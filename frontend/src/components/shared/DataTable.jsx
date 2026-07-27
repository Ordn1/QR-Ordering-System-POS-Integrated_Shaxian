const VARIANT_CLASS = {
  data: 'data-table',
  compact: 'compact-table',
  queue: 'queue-table',
};

export default function DataTable({
  columns,
  rows,
  rowKey,
  variant = 'data',
  loading = false,
  emptyMessage,
  emptyAction,
  rowClassName,
}) {
  const span = columns.length;

  return (
    <table className={VARIANT_CLASS[variant]}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={
                column.align === 'right'
                  ? 'table-numeric'
                  : column.key === 'actions'
                    ? 'table-actions'
                    : undefined
              }
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? [0, 1, 2].map((index) => (
              <tr key={index} className="table-skeleton-row">
                <td colSpan={span} />
              </tr>
            ))
          : null}

        {!loading && rows.length === 0 ? (
          <tr>
            <td colSpan={span} className="table-empty">
              {emptyMessage}
              {emptyAction ? (
                <div className="table-empty-actions">{emptyAction}</div>
              ) : null}
            </td>
          </tr>
        ) : null}

        {!loading
          ? rows.map((row) => (
              <tr key={rowKey(row)} className={rowClassName?.(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.align === 'right'
                        ? 'table-numeric'
                        : column.key === 'actions'
                          ? 'table-actions'
                          : undefined
                    }
                  >
                    {column.key === 'actions' ? (
                      <div className="table-actions-group">{column.render(row)}</div>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))
          : null}
      </tbody>
    </table>
  );
}
