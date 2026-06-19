import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallAppPrompt } from './components/InstallAppPrompt';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { CardsPage } from './pages/CardsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <InstallAppPrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
              <Route path="cards" element={<ProtectedRoute adminOnly><CardsPage /></ProtectedRoute>} />
              <Route path="categories" element={<ProtectedRoute adminOnly><CategoriesPage /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
