import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shown once a second phone scans the same table code.
 */
export default function GroupBanner({ session }) {
  const { t } = useTranslation();

  if (!session?.group_mode) {
    return null;
  }

  return (
    <aside className="group-banner-card">
      <div className="group-banner-icon-wrap">
        <Users size={18} strokeWidth={2} />
      </div>
      <div className="group-banner-content">
        <p className="group-banner-title">
          {session.is_host ? t('group.hostTitle') : t('group.joinedTitle')}
        </p>
        <p className="group-banner-note">
          {t('group.note', {
            number: session.table_number,
            count: session.device_count,
          })}
        </p>
      </div>
    </aside>
  );
}
