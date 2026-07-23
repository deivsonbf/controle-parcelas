import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Trash2, Undo2 } from 'lucide-react';
import { api } from '../services/api';
import type { FinancialControlSummary, FinancialIncome, FinancialPayable, User } from '../types/api';
import { currencyInputToNumber, formatCurrencyInput, formatDate, money } from '../utils';
import { useToast } from '../contexts/ToastContext';

const today = new Date().toISOString().slice(0, 10);

const emptyIncomeForm = {
  userId: '',
  description: 'Renda mensal',
  amount: '',
  receivedDate: today,
  notes: ''
};

export function FinancialControlPage() {
  const toast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<FinancialControlSummary | null>(null);
  const [incomeForm, setIncomeForm] = useState(emptyIncomeForm);
  const [loading, setLoading] = useState(false);
  const [submittingIncome, setSubmittingIncome] = useState(false);

  async function load() {
    setLoading(true);
    const query = new URLSearchParams({ month });
    if (selectedUser) query.set('userId', selectedUser);

    try {
      const [summaryResult, usersResult] = await Promise.all([
        api<FinancialControlSummary>(`/financial-control?${query}`),
        api<User[]>('/users')
      ]);
      setSummary(summaryResult);
      setUsers(usersResult.filter((item) => !item.cardBuyerOnly));
    } catch (error) {
      toast.error('Erro ao carregar controle financeiro', error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;
    setIncomeForm((current) => ({ ...current, userId: selectedUser }));
  }, [selectedUser]);

  async function submitIncome(event: FormEvent) {
    event.preventDefault();
    setSubmittingIncome(true);
    try {
      await api('/financial-control/incomes', {
        method: 'POST',
        body: JSON.stringify({
          ...incomeForm,
          month,
          amount: currencyInputToNumber(incomeForm.amount),
          notes: incomeForm.notes || null
        })
      });
      toast.success('Renda cadastrada');
      setIncomeForm({ ...emptyIncomeForm, userId: selectedUser });
      load();
    } catch (error) {
      toast.error('Erro ao cadastrar renda', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmittingIncome(false);
    }
  }

  async function removeIncome(income: FinancialIncome) {
    if (!window.confirm(`Excluir renda "${income.description}" de ${money(Number(income.amount))}?`)) return;

    try {
      await api(`/financial-control/incomes/${income.id}`, { method: 'DELETE' });
      toast.success('Renda removida');
      load();
    } catch (error) {
      toast.error('Erro ao remover renda', error instanceof Error ? error.message : undefined);
    }
  }

  async function markPaid(kind: 'fixed_expense' | 'card_invoice', item: FinancialPayable) {
    try {
      await api('/financial-control/payments', {
        method: 'POST',
        body: JSON.stringify({
          month,
          expenseKind: kind,
          fixedExpenseId: kind === 'fixed_expense' ? item.id : null,
          cardId: kind === 'card_invoice' ? item.cardId : null,
          amount: Number(item.amount),
          paidDate: today,
          notes: null
        })
      });
      toast.success('Pagamento marcado');
      load();
    } catch (error) {
      toast.error('Erro ao marcar pagamento', error instanceof Error ? error.message : undefined);
    }
  }

  async function undoPayment(item: FinancialPayable) {
    if (!item.paymentId) return;

    try {
      await api(`/financial-control/payments/${item.paymentId}`, { method: 'DELETE' });
      toast.success('Pagamento desfeito');
      load();
    } catch (error) {
      toast.error('Erro ao desfazer pagamento', error instanceof Error ? error.message : undefined);
    }
  }

  function payableRow(kind: 'fixed_expense' | 'card_invoice', item: FinancialPayable) {
    const title = kind === 'card_invoice'
      ? `${item.cardName} **** ${item.cardLastFour}`
      : item.description ?? 'Despesa mensal';
    const subtitle = kind === 'card_invoice'
      ? `Dono: ${item.ownerUserName ?? 'Nao vinculado'}${Number(item.invoicePaymentsTotal ?? 0) > 0 ? ` - adiantamentos: ${money(Number(item.invoicePaymentsTotal))}` : ''}`
      : `${item.userName} - ${item.categoryName} - vencimento dia ${item.dueDay}`;

    return (
      <div className="summary-row" key={`${kind}-${item.id ?? item.cardId}`}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
          {item.paid && item.paidDate && <span>Pago em {formatDate(item.paidDate)}</span>}
        </div>
        <div className="payment-row-actions">
          <strong>{money(Number(item.amount))}</strong>
          {item.paid ? (
            <button className="icon-button" type="button" title="Desfazer pagamento" onClick={() => undoPayment(item)}>
              <Undo2 size={17} />
            </button>
          ) : (
            <button className="icon-button" type="button" title="Marcar como pago" onClick={() => markPaid(kind, item)}>
              <CheckCircle2 size={17} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Controle financeiro</h1>
          <p>Registre rendas, acompanhe pagamentos e veja o saldo previsto do mes.</p>
        </div>
        <div className="filters">
          <label className="form-field">
            Competencia
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label className="form-field">
            Usuario
            <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="">Todos os donos</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green"><span>Renda</span><strong>{money(summary?.incomeTotal ?? 0)}</strong></div>
        <div className="stat-card amber"><span>Despesas</span><strong>{money(summary?.expensesTotal ?? 0)}</strong></div>
        <div className="stat-card"><span>Saldo previsto</span><strong>{money(summary?.balanceAfterExpenses ?? 0)}</strong></div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green"><span>Pago</span><strong>{money(summary?.paidTotal ?? 0)}</strong></div>
        <div className="stat-card amber"><span>A pagar</span><strong>{money(summary?.unpaidTotal ?? 0)}</strong></div>
        <div className="stat-card"><span>Cartoes</span><strong>{money(summary?.cardInvoicesTotal ?? 0)}</strong></div>
      </div>

      <form className="panel form-grid compact-form" onSubmit={submitIncome}>
        <label className="form-field">
          Usuario da renda
          <select value={incomeForm.userId} onChange={(event) => setIncomeForm({ ...incomeForm, userId: event.target.value })} required>
            <option value="">Selecione um dono</option>
            {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          Descricao
          <input placeholder="Ex.: Renda mensal" value={incomeForm.description} onChange={(event) => setIncomeForm({ ...incomeForm, description: event.target.value })} required />
        </label>
        <label className="form-field">
          Valor da renda
          <input inputMode="numeric" placeholder="R$ 0,00" value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: formatCurrencyInput(event.target.value) })} required />
        </label>
        <label className="form-field">
          Data de recebimento
          <input type="date" value={incomeForm.receivedDate} onChange={(event) => setIncomeForm({ ...incomeForm, receivedDate: event.target.value })} required />
        </label>
        <button className="primary-button" type="submit" disabled={submittingIncome}>{submittingIncome ? 'Salvando...' : 'Adicionar renda'}</button>
      </form>

      <div className="split-grid dashboard-summary-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Rendas do mes</h2>
              <span>{summary?.incomes.length ?? 0} lancamentos</span>
            </div>
          </div>
          <div className="summary-list">
            {(summary?.incomes ?? []).map((income) => (
              <div className="summary-row" key={income.id}>
                <div>
                  <strong>{income.description}</strong>
                  <span>{income.userName} - recebido em {formatDate(income.receivedDate)}</span>
                </div>
                <div className="payment-row-actions">
                  <strong>{money(Number(income.amount))}</strong>
                  <button className="icon-button danger" type="button" title="Excluir renda" onClick={() => removeIncome(income)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
            {summary?.incomes.length === 0 && <p className="empty-state">Nenhuma renda cadastrada neste mes.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Faturas dos cartoes</h2>
              <span>{summary?.cardInvoices.length ?? 0} faturas no mes</span>
            </div>
          </div>
          <div className="summary-list">
            {(summary?.cardInvoices ?? []).map((item) => payableRow('card_invoice', item))}
            {summary?.cardInvoices.length === 0 && <p className="empty-state">Nenhuma fatura encontrada neste mes.</p>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <h2>Despesas mensais</h2>
            <span>{summary?.fixedExpenses.length ?? 0} despesas no mes</span>
          </div>
        </div>
        <div className="summary-list">
          {(summary?.fixedExpenses ?? []).map((item) => payableRow('fixed_expense', item))}
          {summary?.fixedExpenses.length === 0 && (
            <p className="empty-state">{loading ? 'Carregando despesas...' : 'Nenhuma despesa mensal encontrada neste mes.'}</p>
          )}
        </div>
      </div>
    </section>
  );
}
