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
  pending: boolean;
  statusLabel: string;
  note: string;
  knownChoices: Array<{
    label: string;
    value: string;
  }>;
}

export function LocationPanel({
  locationName,
  regionName,
  continent,
  description,
  connectedRoutes,
  explored,
  pending,
  statusLabel,
  note,
  knownChoices,
}: LocationPanelProps) {
  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Location</p>
          <h3>{locationName}</h3>
        </div>
        <span className="pill">{pending ? statusLabel : explored ? "Explored" : "Unexplored"}</span>
      </div>
      <p>{pending ? note : description}</p>
      <p className="muted">{regionName} • {continent}</p>
      {knownChoices.length > 0 ? (
        <div className="list-block">
          <strong>Known Incarnation Details</strong>
          {knownChoices.map((entry) => (
            <p key={`${entry.label}-${entry.value}`}>{entry.label}: {entry.value}</p>
          ))}
        </div>
      ) : null}
      <div className="route-list">
        {connectedRoutes.length > 0 ? (
          connectedRoutes.map((route) => (
            <div className="route-row" key={route.routeId}>
              <strong>{route.destinationName}</strong>
              <span>{route.travelTimeLabel}</span>
              <span>{route.statusLabel}</span>
              <span>{route.dangerLabel}</span>
            </div>
          ))
        ) : (
          <p className="muted">{pending ? "No routes anchored before spawn." : "No direct routes from this location."}</p>
        )}
      </div>
    </section>
  );
}
