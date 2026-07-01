import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Card, User } from '../types/api';
import { useToast } from '../contexts/ToastContext';
import { Pencil, X } from 'lucide-react';

const emptyForm = { name: '', lastFour: '', ownerName: '', ownerUserId: '', closingDay: 10, dueDay: 20, active: true };

export function CardsPage() {
  const toast = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<Card[]>('/cards').then(setCards).catch((error) => {
      toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
    });
    api<User[]>('/users').then(setUsers).catch((error) => {
      toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
    });
  }

  useEffect(load, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(editingId ? `/cards/${editingId}` : '/cards', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify({ ...form, ownerUserId: form.ownerUserId || null }) });
      toast.success(editingId ? 'Cartao atualizado' : 'Cartao cadastrado', `${form.name} foi salvo.`);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(`Erro ao ${editingId ? 'atualizar' : 'cadastrar'} cartao`, error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function editCard(item: Card) {
    setEditingId(item.id);
    setForm({ name: item.name, lastFour: item.lastFour, ownerName: item.ownerName, ownerUserId: item.ownerUserId ?? '', closingDay: item.closingDay, dueDay: item.dueDay, active: item.active });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  return (
    <section className="page">
      <div className="page-header"><div><h1>Cartoes</h1></div></div>
      <form className="panel form-grid" onSubmit={submit}>
        <input placeholder="Nome do cartao" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Ultimos 4 digitos" maxLength={4} value={form.lastFour} onChange={(e) => setForm({ ...form, lastFour: e.target.value })} />
        <input placeholder="Titular" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        <select
          value={form.ownerUserId}
          onChange={(e) => {
            const owner = users.find((item) => item.id === e.target.value);
            setForm({ ...form, ownerUserId: e.target.value, ownerName: owner?.name ?? form.ownerName });
          }}
        >
          <option value="">Dono no sistema</option>
          {users.filter((item) => !item.cardBuyerOnly).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input type="number" min={1} max={31} value={form.closingDay} onChange={(e) => setForm({ ...form, closingDay: Number(e.target.value) })} />
        <input type="number" min={1} max={31} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Number(e.target.value) })} />
        <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Ativo</label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Cadastrar cartao'}
        </button>
        {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}><X size={17} /> Cancelar</button>}
      </form>
      <div className="panel table-wrap">
        <table>
          <thead><tr><th>Cartao</th><th>Final</th><th>Titular</th><th>Dono no sistema</th><th>Fechamento</th><th>Vencimento</th><th>Status</th><th aria-label="Acoes" /></tr></thead>
          <tbody>{cards.map((item) => <tr key={item.id}><td>{item.name}</td><td>**** {item.lastFour}</td><td>{item.ownerName}</td><td>{item.ownerUserName ?? 'Nao vinculado'}</td><td>Dia {item.closingDay}</td><td>Dia {item.dueDay}</td><td><span className={`status-pill ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Ativo' : 'Inativo'}</span></td><td className="actions-cell"><button className="icon-button" type="button" title="Editar cartao" aria-label={`Editar ${item.name}`} onClick={() => editCard(item)}><Pencil size={17} /></button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
