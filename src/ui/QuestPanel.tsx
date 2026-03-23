interface QuestEntry {
  id: string;
  title: string;
  obligationLevel: string;
  summary: string;
}

interface QuestPanelProps {
  quests: QuestEntry[];
}

export function QuestPanel({ quests }: QuestPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Obligations</p>
      {quests.length > 0 ? (
        quests.map((quest) => (
          <div className="quest-card" key={quest.id}>
            <div className="panel-header">
              <strong>{quest.title}</strong>
              <span className="pill">{quest.obligationLevel}</span>
            </div>
            <p>{quest.summary}</p>
          </div>
        ))
      ) : (
        <p className="muted">No active obligations.</p>
      )}
    </section>
  );
}
