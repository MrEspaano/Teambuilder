import { useEffect, useMemo, useState } from "react";
import type { BlockRule, ClassRoom } from "../types";
import { areSameName, makePairKey, normalizeName } from "../utils/normalize";

interface BlockRulesEditorProps {
  classData: ClassRoom | null;
  onBlocksChange: (classId: string, blocks: BlockRule[]) => void;
  onTogetherRulesChange: (classId: string, togetherRules: BlockRule[]) => void;
}

type Message = {
  type: "error" | "success";
  text: string;
};

interface IndexedRule {
  rule: BlockRule;
  index: number;
}

interface AnalyzedRules {
  valid: IndexedRule[];
  invalid: IndexedRule[];
}

const analyzeRules = (rules: BlockRule[], studentSet: Set<string>): AnalyzedRules => {
  const valid: IndexedRule[] = [];
  const invalid: IndexedRule[] = [];

  rules.forEach((rule, index) => {
    const a = normalizeName(rule.a);
    const b = normalizeName(rule.b);
    if (!a || !b || a === b || !studentSet.has(a) || !studentSet.has(b)) {
      invalid.push({ rule, index });
      return;
    }

    valid.push({ rule, index });
  });

  return { valid, invalid };
};

const hasRule = (rules: BlockRule[], a: string, b: string): boolean => {
  const key = makePairKey(a, b);
  return rules.some((rule) => makePairKey(rule.a, rule.b) === key);
};

