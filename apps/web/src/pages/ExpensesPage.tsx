import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Card, Category, Expense, User } from '../types/api';
import { money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const emptyForm = {
  description: '',
  totalAmount: 0,
  installments: 1,
  purchaseDate: new Date().toISOString().slice(0, 10),
  userId: '',
  cardId: '',
  categoryId: '',
  notes: ''
};

export function ExpensesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<Expense[]>('/expenses').then(setExpenses).catch((error) => {
      toast.error('Erro ao carregar compras', error instanceof Error ? error.message : undefined);
    });
    api<Category[]>('/categories').then(setCategories).catch((error) => {
      toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
    });
    if (isAdmin) {
      api<User[]>('/users').then(setUsers).catch((error) => {
        toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
      });
      api<Card[]>('/cards').then(setCards).catch((error) => {
        toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
      });
    }
  }

  useEffect(load, [isAdmin]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api('/expenses', { method: 'POST', body: JSON.stringify(form) });
      toast.success('Compra cadastrada', 'As parcelas ja aparecem no resumo mensal.');
      setForm(emptyForm);
      load();
    } catch (error) {
      toast.error('Erro ao cadastrar compra', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Compras</h1>
        </div>
      </div>

      {isAdmin && (
        <form className="panel form-grid" onSubmit={submit}>
          <input placeholder="Descricao" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input type="number" step="0.01" placeholder="Valor total" value={form.totalAmount || ''} onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })} />
          <input type="number" min={1} max={120} placeholder="Parcelas" value={form.installments} onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })} />
          <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
            <option value="">Usuario</option>
            {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={form.cardId} onChange={(e) => setForm({ ...form, cardId: e.target.value })} required>
            <option value="">Cartao</option>
            {cards.map((item) => <option key={item.id} value={item.id}>{item.name} **** {item.lastFour}</option>)}
          </select>
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Categoria</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Cadastrando...' : 'Cadastrar compra'}
          </button>
        </form>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descricao</th>
                <th>Usuario</th>
                <th>Cartao</th>
                <th>Categoria</th>
                <th>Total</th>
                <th>Parcelas</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.userName}</td>
                  <td>{item.cardName}</td>
                  <td>{item.categoryName}</td>
                  <td>{money(Number(item.totalAmount))}</td>
                  <td>{item.installments}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
