interface ReputationEntry {
  factionName: string;
  standingLabel: string;
  score: number;
}

interface ReputationPanelProps {
  entries: ReputationEntry[];
}

export function ReputationPanel({ entries }: ReputationPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Reputation</p>
      <div className="list-block">
        {entries.map((entry) => (
          <div className="route-row" key={entry.factionName}>
            <strong>{entry.factionName}</strong>
            <span>{entry.standingLabel}</span>
            <span>{entry.score}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
