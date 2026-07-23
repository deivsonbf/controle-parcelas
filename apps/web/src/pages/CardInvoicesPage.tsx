import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Receipt } from 'lucide-react';
import { api } from '../services/api';
import type { CardInvoice, CardInvoicesResponse, MonthlyInstallment } from '../types/api';
import { formatDate, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const expenseKindLabel = {
  oneTime: 'À vista',
  installment: 'Parcelado'
};

function categoryStyle(color: string) {
  return { '--category-color': color } as CSSProperties;
}

function installmentKind(item: MonthlyInstallment) {
  return item.totalInstallments > 1 ? 'installment' : 'oneTime';
}

function CardInvoiceTable({ items }: { items: MonthlyInstallment[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Compra</th>
            <th>Data da compra</th>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Parcela atual</th>
            <th>Total de parcelas</th>
            <th>Valor na fatura</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const kind = installmentKind(item);
            return (
              <tr key={`${item.expenseId}-${item.installmentNumber}`}>
                <td>{item.description}</td>
                <td>{formatDate(item.purchaseDate)}</td>
                <td>
                  <span className="category-tag" style={categoryStyle(item.categoryColor)}>
                    {item.categoryName}
                  </span>
                </td>
                <td><span className={`invoice-kind ${kind}`}>{expenseKindLabel[kind]}</span></td>
                <td>{item.installmentNumber}</td>
                <td>{item.totalInstallments}</td>
                <td>{money(Number(item.installmentAmount))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardInvoicePanel({ invoice }: { invoice: CardInvoice }) {
  const sortedItems = useMemo(
    () => [...invoice.items].sort((left, right) => right.purchaseDate.localeCompare(left.purchaseDate)),
    [invoice.items]
  );

  return (
    <div className="panel card-invoice-panel">
      <div className="section-heading">
        <div>
          <h2>{invoice.cardName} **** {invoice.cardLastFour}</h2>
          <span>Dono: {invoice.ownerUserName} | Fecha dia {invoice.closingDay} | Vence dia {invoice.dueDay}</span>
        </div>
        <strong>{money(Number(invoice.total))}</strong>
      </div>

      <div className="invoice-summary-grid">
        <div>
          <span>Total da fatura</span>
          <strong>{money(Number(invoice.total))}</strong>
        </div>
        <div>
          <span>À vista</span>
          <strong>{money(Number(invoice.oneTimeTotal))}</strong>
          <small>{invoice.oneTimeCount} compras</small>
        </div>
        <div>
          <span>Parcelado</span>
          <strong>{money(Number(invoice.installmentTotal))}</strong>
          <small>{invoice.installmentCount} parcelas</small>
        </div>
      </div>

      {sortedItems.length > 0 ? (
        <CardInvoiceTable items={sortedItems} />
      ) : (
        <p className="empty-state">Nenhuma compra do dono neste cartão para o mês selecionado.</p>
      )}
    </div>
  );
}

export function CardInvoicesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<CardInvoicesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.cardBuyerOnly) return;

    setLoading(true);
    api<CardInvoicesResponse>(`/reports/card-invoices?month=${month}`)
      .then(setData)
      .catch((error) => {
        toast.error('Erro ao carregar faturas do cartão', error instanceof Error ? error.message : undefined);
      })
      .finally(() => setLoading(false));
  }, [month, toast, user?.cardBuyerOnly]);

  if (user?.cardBuyerOnly) {
    return (
      <section className="page">
        <div className="panel">
          <h2>Acesso restrito</h2>
          <p className="empty-state">A fatura do cartão é exibida apenas para donos de cartão.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Fatura do cartão</h1>
          <p>Acompanhe as compras mensais dos donos, separadas por cartão e por tipo de lançamento.</p>
        </div>
        <div className="filters">
          <label className="form-field">
            Competência
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Cartões</span>
          <strong>{data?.cards.length ?? 0}</strong>
        </div>
        <div className="stat-card green">
          <span>Total das faturas</span>
          <strong>{money(data?.grandTotal ?? 0)}</strong>
        </div>
        <div className="stat-card amber">
          <span>Compras dos donos</span>
          <strong>{data?.cards.reduce((sum, card) => sum + card.installments, 0) ?? 0}</strong>
        </div>
      </div>

      {loading ? (
        <div className="panel chart-state">Carregando faturas...</div>
      ) : data && data.cards.length > 0 ? (
        <div className="card-invoices-list">
          {data.cards.map((invoice) => <CardInvoicePanel key={invoice.cardId} invoice={invoice} />)}
        </div>
      ) : (
        <div className="panel empty-state">
          <Receipt size={20} />
          Nenhum cartão de dono encontrado para acompanhar.
        </div>
      )}
    </section>
  );
}
