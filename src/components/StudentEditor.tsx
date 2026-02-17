import { useEffect, useMemo, useState } from "react";
import type { ClassRoom, Student, StudentGender, StudentLevel } from "../types";
import { dedupeNames, normalizeName, parseNameLines } from "../utils/normalize";

interface StudentEditorProps {
  classData: ClassRoom | null;
  onStudentsChange: (classId: string, students: Student[]) => void;
}

type Message = {
  type: "error" | "success";
  text: string;
};

const DEFAULT_LEVEL: StudentLevel = 2;
const DEFAULT_GENDER: StudentGender = "okänd";

const createStudent = (name: string, level: StudentLevel, gender: StudentGender): Student => ({
  name: name.trim(),
  level,
  gender
});

const StudentEditor = ({ classData, onStudentsChange }: StudentEditorProps) => {
  const [draftText, setDraftText] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickLevel, setQuickLevel] = useState<StudentLevel>(DEFAULT_LEVEL);
  const [quickGender, setQuickGender] = useState<StudentGender>(DEFAULT_GENDER);
  const [bulkLevel, setBulkLevel] = useState<StudentLevel>(DEFAULT_LEVEL);
  const [bulkGender, setBulkGender] = useState<StudentGender>(DEFAULT_GENDER);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    const names = classData?.students.map((student) => student.name).join("\n") ?? "";
    setDraftText(names);
    setQuickName("");
    setQuickLevel(DEFAULT_LEVEL);
    setQuickGender(DEFAULT_GENDER);
    setBulkLevel(DEFAULT_LEVEL);
    setBulkGender(DEFAULT_GENDER);
    setMessage(null);
  }, [classData?.id, classData?.students]);

  const genderCount = useMemo(() => {
    if (!classData) {
      return { tjej: 0, kille: 0, okänd: 0 };
    }

    return classData.students.reduce(
      (acc, student) => {
        acc[student.gender] += 1;
        return acc;
      },
      { tjej: 0, kille: 0, okänd: 0 } as Record<StudentGender, number>
    );
  }, [classData]);

  if (!classData) {
    return (
      <section>
        <h2>Elever</h2>
        <p className="empty-state">Välj en klass för att lägga in elever.</p>
      </section>
    );
  }

  const saveStudents = (students: Student[]) => {
    onStudentsChange(classData.id, students);
    setDraftText(students.map((student) => student.name).join("\n"));
  };

  const hasDuplicateName = (students: Student[], name: string, ignoreIndex: number | null): boolean => {
    const normalized = normalizeName(name);
    return students.some((student, index) => index !== ignoreIndex && normalizeName(student.name) === normalized);
  };

  const handleSaveList = () => {
    const parsed = parseNameLines(draftText);
    const { unique, duplicates } = dedupeNames(parsed);
    if (duplicates.length > 0) {
      setMessage({
        type: "error",
        text: `Dubbla namn hittades: ${duplicates.join(", ")}.`
      });
      return;
    }

    const existingByName = new Map(classData.students.map((student) => [normalizeName(student.name), student] as const));
    const students = unique.map((name) => {
      const existing = existingByName.get(normalizeName(name));
      if (existing) {
        return {
          ...existing,
          name
        };
      }

      return createStudent(name, bulkLevel, bulkGender);
    });

    saveStudents(students);
    setMessage({
      type: "success",
      text: "Elevlistan är sparad."
    });
  };

  const handleReset = () => {
    setDraftText(classData.students.map((student) => student.name).join("\n"));
    setMessage(null);
  };

  const handleQuickAdd = () => {
    const cleaned = quickName.trim();
    if (!cleaned) {
      setMessage({
        type: "error",
        text: "Ange ett elevnamn."
      });
      return;
    }

    if (hasDuplicateName(classData.students, cleaned, null)) {
      setMessage({
        type: "error",
        text: "Den eleven finns redan i klassen."
      });
      return;
    }

    const updated = [...classData.students, createStudent(cleaned, quickLevel, quickGender)];
    saveStudents(updated);
    setQuickName("");
    setMessage({
      type: "success",
      text: `${cleaned} lades till.`
    });
  };

  const handleRemoveStudent = (indexToRemove: number) => {
    const updated = classData.students.filter((_, index) => index !== indexToRemove);
    saveStudents(updated);
    setMessage({
      type: "success",
      text: "Elev borttagen."
    });
  };

  const handleStudentNameChange = (index: number, name: string) => {
    const cleaned = name.trim();
    if (!cleaned) {
      setMessage({
        type: "error",
        text: "Elevnamn får inte vara tomt."
      });
      return;
    }

    if (hasDuplicateName(classData.students, cleaned, index)) {
      setMessage({
        type: "error",
        text: "Dubbla elevnamn är inte tillåtna."
      });
      return;
    }

    const updated = classData.students.map((student, studentIndex) =>
      studentIndex === index
        ? {
            ...student,
            name: cleaned
          }
        : student
    );

    saveStudents(updated);
    setMessage(null);
  };

  const handleStudentLevelChange = (index: number, level: StudentLevel) => {
    const updated = classData.students.map((student, studentIndex) =>
      studentIndex === index
        ? {
            ...student,
            level
          }
        : student
    );

    saveStudents(updated);
  };

  const handleStudentGenderChange = (index: number, gender: StudentGender) => {
    const updated = classData.students.map((student, studentIndex) =>
      studentIndex === index
        ? {
            ...student,
            gender
          }
        : student
    );

    saveStudents(updated);
  };

  return (
    <section>
      <h2>Elever i {classData.name}</h2>
      <p className="muted">
        Ange nivå 1-3 och kön per elev. Laggenereringen försöker jämna ut både nivåsumma och könsfördelning.
      </p>

      <div className="input-row">
        <input
          aria-label="Nytt elevnamn"
          placeholder="Lägg till elev"
          value={quickName}
          onChange={(event) => setQuickName(event.target.value)}
          maxLength={80}
        />
        <select value={quickLevel} onChange={(event) => setQuickLevel(Number(event.target.value) as StudentLevel)}>
          <option value={1}>Nivå 1</option>
          <option value={2}>Nivå 2</option>
          <option value={3}>Nivå 3</option>
        </select>
        <select value={quickGender} onChange={(event) => setQuickGender(event.target.value as StudentGender)}>
          <option value="tjej">Tjej</option>
          <option value="kille">Kille</option>
          <option value="okänd">Okänd</option>
        </select>
        <button type="button" onClick={handleQuickAdd}>
          Lägg till elev
        </button>
      </div>

      {message && <p className={`message ${message.type}`}>{message.text}</p>}

      <p className="muted">Klistra in elevnamn (ett per rad). Nya namn får nivå/kön enligt valen nedan.</p>

      <div className="input-row">
        <label htmlFor="bulk-level">Standardnivå för nya namn</label>
        <select id="bulk-level" value={bulkLevel} onChange={(event) => setBulkLevel(Number(event.target.value) as StudentLevel)}>
          <option value={1}>Nivå 1</option>
          <option value={2}>Nivå 2</option>
          <option value={3}>Nivå 3</option>
        </select>
        <label htmlFor="bulk-gender">Standardkön för nya namn</label>
        <select id="bulk-gender" value={bulkGender} onChange={(event) => setBulkGender(event.target.value as StudentGender)}>
          <option value="tjej">Tjej</option>
          <option value="kille">Kille</option>
          <option value="okänd">Okänd</option>
        </select>
      </div>

      <textarea
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
        rows={10}
        placeholder="Ett namn per rad"
      />

      <div className="button-row">
        <button type="button" onClick={handleSaveList}>
          Spara elevlista
        </button>
        <button type="button" className="ghost" onClick={handleReset}>
          Återställ osparat
        </button>
      </div>

      <p className="muted">
        Antal elever: {classData.students.length} • Tjejer: {genderCount.tjej} • Killar: {genderCount.kille} • Okänd:{" "}
        {genderCount.okänd}
      </p>

      {classData.students.length > 0 && (
        <ul className="student-list">
          {classData.students.map((student, index) => (
            <li key={`${student.name}-${index}`} className="student-row">
              <input
                value={student.name}
                onChange={(event) => handleStudentNameChange(index, event.target.value)}
                aria-label={`Namn för elev ${index + 1}`}
              />
              <select
                value={student.level}
                onChange={(event) => handleStudentLevelChange(index, Number(event.target.value) as StudentLevel)}
                aria-label={`Nivå för ${student.name}`}
              >
                <option value={1}>Nivå 1</option>
                <option value={2}>Nivå 2</option>
                <option value={3}>Nivå 3</option>
              </select>
              <select
                value={student.gender}
                onChange={(event) => handleStudentGenderChange(index, event.target.value as StudentGender)}
                aria-label={`Kön för ${student.name}`}
              >
                <option value="tjej">Tjej</option>
                <option value="kille">Kille</option>
                <option value="okänd">Okänd</option>
              </select>
              <button type="button" className="danger ghost" onClick={() => handleRemoveStudent(index)}>
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default StudentEditor;
