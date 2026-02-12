export interface BlockRule {
  a: string;
  b: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  students: string[];
  blocks: BlockRule[];
}

export interface AppDataV1 {
  version: 1;
  activeClassId: string | null;
  classes: ClassRoom[];
}

export type AppData = AppDataV1;

export interface TeamGenerationError {
  message: string;
  suggestion: string;
}

export interface TeamGenerationSuccess {
  ok: true;
  teams: string[][];
  attempts: number;
}

export interface TeamGenerationFailure {
  ok: false;
  error: TeamGenerationError;
  attempts: number;
}

export type TeamGenerationResult = TeamGenerationSuccess | TeamGenerationFailure;
