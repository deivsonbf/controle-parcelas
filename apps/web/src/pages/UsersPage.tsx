import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types/api';
import { useToast } from '../contexts/ToastContext';
import { Pencil, X } from 'lucide-react';

const emptyForm = { name: '', email: '', password: '', role: 'user', active: true, cardBuyerOnly: false, jointAccount: false };

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      const payload = editingId && !form.password
        ? { ...form, password: undefined }
        : form;
      await api(editingId ? `/users/${editingId}` : '/users', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      toast.success(editingId ? 'Usuario atualizado' : 'Usuario cadastrado', `${form.name} foi salvo.`);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(`Erro ao ${editingId ? 'atualizar' : 'cadastrar'} usuario`, error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function editUser(item: User) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      email: item.email,
      password: '',
      role: item.role,
      active: item.active,
      cardBuyerOnly: item.cardBuyerOnly,
      jointAccount: item.jointAccount
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
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
          cardBuyerOnly: !item.cardBuyerOnly,
          jointAccount: item.jointAccount
        })
      });
      toast.success('Tipo de usuario atualizado', `${item.name} foi atualizado.`);
      load();
    } catch (error) {
      toast.error('Erro ao atualizar usuario', error instanceof Error ? error.message : undefined);
    }
  }

  async function toggleJointAccount(item: User) {
    try {
      await api(`/users/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: item.name,
          email: item.email,
          role: item.role,
          active: item.active,
          cardBuyerOnly: item.cardBuyerOnly,
          jointAccount: !item.jointAccount
        })
      });
      toast.success('Conta conjunta atualizada', `${item.name} foi atualizado.`);
      load();
    } catch (error) {
      toast.error('Erro ao atualizar conta conjunta', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <section className="page">
      <div className="page-header"><div><h1>Usuarios</h1></div></div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder={editingId ? 'Nova senha (opcional)' : 'Senha inicial'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
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
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.jointAccount}
            onChange={(e) => setForm({ ...form, jointAccount: e.target.checked })}
          />
          Conta conjunta
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Ativo
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Cadastrar usuario'}
        </button>
        {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}><X size={17} /> Cancelar</button>}
      </form>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Tipo</th><th>Conta conjunta</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.email}</td>
                <td>{item.role}</td>
                <td>{item.cardBuyerOnly ? 'Utilizador do cartao' : 'Dono do cartao'}</td>
                <td>{item.jointAccount ? 'Sim' : 'Nao'}</td>
                <td>{item.active ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <button className="icon-button" type="button" title="Editar usuario" aria-label={`Editar ${item.name}`} onClick={() => editUser(item)}><Pencil size={17} /></button>
                  <button className="secondary-button compact" type="button" onClick={() => toggleCardBuyerOnly(item)}>
                    {item.cardBuyerOnly ? 'Marcar dono' : 'Marcar utilizador'}
                  </button>
                  <button className="secondary-button compact" type="button" onClick={() => toggleJointAccount(item)}>
                    {item.jointAccount ? 'Remover conjunta' : 'Marcar conjunta'}
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
