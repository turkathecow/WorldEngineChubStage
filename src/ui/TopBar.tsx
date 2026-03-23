interface TopBarProps {
  dateLabel: string;
  timeLabel: string;
  season: string;
  location: string;
  region: string;
  note: string | null;
}

export function TopBar({ dateLabel, timeLabel, season, location, region, note }: TopBarProps) {
  return (
    <section className="panel-card top-bar">
      <div>
        <p className="eyebrow">Clock</p>
        <h2>{dateLabel}</h2>
        <p>{timeLabel} • {season}</p>
      </div>
      <div>
        <p className="eyebrow">Position</p>
        <h2>{location}</h2>
        <p>{region}</p>
      </div>
      <div>
        <p className="eyebrow">Engine Note</p>
        <p className="engine-note">{note ?? "No recent system note."}</p>
      </div>
    </section>
  );
}
