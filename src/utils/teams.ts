import type { BlockRule, Student, StudentLevel, TeamGenerationResult } from "../types";
import { dedupeStudents, makePairKey, normalizeName } from "./normalize";

interface PairValidation {
  adjacency: Map<string, Set<string>>;
  invalidMissing: BlockRule[];
  invalidSelf: BlockRule[];
}

interface StudentNode extends Student {
  key: string;
}

interface StudentGroup {
  id: string;
  members: StudentNode[];
  keys: string[];
  size: number;
  skillSum: number;
  girls: number;
  boys: number;
  levelCounts: Record<StudentLevel, number>;
  degree: number;
}

interface TeamState {
  members: Student[];
  keys: string[];
  groupIds: string[];
  skillSum: number;
  girls: number;
  boys: number;
  levelCounts: Record<StudentLevel, number>;
}

interface TeamQuality {
  levelGap: number;
  levelDeviation: number;
  skillRange: number;
  skillDeviation: number;
  genderDeviation: number;
}

type LevelTargets = Record<StudentLevel, number[]>;

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

const buildPairValidation = (allKeys: Set<string>, presentKeys: Set<string>, rules: BlockRule[]): PairValidation => {
  const adjacency = new Map<string, Set<string>>();
  const invalidMissing: BlockRule[] = [];
  const invalidSelf: BlockRule[] = [];
  const pairSeen = new Set<string>();

  for (const key of presentKeys) {
    adjacency.set(key, new Set<string>());
  }

  for (const rule of rules) {
    const a = normalizeName(rule.a);
    const b = normalizeName(rule.b);

    if (!a || !b) {
      continue;
    }

    if (a === b) {
      invalidSelf.push(rule);
      continue;
    }

    if (!allKeys.has(a) || !allKeys.has(b)) {
      invalidMissing.push(rule);
      continue;
    }

    if (!presentKeys.has(a) || !presentKeys.has(b)) {
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

const createDisjointSet = (keys: string[]) => {
  const parent = new Map<string, string>();
  for (const key of keys) {
    parent.set(key, key);
  }

  const find = (value: string): string => {
    const currentParent = parent.get(value);
    if (!currentParent || currentParent === value) {
      return value;
    }

    const root = find(currentParent);
    parent.set(value, root);
    return root;
  };

  const union = (a: string, b: string): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) {
      return;
    }

    parent.set(rootB, rootA);
  };

  return { find, union };
};

const buildStudentGroups = (students: StudentNode[], togetherAdjacency: Map<string, Set<string>>): StudentGroup[] => {
  const keys = students.map((student) => student.key);
  const disjointSet = createDisjointSet(keys);

  for (const [key, linked] of togetherAdjacency) {
    for (const other of linked) {
      disjointSet.union(key, other);
    }
  }

  const groupsByRoot = new Map<string, StudentNode[]>();
  for (const student of students) {
    const root = disjointSet.find(student.key);
    const group = groupsByRoot.get(root) ?? [];
    group.push(student);
    groupsByRoot.set(root, group);
  }

  const groups: StudentGroup[] = [];
  for (const [root, members] of groupsByRoot) {
    const skillSum = members.reduce((sum, student) => sum + student.level, 0);
    const girls = members.filter((student) => student.gender === "tjej").length;
    const boys = members.filter((student) => student.gender === "kille").length;
    const levelCounts: Record<StudentLevel, number> = { 1: 0, 2: 0, 3: 0 };
    for (const member of members) {
      levelCounts[member.level] += 1;
    }

    groups.push({
      id: root,
      members,
      keys: members.map((student) => student.key),
      size: members.length,
      skillSum,
      girls,
      boys,
      levelCounts,
      degree: 0
    });
  }

  return groups;
};

const buildGroupAdjacency = (groups: StudentGroup[], pairAdjacency: Map<string, Set<string>>): Map<string, Set<string>> => {
  const adjacency = new Map<string, Set<string>>();
  const keyToGroupId = new Map<string, string>();

  for (const group of groups) {
    adjacency.set(group.id, new Set<string>());
    for (const key of group.keys) {
      keyToGroupId.set(key, group.id);
    }
  }

  for (const [key, conflicts] of pairAdjacency) {
    const groupId = keyToGroupId.get(key);
    if (!groupId) {
      continue;
    }

    for (const conflictKey of conflicts) {
      const otherGroupId = keyToGroupId.get(conflictKey);
      if (!otherGroupId || otherGroupId === groupId) {
        continue;
      }

      adjacency.get(groupId)?.add(otherGroupId);
      adjacency.get(otherGroupId)?.add(groupId);
    }
  }

  return adjacency;
};

const findInternalConflict = (
  groups: StudentGroup[],
  blockAdjacency: Map<string, Set<string>>,
  keyToName: Map<string, string>
): { a: string; b: string } | null => {
  for (const group of groups) {
    const keySet = new Set(group.keys);

    for (const key of group.keys) {
      const blocked = blockAdjacency.get(key);
      if (!blocked) {
        continue;
      }

      for (const other of blocked) {
        if (!keySet.has(other)) {
          continue;
        }

        const aName = keyToName.get(key) ?? key;
        const bName = keyToName.get(other) ?? other;
        if (aName <= bName) {
          return { a: aName, b: bName };
        }

        return { a: bName, b: aName };
      }
    }
  }

  return null;
};

const hasGroupConflict = (
  groupId: string,
  teamGroupIds: string[],
  groupAdjacency: Map<string, Set<string>>
): boolean => {
  const blockedGroups = groupAdjacency.get(groupId);
  if (!blockedGroups || blockedGroups.size === 0) {
    return false;
  }

  for (const teamGroupId of teamGroupIds) {
    if (blockedGroups.has(teamGroupId)) {
      return true;
    }
  }

  return false;
};

const getTeamScore = (
  team: TeamState,
  group: StudentGroup,
  teamIndex: number,
  targetSize: number,
  idealSkill: number,
  targetGirls: number[],
  targetBoys: number[],
  levelTargets: LevelTargets
): number => {
  const nextSize = team.members.length + group.size;
  const nextSkill = team.skillSum + group.skillSum;
  const skillPenalty = Math.abs(nextSkill - idealSkill);
  const sizePenalty = nextSize / targetSize;

  const projectedGirls = team.girls + group.girls;
  const projectedBoys = team.boys + group.boys;
  const targetGirlCount = targetGirls[teamIndex] ?? 0;
  const targetBoyCount = targetBoys[teamIndex] ?? 0;

  const girlPenalty =
    projectedGirls > targetGirlCount
      ? (projectedGirls - targetGirlCount) * 8
      : Math.abs(projectedGirls - targetGirlCount) * 0.4;

  const boyPenalty =
    projectedBoys > targetBoyCount
      ? (projectedBoys - targetBoyCount) * 8
      : Math.abs(projectedBoys - targetBoyCount) * 0.4;

  let levelPenalty = 0;
  for (const level of [1, 2, 3] as const) {
    const projected = team.levelCounts[level] + group.levelCounts[level];
    const target = levelTargets[level][teamIndex] ?? 0;
    levelPenalty += projected > target ? (projected - target) * 9 : Math.abs(projected - target) * 0.8;
  }

  // Prioritize level balance first, then size/gender fit.
  return skillPenalty * 4.2 + levelPenalty * 2.6 + sizePenalty * 0.4 + girlPenalty + boyPenalty;
};

const evaluateTeams = (
  teams: TeamState[],
  idealSkill: number,
  targetGirls: number[],
  targetBoys: number[],
  levelTargets: LevelTargets
): TeamQuality => {
  if (teams.length === 0) {
    return {
      levelGap: Number.POSITIVE_INFINITY,
      levelDeviation: Number.POSITIVE_INFINITY,
      skillRange: Number.POSITIVE_INFINITY,
      skillDeviation: Number.POSITIVE_INFINITY,
      genderDeviation: Number.POSITIVE_INFINITY
    };
  }

  const skillSums = teams.map((team) => team.skillSum);
  const minSkill = Math.min(...skillSums);
  const maxSkill = Math.max(...skillSums);
  const skillRange = maxSkill - minSkill;
  const skillDeviation = teams.reduce((sum, team) => sum + Math.abs(team.skillSum - idealSkill), 0);

  let levelGap = 0;
  let levelDeviation = 0;
  for (const level of [1, 2, 3] as const) {
    const counts = teams.map((team) => team.levelCounts[level]);
    const minLevel = Math.min(...counts);
    const maxLevel = Math.max(...counts);
    levelGap = Math.max(levelGap, maxLevel - minLevel);

    for (let i = 0; i < teams.length; i += 1) {
      const target = levelTargets[level][i] ?? 0;
      const current = counts[i] ?? 0;
      levelDeviation += Math.abs(current - target);
    }
  }

  const genderDeviation = teams.reduce((sum, team, index) => {
    const girlTarget = targetGirls[index] ?? 0;
    const boyTarget = targetBoys[index] ?? 0;
    return sum + Math.abs(team.girls - girlTarget) + Math.abs(team.boys - boyTarget);
  }, 0);

  return {
    levelGap,
    levelDeviation,
    skillRange,
    skillDeviation,
    genderDeviation
  };
};

const isBetterQuality = (candidate: TeamQuality, best: TeamQuality): boolean => {
  if (candidate.levelGap !== best.levelGap) {
    return candidate.levelGap < best.levelGap;
  }

  if (candidate.levelDeviation !== best.levelDeviation) {
    return candidate.levelDeviation < best.levelDeviation;
  }

  if (candidate.skillRange !== best.skillRange) {
    return candidate.skillRange < best.skillRange;
  }

  if (candidate.skillDeviation !== best.skillDeviation) {
    return candidate.skillDeviation < best.skillDeviation;
  }

  if (candidate.genderDeviation !== best.genderDeviation) {
    return candidate.genderDeviation < best.genderDeviation;
  }

  return false;
};

const buildTeamStateFromGroupIds = (groupIds: string[], groupById: Map<string, StudentGroup>): TeamState => {
  const team: TeamState = {
    members: [],
    keys: [],
    groupIds: [...groupIds],
    skillSum: 0,
    girls: 0,
    boys: 0,
    levelCounts: { 1: 0, 2: 0, 3: 0 }
  };

  for (const groupId of groupIds) {
    const group = groupById.get(groupId);
    if (!group) {
      continue;
    }

    team.keys.push(...group.keys);
    team.members.push(
      ...group.members.map((member) => ({
        name: member.name,
        level: member.level,
        gender: member.gender,
        present: true
      }))
    );
    team.skillSum += group.skillSum;
    team.girls += group.girls;
    team.boys += group.boys;
    team.levelCounts[1] += group.levelCounts[1];
    team.levelCounts[2] += group.levelCounts[2];
    team.levelCounts[3] += group.levelCounts[3];
  }

  return team;
};

const optimizeTeamsByLocalSearch = (
  initialTeams: TeamState[],
  groupById: Map<string, StudentGroup>,
  targetSizes: number[],
  groupAdjacency: Map<string, Set<string>>,
  idealSkill: number,
  targetGirls: number[],
  targetBoys: number[],
  levelTargets: LevelTargets,
  maxIterations = 120
): TeamState[] => {
  let currentTeams = initialTeams.map((team) => ({ ...team, groupIds: [...team.groupIds], keys: [...team.keys], members: [...team.members] }));
  let currentQuality = evaluateTeams(currentTeams, idealSkill, targetGirls, targetBoys, levelTargets);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let bestNeighborTeams: TeamState[] | null = null;
    let bestNeighborQuality: TeamQuality | null = null;

    for (let fromIndex = 0; fromIndex < currentTeams.length; fromIndex += 1) {
      const fromTeam = currentTeams[fromIndex];
      if (!fromTeam) {
        continue;
      }

      for (const movingGroupId of fromTeam.groupIds) {
        const movingGroup = groupById.get(movingGroupId);
        if (!movingGroup) {
          continue;
        }

        for (let toIndex = 0; toIndex < currentTeams.length; toIndex += 1) {
          if (toIndex === fromIndex) {
            continue;
          }

          const toTeam = currentTeams[toIndex];
          const toTargetSize = targetSizes[toIndex] ?? 0;
          if (!toTeam || toTeam.members.length + movingGroup.size > toTargetSize) {
            continue;
          }

          if (hasGroupConflict(movingGroupId, toTeam.groupIds, groupAdjacency)) {
            continue;
          }

          const candidateGroupIds = currentTeams.map((team) => [...team.groupIds]);
          candidateGroupIds[fromIndex] = candidateGroupIds[fromIndex]?.filter((id) => id !== movingGroupId) ?? [];
          candidateGroupIds[toIndex] = [...(candidateGroupIds[toIndex] ?? []), movingGroupId];

          const candidateTeams = candidateGroupIds.map((groupIds) => buildTeamStateFromGroupIds(groupIds, groupById));
          const candidateQuality = evaluateTeams(candidateTeams, idealSkill, targetGirls, targetBoys, levelTargets);
          if (
            !bestNeighborQuality ||
            isBetterQuality(candidateQuality, bestNeighborQuality)
          ) {
            bestNeighborTeams = candidateTeams;
            bestNeighborQuality = candidateQuality;
          }
        }

        for (let otherIndex = fromIndex + 1; otherIndex < currentTeams.length; otherIndex += 1) {
          const otherTeam = currentTeams[otherIndex];
          if (!otherTeam) {
            continue;
          }

          for (const swapGroupId of otherTeam.groupIds) {
            const swapGroup = groupById.get(swapGroupId);
            if (!swapGroup) {
              continue;
            }

            const fromTargetSize = targetSizes[fromIndex] ?? 0;
            const otherTargetSize = targetSizes[otherIndex] ?? 0;
            const projectedFromSize = fromTeam.members.length - movingGroup.size + swapGroup.size;
            const projectedOtherSize = otherTeam.members.length - swapGroup.size + movingGroup.size;
            if (projectedFromSize > fromTargetSize || projectedOtherSize > otherTargetSize) {
              continue;
            }

            const fromWithout = fromTeam.groupIds.filter((id) => id !== movingGroupId);
            const otherWithout = otherTeam.groupIds.filter((id) => id !== swapGroupId);

            if (hasGroupConflict(swapGroupId, fromWithout, groupAdjacency)) {
              continue;
            }
            if (hasGroupConflict(movingGroupId, otherWithout, groupAdjacency)) {
              continue;
            }

            const candidateGroupIds = currentTeams.map((team) => [...team.groupIds]);
            candidateGroupIds[fromIndex] = [...fromWithout, swapGroupId];
            candidateGroupIds[otherIndex] = [...otherWithout, movingGroupId];

            const candidateTeams = candidateGroupIds.map((groupIds) => buildTeamStateFromGroupIds(groupIds, groupById));
            const candidateQuality = evaluateTeams(candidateTeams, idealSkill, targetGirls, targetBoys, levelTargets);
            if (
              !bestNeighborQuality ||
              isBetterQuality(candidateQuality, bestNeighborQuality)
            ) {
              bestNeighborTeams = candidateTeams;
              bestNeighborQuality = candidateQuality;
            }
          }
        }
      }
    }

    if (!bestNeighborTeams || !bestNeighborQuality || !isBetterQuality(bestNeighborQuality, currentQuality)) {
      break;
    }

    currentTeams = bestNeighborTeams;
    currentQuality = bestNeighborQuality;
  }

  return currentTeams;
};

