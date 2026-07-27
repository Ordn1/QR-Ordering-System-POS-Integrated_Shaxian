const VARIANT_CLASS = {
  primary: 'primary-btn',
  secondary: 'secondary-btn',
  ghost: 'ghost-btn',
  'wide-create': 'wide-create-btn',
  'wide-edit': 'wide-edit-btn',
  'wide-delete': 'wide-delete-btn',
  'wide-view': 'wide-view-btn',
  'add-to-cart': 'add-to-cart-btn',
  checkout: 'checkout-btn',
  lang: 'lang-btn',
};

export default function Button({
  variant = 'primary',
  type = 'button',
  icon: Icon,
  loading = false,
  disabled = false,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASS[variant]}${loading ? ' is-loading' : ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="btn-spinner" role="status" aria-label="Working" />
      ) : null}
      <span className="btn-label">
        {Icon ? <Icon size={20} strokeWidth={1.75} /> : null}
        {children}
      </span>
    </button>
  );
}
