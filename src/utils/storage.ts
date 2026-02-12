import type { AppData, BlockRule, ClassRoom } from "../types";
import { cleanName, dedupeNames } from "./normalize";

const STORAGE_KEY = "lagbyggare:data";
const CURRENT_VERSION = 1;

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
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

const sanitizeClassRoom = (value: unknown, index: number): ClassRoom => {
  const objectValue = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const studentsRaw = Array.isArray(objectValue.students) ? objectValue.students : [];
  const studentStrings = studentsRaw.map((name) => cleanName(String(name)));
  const { unique } = dedupeNames(studentStrings);

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

const migrateToV1 = (raw: unknown): AppData => {
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

  const rawValue = localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return createEmptyData();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return migrateToV1(parsed);
  } catch {
    return createEmptyData();
  }
};

export const saveAppData = (data: AppData): void => {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const createClassRoom = (name: string): ClassRoom => ({
  id: createId(),
  name: cleanName(name),
  students: [],
  blocks: []
});
