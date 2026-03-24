interface InventoryPanelProps {
  highlights: string[];
  pending: boolean;
  note: string;
}

export function InventoryPanel({ highlights, pending, note }: InventoryPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Inventory</p>
      <h3>Highlights</h3>
      {highlights.length > 0 ? highlights.map((item) => <p key={item}>{item}</p>) : <p className="muted">{pending ? note : "Nothing notable beyond ordinary carry."}</p>}
    </section>
  );
}
