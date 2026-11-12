export default function StatStrip({ items = [] }) {
  return (
    <div className="stat-strip" role="list">
      {items.map((item) => (
        <div className="stat-tile" role="listitem" key={item.label}>
          <div className="stat-tile-label">{item.label}</div>
          <div className="stat-tile-value" title={String(item.value ?? "")}>
            {item.value ?? "—"}
          </div>
          {item.sub != null && <div className="stat-tile-sub">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
