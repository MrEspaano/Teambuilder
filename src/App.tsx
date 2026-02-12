import { useEffect, useMemo, useState } from "react";
import BlockRulesEditor from "./components/BlockRulesEditor";
import ClassSelector from "./components/ClassSelector";
import StudentEditor from "./components/StudentEditor";
import TeamGenerator from "./components/TeamGenerator";
import type { AppData, BlockRule } from "./types";
import { normalizeName } from "./utils/normalize";
import { createClassRoom, loadAppData, saveAppData } from "./utils/storage";

const App = () => {
  const [data, setData] = useState<AppData>(() => loadAppData());

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const activeClass = useMemo(
    () => data.classes.find((classRoom) => classRoom.id === data.activeClassId) ?? null,
    [data.activeClassId, data.classes]
  );

  const createClass = (name: string): string | null => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      return "Ange ett klassnamn.";
    }

    const exists = data.classes.some((classRoom) => normalizeName(classRoom.name) === normalizeName(cleanedName));
    if (exists) {
      return "En klass med det namnet finns redan.";
    }

    const newClass = createClassRoom(cleanedName);
    setData((prev) => ({
      ...prev,
      activeClassId: newClass.id,
      classes: [...prev.classes, newClass]
    }));

    return null;
  };

  const renameClass = (classId: string, name: string): string | null => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      return "Klassnamn får inte vara tomt.";
    }

    const exists = data.classes.some(
      (classRoom) => classRoom.id !== classId && normalizeName(classRoom.name) === normalizeName(cleanedName)
    );
    if (exists) {
      return "Det finns redan en klass med det namnet.";
    }

    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              name: cleanedName
            }
          : classRoom
      )
    }));

    return null;
  };

  const deleteClass = (classId: string) => {
    setData((prev) => {
      const remaining = prev.classes.filter((classRoom) => classRoom.id !== classId);
      const activeStillExists = remaining.some((classRoom) => classRoom.id === prev.activeClassId);

      return {
        ...prev,
        classes: remaining,
        activeClassId: activeStillExists ? prev.activeClassId : (remaining[0]?.id ?? null)
      };
    });
  };

  const updateStudents = (classId: string, students: string[]) => {
    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              students
            }
          : classRoom
      )
    }));
  };

  const updateBlocks = (classId: string, blocks: BlockRule[]) => {
    setData((prev) => ({
      ...prev,
      classes: prev.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              blocks
            }
          : classRoom
      )
    }));
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Lagbyggare för idrott</h1>
        <p>Skapa klasser, hantera elevlistor och generera slumpade lag med blockeringar.</p>
      </header>

      <div className="app-shell">
        <aside className="panel sidebar">
          <ClassSelector
            classes={data.classes}
            activeClassId={data.activeClassId}
            onSelect={(classId) => setData((prev) => ({ ...prev, activeClassId: classId }))}
            onCreate={createClass}
            onRename={renameClass}
            onDelete={deleteClass}
          />
        </aside>

        <main className="main-stack">
          <div className="panel">
            <StudentEditor classData={activeClass} onStudentsChange={updateStudents} />
          </div>
          <div className="panel">
            <BlockRulesEditor classData={activeClass} onBlocksChange={updateBlocks} />
          </div>
          <div className="panel">
            <TeamGenerator classData={activeClass} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
