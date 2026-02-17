import type { AppData, BlockRule, ClassRoom, Student, StudentGender, StudentLevel } from "../types";
import { cleanName, dedupeStudents } from "./normalize";

const STORAGE_KEY = "lagbyggare:data";
const CURRENT_VERSION = 2;

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
};

const sanitizeLevel = (value: unknown): StudentLevel => {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed;
  }

  return 2;
};

const sanitizeGender = (value: unknown): StudentGender => {
  const raw = cleanName(String(value ?? "")).toLocaleLowerCase("sv-SE");
  if (raw === "tjej" || raw === "kille" || raw === "okänd") {
    return raw;
  }

  return "okänd";
};

const sanitizeStudent = (value: unknown): Student | null => {
  if (typeof value === "string") {
    const name = cleanName(value);
    if (!name) {
      return null;
    }

    return {
      name,
      level: 2,
      gender: "okänd"
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const objectValue = value as Record<string, unknown>;
  const name = cleanName(String(objectValue.name ?? ""));
  if (!name) {
    return null;
  }

  return {
    name,
    level: sanitizeLevel(objectValue.level),
    gender: sanitizeGender(objectValue.gender)
  };
};

const sanitizeBlocks = (value: unknown): BlockRule[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: BlockRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const a = cleanName(String((item as { a?: unknown }).a ?? ""));
    const b = cleanName(String((item as { b?: unknown }).b ?? ""));
    if (!a || !b) {
      continue;
    }

    result.push({ a, b });
  }

  return result;
};

const isStudent = (value: Student | null): value is Student => value !== null;

const sanitizeClassRoom = (value: unknown, index: number): ClassRoom => {
  const objectValue = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const studentsRaw = Array.isArray(objectValue.students) ? objectValue.students : [];
  const studentObjects = studentsRaw.map((student) => sanitizeStudent(student)).filter(isStudent);
  const { unique } = dedupeStudents(studentObjects);

  const id = cleanName(String(objectValue.id ?? "")) || createId();
  const name = cleanName(String(objectValue.name ?? "")) || `Klass ${index + 1}`;

  return {
    id,
    name,
    students: unique,
    blocks: sanitizeBlocks(objectValue.blocks)
  };
};

export const createEmptyData = (): AppData => ({
  version: CURRENT_VERSION,
  activeClassId: null,
  classes: []
});

export const sanitizeAppData = (raw: unknown): AppData => {
  if (!raw || typeof raw !== "object") {
    return createEmptyData();
  }

  const source = raw as Record<string, unknown>;
  const classesRaw = Array.isArray(source.classes) ? source.classes : [];
  const classes = classesRaw.map((classValue, index) => sanitizeClassRoom(classValue, index));

  const requestedActiveId = cleanName(String(source.activeClassId ?? ""));
  const activeExists = classes.some((classRoom) => classRoom.id === requestedActiveId);

  return {
    version: CURRENT_VERSION,
    activeClassId: activeExists ? requestedActiveId : classes[0]?.id ?? null,
    classes
  };
};

export const loadAppData = (): AppData => {
  if (typeof localStorage === "undefined") {
    return createEmptyData();
  }

  let rawValue: string | null = null;
  try {
    rawValue = localStorage.getItem(STORAGE_KEY);
  } catch {
    return createEmptyData();
  }

  if (!rawValue) {
    return createEmptyData();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return sanitizeAppData(parsed);
  } catch {
    return createEmptyData();
  }
};

export const saveAppData = (data: AppData): void => {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage write errors (private mode, blocked storage, quota).
  }
};

export const createClassRoom = (name: string): ClassRoom => ({
  id: createId(),
  name: cleanName(name),
  students: [],
  blocks: []
});
