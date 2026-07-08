import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import type { Card, InstallmentProjection, User } from '../types/api';
import { money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
}

function categoryPieGradient(categories: InstallmentProjection['months'][number]['categories'], total: number) {
  if (total <= 0 || categories.length === 0) return '#e2e8f0';

  let current = 0;
  const segments = categories.map((category) => {
    const value = Number(category.total);
    const start = current;
    const end = current + (value / total) * 100;
    current = end;
    return `${category.categoryColor} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return `conic-gradient(${segments.join(', ')})`;
}

export function InstallmentProjectionPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [projection, setProjection] = useState<InstallmentProjection | null>(null);
  const [loading, setLoading] = useState(false);

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
    const query = new URLSearchParams({ month: startMonth });
    if (selectedUser) query.set('userId', selectedUser);
    if (selectedCard) query.set('cardId', selectedCard);

    setLoading(true);
    api<InstallmentProjection>(`/reports/installment-projection?${query}`)
      .then(setProjection)
      .catch((error) => {
        toast.error('Erro ao carregar projecao de parcelas', error instanceof Error ? error.message : undefined);
      })
      .finally(() => setLoading(false));
  }, [selectedCard, selectedUser, startMonth, toast]);

  const highestMonthTotal = Math.max(...(projection?.months ?? []).map((item) => Number(item.total)), 0);
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; total: number; installments: number }>();
    for (const month of projection?.months ?? []) {
      for (const category of month.categories) {
        const current = totals.get(category.categoryId) ?? {
          name: category.categoryName,
          color: category.categoryColor,
          total: 0,
          installments: 0
        };
        current.total += Number(category.total);
        current.installments += category.installments;
        totals.set(category.categoryId, current);
      }
    }

    return [...totals.values()].sort((a, b) => b.total - a.total);
  }, [projection]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Projecao de parcelas</h1>
        </div>
        <div className="filters">
          <input type="month" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} />
          {user?.role === 'admin' && (
            <>
              <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
                <option value="">Todos os usuarios</option>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={selectedCard} onChange={(event) => setSelectedCard(event.target.value)}>
                <option value="">Todos os cartoes</option>
                {cards.map((item) => <option key={item.id} value={item.id}>{item.name} **** {item.lastFour}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span>Periodo</span><strong>{projection ? `${monthLabel(projection.startMonth)} - ${monthLabel(projection.endMonth)}` : '-'}</strong></div>
        <div className="stat-card green"><span>Total projetado</span><strong>{money(projection?.grandTotal ?? 0)}</strong></div>
        <div className="stat-card amber"><span>Parcelas</span><strong>{projection?.installments ?? 0}</strong></div>
      </div>

      <div className="panel projection-chart-panel">
        <div className="chart-heading">
          <div>
            <h2>Total por mes</h2>
            <p>Parcelas futuras ate o ultimo mes projetado</p>
          </div>
          <div className="chart-heading-icon" aria-hidden="true"><BarChart3 size={21} /></div>
        </div>

        {loading ? (
          <div className="chart-state">Carregando projecao...</div>
        ) : !projection || projection.months.length === 0 ? (
          <div className="chart-state">Nenhuma parcela encontrada para projetar.</div>
        ) : (
          <div className="chart-scroll">
            <div className="projection-total-chart" style={{ '--chart-columns': projection.months.length } as CSSProperties}>
              {projection.months.map((item) => {
                const total = Number(item.total);
                const height = highestMonthTotal > 0 ? Math.max((total / highestMonthTotal) * 100, 4) : 4;

                return (
                  <div className="projection-column" key={item.month} title={`${monthLabel(item.month)}: ${money(total)}`}>
                    <span className="chart-value">{money(total)}<small>{item.installments} parcelas</small></span>
                    <span className="chart-bar" style={{ '--bar-height': `${height}%` } as CSSProperties} />
                    <span className="chart-month">{monthLabel(item.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="panel projection-chart-panel">
        <div className="chart-heading">
          <div>
            <h2>Categorias por mes</h2>
            <p>Distribuicao mensal das parcelas por categoria</p>
          </div>
        </div>

        {loading ? (
          <div className="chart-state">Carregando categorias...</div>
        ) : !projection || projection.months.length === 0 ? (
          <div className="chart-state">Nenhuma categoria encontrada.</div>
        ) : (
          <>
            <div className="chart-scroll">
              <div className="category-projection-chart" style={{ '--chart-columns': projection.months.length } as CSSProperties}>
                {projection.months.map((month) => {
                  const total = Number(month.total);
                  return (
                    <div className="category-month-column" key={month.month}>
                      <div
                        className="category-pie"
                        style={{ '--pie-background': categoryPieGradient(month.categories, total) } as CSSProperties}
                        title={`${monthLabel(month.month)}: ${money(total)}`}
                        aria-label={`Categorias de ${monthLabel(month.month)}, total ${money(total)}`}
                      >
                        <span>{month.categories.length}</span>
                      </div>
                      <strong>{money(total)}</strong>
                      <span>{monthLabel(month.month)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="projection-legend">
              {categoryTotals.map((category) => (
                <div key={category.name}>
                  <span style={{ backgroundColor: category.color }} />
                  <strong>{category.name}</strong>
                  <small>{money(category.total)} em {category.installments} parcelas</small>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
