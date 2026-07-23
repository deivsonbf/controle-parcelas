import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
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
  recurring: true,
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
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api<FixedExpense[]>(`/fixed-expenses?month=${month}`).then(setFixedExpenses).catch((error) => {
      toast.error('Erro ao carregar despesas mensais', error instanceof Error ? error.message : undefined);
    });
    api<Category[]>('/categories').then(setCategories).catch((error) => {
      toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
    });
    if (isAdmin) {
      api<User[]>('/users').then((items) => setUsers(items.filter((item) => !item.cardBuyerOnly))).catch((error) => {
        toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
      });
    }
  }

  useEffect(load, [isAdmin, month]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(editingId ? `/fixed-expenses/${editingId}` : '/fixed-expenses', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          amount: currencyInputToNumber(form.amount)
        })
      });
      toast.success(editingId ? 'Despesa mensal atualizada' : 'Despesa mensal cadastrada', `${form.description} foi salva.`);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(`Erro ao ${editingId ? 'atualizar' : 'cadastrar'} despesa mensal`, error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function editFixedExpense(item: FixedExpense) {
    setEditingId(item.id);
    setForm({ description: item.description, amount: formatCurrencyInput(String(Math.round(Number(item.amount) * 100))), dueDay: item.dueDay, startsOn: item.startsOn.slice(0, 10), recurring: item.recurring, active: item.active, userId: item.userId, categoryId: item.categoryId, notes: item.notes ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  async function removeFixedExpense(fixedExpense: FixedExpense) {
    if (!window.confirm(`Excluir a despesa mensal "${fixedExpense.description}"?`)) {
      return;
    }

    try {
      await api(`/fixed-expenses/${fixedExpense.id}`, { method: 'DELETE' });
      toast.success('Despesa mensal excluida', `${fixedExpense.description} foi removida.`);
      load();
    } catch (error) {
      toast.error('Erro ao excluir despesa mensal', error instanceof Error ? error.message : undefined);
    }
  }

  const totalMonth = fixedExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Despesas mensais</h1>
          <p>Controle despesas recorrentes e lancamentos de uma unica competencia.</p>
        </div>
        <div className="filters">
          <label className="form-field">
            Competencia
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>
      </div>

      {isAdmin && (
        <form className="panel form-grid" onSubmit={submit}>
          <label className="form-field">
            Descricao
            <input placeholder="Ex.: Internet, aluguel" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </label>
          <label className="form-field">
            Valor mensal
            <input
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: formatCurrencyInput(e.target.value) })}
              required
            />
          </label>
          <label className="form-field">
            Dia de vencimento
            <input type="number" min={1} max={31} placeholder="1" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Number(e.target.value) })} required />
          </label>
          <label className="form-field">
            Inicio
            <input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} required />
          </label>
          <label className="form-field">
            Usuario
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Selecione um dono</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            Categoria
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">Selecione</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativa
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
            Recorrente
          </label>
          <label className="form-field">
            Observacoes
            <input placeholder="Opcional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Cadastrar despesa mensal'}
          </button>
          {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}><X size={17} /> Cancelar</button>}
        </form>
      )}

      <div className="panel">
        <div className="section-heading">
          <div>
            <h2>Despesas do mes</h2>
            <span>{money(totalMonth)} em {fixedExpenses.length} despesas da competencia {month}</span>
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
                <th>Recorrente</th>
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
                  <td><span className={`status-pill ${item.recurring ? 'active' : 'inactive'}`}>{item.recurring ? 'Sim' : 'Nao'}</span></td>
                  <td><span className={`status-pill ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Ativa' : 'Inativa'}</span></td>
                  {isAdmin && (
                    <td className="actions-cell"><div className="table-actions">
                      <button className="icon-button" type="button" title="Editar despesa mensal" aria-label={`Editar ${item.description}`} onClick={() => editFixedExpense(item)}><Pencil size={17} /></button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Excluir despesa mensal"
                        aria-label={`Excluir ${item.description}`}
                        onClick={() => removeFixedExpense(item)}
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
        {fixedExpenses.length === 0 && <p className="empty-state">Nenhuma despesa mensal ativa neste mes.</p>}
      </div>
    </section>
  );
}
