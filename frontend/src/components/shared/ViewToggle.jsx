import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useUiStore } from '../../store/uiStore';

export default function ViewToggle() {
  const { t } = useTranslation();
  const adminView = useUiStore((state) => state.adminView);
  const setAdminView = useUiStore((state) => state.setAdminView);

  const next = adminView === 'tiles' ? 'list' : 'tiles';
  const Icon = next === 'list' ? List : LayoutGrid;

  return (
    <button
      type="button"
      className="toggle-btn"
      aria-label={t(next === 'list' ? 'common.viewAsList' : 'common.viewAsTiles')}
      title={t(next === 'list' ? 'common.viewAsList' : 'common.viewAsTiles')}
      onClick={() => setAdminView(next)}
    >
      <Icon size={18} strokeWidth={1.75} />
    </button>
  );
}
