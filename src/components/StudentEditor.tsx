import { useEffect, useMemo, useState } from "react";
import type { ClassRoom, Student, StudentGender, StudentLevel } from "../types";
import { normalizeName } from "../utils/normalize";

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
  const [quickName, setQuickName] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    setQuickName("");
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
  };

  const hasDuplicateName = (students: Student[], name: string, ignoreIndex: number | null): boolean => {
    const normalized = normalizeName(name);
    return students.some((student, index) => index !== ignoreIndex && normalizeName(student.name) === normalized);
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

    const updated = [...classData.students, createStudent(cleaned, DEFAULT_LEVEL, DEFAULT_GENDER)];
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
      <p className="muted">Arbeta i två steg: 1) Lägg till namn, 2) Välj nivå och kön i listan.</p>

      {message && <p className={`message ${message.type}`}>{message.text}</p>}

      <div className="editor-step">
        <h3>Steg 1: Lägg till elevnamn</h3>
        <div className="input-row">
          <input
            aria-label="Nytt elevnamn"
            placeholder="Skriv elevens namn"
            value={quickName}
            onChange={(event) => setQuickName(event.target.value)}
            maxLength={80}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleQuickAdd();
              }
            }}
          />
          <button type="button" onClick={handleQuickAdd}>
            Lägg till elev
          </button>
        </div>
      </div>

      <div className="editor-step">
        <h3>Steg 2: Sätt nivå och kön i listan</h3>
        <p className="muted">
          Nya elever får automatiskt nivå 2 och kön Okänd tills du ändrar.
        </p>
        <p className="muted">
          Antal elever: {classData.students.length} • Tjejer: {genderCount.tjej} • Killar: {genderCount.kille} • Okänd:{" "}
          {genderCount.okänd}
        </p>

        {classData.students.length > 0 ? (
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
        ) : (
          <p className="empty-state">Lägg till första eleven i steg 1.</p>
        )}
      </div>
    </section>
  );
};

export default StudentEditor;
