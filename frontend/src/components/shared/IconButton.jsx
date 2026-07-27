import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';

const VARIANTS = {
  view: { className: 'icon-view-btn', Icon: Eye },
  edit: { className: 'icon-edit-btn', Icon: Pencil },
  delete: { className: 'icon-delete-btn', Icon: Trash2 },
  create: { className: 'icon-create-btn', Icon: Plus },
  remove: { className: 'remove-btn', Icon: X },
};

export default function IconButton({ variant, label, size = 18, ...rest }) {
  const { className, Icon } = VARIANTS[variant];

  return (
    <button type="button" className={className} aria-label={label} {...rest}>
      <Icon size={size} strokeWidth={1.75} />
    </button>
  );
}
