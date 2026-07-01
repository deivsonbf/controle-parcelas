import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types/api';
import { useToast } from '../contexts/ToastContext';

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user', active: true, cardBuyerOnly: false });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<User[]>('/users').then(setUsers).catch((error) => {
      toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
    });
  }

  useEffect(load, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      toast.success('Usuario cadastrado', `${form.name} ja pode acessar o sistema.`);
      setForm({ name: '', email: '', password: '', role: 'user', active: true, cardBuyerOnly: false });
      load();
    } catch (error) {
      toast.error('Erro ao cadastrar usuario', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleCardBuyerOnly(item: User) {
    try {
      await api(`/users/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: item.name,
          email: item.email,
          role: item.role,
          active: item.active,
          cardBuyerOnly: !item.cardBuyerOnly
        })
      });
      toast.success('Tipo de usuario atualizado', `${item.name} foi atualizado.`);
      load();
    } catch (error) {
      toast.error('Erro ao atualizar usuario', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <section className="page">
      <div className="page-header"><div><h1>Usuarios</h1></div></div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Senha inicial" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="user">Utilizador</option>
          <option value="admin">Administrador</option>
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.cardBuyerOnly}
            onChange={(e) => setForm({ ...form, cardBuyerOnly: e.target.checked })}
          />
          Compra no cartao, mas nao e dono
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Cadastrando...' : 'Cadastrar usuario'}
        </button>
      </form>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Tipo</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.email}</td>
                <td>{item.role}</td>
                <td>{item.cardBuyerOnly ? 'Utilizador do cartao' : 'Dono do cartao'}</td>
                <td>{item.active ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <button className="secondary-button compact" type="button" onClick={() => toggleCardBuyerOnly(item)}>
                    {item.cardBuyerOnly ? 'Marcar dono' : 'Marcar utilizador'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
