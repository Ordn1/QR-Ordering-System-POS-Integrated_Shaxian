export default function KpiCard({ label, value, delta, direction, icon: Icon }) {
  return (
    <article className="kpi-card">
      {Icon ? (
        <Icon
          className="kpi-watermark"
          size={96}
          strokeWidth={1.25}
          aria-hidden="true"
        />
      ) : null}
      <div className="kpi-content">
        <p className="eyebrow">{label}</p>
        <p className="kpi-value">{value}</p>
        {delta ? (
          <p className={`kpi-delta kpi-delta-${direction}`}>{delta}</p>
        ) : null}
      </div>
    </article>
  );
}
