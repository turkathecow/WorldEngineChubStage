interface WeatherPanelProps {
  conditionLabel: string;
  temperatureLabel: string;
  eventLabel: string | null;
  travelNote: string;
  pending: boolean;
  note: string;
}

export function WeatherPanel({ conditionLabel, temperatureLabel, eventLabel, travelNote, pending, note }: WeatherPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Weather</p>
      <h3>{conditionLabel}</h3>
      <p>{temperatureLabel}</p>
      <p className="muted">{pending ? note : eventLabel ?? "No extraordinary climatic event active."}</p>
      <p>{travelNote}</p>
    </section>
  );
}
