import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { Category, FixedExpense, User } from '../types/api';
import { currencyInputToNumber, formatCurrencyInput, formatDate, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const emptyForm = {
  description: '',
  amount: '',
  dueDay: 1,
  startsOn: new Date().toISOString().slice(0, 10),
  active: true,
  userId: '',
  categoryId: '',
  notes: ''
};

function categoryStyle(color: string) {
  return { '--category-color': color } as CSSProperties;
}

export function FixedExpensesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<FixedExpense[]>('/fixed-expenses').then(setFixedExpenses).catch((error) => {
      toast.error('Erro ao carregar despesas fixas', error instanceof Error ? error.message : undefined);
    });
    api<Category[]>('/categories').then(setCategories).catch((error) => {
      toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
    });
    if (isAdmin) {
      api<User[]>('/users').then(setUsers).catch((error) => {
        toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
      });
    }
  }

  useEffect(load, [isAdmin]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api('/fixed-expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          amount: currencyInputToNumber(form.amount)
        })
      });
      toast.success('Despesa fixa cadastrada', `${form.description} foi adicionada.`);
      setForm(emptyForm);
      load();
    } catch (error) {
      toast.error('Erro ao cadastrar despesa fixa', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeFixedExpense(fixedExpense: FixedExpense) {
    if (!window.confirm(`Excluir a despesa fixa "${fixedExpense.description}"?`)) {
      return;
    }

    try {
      await api(`/fixed-expenses/${fixedExpense.id}`, { method: 'DELETE' });
      toast.success('Despesa fixa excluida', `${fixedExpense.description} foi removida.`);
      load();
    } catch (error) {
      toast.error('Erro ao excluir despesa fixa', error instanceof Error ? error.message : undefined);
    }
  }

  const totalActive = fixedExpenses
    .filter((item) => item.active)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Despesas fixas</h1>
        </div>
      </div>

      {isAdmin && (
        <form className="panel form-grid" onSubmit={submit}>
          <input placeholder="Descricao" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <input
            inputMode="numeric"
            placeholder="Valor mensal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: formatCurrencyInput(e.target.value) })}
            required
          />
          <input type="number" min={1} max={31} placeholder="Dia de vencimento" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Number(e.target.value) })} required />
          <input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} required />
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
            <option value="">Usuario</option>
            {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Categoria</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativa
          </label>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Cadastrando...' : 'Cadastrar despesa fixa'}
          </button>
        </form>
      )}

      <div className="panel">
        <div className="section-heading">
          <div>
            <h2>Recorrencias cadastradas</h2>
            <span>{money(totalActive)} em despesas ativas</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descricao</th>
                <th>Usuario</th>
                <th>Categoria</th>
                <th>Valor mensal</th>
                <th>Vencimento</th>
                <th>Inicio</th>
                <th>Status</th>
                {isAdmin && <th aria-label="Acoes" />}
              </tr>
            </thead>
            <tbody>
              {fixedExpenses.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.userName}</td>
                  <td>
                    <span className="category-tag" style={categoryStyle(item.categoryColor)}>
                      {item.categoryName}
                    </span>
                  </td>
                  <td>{money(Number(item.amount))}</td>
                  <td>Dia {item.dueDay}</td>
                  <td>{formatDate(item.startsOn)}</td>
                  <td><span className={`status-pill ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Ativa' : 'Inativa'}</span></td>
                  {isAdmin && (
                    <td className="actions-cell">
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Excluir despesa fixa"
                        aria-label={`Excluir ${item.description}`}
                        onClick={() => removeFixedExpense(item)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
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
