import { useEffect, useMemo, useState } from "react";
import type { ClassRoom } from "../types";

interface ClassSelectorProps {
  classes: ClassRoom[];
  activeClassId: string | null;
  onSelect: (classId: string) => void;
  onCreate: (name: string) => string | null;
  onRename: (classId: string, name: string) => string | null;
  onDelete: (classId: string) => void;
}

const ClassSelector = ({ classes, activeClassId, onSelect, onCreate, onRename, onDelete }: ClassSelectorProps) => {
  const [newClassName, setNewClassName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeClass = useMemo(
    () => classes.find((classRoom) => classRoom.id === activeClassId) ?? null,
    [activeClassId, classes]
  );

  useEffect(() => {
    setRenameValue(activeClass?.name ?? "");
    setErrorMessage(null);
  }, [activeClassId, activeClass?.name]);

  const handleCreate = () => {
    const error = onCreate(newClassName);
    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage(null);
    setNewClassName("");
  };

  const handleRename = () => {
    if (!activeClass) {
      return;
    }

    const error = onRename(activeClass.id, renameValue);
    setErrorMessage(error);
  };

  const handleDelete = (classRoom: ClassRoom) => {
    const shouldDelete = window.confirm(`Ta bort klassen ${classRoom.name}?`);
    if (!shouldDelete) {
      return;
    }

    onDelete(classRoom.id);
    setErrorMessage(null);
  };

  return (
    <section>
      <h2>Klasshantering</h2>
      <p className="muted">Skapa klasser och välj vilken klass som är aktiv.</p>

      <div className="input-row">
        <input
          aria-label="Nytt klassnamn"
          placeholder="t.ex. 7A"
          value={newClassName}
          onChange={(event) => setNewClassName(event.target.value)}
          maxLength={40}
        />
        <button type="button" onClick={handleCreate}>
          Lägg till klass
        </button>
      </div>

      {errorMessage && <p className="message error">{errorMessage}</p>}

      {classes.length === 0 && <p className="empty-state">Inga klasser ännu.</p>}

      {classes.length > 0 && (
        <ul className="class-list">
          {classes.map((classRoom) => (
            <li key={classRoom.id} className={classRoom.id === activeClassId ? "active" : ""}>
              <button type="button" className="class-select" onClick={() => onSelect(classRoom.id)}>
                {classRoom.name}
              </button>
              <button type="button" className="danger ghost" onClick={() => handleDelete(classRoom)}>
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      )}

      {activeClass && (
        <div className="rename-box">
          <label htmlFor="rename-class">Byt namn på aktiv klass</label>
          <div className="input-row">
            <input
              id="rename-class"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={40}
            />
            <button type="button" onClick={handleRename}>
              Spara namn
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ClassSelector;