const BlockRulesEditor = ({ classData, onBlocksChange, onTogetherRulesChange }: BlockRulesEditorProps) => {
  const [blockA, setBlockA] = useState("");
  const [blockB, setBlockB] = useState("");
  const [togetherA, setTogetherA] = useState("");
  const [togetherB, setTogetherB] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  const students = classData?.students.map((student) => student.name) ?? [];

  const analyzed = useMemo(() => {
    if (!classData) {
      return {
        blocks: { valid: [] as IndexedRule[], invalid: [] as IndexedRule[] },
        together: { valid: [] as IndexedRule[], invalid: [] as IndexedRule[] }
      };
    }

    const studentSet = new Set(classData.students.map((student) => normalizeName(student.name)));
    return {
      blocks: analyzeRules(classData.blocks, studentSet),
      together: analyzeRules(classData.togetherRules, studentSet)
    };
  }, [classData]);

  useEffect(() => {
    setMessage(null);
    if (students.length === 0) {
      setBlockA("");
      setBlockB("");
      setTogetherA("");
      setTogetherB("");
      return;
    }

    const first = students[0] ?? "";
    const second = students[1] ?? first;
    setBlockA(first);
    setBlockB(second);
    setTogetherA(first);
    setTogetherB(second);
  }, [classData?.id, students.join("||")]);

  if (!classData) {
    return (
      <section>
        <h2>Regler</h2>
        <p className="empty-state">Välj en klass för att hantera regler.</p>
      </section>
    );
  }

  const ensurePairIsValid = (a: string, b: string): string | null => {
    if (students.length < 2) {
      return "Minst två elever krävs för att skapa regler.";
    }

    if (!a || !b) {
      return "Välj två elever.";
    }

    if (areSameName(a, b)) {
      return "Du kan inte välja samma elev på båda sidor.";
    }

    return null;
  };

  const handleAddBlock = () => {
    const pairError = ensurePairIsValid(blockA, blockB);
    if (pairError) {
      setMessage({ type: "error", text: pairError });
      return;
    }

    if (hasRule(classData.togetherRules, blockA, blockB)) {
      setMessage({
        type: "error",
        text: "Det paret är låst att alltid vara i samma lag. Ta bort den regeln först."
      });
      return;
    }

    if (hasRule(classData.blocks, blockA, blockB)) {
      setMessage({
        type: "error",
        text: "Den spärren finns redan."
      });
      return;
    }

    onBlocksChange(classData.id, [...classData.blocks, { a: blockA, b: blockB }]);
    setMessage({ type: "success", text: "Spärr tillagd." });
  };

  const handleAddTogetherRule = () => {
    const pairError = ensurePairIsValid(togetherA, togetherB);
    if (pairError) {
      setMessage({ type: "error", text: pairError });
      return;
    }

    if (hasRule(classData.blocks, togetherA, togetherB)) {
      setMessage({
        type: "error",
        text: "Det paret är spärrat från samma lag. Ta bort spärren först."
      });
      return;
    }

    if (hasRule(classData.togetherRules, togetherA, togetherB)) {
      setMessage({
        type: "error",
        text: "Den regeln finns redan."
      });
      return;
    }

    onTogetherRulesChange(classData.id, [...classData.togetherRules, { a: togetherA, b: togetherB }]);
    setMessage({ type: "success", text: "" + togetherA + " och " + togetherB + " låstes till samma lag." });
  };

  const handleRemoveBlock = (index: number) => {
    const updated = classData.blocks.filter((_, ruleIndex) => ruleIndex !== index);
    onBlocksChange(classData.id, updated);
    setMessage({ type: "success", text: "Spärr borttagen." });
  };

  const handleRemoveTogetherRule = (index: number) => {
    const updated = classData.togetherRules.filter((_, ruleIndex) => ruleIndex !== index);
    onTogetherRulesChange(classData.id, updated);
    setMessage({ type: "success", text: "Samma-lag-regel borttagen." });
  };

  const clearInvalidBlocks = () => {
    const invalidIndexes = new Set(analyzed.blocks.invalid.map((item) => item.index));
    const updated = classData.blocks.filter((_, index) => !invalidIndexes.has(index));
    onBlocksChange(classData.id, updated);
    setMessage({ type: "success", text: "Ogiltiga spärrar har rensats." });
  };

  const clearInvalidTogetherRules = () => {
    const invalidIndexes = new Set(analyzed.together.invalid.map((item) => item.index));
    const updated = classData.togetherRules.filter((_, index) => !invalidIndexes.has(index));
    onTogetherRulesChange(classData.id, updated);
    setMessage({ type: "success", text: "Ogiltiga samma-lag-regler har rensats." });
  };

  return (
    <section>
      <h2>Regler i {classData.name}</h2>
      <p className="muted">Skapa spärrar för elever som inte får vara i samma lag, eller lås elever som alltid ska vara i samma lag.</p>

      {message && <p className={`message ${message.type}`}>{message.text}</p>}

      <div className="editor-step">
        <h3>Spärrar: får inte vara i samma lag</h3>

        {students.length < 2 ? (
          <p className="empty-state">Lägg till minst två elever innan du skapar regler.</p>
        ) : (
          <div className="input-row">
            <select value={blockA} onChange={(event) => setBlockA(event.target.value)}>
              {students.map((student) => (
                <option key={`block-a-${student}`} value={student}>
                  {student}
                </option>
              ))}
            </select>

            <select value={blockB} onChange={(event) => setBlockB(event.target.value)}>
              {students.map((student) => (
                <option key={`block-b-${student}`} value={student}>
                  {student}
                </option>
              ))}
            </select>

            <button type="button" onClick={handleAddBlock}>
              Lägg till spärr
            </button>
          </div>
        )}

        {analyzed.blocks.invalid.length > 0 && (
          <div className="alert">
            <p>Det finns {analyzed.blocks.invalid.length} ogiltiga spärrar.</p>
            <button type="button" className="ghost" onClick={clearInvalidBlocks}>
              Rensa ogiltiga spärrar
            </button>
          </div>
        )}

        {classData.blocks.length === 0 && <p className="empty-state">Inga spärrar ännu.</p>}

        {classData.blocks.length > 0 && (
          <ul className="block-list">
            {classData.blocks.map((rule, index) => {
              const isInvalid = analyzed.blocks.invalid.some((item) => item.index === index);
              return (
                <li key={`block-${rule.a}-${rule.b}-${index}`} className={isInvalid ? "invalid" : ""}>
                  <span>
                    {rule.a} ↔ {rule.b}
                  </span>
                  <button type="button" className="danger ghost" onClick={() => handleRemoveBlock(index)}>
                    Ta bort
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="editor-step">
        <h3>Samma lag: ska alltid vara i samma lag</h3>

        {students.length < 2 ? (
          <p className="empty-state">Lägg till minst två elever innan du skapar regler.</p>
        ) : (
          <div className="input-row">
            <select value={togetherA} onChange={(event) => setTogetherA(event.target.value)}>
              {students.map((student) => (
                <option key={`together-a-${student}`} value={student}>
                  {student}
                </option>
              ))}
            </select>

            <select value={togetherB} onChange={(event) => setTogetherB(event.target.value)}>
              {students.map((student) => (
                <option key={`together-b-${student}`} value={student}>
                  {student}
                </option>
              ))}
            </select>

            <button type="button" onClick={handleAddTogetherRule}>
              Lägg till samma-lag
            </button>
          </div>
        )}

        {analyzed.together.invalid.length > 0 && (
          <div className="alert">
            <p>Det finns {analyzed.together.invalid.length} ogiltiga samma-lag-regler.</p>
            <button type="button" className="ghost" onClick={clearInvalidTogetherRules}>
              Rensa ogiltiga regler
            </button>
          </div>
        )}

        {classData.togetherRules.length === 0 && <p className="empty-state">Inga samma-lag-regler ännu.</p>}

        {classData.togetherRules.length > 0 && (
          <ul className="block-list">
            {classData.togetherRules.map((rule, index) => {
              const isInvalid = analyzed.together.invalid.some((item) => item.index === index);
              return (
                <li key={`together-${rule.a}-${rule.b}-${index}`} className={isInvalid ? "invalid" : ""}>
                  <span>
                    {rule.a} ↔ {rule.b}
                  </span>
                  <button type="button" className="danger ghost" onClick={() => handleRemoveTogetherRule(index)}>
                    Ta bort
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default BlockRulesEditor;
