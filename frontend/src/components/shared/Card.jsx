export default function Card({ title, actions, children }) {
  return (
    <section className="card">
      {title ? (
        <header className="card-header">
          <span className="seal" aria-hidden="true" />
          <h3 className="card-title">{title}</h3>
          {actions ? <div className="page-header-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
