interface InventoryPanelProps {
  highlights: string[];
}

export function InventoryPanel({ highlights }: InventoryPanelProps) {
  return (
    <section className="panel-card">
      <p className="eyebrow">Inventory</p>
      <h3>Highlights</h3>
      {highlights.length > 0 ? highlights.map((item) => <p key={item}>{item}</p>) : <p className="muted">Nothing notable beyond ordinary carry.</p>}
    </section>
  );
}
