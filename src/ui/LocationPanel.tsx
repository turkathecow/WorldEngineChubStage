interface ConnectedRoute {
  routeId: string;
  destinationName: string;
  travelTimeLabel: string;
  statusLabel: string;
  dangerLabel: string;
}

interface LocationPanelProps {
  locationName: string;
  regionName: string;
  continent: string;
  description: string;
  connectedRoutes: ConnectedRoute[];
  explored: boolean;
}

export function LocationPanel({
  locationName,
  regionName,
  continent,
  description,
  connectedRoutes,
  explored,
}: LocationPanelProps) {
  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Location</p>
          <h3>{locationName}</h3>
        </div>
        <span className="pill">{explored ? "Explored" : "Unexplored"}</span>
      </div>
      <p>{description}</p>
      <p className="muted">{regionName} • {continent}</p>
      <div className="route-list">
        {connectedRoutes.map((route) => (
          <div className="route-row" key={route.routeId}>
            <strong>{route.destinationName}</strong>
            <span>{route.travelTimeLabel}</span>
            <span>{route.statusLabel}</span>
            <span>{route.dangerLabel}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
