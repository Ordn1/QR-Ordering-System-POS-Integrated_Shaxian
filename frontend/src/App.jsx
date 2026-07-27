import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from './components/shared/AppShell';
import ToastRegion from './components/shared/ToastRegion';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import CustomerMenuPage from './pages/customer/CustomerMenuPage';
import CustomerShell from './pages/customer/CustomerShell';
import ReceiptPage from './pages/customer/ReceiptPage';
import SplitBillPage from './pages/customer/SplitBillPage';
import StatusPage from './pages/customer/StatusPage';
import TableEntryPage from './pages/customer/TableEntryPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import DashboardPage from './pages/admin/DashboardPage';
import MenuPage from './pages/admin/MenuPage';
import PosPage from './pages/admin/PosPage';
import TransactionsPage from './pages/admin/TransactionsPage';
import VerificationsPage from './pages/admin/VerificationsPage';
import AtomsPage from './pages/dev/AtomsPage';
import LoginPage from './pages/staff/LoginPage';
import QueuePage from './pages/staff/QueuePage';
import SignedInPage from './pages/staff/SignedInPage';
import ProtectedRoute from './routes/ProtectedRoute';

const ADMIN_LINKS = [
  { to: '/admin/dashboard', labelKey: 'admin.dashboardTitle' },
  { to: '/admin/menu', labelKey: 'admin.menuTitle' },
  { to: '/admin/categories', labelKey: 'admin.categoriesTitle' },
  { to: '/admin/transactions', labelKey: 'admin.transactionsTitle' },
  { to: '/admin/verifications', labelKey: 'admin.verificationsTitle' },
  { to: '/admin/pos', labelKey: 'admin.posTitle' },
];

const STAFF_LINKS = [{ to: '/staff/queue', labelKey: 'staff.queueTitle' }];

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/dev/atoms" element={<AtomsPage />} />

        <Route path="/t/:qrToken" element={<TableEntryPage />} />
        <Route path="/t/:qrToken" element={<CustomerShell />}>
          <Route path="menu" element={<CustomerMenuPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="split" element={<SplitBillPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="receipt" element={<ReceiptPage />} />
          <Route path="status" element={<StatusPage />} />
        </Route>

        <Route path="/admin/login" element={<LoginPage titleKey="auth.adminTitle" />} />
        <Route path="/staff/login" element={<LoginPage titleKey="auth.staffTitle" />} />

        <Route element={<ProtectedRoute roles={['admin']} loginPath="/admin/login" />}>
          <Route
            path="/admin"
            element={<AppShell links={ADMIN_LINKS} loginPath="/admin/login" />}
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="verifications" element={<VerificationsPage />} />
            <Route path="pos" element={<PosPage />} />
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['admin', 'service_crew']} loginPath="/staff/login" />
          }
        >
          <Route
            path="/staff"
            element={<AppShell links={STAFF_LINKS} loginPath="/staff/login" />}
          >
            <Route index element={<Navigate to="/staff/queue" replace />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="account" element={<SignedInPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/staff/login" replace />} />
      </Routes>
      <ToastRegion />
    </div>
  );
}
