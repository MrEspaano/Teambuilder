import { useEffect, useMemo, useState } from "react";
import type { ClassRoom } from "../types";
import TeamResults from "./TeamResults";
import { formatTeamsAsText, generateTeams } from "../utils/teams";

type Message = {
  type: "error" | "success";
  text: string;
};

interface TeamGeneratorProps {
  classData: ClassRoom | null;
}

const TeamGenerator = ({ classData }: TeamGeneratorProps) => {
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<string[][]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);

  useEffect(() => {
    setTeams([]);
    setMessage(null);
    setAttemptsUsed(0);
    setTeamCount(2);
  }, [classData?.id]);

  const hasStudents = useMemo(() => (classData?.students.length ?? 0) > 0, [classData?.students.length]);

  if (!classData) {
    return (
      <section>
        <h2>Lag-generator</h2>
        <p className="empty-state">Välj en klass för att generera lag.</p>
      </section>
    );
  }

  const handleTeamCountChange = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) {
      return;
    }

    const clamped = Math.max(2, Math.min(10, Math.trunc(parsed)));
    setTeamCount(clamped);
  };

  const handleGenerate = () => {
    const result = generateTeams(classData.students, classData.blocks, teamCount, 2000);

    if (!result.ok) {
      setTeams([]);
      setAttemptsUsed(result.attempts);
      setMessage({
        type: "error",
        text: `${result.error.message} ${result.error.suggestion}`
      });
      return;
    }

    setTeams(result.teams);
    setAttemptsUsed(result.attempts);
    setMessage({
      type: "success",
      text: `Lag skapade efter ${result.attempts} försök.`
    });
  };

  const handleCopy = async () => {
    if (teams.length === 0) {
      return;
    }

    const text = formatTeamsAsText(teams);
    try {
      await navigator.clipboard.writeText(text);
      setMessage({
        type: "success",
        text: "Resultatet kopierades till urklipp."
      });
    } catch {
      setMessage({
        type: "error",
        text: "Kunde inte kopiera resultatet. Prova export istället."
      });
    }
  };

  const handleExport = () => {
    if (teams.length === 0) {
      return;
    }

    const text = formatTeamsAsText(teams);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const classSlug = classData.name.toLocaleLowerCase("sv-SE").replace(/\s+/g, "-");
    link.href = url;
    link.download = `lag-${classSlug}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setMessage({
      type: "success",
      text: "Resultatet exporterades som .txt."
    });
  };

  return (
    <section>
      <h2>Lag-generator</h2>
      <p className="muted">Antal lag: 2–10. Fördelningen blir så jämn som möjligt.</p>

      <div className="input-row">
        <label htmlFor="team-count">Antal lag</label>
        <input
          id="team-count"
          type="number"
          min={2}
          max={10}
          value={teamCount}
          onChange={(event) => handleTeamCountChange(event.target.value)}
        />
      </div>

      <div className="button-row">
        <button type="button" onClick={handleGenerate} disabled={!hasStudents}>
          Generera lag
        </button>
        <button type="button" className="ghost" onClick={handleGenerate} disabled={!hasStudents}>
          Generera igen
        </button>
      </div>

      {message && <p className={`message ${message.type}`}>{message.text}</p>}
      {attemptsUsed > 0 && <p className="muted">Försök använda: {attemptsUsed} / 2000</p>}

      <TeamResults teams={teams} onCopy={handleCopy} onExport={handleExport} />
    </section>
  );
};

export default TeamGenerator;
