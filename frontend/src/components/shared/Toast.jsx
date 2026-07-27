export default function Toast({ type, message, onDismiss }) {
  return (
    <div
      className={`toast toast-${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}