const pickTeamIndex = (
  group: StudentGroup,
  teams: TeamState[],
  targetSizes: number[],
  idealSkill: number,
  targetGirls: number[],
  targetBoys: number[],
  groupAdjacency: Map<string, Set<string>>,
  levelTargets: LevelTargets
): number | null => {
  let bestScore = Number.POSITIVE_INFINITY;
  let bestIndexes: number[] = [];

  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    const targetSize = targetSizes[i];
    if (!team || targetSize === undefined) {
      continue;
    }

    if (team.members.length + group.size > targetSize) {
      continue;
    }

    if (hasGroupConflict(group.id, team.groupIds, groupAdjacency)) {
      continue;
    }

    const score = getTeamScore(team, group, i, targetSize, idealSkill, targetGirls, targetBoys, levelTargets);
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
  togetherRules: BlockRule[],
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

  const presentStudents = students.filter((student) => student.present);

  if (presentStudents.length === 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Inga elever är markerade som närvarande.",
        suggestion: "Markera närvarande elever i elevlistan innan du genererar lag."
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

  if (teamCount > presentStudents.length) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Antal lag kan inte vara större än antal närvarande elever.",
        suggestion: "Minska antal lag eller markera fler elever som närvarande."
      }
    };
  }

  const normalizedAll = students.map((student) => ({
    ...student,
    key: normalizeName(student.name)
  }));
  const normalizedPresent = normalizedAll.filter((student) => student.present);

  const allKeySet = new Set(normalizedAll.map((student) => student.key));
  const presentKeySet = new Set(normalizedPresent.map((student) => student.key));

  const blockValidation = buildPairValidation(allKeySet, presentKeySet, blocks);
  const togetherValidation = buildPairValidation(allKeySet, presentKeySet, togetherRules);

  if (blockValidation.invalidSelf.length > 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Minst en spärr har samma elev på båda sidor.",
        suggestion: "Ta bort ogiltiga spärrar och försök igen."
      }
    };
  }

  if (togetherValidation.invalidSelf.length > 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Minst en samma-lag-regel har samma elev på båda sidor.",
        suggestion: "Ta bort ogiltiga samma-lag-regler och försök igen."
      }
    };
  }

  if (blockValidation.invalidMissing.length > 0 || togetherValidation.invalidMissing.length > 0) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "Det finns regler med elever som inte längre finns i klassen.",
        suggestion: "Rensa ogiltiga regler och försök igen."
      }
    };
  }

  const targetSizes = calculateDistribution(normalizedPresent.length, teamCount);
  const maxTargetSize = Math.max(...targetSizes);

  const groups = buildStudentGroups(normalizedPresent, togetherValidation.adjacency);

  if (groups.some((group) => group.size > maxTargetSize)) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: "En samma-lag-regel skapar en grupp som är större än ett helt lag.",
        suggestion: "Minska antal lag eller ta bort vissa samma-lag-regler."
      }
    };
  }

  const keyToName = new Map(normalizedPresent.map((student) => [student.key, student.name] as const));
  const internalConflict = findInternalConflict(groups, blockValidation.adjacency, keyToName);
  if (internalConflict) {
    return {
      ok: false,
      attempts: 0,
      error: {
        message: `Regelkonflikt: ${internalConflict.a} och ${internalConflict.b} är både spärrade och låsta till samma lag.`,
        suggestion: "Ta bort den ena regeln och försök igen."
      }
    };
  }

  const groupAdjacency = buildGroupAdjacency(groups, blockValidation.adjacency);
  const groupsWithDegree = groups.map((group) => ({
    ...group,
    degree: groupAdjacency.get(group.id)?.size ?? 0
  }));
  const groupById = new Map(groupsWithDegree.map((group) => [group.id, group] as const));

  const totalSkill = normalizedPresent.reduce((sum, student) => sum + student.level, 0);
  const idealSkill = totalSkill / teamCount;
  const totalGirls = normalizedPresent.filter((student) => student.gender === "tjej").length;
  const totalBoys = normalizedPresent.filter((student) => student.gender === "kille").length;
  const totalLevel1 = normalizedPresent.filter((student) => student.level === 1).length;
  const totalLevel2 = normalizedPresent.filter((student) => student.level === 2).length;
  const totalLevel3 = normalizedPresent.filter((student) => student.level === 3).length;

  const targetGirls = calculateDistribution(totalGirls, teamCount);
  const targetBoys = calculateDistribution(totalBoys, teamCount);
  const levelTargets: LevelTargets = {
    1: calculateDistribution(totalLevel1, teamCount),
    2: calculateDistribution(totalLevel2, teamCount),
    3: calculateDistribution(totalLevel3, teamCount)
  };

  const attemptLimit = Math.max(1, maxAttempts);
  let bestTeams: Student[][] | null = null;
  let bestQuality: TeamQuality | null = null;
  let bestAttempt = 0;

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    const randomOrder = fisherYatesShuffle(groupsWithDegree);
    const ordered = [...randomOrder].sort((a, b) => {
      if (b.degree !== a.degree) {
        return b.degree - a.degree;
      }

      if (b.size !== a.size) {
        return b.size - a.size;
      }

      if (b.skillSum !== a.skillSum) {
        return b.skillSum - a.skillSum;
      }

      return 0;
    });

    const teams: TeamState[] = Array.from({ length: teamCount }, () => ({
      members: [],
      keys: [],
      groupIds: [],
      skillSum: 0,
      girls: 0,
      boys: 0,
      levelCounts: { 1: 0, 2: 0, 3: 0 }
    }));

    let failedAttempt = false;
    for (const group of ordered) {
      const teamIndex = pickTeamIndex(
        group,
        teams,
        targetSizes,
        idealSkill,
        targetGirls,
        targetBoys,
        groupAdjacency,
        levelTargets
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

      team.groupIds.push(group.id);
      team.keys.push(...group.keys);
      team.members.push(
        ...group.members.map((member) => ({
          name: member.name,
          level: member.level,
          gender: member.gender,
          present: true
        }))
      );
      team.skillSum += group.skillSum;
      team.girls += group.girls;
      team.boys += group.boys;
      team.levelCounts[1] += group.levelCounts[1];
      team.levelCounts[2] += group.levelCounts[2];
      team.levelCounts[3] += group.levelCounts[3];
    }

    if (failedAttempt) {
      continue;
    }

    const optimizedTeams = optimizeTeamsByLocalSearch(
      teams,
      groupById,
      targetSizes,
      groupAdjacency,
      idealSkill,
      targetGirls,
      targetBoys,
      levelTargets
    );
    const quality = evaluateTeams(optimizedTeams, idealSkill, targetGirls, targetBoys, levelTargets);
    if (!bestQuality || !bestTeams || isBetterQuality(quality, bestQuality)) {
      bestQuality = quality;
      bestTeams = optimizedTeams.map((team) => team.members);
      bestAttempt = attempt;
    }

    // Perfect level balance found; no reason to continue searching.
    if (quality.levelGap === 0 && quality.levelDeviation === 0 && quality.skillRange === 0 && quality.skillDeviation === 0) {
      break;
    }
  }

  if (bestTeams) {
    return {
      ok: true,
      attempts: bestAttempt,
      teams: bestTeams
    };
  }

  return {
    ok: false,
    attempts: attemptLimit,
    error: {
      message: "Det gick inte att skapa en giltig lagindelning med nuvarande regler.",
      suggestion: "Minska antal lag eller justera spärrar/samma-lag-regler och försök igen."
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
