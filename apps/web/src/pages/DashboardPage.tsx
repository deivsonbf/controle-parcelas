import { FormEvent, useEffect, useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { MonthlyInstallmentsChart } from '../components/MonthlyInstallmentsChart';
import { SortableInstallmentsTable } from '../components/SortableInstallmentsTable';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import type { Card, DashboardSummary, InvoicePayment, MonthlyResponse, MonthlySummary, User } from '../types/api';
import { copyText, currencyInputToNumber, formatCurrencyInput, formatDate, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const pixKey = import.meta.env.VITE_PIX_KEY ?? '';
const today = new Date().toISOString().slice(0, 10);

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [monthlyInstallments, setMonthlyInstallments] = useState<MonthlyResponse | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [paymentForm, setPaymentForm] = useState({ cardId: '', amount: '', paymentDate: today, notes: '' });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    api<User[]>('/users').then(setUsers).catch((error) => {
      toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
    });

    api<Card[]>('/cards').then(setCards).catch((error) => {
      toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
    });
  }, [toast, user?.role]);

  async function loadDashboard() {
    const query = new URLSearchParams({ month });
    if (selectedUser) query.set('userId', selectedUser);
    if (selectedCard) query.set('cardId', selectedCard);

    try {
      setDashboard(await api<DashboardSummary>(`/reports/dashboard?${query}`));
    } catch (error) {
      toast.error('Erro ao carregar dashboard', error instanceof Error ? error.message : undefined);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [month, selectedCard, selectedUser, toast]);

  async function loadInvoicePayments() {
    if (user?.role !== 'admin') return;
    const query = new URLSearchParams({ month });
    if (selectedCard) query.set('cardId', selectedCard);

    try {
      setInvoicePayments(await api<InvoicePayment[]>(`/invoice-payments?${query}`));
    } catch (error) {
      toast.error('Erro ao carregar pagamentos', error instanceof Error ? error.message : undefined);
    }
  }

  useEffect(() => {
    loadInvoicePayments();
  }, [month, selectedCard, toast, user?.role]);

  useEffect(() => {
    if (!selectedCard) return;
    setPaymentForm((current) => ({ ...current, cardId: selectedCard }));
  }, [selectedCard]);

  useEffect(() => {
    if (user?.role !== 'user') return;

    setSummaryLoading(true);
    api<MonthlySummary[]>('/reports/summary')
      .then(setMonthlySummary)
      .catch((error) => {
        toast.error('Erro ao carregar grafico', error instanceof Error ? error.message : undefined);
      })
      .finally(() => setSummaryLoading(false));
  }, [toast, user?.role]);

  useEffect(() => {
    if (user?.role !== 'user') return;

    setInstallmentsLoading(true);
    api<MonthlyResponse>(`/reports/monthly-installments?month=${month}`)
      .then(setMonthlyInstallments)
      .catch((error) => {
        toast.error('Erro ao carregar compras parceladas', error instanceof Error ? error.message : undefined);
      })
      .finally(() => setInstallmentsLoading(false));
  }, [month, toast, user?.role]);

  const installmentPurchases = (monthlyInstallments?.items ?? []).filter((item) => item.totalInstallments > 1);
  const installmentPurchasesTotal = installmentPurchases.reduce(
    (total, item) => total + Number(item.installmentAmount),
    0
  );
  const isBuyerOnly = dashboard?.viewerCardBuyerOnly ?? user?.cardBuyerOnly ?? false;

  async function copyPix(value: string, label: string) {
    try {
      await copyText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`Nao foi possivel copiar ${label.toLowerCase()}`);
    }
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    setPaymentSubmitting(true);
    try {
      await api('/invoice-payments', {
        method: 'POST',
        body: JSON.stringify({
          cardId: paymentForm.cardId,
          month,
          amount: currencyInputToNumber(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          notes: paymentForm.notes || null
        })
      });
      toast.success('Pagamento registrado', 'O valor foi abatido da fatura selecionada.');
      setPaymentForm({ cardId: selectedCard, amount: '', paymentDate: today, notes: '' });
      await Promise.all([loadDashboard(), loadInvoicePayments()]);
    } catch (error) {
      toast.error('Erro ao registrar pagamento', error instanceof Error ? error.message : undefined);
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function removePayment(payment: InvoicePayment) {
    if (!window.confirm(`Excluir pagamento de ${money(Number(payment.amount))} do cartao ${payment.cardName}?`)) {
      return;
    }

    try {
      await api(`/invoice-payments/${payment.id}`, { method: 'DELETE' });
      toast.success('Pagamento removido');
      await Promise.all([loadDashboard(), loadInvoicePayments()]);
    } catch (error) {
      toast.error('Erro ao remover pagamento', error instanceof Error ? error.message : undefined);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Resumo mensal</h1>
          <p>Acompanhe faturas, despesas mensais e pagamentos do periodo selecionado.</p>
        </div>
        <div className="filters">
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          {user?.role === 'admin' && (
            <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="">Todos os usuarios</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          {user?.role === 'admin' && (
            <select value={selectedCard} onChange={(event) => setSelectedCard(event.target.value)}>
              <option value="">Todos os cartoes</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} **** {card.lastFour}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className={`stats-grid${isBuyerOnly ? ' single-stat' : ''}`}>
        {!isBuyerOnly && <StatCard label="Total previsto" value={money(dashboard?.grandTotal ?? 0)} />}
        <StatCard label={isBuyerOnly ? 'Minhas parcelas' : 'Cartoes do mes'} value={money(dashboard?.cardsTotal ?? 0)} tone="green" />
        {!isBuyerOnly && <StatCard label="Despesas mensais" value={money(dashboard?.fixedExpensesTotal ?? 0)} tone="amber" />}
      </div>

      {user?.role === 'admin' && (
        <div className="panel">
          <div className="user-type-grid">
            {(dashboard?.userGroups ?? []).map((group) => (
              <div className={`user-type-card ${group.key}`} key={group.key}>
                <div>
                  <span>{group.label}</span>
                  <strong>{money(Number(group.cardsTotal))}</strong>
                </div>
                <dl>
                  <div>
                    <dt>No cartao</dt>
                    <dd>{money(Number(group.cardsTotal))}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Pagamentos da fatura</h2>
              <span>{money(dashboard?.invoicePaymentsTotal ?? 0)} abatidos no mes selecionado</span>
            </div>
          </div>
          <form className="form-grid compact-form" onSubmit={submitPayment}>
            <select value={paymentForm.cardId} onChange={(event) => setPaymentForm({ ...paymentForm, cardId: event.target.value })} required>
              <option value="">Cartao</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>{card.name} **** {card.lastFour}</option>
              ))}
            </select>
            <input
              inputMode="numeric"
              placeholder="Valor pago"
              value={paymentForm.amount}
              onChange={(event) => setPaymentForm({ ...paymentForm, amount: formatCurrencyInput(event.target.value) })}
              required
            />
            <input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} required />
            <input placeholder="Observacao (opcional)" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
            <button className="primary-button" type="submit" disabled={paymentSubmitting}>
              {paymentSubmitting ? 'Salvando...' : 'Registrar pagamento'}
            </button>
          </form>
          <div className="summary-list">
            {invoicePayments.map((payment) => (
              <div className="summary-row" key={payment.id}>
                <div>
                  <strong>{payment.cardName} **** {payment.cardLastFour}</strong>
                  <span>{formatDate(payment.paymentDate)}{payment.notes ? ` - ${payment.notes}` : ''}</span>
                </div>
                <div className="payment-row-actions">
                  <strong>-{money(Number(payment.amount))}</strong>
                  <button className="icon-button danger" type="button" title="Excluir pagamento" aria-label="Excluir pagamento" onClick={() => removePayment(payment)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
            {invoicePayments.length === 0 && <p className="empty-state">Nenhum pagamento registrado neste mes.</p>}
          </div>
        </div>
      )}

      <div className={`split-grid dashboard-summary-grid${isBuyerOnly ? ' single-panel' : ''}`}>
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Cartoes no mes</h2>
              <span>{dashboard?.cards.length ?? 0} cartoes com parcelas no mes selecionado</span>
            </div>
          </div>
          <div className="summary-list">
            {(dashboard?.cards ?? []).map((card) => (
              <div className="summary-row" key={card.cardId}>
                <div>
                  <strong>{card.cardName} **** {card.cardLastFour}</strong>
                  {!isBuyerOnly && <span>Dono: {card.ownerUserName ?? card.ownerName ?? 'Nao vinculado'}</span>}
                  {!isBuyerOnly && (
                    <span>
                      Compra no cartao {card.ownerInstallments} parcelas: {money(Number(card.ownerTotal))} | Compras de terceiros {card.buyerInstallments} parcelas: {money(Number(card.buyerTotal))}
                    </span>
                  )}
                  {!isBuyerOnly && Number(card.invoicePaymentsTotal) > 0 && (
                    <span>
                      Pagamentos: -{money(Number(card.invoicePaymentsTotal))} | Saldo: {money(Number(card.ownerNetTotal))}
                    </span>
                  )}
                </div>
                <strong>{isBuyerOnly ? money(Number(card.total)) : money(Number(card.ownerNetTotal))}</strong>
              </div>
            ))}
            {dashboard?.cards.length === 0 && <p className="empty-state">Nenhuma parcela de cartao neste mes.</p>}
          </div>
        </div>

        {!isBuyerOnly && (
          <div className="panel">
            <div className="section-heading">
              <div>
                <h2>Despesas mensais</h2>
                <span>{dashboard?.fixedExpenses.length ?? 0} despesas ativas para o mes</span>
              </div>
            </div>
            <div className="summary-list">
              {(dashboard?.fixedExpenses ?? []).map((expense) => (
                <div className="summary-row" key={expense.id}>
                  <div>
                    <strong>{expense.description}</strong>
                    <span>Dia {expense.dueDay} - {expense.categoryName} - desde {formatDate(expense.startsOn)}</span>
                  </div>
                  <strong>{money(Number(expense.amount))}</strong>
                </div>
              ))}
              {dashboard?.fixedExpenses.length === 0 && <p className="empty-state">Nenhuma despesa mensal ativa neste mes.</p>}
            </div>
          </div>
        )}
      </div>

      {user?.role === 'user' && (
        <MonthlyInstallmentsChart
          items={monthlySummary}
          selectedMonth={month}
          loading={summaryLoading}
          onSelectMonth={setMonth}
        />
      )}

      {user?.role === 'user' && pixKey && (
        <div className="pix-panel">
          <div className="pix-heading">
            <div className="pix-icon"><KeyRound size={22} /></div>
            <div>
              <h2>Pagamento via PIX</h2>
              <span>Valor deste mes: {money(dashboard?.grandTotal ?? 0)}</span>
            </div>
          </div>

          <div className="pix-key-row">
            <div>
              <span>Chave PIX</span>
              <strong>{pixKey}</strong>
            </div>
            <button className="icon-button" type="button" title="Copiar chave PIX" onClick={() => copyPix(pixKey, 'Chave PIX')}>
              <Copy size={18} />
            </button>
          </div>

        </div>
      )}

      {user?.role === 'user' && (
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Compras parceladas do mes</h2>
              <span>
                {installmentPurchases.length} parcelas na fatura - {money(installmentPurchasesTotal)}
              </span>
            </div>
          </div>
          {installmentsLoading ? (
            <p className="empty-state">Carregando compras parceladas...</p>
          ) : installmentPurchases.length > 0 ? (
            <SortableInstallmentsTable items={installmentPurchases} />
          ) : (
            <p className="empty-state">Nenhuma compra parcelada neste mes.</p>
          )}
        </div>
      )}
    </section>
  );
}
