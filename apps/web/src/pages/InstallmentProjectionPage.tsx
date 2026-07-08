import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import type { Card, InstallmentProjection, InstallmentProjectionCategory, User } from '../types/api';
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

function categoryPieGradient(categories: InstallmentProjectionCategory[], total: number) {
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

  const highestCardTotal = Math.max(...(projection?.months ?? []).map((item) => Number(item.cardTotal)), 0);
  const highestFixedTotal = Math.max(...(projection?.months ?? []).map((item) => Number(item.fixedTotal)), 0);

  function getCategoryTotals(source: 'cardCategories' | 'fixedCategories') {
    const totals = new Map<string, { name: string; color: string; total: number; installments: number }>();
    for (const month of projection?.months ?? []) {
      for (const category of month[source]) {
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
  }

  const cardCategoryTotals = useMemo(() => getCategoryTotals('cardCategories'), [projection]);
  const fixedCategoryTotals = useMemo(() => getCategoryTotals('fixedCategories'), [projection]);

  function renderMonthlyBars(
    title: string,
    description: string,
    valueKey: 'cardTotal' | 'fixedTotal',
    countKey: 'cardInstallments' | 'fixedExpenses',
    highestTotal: number,
    countLabel: string
  ) {
    return (
      <div className="panel projection-chart-panel">
        <div className="chart-heading">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className="chart-heading-icon" aria-hidden="true"><BarChart3 size={21} /></div>
        </div>

        {loading ? (
          <div className="chart-state">Carregando grafico...</div>
        ) : !projection || projection.months.length === 0 ? (
          <div className="chart-state">Nenhum valor encontrado para exibir.</div>
        ) : (
          <div className="chart-scroll">
            <div className="projection-total-chart" style={{ '--chart-columns': projection.months.length } as CSSProperties}>
              {projection.months.map((item) => {
                const total = Number(item[valueKey]);
                const height = highestTotal > 0 ? Math.max((total / highestTotal) * 100, 4) : 4;
                const count = Number(item[countKey]);
                const countText = count === 1 ? countLabel.replace(/s$/, '') : countLabel;

                return (
                  <div className="projection-column" key={`${title}-${item.month}`} title={`${monthLabel(item.month)}: ${money(total)}`}>
                    <span className="chart-value">{money(total)}<small>{count} {countText}</small></span>
                    <span className="chart-bar" style={{ '--bar-height': `${height}%` } as CSSProperties} />
                    <span className="chart-month">{monthLabel(item.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCategoryPies(
    title: string,
    description: string,
    source: 'cardCategories' | 'fixedCategories',
    totals: Array<{ name: string; color: string; total: number; installments: number }>,
    emptyText: string
  ) {
    return (
      <div className="panel projection-chart-panel">
        <div className="chart-heading">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>

        {loading ? (
          <div className="chart-state">Carregando categorias...</div>
        ) : !projection || projection.months.length === 0 || totals.length === 0 ? (
          <div className="chart-state">{emptyText}</div>
        ) : (
          <>
            <div className="chart-scroll">
              <div className="category-projection-chart" style={{ '--chart-columns': projection.months.length } as CSSProperties}>
                {projection.months.map((month) => {
                  const categories = month[source];
                  const total = categories.reduce((sum, category) => sum + Number(category.total), 0);
                  return (
                    <div className="category-month-column" key={`${source}-${month.month}`}>
                      <div
                        className="category-pie"
                        style={{ '--pie-background': categoryPieGradient(categories, total) } as CSSProperties}
                        title={`${monthLabel(month.month)}: ${money(total)}`}
                        aria-label={`${title} de ${monthLabel(month.month)}, total ${money(total)}`}
                      >
                        <span>{categories.length}</span>
                      </div>
                      <strong>{money(total)}</strong>
                      <span>{monthLabel(month.month)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="projection-legend">
              {totals.map((category) => (
                <div key={`${title}-${category.name}`}>
                  <span style={{ backgroundColor: category.color }} />
                  <strong>{category.name}</strong>
                  <small>{money(category.total)} em {category.installments} lancamentos</small>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Projecao de parcelas</h1>
          <p>Veja 6 meses anteriores e 6 meses futuros em torno do mes selecionado.</p>
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
        <div className="stat-card green"><span>Compras no cartao</span><strong>{money(projection?.cardTotal ?? 0)}</strong></div>
        <div className="stat-card amber"><span>Despesas mensais</span><strong>{money(projection?.fixedTotal ?? 0)}</strong></div>
      </div>

      {renderMonthlyBars('Compras no cartao', 'Compras em cartao nos 13 meses da janela', 'cardTotal', 'cardInstallments', highestCardTotal, 'compras')}
      {renderMonthlyBars('Despesas mensais', 'Despesas recorrentes ou da competencia em cada mes', 'fixedTotal', 'fixedExpenses', highestFixedTotal, 'despesas')}
      {renderCategoryPies('Categorias do cartao', 'Distribuicao das compras no cartao por categoria', 'cardCategories', cardCategoryTotals, 'Nenhuma categoria de cartao encontrada.')}
      {renderCategoryPies('Categorias das despesas mensais', 'Distribuicao das despesas mensais por categoria', 'fixedCategories', fixedCategoryTotals, 'Nenhuma categoria de despesa mensal encontrada.')}
    </section>
  );
}
