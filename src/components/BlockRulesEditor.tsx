import { useEffect, useMemo, useState } from "react";
import type { BlockRule, ClassRoom } from "../types";
import { areSameName, makePairKey, normalizeName } from "../utils/normalize";

interface BlockRulesEditorProps {
  classData: ClassRoom | null;
  onBlocksChange: (classId: string, blocks: BlockRule[]) => void;
}

type Message = {
  type: "error" | "success";
  text: string;
};

interface IndexedBlock {
  block: BlockRule;
  index: number;
}

const BlockRulesEditor = ({ classData, onBlocksChange }: BlockRulesEditorProps) => {
  const [studentA, setStudentA] = useState("");
  const [studentB, setStudentB] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  const students = classData?.students.map((student) => student.name) ?? [];

  const analyzed = useMemo(() => {
    if (!classData) {
      return {
        valid: [] as IndexedBlock[],
        invalid: [] as IndexedBlock[]
      };
    }

    const studentSet = new Set(classData.students.map((student) => normalizeName(student.name)));
    const valid: IndexedBlock[] = [];
    const invalid: IndexedBlock[] = [];

    classData.blocks.forEach((block, index) => {
      const a = normalizeName(block.a);
      const b = normalizeName(block.b);
      if (!a || !b || a === b || !studentSet.has(a) || !studentSet.has(b)) {
        invalid.push({ block, index });
        return;
      }

      valid.push({ block, index });
    });

    return { valid, invalid };
  }, [classData]);

  useEffect(() => {
    setMessage(null);
    if (students.length === 0) {
      setStudentA("");
      setStudentB("");
      return;
    }

    const first = students[0] ?? "";
    const second = students[1] ?? first;
    setStudentA(first);
    setStudentB(second);
  }, [classData?.id, students.join("||")]);

  if (!classData) {
    return (
      <section>
        <h2>Blockeringar</h2>
        <p className="empty-state">Välj en klass för att hantera blockeringar.</p>
      </section>
    );
  }

  const handleAddBlock = () => {
    if (students.length < 2) {
      setMessage({
        type: "error",
        text: "Minst två elever krävs för att skapa en blockering."
      });
      return;
    }

    if (!studentA || !studentB) {
      setMessage({
        type: "error",
        text: "Välj två elever."
      });
      return;
    }

    if (areSameName(studentA, studentB)) {
      setMessage({
        type: "error",
        text: "Du kan inte blockera en elev mot sig själv."
      });
      return;
    }

    const newPairKey = makePairKey(studentA, studentB);
    const exists = classData.blocks.some((rule) => makePairKey(rule.a, rule.b) === newPairKey);
    if (exists) {
      setMessage({
        type: "error",
        text: "Den blockeringen finns redan."
      });
      return;
    }

    onBlocksChange(classData.id, [...classData.blocks, { a: studentA, b: studentB }]);
    setMessage({
      type: "success",
      text: "Blockering tillagd."
    });
  };

  const handleRemoveBlock = (index: number) => {
    const updated = classData.blocks.filter((_, blockIndex) => blockIndex !== index);
    onBlocksChange(classData.id, updated);
    setMessage({
      type: "success",
      text: "Blockering borttagen."
    });
  };

  const clearInvalidBlocks = () => {
    const invalidIndexes = new Set(analyzed.invalid.map((item) => item.index));
    const updated = classData.blocks.filter((_, index) => !invalidIndexes.has(index));
    onBlocksChange(classData.id, updated);
    setMessage({
      type: "success",
      text: "Ogiltiga blockeringar har rensats."
    });
  };

  return (
    <section>
      <h2>Blockeringar i {classData.name}</h2>
      <p className="muted">Elever i en blockeringsregel får aldrig hamna i samma lag.</p>

      {students.length < 2 ? (
        <p className="empty-state">Lägg till minst två elever innan du skapar blockeringar.</p>
      ) : (
        <div className="input-row">
          <select value={studentA} onChange={(event) => setStudentA(event.target.value)}>
            {students.map((student) => (
              <option key={`a-${student}`} value={student}>
                {student}
              </option>
            ))}
          </select>

          <select value={studentB} onChange={(event) => setStudentB(event.target.value)}>
            {students.map((student) => (
              <option key={`b-${student}`} value={student}>
                {student}
              </option>
            ))}
          </select>

          <button type="button" onClick={handleAddBlock}>
            Lägg till blockering
          </button>
        </div>
      )}

      {message && <p className={`message ${message.type}`}>{message.text}</p>}

      {analyzed.invalid.length > 0 && (
        <div className="alert">
          <p>Det finns {analyzed.invalid.length} ogiltiga blockeringar (saknade elever eller samma elev två gånger).</p>
          <button type="button" className="ghost" onClick={clearInvalidBlocks}>
            Rensa ogiltiga blockeringar
          </button>
        </div>
      )}

      {classData.blocks.length === 0 && <p className="empty-state">Inga blockeringar ännu.</p>}

      {classData.blocks.length > 0 && (
        <ul className="block-list">
          {classData.blocks.map((block, index) => {
            const isInvalid = analyzed.invalid.some((item) => item.index === index);
            return (
              <li key={`${block.a}-${block.b}-${index}`} className={isInvalid ? "invalid" : ""}>
                <span>
                  {block.a} ↔ {block.b}
                </span>
                <button type="button" className="danger ghost" onClick={() => handleRemoveBlock(index)}>
                  Ta bort
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default BlockRulesEditor;
