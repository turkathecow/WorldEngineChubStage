interface StatusPanelProps {
  moneyLabel: string;
  fatigueLabel: string;
  injuries: string[];
  nearbyHazards: string[];
  pending: boolean;
  note: string;
}

export function StatusPanel({ moneyLabel, fatigueLabel, injuries, nearbyHazards, pending, note }: StatusPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Status</p>
      <div className="stat-grid">
        <div>
          <strong>Money</strong>
          <p>{moneyLabel}</p>
        </div>
        <div>
          <strong>Fatigue</strong>
          <p>{fatigueLabel}</p>
        </div>
      </div>
      {pending ? <p className="muted">{note}</p> : null}
      <div className="list-block">
        <strong>Injuries</strong>
        {injuries.length > 0 ? injuries.map((injury) => <p key={injury}>{injury}</p>) : <p className="muted">{pending ? "None assigned." : "None recorded."}</p>}
      </div>
      <div className="list-block">
        <strong>Hazards</strong>
        {nearbyHazards.length > 0 ? nearbyHazards.map((hazard) => <p key={hazard}>{hazard}</p>) : <p className="muted">{pending ? "None assigned." : "No immediate hazard."}</p>}
      </div>
    </section>
  );
}
