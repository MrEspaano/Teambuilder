import type { Student } from "../types";

export const cleanName = (value: string): string => value.trim();

export const normalizeName = (value: string): string => cleanName(value).toLocaleLowerCase("sv-SE");

export const areSameName = (a: string, b: string): boolean => normalizeName(a) === normalizeName(b);

export const parseNameLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => cleanName(line))
    .filter((line) => line.length > 0);

export interface DedupeResult {
  unique: string[];
  duplicates: string[];
}

export interface DedupeStudentsResult {
  unique: Student[];
  duplicates: string[];
}

export const dedupeNames = (names: string[]): DedupeResult => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const unique: string[] = [];

  for (const name of names) {
    const cleaned = cleanName(name);
    if (!cleaned) {
      continue;
    }

    const key = normalizeName(cleaned);
    if (seen.has(key)) {
      duplicates.add(cleaned);
      continue;
    }

    seen.add(key);
    unique.push(cleaned);
  }

  return {
    unique,
    duplicates: [...duplicates]
  };
};

export const dedupeStudents = (students: Student[]): DedupeStudentsResult => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const unique: Student[] = [];

  for (const student of students) {
    const cleanedName = cleanName(student.name);
    if (!cleanedName) {
      continue;
    }

    const key = normalizeName(cleanedName);
    if (seen.has(key)) {
      duplicates.add(cleanedName);
      continue;
    }

    seen.add(key);
    unique.push({
      ...student,
      name: cleanedName
    });
  }

  return {
    unique,
    duplicates: [...duplicates]
  };
};

export const makePairKey = (a: string, b: string): string => {
  const first = normalizeName(a);
  const second = normalizeName(b);
  return first < second ? `${first}||${second}` : `${second}||${first}`;
};
