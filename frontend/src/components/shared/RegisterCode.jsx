export default function RegisterCode({ code, size = 'default' }) {
  if (!code) {
    return null;
  }

  return (
    <span className={`register-code${size === 'large' ? ' register-code-large' : ''}`}>
      {code}
    </span>
  );
}
