import { Outlet, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import Navbar from './Navbar';

export default function AppShell({ links, loginPath }) {
  const staff = useAuthStore((state) => state.staff);
  const signOut = useAuthStore((state) => state.signOut);
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate(loginPath, { replace: true });
  }

  return (
    <>
      <Navbar
        links={links}
        identity={staff ? `${staff.full_name} · ${staff.role.replace('_', ' ')}` : null}
        onSignOut={onSignOut}
      />
      <Outlet />
    </>
  );
}
