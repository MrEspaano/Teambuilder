import type { Student } from "../types";
import { summarizeTeam } from "../utils/teams";

interface TeamResultsProps {
  teams: Student[][];
  onCopy: () => void;
  onExport: () => void;
}

const TeamResults = ({ teams, onCopy, onExport }: TeamResultsProps) => {
  if (teams.length === 0) {
    return <p className="empty-state">Inga lag att visa ännu.</p>;
  }

  return (
    <section>
      <div className="button-row">
        <button type="button" onClick={onCopy}>
          Kopiera resultat
        </button>
        <button type="button" className="ghost" onClick={onExport}>
          Exportera som .txt
        </button>
      </div>

      <div className="team-grid">
        {teams.map((team, index) => (
          <article key={`team-${index}`} className="team-card">
            <h3>Lag {index + 1}</h3>
            <p className="muted">{summarizeTeam(team)}</p>
            <ol>
              {team.map((student) => (
                <li key={`${student.name}-${index}`}>
                  {student.name} (N{student.level}, {student.gender})
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TeamResults;
