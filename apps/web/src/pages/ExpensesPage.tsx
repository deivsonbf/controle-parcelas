import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import type { Card, Category, Expense, User } from '../types/api';
import { currencyInputToNumber, formatCurrencyInput, formatDate, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { ExpenseType } from '../types/api';

const expenseTypeLabels: Record<ExpenseType, string> = {
  fixed: 'Fixa',
  card: 'Cartoes',
  unplanned: 'Nao planejada'
};

const emptyForm = {
  description: '',
  totalAmount: '',
  installments: 1,
  purchaseDate: new Date().toISOString().slice(0, 10),
  expenseType: 'card' as ExpenseType,
  recurring: false,
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
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    const query = new URLSearchParams();
    if (selectedUser) query.set('userId', selectedUser);
    if (selectedCard) query.set('cardId', selectedCard);

    api<Expense[]>(`/expenses${query.size ? `?${query}` : ''}`).then(setExpenses).catch((error) => {
      toast.error('Erro ao carregar compras', error instanceof Error ? error.message : undefined);
    });
    api<Category[]>('/categories').then(setCategories).catch((error) => {
      toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
    });
    if (isAdmin) {
      api<User[]>('/users').then((items) => setUsers(items.filter((item) => !item.cardBuyerOnly))).catch((error) => {
        toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
      });
      api<Card[]>('/cards').then(setCards).catch((error) => {
        toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
      });
    }
  }

  useEffect(load, [isAdmin, selectedCard, selectedUser]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(editingId ? `/expenses/${editingId}` : '/expenses', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          totalAmount: currencyInputToNumber(form.totalAmount)
        })
      });
      toast.success(editingId ? 'Compra atualizada' : 'Compra cadastrada', 'As parcelas e os resumos mensais foram atualizados.');
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(`Erro ao ${editingId ? 'atualizar' : 'cadastrar'} compra`, error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function editExpense(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      description: expense.description,
      totalAmount: formatCurrencyInput(String(Math.round(Number(expense.totalAmount) * 100))),
      installments: expense.installments,
      purchaseDate: expense.purchaseDate.slice(0, 10),
      expenseType: expense.expenseType,
      recurring: expense.recurring,
      userId: expense.userId,
      cardId: expense.cardId,
      categoryId: expense.categoryId,
      notes: expense.notes ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`Excluir a compra "${expense.description}"? Todas as parcelas serao removidas.`)) {
      return;
    }

    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      toast.success('Compra excluida', 'As parcelas foram removidas dos resumos mensais.');
      load();
    } catch (error) {
      toast.error('Erro ao excluir compra', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Compras</h1>
          <p>Cadastre compras no cartao e acompanhe como elas entram nas faturas mensais.</p>
        </div>
        {isAdmin && (
          <div className="filters">
            <label className="form-field">
              Usuario
              <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
                <option value="">Todos os donos</option>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              Cartao
              <select value={selectedCard} onChange={(event) => setSelectedCard(event.target.value)}>
                <option value="">Todos os cartoes</option>
                {cards.map((item) => <option key={item.id} value={item.id}>{item.name} **** {item.lastFour}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {isAdmin && (
        <form className="panel form-grid" onSubmit={submit}>
          <label className="form-field">
            Descricao
            <input placeholder="Ex.: Mercado, app, farmacia" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="form-field">
            Valor total
            <input
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: formatCurrencyInput(e.target.value) })}
              required
            />
          </label>
          <label className="form-field">
            Parcelas
            <input type="number" min={1} max={120} placeholder="1" value={form.installments} onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })} />
          </label>
          <label className="form-field">
            Data da compra
            <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </label>
          <label className="form-field">
            Tipo de despesa
            <select value={form.expenseType} onChange={(e) => setForm({ ...form, expenseType: e.target.value as ExpenseType })} required>
              {Object.entries(expenseTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
            Recorrente
          </label>
          <label className="form-field">
            Usuario
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Selecione um dono</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            Cartao
            <select value={form.cardId} onChange={(e) => setForm({ ...form, cardId: e.target.value })} required>
              <option value="">Selecione</option>
              {cards.map((item) => <option key={item.id} value={item.id}>{item.name} **** {item.lastFour}</option>)}
            </select>
          </label>
          <label className="form-field">
            Categoria
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">Selecione</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            Observacoes
            <input placeholder="Opcional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Cadastrar compra'}
          </button>
          {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}><X size={17} /> Cancelar</button>}
        </form>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descricao</th>
                <th>Data da compra</th>
                <th>Usuario</th>
                <th>Cartao</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Recorrente</th>
                <th>Observacoes</th>
                <th>Total</th>
                <th>Parcelas</th>
                {isAdmin && <th aria-label="Acoes" />}
              </tr>
            </thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{formatDate(item.purchaseDate)}</td>
                  <td>{item.userName}</td>
                  <td>{item.cardName}</td>
                  <td>{item.categoryName}</td>
                  <td><span className={`expense-type-tag ${item.expenseType}`}>{expenseTypeLabels[item.expenseType]}</span></td>
                  <td><span className={`status-pill ${item.recurring ? 'active' : 'inactive'}`}>{item.recurring ? 'Sim' : 'Nao'}</span></td>
                  <td className="notes-cell">{item.notes || '-'}</td>
                  <td>{money(Number(item.totalAmount))}</td>
                  <td>{item.installments}x</td>
                  {isAdmin && (
                    <td className="actions-cell"><div className="table-actions">
                      <button className="icon-button" type="button" title="Editar compra" aria-label={`Editar ${item.description}`} onClick={() => editExpense(item)}><Pencil size={17} /></button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Excluir compra"
                        aria-label={`Excluir ${item.description}`}
                        onClick={() => removeExpense(item)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
