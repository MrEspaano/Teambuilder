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
}

export interface ClassRoom {
  id: string;
  name: string;
  students: Student[];
  blocks: BlockRule[];
}

export interface AppDataV2 {
  version: 2;
  activeClassId: string | null;
  classes: ClassRoom[];
}

export type AppData = AppDataV2;

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
