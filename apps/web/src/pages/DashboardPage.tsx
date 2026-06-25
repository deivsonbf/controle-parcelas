import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { MonthlyInstallmentsChart } from '../components/MonthlyInstallmentsChart';
import { SortableInstallmentsTable } from '../components/SortableInstallmentsTable';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import type { MonthlyResponse, MonthlySummary, User } from '../types/api';
import { copyText, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const pixKey = import.meta.env.VITE_PIX_KEY ?? '';

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [data, setData] = useState<MonthlyResponse | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      api<User[]>('/users').then(setUsers).catch((error) => {
        toast.error('Erro ao carregar usuarios', error instanceof Error ? error.message : undefined);
      });
    }
  }, [toast, user?.role]);

  useEffect(() => {
    const query = new URLSearchParams({ month });
    if (selectedUser) query.set('userId', selectedUser);
    api<MonthlyResponse>(`/reports/monthly-installments?${query}`)
      .then(setData)
      .catch((error) => {
        toast.error('Erro ao carregar resumo', error instanceof Error ? error.message : undefined);
      });
  }, [month, selectedUser, toast]);

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

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    data?.items.forEach((item) => {
      map.set(item.categoryName, (map.get(item.categoryName) ?? 0) + Number(item.installmentAmount));
    });
    return Array.from(map.entries());
  }, [data]);

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
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total do mes" value={money(data?.total ?? 0)} />
        <StatCard label="Parcelas" value={String(data?.items.length ?? 0)} tone="green" />
        <StatCard label="Categorias" value={String(byCategory.length)} tone="amber" />
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
              <span>Valor deste mes: {money(data?.total ?? 0)}</span>
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

      <div className="split-grid">
        <div className="panel">
          <h2>Compras na fatura</h2>
          <SortableInstallmentsTable items={data?.items ?? []} />
        </div>

        <div className="panel">
          <h2>Por categoria</h2>
          <div className="category-list">
            {byCategory.map(([category, total]) => (
              <div key={category}>
                <span>{category}</span>
                <strong>{money(total)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
