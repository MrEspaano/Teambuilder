import { useEffect, useState } from "react";
import type { ClassRoom } from "../types";
import { dedupeNames, normalizeName, parseNameLines } from "../utils/normalize";

interface StudentEditorProps {
  classData: ClassRoom | null;
  onStudentsChange: (classId: string, students: string[]) => void;
}

type Message = {
  type: "error" | "success";
  text: string;
};

const StudentEditor = ({ classData, onStudentsChange }: StudentEditorProps) => {
  const [draftText, setDraftText] = useState("");
  const [quickName, setQuickName] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    setDraftText(classData?.students.join("\n") ?? "");
    setQuickName("");
    setMessage(null);
  }, [classData?.id, classData?.students]);

  if (!classData) {
    return (
      <section>
        <h2>Elever</h2>
        <p className="empty-state">Välj en klass för att lägga in elever.</p>
      </section>
    );
  }

  const saveStudents = (students: string[]) => {
    onStudentsChange(classData.id, students);
    setDraftText(students.join("\n"));
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

    saveStudents(unique);
    setMessage({
      type: "success",
      text: "Elevlistan är sparad."
    });
  };

  const handleReset = () => {
    setDraftText(classData.students.join("\n"));
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

    const existing = new Set(classData.students.map((name) => normalizeName(name)));
    if (existing.has(normalizeName(cleaned))) {
      setMessage({
        type: "error",
        text: "Den eleven finns redan i klassen."
      });
      return;
    }

    const updated = [...classData.students, cleaned];
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

  return (
    <section>
      <h2>Elever i {classData.name}</h2>
      <p className="muted">Klistra in en elev per rad. Du kan redigera listan direkt i textrutan.</p>

      <div className="input-row">
        <input
          aria-label="Nytt elevnamn"
          placeholder="Lägg till elev"
          value={quickName}
          onChange={(event) => setQuickName(event.target.value)}
          maxLength={80}
        />
        <button type="button" onClick={handleQuickAdd}>
          Lägg till elev
        </button>
      </div>

      {message && <p className={`message ${message.type}`}>{message.text}</p>}

      <textarea
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
        rows={12}
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

      <p className="muted">Antal elever: {classData.students.length}</p>

      {classData.students.length > 0 && (
        <ul className="student-list">
          {classData.students.map((student, index) => (
            <li key={`${student}-${index}`}>
              <span>{student}</span>
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
