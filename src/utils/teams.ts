import type { BlockRule, Student, TeamGenerationResult } from "../types";
import { dedupeStudents, makePairKey, normalizeName } from "./normalize";

interface BlockValidation {
  adjacency: Map<string, Set<string>>;
  invalidMissing: BlockRule[];
  invalidSelf: BlockRule[];
}

interface TeamState {
  members: Student[];
  keys: string[];
  skillSum: number;
  girls: number;
  boys: number;
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

const calculateDistribution = (count: number, buckets: number): number[] => {
  const base = Math.floor(count / buckets);
  const remainder = count % buckets;
  return Array.from({ length: buckets }, (_, index) => (index < remainder ? base + 1 : base));
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

const hasBlockConflict = (studentKey: string, teamKeys: string[], adjacency: Map<string, Set<string>>): boolean => {
  const blocked = adjacency.get(studentKey);
  if (!blocked || blocked.size === 0) {
    return false;
  }

  for (const member of teamKeys) {
    if (blocked.has(member)) {
      return true;
    }
  }

  return false;
};

const getTeamScore = (
  team: TeamState,
  student: Student,
  teamIndex: number,
  targetSize: number,
  idealSkill: number,
  targetGirls: number[],
  targetBoys: number[]
): number => {
  const nextSize = team.members.length + 1;
  const nextSkill = team.skillSum + student.level;
  const skillPenalty = Math.abs(nextSkill - idealSkill);
  const sizePenalty = nextSize / targetSize;

  let genderPenalty = 0;
  if (student.gender === "tjej") {
    const projected = team.girls + 1;
    const target = targetGirls[teamIndex] ?? 0;
    genderPenalty += projected > target ? (projected - target) * 8 : Math.abs(projected - target) * 0.4;
  }

  if (student.gender === "kille") {
    const projected = team.boys + 1;
    const target = targetBoys[teamIndex] ?? 0;
    genderPenalty += projected > target ? (projected - target) * 8 : Math.abs(projected - target) * 0.4;
  }

  return skillPenalty * 1.3 + sizePenalty + genderPenalty;
};

const pickTeamIndex = (
  student: Student,
  studentKey: string,
  teams: TeamState[],
  targetSizes: number[],
  idealSkill: number,
  targetGirls: number[],
  targetBoys: number[],
  adjacency: Map<string, Set<string>>
): number | null => {
  let bestScore = Number.POSITIVE_INFINITY;
  let bestIndexes: number[] = [];

  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    const targetSize = targetSizes[i];
    if (!team || targetSize === undefined) {
      continue;
    }

    if (team.members.length >= targetSize) {
      continue;
    }

    if (hasBlockConflict(studentKey, team.keys, adjacency)) {
      continue;
    }

    const score = getTeamScore(team, student, i, targetSize, idealSkill, targetGirls, targetBoys);
    if (score < bestScore) {
      bestScore = score;
      bestIndexes = [i];
      continue;
    }

    if (Math.abs(score - bestScore) < 0.0001) {
      bestIndexes.push(i);
    }
  }

  if (bestIndexes.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * bestIndexes.length);
  return bestIndexes[randomIndex] ?? null;
};

export const generateTeams = (
  studentsInput: Student[],
  blocks: BlockRule[],
  teamCount: number,
  maxAttempts = 2000
): TeamGenerationResult => {
  const { unique: students, duplicates } = dedupeStudents(studentsInput);

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

  const normalized = students.map((student) => ({
    ...student,
    key: normalizeName(student.name)
  }));

  const studentKeys = normalized.map((student) => student.key);
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

  const totalSkill = normalized.reduce((sum, student) => sum + student.level, 0);
  const idealSkill = totalSkill / teamCount;
  const totalGirls = normalized.filter((student) => student.gender === "tjej").length;
  const totalBoys = normalized.filter((student) => student.gender === "kille").length;

  const targetSizes = calculateDistribution(normalized.length, teamCount);
  const targetGirls = calculateDistribution(totalGirls, teamCount);
  const targetBoys = calculateDistribution(totalBoys, teamCount);

  const attemptLimit = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    const randomOrder = fisherYatesShuffle(normalized);
    const ordered = [...randomOrder].sort((a, b) => {
      const aDegree = adjacency.get(a.key)?.size ?? 0;
      const bDegree = adjacency.get(b.key)?.size ?? 0;
      if (bDegree !== aDegree) {
        return bDegree - aDegree;
      }

      if (b.level !== a.level) {
        return b.level - a.level;
      }

      return 0;
    });

    const teams: TeamState[] = Array.from({ length: teamCount }, () => ({
      members: [],
      keys: [],
      skillSum: 0,
      girls: 0,
      boys: 0
    }));

    let failedAttempt = false;
    for (const student of ordered) {
      const teamIndex = pickTeamIndex(
        student,
        student.key,
        teams,
        targetSizes,
        idealSkill,
        targetGirls,
        targetBoys,
        adjacency
      );

      if (teamIndex === null) {
        failedAttempt = true;
        break;
      }

      const team = teams[teamIndex];
      if (!team) {
        failedAttempt = true;
        break;
      }

      team.keys.push(student.key);
      team.members.push({
        name: student.name,
        level: student.level,
        gender: student.gender
      });
      team.skillSum += student.level;
      if (student.gender === "tjej") {
        team.girls += 1;
      }
      if (student.gender === "kille") {
        team.boys += 1;
      }
    }

    if (failedAttempt) {
      continue;
    }

    return {
      ok: true,
      attempts: attempt,
      teams: teams.map((team) => team.members)
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

export const formatTeamsAsText = (teams: Student[][]): string =>
  teams
    .map((team, index) => {
      const members = team.map((student) => `- ${student.name} (nivå ${student.level}, ${student.gender})`).join("\n");
      return `Lag ${index + 1}\n${members}`;
    })
    .join("\n\n");

export const summarizeTeam = (team: Student[]): string => {
  const totalSkill = team.reduce((sum, student) => sum + student.level, 0);
  const girls = team.filter((student) => student.gender === "tjej").length;
  const boys = team.filter((student) => student.gender === "kille").length;
  return `Nivåsumma: ${totalSkill} • Tjejer: ${girls} • Killar: ${boys}`;
};
