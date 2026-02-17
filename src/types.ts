export interface BlockRule {
  a: string;
  b: string;
}

export type StudentLevel = 1 | 2 | 3;
export type StudentGender = "tjej" | "kille" | "okänd";

export interface Student {
  name: string;
  level: StudentLevel;
  gender: StudentGender;
  present: boolean;
}

export interface ClassRoom {
  id: string;
  name: string;
  students: Student[];
  blocks: BlockRule[];
  togetherRules: BlockRule[];
}

export interface AppDataV3 {
  version: 3;
  activeClassId: string | null;
  classes: ClassRoom[];
}

export type AppData = AppDataV3;

export interface TeamGenerationError {
  message: string;
  suggestion: string;
}

export interface TeamGenerationSuccess {
  ok: true;
  teams: Student[][];
  attempts: number;
}

export interface TeamGenerationFailure {
  ok: false;
  error: TeamGenerationError;
  attempts: number;
}

export type TeamGenerationResult = TeamGenerationSuccess | TeamGenerationFailure;
