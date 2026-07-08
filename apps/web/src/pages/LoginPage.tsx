import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Login realizado', 'Bem-vindo de volta.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no login';
      setError(message);
      toast.error('Nao foi possivel entrar', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-icon"><Lock size={28} /></div>
        <h1>Acessar parcelas</h1>
        <p>Entre para acompanhar faturas, pagamentos e despesas compartilhadas.</p>
        <label>
          E-mail ou usuario
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="text" autoComplete="username" />
        </label>
        <label>
          Senha
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Acessando...' : 'Acessar'}
        </button>
      </form>
    </main>
  );
}
