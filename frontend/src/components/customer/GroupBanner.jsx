import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shown once a second phone scans the same table code. Without it a joining diner
 * gets an ordinary menu and no sign that they are attached to the table's session,
 * which is the moment the group segment starts driving their recommendations.
 */
export default function GroupBanner({ session }) {
  const { t } = useTranslation();

  if (!session?.group_mode) {
    return null;
  }

  return (
    <aside className="group-banner">
      <Users className="group-banner-icon" size={20} strokeWidth={1.75} aria-hidden="true" />
      <div>
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
