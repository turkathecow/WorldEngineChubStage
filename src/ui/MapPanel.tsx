interface AdjacentLocationEntry {
  id: string;
  name: string;
  routeLabel: string;
  explored: boolean;
}

interface MapPanelProps {
  currentLocationId: string | null;
  currentLocationName: string;
  adjacentLocations: AdjacentLocationEntry[];
  pending: boolean;
  note: string;
}

export function MapPanel({ currentLocationName, adjacentLocations, pending, note }: MapPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Routes</p>
      <h3>{currentLocationName}</h3>
      <div className="list-block">
        {adjacentLocations.length > 0 ? (
          adjacentLocations.map((location) => (
            <div className="route-row" key={location.id}>
              <strong>{location.name}</strong>
              <span>{location.routeLabel}</span>
              <span>{location.explored ? "Known" : "Unknown"}</span>
            </div>
          ))
        ) : (
          <p className="muted">{pending ? note : "No adjacent routes mapped."}</p>
        )}
      </div>
    </section>
  );
}
