interface WeatherPanelProps {
  conditionLabel: string;
  temperatureLabel: string;
  eventLabel: string | null;
  travelNote: string;
}

export function WeatherPanel({ conditionLabel, temperatureLabel, eventLabel, travelNote }: WeatherPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Weather</p>
      <h3>{conditionLabel}</h3>
      <p>{temperatureLabel}</p>
      <p className="muted">{eventLabel ?? "No extraordinary climatic event active."}</p>
      <p>{travelNote}</p>
    </section>
  );
}
