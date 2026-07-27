export default function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-head">{label}</div>
      <div className="chart-tooltip-body">
        {payload.map((entry) => (
          <span key={entry.dataKey ?? entry.name}>
            {format ? format(entry.value) : entry.value}
          </span>
        ))}
      </div>
    </div>
  );
}
