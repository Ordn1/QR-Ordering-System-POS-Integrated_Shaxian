import { useTranslation } from 'react-i18next';

import Card from '../../components/shared/Card';
import { useAuthStore } from '../../store/authStore';

export default function SignedInPage() {
  const { t } = useTranslation();
  const staff = useAuthStore((state) => state.staff);

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('auth.signedIn')}</h1>
      </header>
      <Card title={t('auth.accountTitle')}>
        <dl className="detail-list">
          <dt className="eyebrow">{t('auth.name')}</dt>
          <dd>{staff.full_name}</dd>
          <dt className="eyebrow">{t('auth.username')}</dt>
          <dd>{staff.username}</dd>
          <dt className="eyebrow">{t('auth.staffId')}</dt>
          <dd className="numeric">{staff.staff_id}</dd>
          <dt className="eyebrow">{t('auth.role')}</dt>
          <dd>{staff.role.replace('_', ' ')}</dd>
        </dl>
      </Card>
    </main>
  );
}
