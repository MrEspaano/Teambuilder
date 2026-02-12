import type { BlockRule, TeamGenerationResult } from "../types";
import { dedupeNames, makePairKey, normalizeName } from "./normalize";

interface BlockValidation {
  adjacency: Map<string, Set<string>>;
  invalidMissing: BlockRule[];
  invalidSelf: BlockRule[];
}

const fisherYatesShuffle = <T>(items: T[]): T[] => {
  const values = [...items];
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = values[i] as T;
    values[i] = values[j] as T;
    values[j] = current;
  }
  return values;
};

const calculateTeamSizes = (studentCount: number, teamCount: number): number[] => {
  const baseSize = Math.floor(studentCount / teamCount);
  const remainder = studentCount % teamCount;
  return Array.from({ length: teamCount }, (_, index) => (index < remainder ? baseSize + 1 : baseSize));
};

const buildBlockValidation = (studentKeys: Set<string>, blocks: BlockRule[]): BlockValidation => {
  const adjacency = new Map<string, Set<string>>();
  const invalidMissing: BlockRule[] = [];
  const invalidSelf: BlockRule[] = [];
  const pairSeen = new Set<string>();

  for (const key of studentKeys) {
    adjacency.set(key, new Set<string>());
  }

  for (const block of blocks) {
    const a = normalizeName(block.a);
    const b = normalizeName(block.b);

    if (!a || !b) {
      continue;
    }

    if (a === b) {
      invalidSelf.push(block);
      continue;
    }

    if (!studentKeys.has(a) || !studentKeys.has(b)) {
      invalidMissing.push(block);
      continue;
    }

    const pairKey = makePairKey(a, b);
    if (pairSeen.has(pairKey)) {
      continue;
    }

    pairSeen.add(pairKey);
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }

  return { adjacency, invalidMissing, invalidSelf };
};

const hasBlockConflict = (studentKey: string, team: string[], adjacency: Map<string, Set<string>>): boolean => {
  const blocked = adjacency.get(studentKey);
  if (!blocked || blocked.size === 0) {
    return false;
  }

  for (const member of team) {
    if (blocked.has(member)) {
      return true;
    }
  }

  return false;
};

const pickTeamIndex = (
  studentKey: string,
  teams: string[][],
  targetSizes: number[],
  adjacency: Map<string, Set<string>>
): number | null => {
  const candidateIndices: number[] = [];
  let smallestTeamSize = Number.POSITIVE_INFINITY;

  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    const targetSize = targetSizes[i];
    if (!team || targetSize === undefined) {
      continue;
    }

    if (team.length >= targetSize) {
      continue;
    }

    if (hasBlockConflict(studentKey, team, adjacency)) {
      continue;
    }

    smallestTeamSize = Math.min(smallestTeamSize, team.length);
    candidateIndices.push(i);
  }

  if (candidateIndices.length === 0) {
    return null;
  }

  const bestCandidates = candidateIndices.filter((index) => {
    const team = teams[index];
    return team !== undefined && team.length === smallestTeamSize;
  });

  const selectedPool = bestCandidates.length > 0 ? bestCandidates : candidateIndices;
  const randomIndex = Math.floor(Math.random() * selectedPool.length);
  return selectedPool[randomIndex] ?? null;
};

export const generateTeams = (
  studentsInput: string[],
  blocks: BlockRule[],
  teamCount: number,
  maxAttempts = 2000
): TeamGenerationResult => {
  const { unique: students, duplicates } = dedupeNames(studentsInput);

  if (duplicates.length > 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: `Dubbla elevnamn hittades: ${duplicates.join(", ")}.`,
        suggestion: "Ta bort dubletter i elevlistan och försök igen."
      }
    };
  }

  if (students.length === 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Elevlistan är tom.",
        suggestion: "Lägg till elever i klassen innan du genererar lag."
      }
    };
  }

  if (teamCount < 2 || teamCount > 10) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Antal lag måste vara mellan 2 och 10.",
        suggestion: "Ange ett giltigt antal lag och försök igen."
      }
    };
  }

  if (teamCount > students.length) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Antal lag kan inte vara större än antal elever.",
        suggestion: "Minska antal lag eller lägg till fler elever."
      }
    };
  }

  const studentKeyToName = new Map<string, string>();
  for (const student of students) {
    studentKeyToName.set(normalizeName(student), student);
  }

  const studentKeys = [...studentKeyToName.keys()];
  const studentKeySet = new Set(studentKeys);
  const { adjacency, invalidMissing, invalidSelf } = buildBlockValidation(studentKeySet, blocks);

  if (invalidSelf.length > 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Minst en blockering har samma elev på båda sidor.",
        suggestion: "Ta bort ogiltiga blockeringar och försök igen."
      }
    };
  }

  if (invalidMissing.length > 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Det finns blockeringar med elever som inte längre finns i klassen.",
        suggestion: "Rensa ogiltiga blockeringar och försök igen."
      }
    };
  }

  const targetSizes = calculateTeamSizes(students.length, teamCount);
  const attemptLimit = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    const order = fisherYatesShuffle(studentKeys);
    const teams = Array.from({ length: teamCount }, () => [] as string[]);
    let failedAttempt = false;

    for (const studentKey of order) {
      const teamIndex = pickTeamIndex(studentKey, teams, targetSizes, adjacency);
      if (teamIndex === null) {
        failedAttempt = true;
        break;
      }

      teams[teamIndex]?.push(studentKey);
    }

    if (failedAttempt) {
      continue;
    }

    return {
      ok: true,
      attempts: attempt,
      teams: teams.map((team) => team.map((studentKey) => studentKeyToName.get(studentKey) ?? studentKey))
    };
  }

  return {
    ok: false,
    attempts: attemptLimit,
    error: {
      message: "Det gick inte att skapa en giltig lagindelning med nuvarande regler.",
      suggestion: "Öka antal lag eller ta bort vissa blockeringar och försök igen."
    }
  };
};

export const formatTeamsAsText = (teams: string[][]): string =>
  teams
    .map((team, index) => {
      const members = team.map((name) => `- ${name}`).join("\n");
      return `Lag ${index + 1}\n${members}`;
    })
    .join("\n\n");
