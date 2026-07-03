import type { CSSProperties } from 'react';
import { BarChart3 } from 'lucide-react';
import type { MonthlySummary } from '../types/api';
import { money } from '../utils';

type MonthlyInstallmentsChartProps = {
  items: MonthlySummary[];
  selectedMonth: string;
  loading: boolean;
  onSelectMonth: (month: string) => void;
};

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
}

export function MonthlyInstallmentsChart({
  items,
  selectedMonth,
  loading,
  onSelectMonth
}: MonthlyInstallmentsChartProps) {
  const orderedItems = [...items].sort((a, b) => a.month.localeCompare(b.month));
  const highestTotal = Math.max(...orderedItems.map((item) => Number(item.total)), 0);

  return (
    <div className="panel installments-chart-panel">
      <div className="chart-heading">
        <div>
          <h2>Parcelas por mes</h2>
          <p>Valor total e quantidade de parcelas em cada fatura</p>
        </div>
        <div className="chart-heading-icon" aria-hidden="true">
          <BarChart3 size={21} />
        </div>
      </div>

      {loading ? (
        <div className="chart-state">Carregando valores mensais...</div>
      ) : orderedItems.length === 0 ? (
        <div className="chart-state">Nenhuma parcela encontrada para exibir no grafico.</div>
      ) : (
        <div className="chart-scroll">
          <div
            className="installments-chart"
            style={{ '--chart-columns': orderedItems.length } as CSSProperties}
            role="img"
            aria-label="Grafico do valor total de parcelas por mes"
          >
            {orderedItems.map((item) => {
              const total = Number(item.total);
              const height = highestTotal > 0 ? Math.max((total / highestTotal) * 100, 4) : 4;
              const isSelected = item.month === selectedMonth;

              return (
                <button
                  className={`chart-column${isSelected ? ' selected' : ''}`}
                  key={item.month}
                  type="button"
                  title={`${monthLabel(item.month)}: ${money(total)} em ${item.installments} parcelas`}
                  aria-label={`Abrir fatura de ${monthLabel(item.month)}, total ${money(total)} em ${item.installments} parcelas`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectMonth(item.month)}
                >
                  <span className="chart-value">
                    {money(total)}
                    <small>{item.installments} {item.installments === 1 ? 'parcela' : 'parcelas'}</small>
                  </span>
                  <span
                    className="chart-bar"
                    style={{ '--bar-height': `${height}%` } as CSSProperties}
                    aria-hidden="true"
                  />
                  <span className="chart-month">{monthLabel(item.month)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
