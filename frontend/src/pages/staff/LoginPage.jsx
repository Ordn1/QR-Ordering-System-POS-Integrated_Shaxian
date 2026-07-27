import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import Button from '../../components/shared/Button';
import TextInput from '../../components/shared/TextInput';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

export default function LoginPage({ titleKey }) {
  const { t } = useTranslation();
  const signIn = useAuthStore((state) => state.signIn);
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setFieldErrors({});
    setSubmitting(true);

    try {
      const staff = await signIn(username, password);
      const target =
        location.state?.from ?? (staff.role === 'admin' ? '/admin' : '/staff');
      navigate(target, { replace: true });
    } catch (error) {
      if (error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
      }
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <div className="login-split">
        {/* The seal panel is brand, not content — hidden from assistive tech and
            dropped entirely on phones, where the form should own the screen. */}
        <aside className="login-art" aria-hidden="true">
          <img src="/logos/ShaxianIcon2.png" alt="" />
        </aside>

        <form className="login-form" onSubmit={onSubmit} noValidate>
          <div className="login-card">
            <img className="login-logo" src="/logos/ShaxianLogoStandard.png" alt="" />
            <h1 className="login-title">{t('auth.brand')}</h1>
            <p className="login-subtitle">{t(titleKey)}</p>

            <TextInput
              label={t('auth.username')}
              required
              maxLength={30}
              autoComplete="username"
              value={username}
              error={fieldErrors.username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextInput
              label={t('auth.password')}
              type="password"
              required
              maxLength={72}
              autoComplete="current-password"
              value={password}
              error={fieldErrors.password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              variant="primary"
              type="submit"
              loading={submitting}
              disabled={!username || !password}
            >
              {t('auth.signIn')}
            </Button>
          </div>
        </form>
        </div>

        <p className="login-hint">{t('auth.hint')}</p>
      </div>
    </main>
  );
}
