import { Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';

export default function GroupBanner({ session }) {
  const { t } = useTranslation();
  const { qrToken } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const setDisplayName = useSessionStore((state) => state.setDisplayName);
  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(session?.display_name ?? '');
  const [saving, setSaving] = useState(false);

  if (!session?.group_mode || session?.display_name || pathname.endsWith('/split')) {
    return null;
  }

  async function saveName() {
    setSaving(true);
    try {
      await setDisplayName(nickname.trim());
      setEditingName(false);
      toast.success(
        t('group.nicknameSaved', { defaultValue: 'Display name updated' }),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <aside className="group-banner-card">
        <div className="group-banner-icon-wrap">
          <Users size={18} strokeWidth={2} />
        </div>
        <div className="group-banner-content" style={{ flex: 1 }}>
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
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => {
              setNickname('');
              setEditingName(true);
            }}
          >
            {t('group.setName', { defaultValue: 'Set name' })}
          </Button>
          {qrToken ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/t/${qrToken}/split`)}
            >
              {t('split.title')}
            </Button>
          ) : null}
        </div>
      </aside>

      {editingName ? (
        <Modal
          title={t('group.nameModalTitle', { defaultValue: 'Your display name at this table' })}
          size="small"
          onClose={() => setEditingName(false)}
          footer={
            <>
              <Button
                variant="secondary"
                data-modal-cancel="true"
                onClick={() => setEditingName(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="primary" loading={saving} onClick={saveName}>
                {t('common.save')}
              </Button>
            </>
          }
        >
          <TextInput
            label={t('group.nicknameLabel', { defaultValue: 'Nickname shown to tablemates' })}
            inputClass="alphanumeric"
            maxLength={30}
            hint="e.g. Justin, Faith"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </Modal>
      ) : null}
    </>
  );
}