interface QuestEntry {
  id: string;
  title: string;
  obligationLevel: string;
  summary: string;
}

interface QuestPanelProps {
  entries: QuestEntry[];
  pending: boolean;
  note: string;
}

export function QuestPanel({ entries, pending, note }: QuestPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Obligations</p>
      {entries.length > 0 ? (
        entries.map((quest) => (
          <div className="quest-card" key={quest.id}>
            <div className="panel-header">
              <strong>{quest.title}</strong>
              <span className="pill">{quest.obligationLevel}</span>
            </div>
            <p>{quest.summary}</p>
          </div>
        ))
      ) : (
        <p className="muted">{pending ? note : "No active obligations."}</p>
      )}
    </section>
  );
}
