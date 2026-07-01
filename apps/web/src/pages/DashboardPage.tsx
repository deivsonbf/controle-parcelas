import { useEffect, useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { MonthlyInstallmentsChart } from '../components/MonthlyInstallmentsChart';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import type { Card, DashboardSummary, MonthlySummary, User } from '../types/api';
import { copyText, formatDate, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const pixKey = import.meta.env.VITE_PIX_KEY ?? '';

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
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    api<User[]>('/users').then(setUsers).catch((error) => {
      toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
    });

    api<Card[]>('/cards').then(setCards).catch((error) => {
      toast.error('Erro ao carregar cartoes', error instanceof Error ? error.message : undefined);
    });
  }, [toast, user?.role]);

  useEffect(() => {
    const query = new URLSearchParams({ month });
    if (selectedUser) query.set('userId', selectedUser);
    if (selectedCard) query.set('cardId', selectedCard);

    api<DashboardSummary>(`/reports/dashboard?${query}`)
      .then(setDashboard)
      .catch((error) => {
        toast.error('Erro ao carregar dashboard', error instanceof Error ? error.message : undefined);
      });
  }, [month, selectedCard, selectedUser, toast]);

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

  async function copyPix(value: string, label: string) {
    try {
      await copyText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`Nao foi possivel copiar ${label.toLowerCase()}`);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Resumo mensal</h1>
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

      <div className="stats-grid">
        <StatCard label="Somatorio geral" value={money(dashboard?.grandTotal ?? 0)} />
        <StatCard label="Despesas no cartao" value={money(dashboard?.cardsTotal ?? 0)} tone="green" />
        <StatCard label="Despesas fixas" value={money(dashboard?.fixedExpensesTotal ?? 0)} tone="amber" />
      </div>

      {user?.role === 'admin' && (
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Cartao por tipo de usuario</h2>
              <span>Somente despesas no cartao, separadas entre dono e utilizador</span>
            </div>
          </div>
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
                  <div>
                    <dt>Usuarios</dt>
                    <dd>{group.users}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="split-grid dashboard-summary-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Total por cartao</h2>
              <span>{dashboard?.cards.length ?? 0} cartoes com parcelas dos donos no mes</span>
            </div>
          </div>
          <div className="summary-list">
            {(dashboard?.cards ?? []).map((card) => (
              <div className="summary-row" key={card.cardId}>
                <div>
                  <strong>{card.cardName} **** {card.cardLastFour}</strong>
                  <span>{card.installments} parcelas</span>
                </div>
                <strong>{money(Number(card.total))}</strong>
              </div>
            ))}
            {dashboard?.cards.length === 0 && <p className="empty-state">Nenhuma parcela de dono do cartao neste mes.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Despesas fixas</h2>
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
            {dashboard?.fixedExpenses.length === 0 && <p className="empty-state">Nenhuma despesa fixa ativa neste mes.</p>}
          </div>
        </div>
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
    </section>
  );
}
