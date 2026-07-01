import { CalendarClock, CreditCard, Folders, Home, LogOut, Receipt, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  function handleLogout() {
    logout();
    toast.info('Sessao encerrada');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <CreditCard size={24} />
          <div>
            <strong>Cartao Parcelado</strong>
            <span>{isAdmin ? 'Administracao' : 'Utilizador'}</span>
          </div>
        </div>

        <nav>
          <NavLink to="/"><Home size={18} />Resumo</NavLink>
          <NavLink to="/expenses"><Receipt size={18} />Compras</NavLink>
          <NavLink to="/fixed-expenses"><CalendarClock size={18} />Despesas fixas</NavLink>
          {isAdmin && <NavLink to="/users"><Users size={18} />Usuarios</NavLink>}
          {isAdmin && <NavLink to="/cards"><CreditCard size={18} />Cartoes</NavLink>}
          {isAdmin && <NavLink to="/categories"><Folders size={18} />Categorias</NavLink>}
        </nav>

        <button className="ghost-button" onClick={handleLogout}>
          <LogOut size={18} />Sair
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span>Logado como</span>
            <strong>{user?.name}</strong>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
