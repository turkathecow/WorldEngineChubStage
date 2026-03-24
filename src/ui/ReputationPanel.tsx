interface ReputationEntry {
  factionName: string;
  standingLabel: string;
  score: number;
}

interface ReputationPanelProps {
  entries: ReputationEntry[];
  pending: boolean;
  note: string;
}

export function ReputationPanel({ entries, pending, note }: ReputationPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Reputation</p>
      <div className="list-block">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div className="route-row" key={entry.factionName}>
              <strong>{entry.factionName}</strong>
              <span>{entry.standingLabel}</span>
              <span>{entry.score}</span>
            </div>
          ))
        ) : (
          <p className="muted">{pending ? note : "No active faction standing."}</p>
        )}
      </div>
    </section>
  );
}
