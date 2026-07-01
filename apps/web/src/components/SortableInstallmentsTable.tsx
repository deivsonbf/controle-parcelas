import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ExpenseType, MonthlyInstallment } from '../types/api';
import { formatDate, money } from '../utils';

type SortKey =
  | 'description'
  | 'purchaseDate'
  | 'userName'
  | 'categoryName'
  | 'expenseType'
  | 'installmentNumber'
  | 'cardName'
  | 'installmentAmount';

type SortDirection = 'asc' | 'desc';

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type Column = {
  key: SortKey;
  label: string;
};

const columns: Column[] = [
  { key: 'description', label: 'Compra' },
  { key: 'purchaseDate', label: 'Data da compra' },
  { key: 'userName', label: 'Usuario' },
  { key: 'categoryName', label: 'Categoria' },
  { key: 'expenseType', label: 'Tipo' },
  { key: 'installmentNumber', label: 'Parcela' },
  { key: 'cardName', label: 'Cartao' },
  { key: 'installmentAmount', label: 'Valor' }
];

const expenseTypeLabels: Record<ExpenseType, string> = {
  fixed: 'Fixa',
  card: 'Cartoes',
  unplanned: 'Nao planejada'
};

function compareItems(left: MonthlyInstallment, right: MonthlyInstallment, key: SortKey) {
  switch (key) {
    case 'purchaseDate':
      return left.purchaseDate.localeCompare(right.purchaseDate);
    case 'installmentNumber':
      return left.installmentNumber - right.installmentNumber;
    case 'installmentAmount':
      return Number(left.installmentAmount) - Number(right.installmentAmount);
    case 'cardName':
      return `${left.cardName} ${left.cardLastFour}`.localeCompare(
        `${right.cardName} ${right.cardLastFour}`,
        'pt-BR'
      );
    case 'expenseType':
      return expenseTypeLabels[left.expenseType].localeCompare(expenseTypeLabels[right.expenseType], 'pt-BR');
    default:
      return left[key].localeCompare(right[key], 'pt-BR', { sensitivity: 'base' });
  }
}

function categoryStyle(color: string) {
  return { '--category-color': color } as CSSProperties;
}

export function SortableInstallmentsTable({ items }: { items: MonthlyInstallment[] }) {
  const [sort, setSort] = useState<SortState>({ key: 'purchaseDate', direction: 'desc' });

  const sortedItems = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...items].sort((left, right) => {
      const result = compareItems(left, right, sort.key);
      if (result !== 0) return result * direction;
      return right.purchaseDate.localeCompare(left.purchaseDate);
    });
  }, [items, sort]);

  function changeSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

  function sortIcon(key: SortKey) {
    if (sort.key !== key) return <ArrowUpDown size={15} />;
    return sort.direction === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                aria-sort={
                  sort.key === column.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  className="sort-button"
                  type="button"
                  title={`Ordenar por ${column.label.toLowerCase()}`}
                  onClick={() => changeSort(column.key)}
                >
                  {column.label}
                  {sortIcon(column.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => (
            <tr key={`${item.expenseId}-${item.installmentNumber}`}>
              <td>{item.description}</td>
              <td>{formatDate(item.purchaseDate)}</td>
              <td>{item.userName}</td>
              <td>
                <span className="category-tag" style={categoryStyle(item.categoryColor)}>
                  {item.categoryName}
                </span>
              </td>
              <td><span className={`expense-type-tag ${item.expenseType}`}>{expenseTypeLabels[item.expenseType]}</span></td>
              <td>{item.installmentNumber}/{item.totalInstallments}</td>
              <td>{item.cardName} **** {item.cardLastFour}</td>
              <td>{money(Number(item.installmentAmount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
