import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import type { MonthlyResponse, User } from '../types/api';
import { copyText, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createPixPayload } from '../services/pix';

const pixKey = import.meta.env.VITE_PIX_KEY ?? '';
const pixReceiverName = import.meta.env.VITE_PIX_RECEIVER_NAME ?? 'DEIVSON BEZERRA';
const pixReceiverCity = import.meta.env.VITE_PIX_RECEIVER_CITY ?? 'SAO PAULO';

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [data, setData] = useState<MonthlyResponse | null>(null);

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

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    data?.items.forEach((item) => {
      map.set(item.categoryName, (map.get(item.categoryName) ?? 0) + Number(item.installmentAmount));
    });
    return Array.from(map.entries());
  }, [data]);

  const pixPayload = useMemo(() => {
    if (!pixKey) return '';
    return createPixPayload({
      key: pixKey,
      amount: data?.total ?? 0,
      receiverName: pixReceiverName,
      receiverCity: pixReceiverCity
    });
  }, [data?.total]);

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

          <div className="pix-copy-code">
            <span>PIX copia e cola</span>
            <code>{pixPayload}</code>
            <button className="secondary-button" type="button" onClick={() => copyPix(pixPayload, 'Codigo PIX')}>
              <Copy size={17} />Copiar codigo
            </button>
          </div>
        </div>
      )}

      <div className="split-grid">
        <div className="panel">
          <h2>Compras na fatura</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Usuario</th>
                  <th>Parcela</th>
                  <th>Cartao</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={`${item.expenseId}-${item.installmentNumber}`}>
                    <td>{item.description}</td>
                    <td>{item.userName}</td>
                    <td>{item.installmentNumber}/{item.totalInstallments}</td>
                    <td>{item.cardName} **** {item.cardLastFour}</td>
                    <td>{money(Number(item.installmentAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
