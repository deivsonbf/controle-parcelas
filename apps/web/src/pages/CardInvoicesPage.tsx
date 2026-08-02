import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Receipt } from 'lucide-react';
import { api } from '../services/api';
import type { CardInvoice, CardInvoicesResponse, Category, ExpenseType, MonthlyInstallment } from '../types/api';
import { currencyInputToNumber, formatCurrencyInput, formatDate, money } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const expenseKindLabel = {
  oneTime: 'À vista',
  installment: 'Parcelado'
};

const expenseTypeLabels: Record<ExpenseType, string> = {
  fixed: 'Fixa',
  card: 'Cartões',
  unplanned: 'Não planejada'
};

const emptyPurchaseForm = {
  description: '',
  totalAmount: '',
  installments: 1,
  purchaseDate: new Date().toISOString().slice(0, 10),
  expenseType: 'card' as ExpenseType,
  recurring: false,
  categoryId: '',
  notes: ''
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

type InvoicePurchaseFormProps = {
  invoice: CardInvoice;
  categories: Category[];
  submitting: boolean;
  form: typeof emptyPurchaseForm;
  onChange: (form: typeof emptyPurchaseForm) => void;
  onSubmit: (event: FormEvent) => void;
};

function InvoicePurchaseForm({ invoice, categories, submitting, form, onChange, onSubmit }: InvoicePurchaseFormProps) {
  return (
    <form className="panel form-grid invoice-purchase-form" onSubmit={onSubmit}>
      <div className="form-context">
        <span>Compra direta no cartão</span>
        <strong>{invoice.cardName} **** {invoice.cardLastFour}</strong>
        <small>Dono: {invoice.ownerUserName}</small>
      </div>
      <label className="form-field">
        Descrição
        <input placeholder="Ex.: Mercado, app, farmácia" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} required />
      </label>
      <label className="form-field">
        Valor total
        <input
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={form.totalAmount}
          onChange={(event) => onChange({ ...form, totalAmount: formatCurrencyInput(event.target.value) })}
          required
        />
      </label>
      <label className="form-field">
        Parcelas
        <input type="number" min={1} max={120} value={form.installments} onChange={(event) => onChange({ ...form, installments: Number(event.target.value) })} required />
      </label>
      <label className="form-field">
        Data da compra
        <input type="date" value={form.purchaseDate} onChange={(event) => onChange({ ...form, purchaseDate: event.target.value })} required />
      </label>
      <label className="form-field">
        Tipo de despesa
        <select value={form.expenseType} onChange={(event) => onChange({ ...form, expenseType: event.target.value as ExpenseType })} required>
          {Object.entries(expenseTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="form-field">
        Categoria
        <select value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })} required>
          <option value="">Selecione</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="form-field">
        Observações
        <input placeholder="Opcional" value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={form.recurring} onChange={(event) => onChange({ ...form, recurring: event.target.checked })} />
        Recorrente
      </label>
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? 'Salvando...' : 'Adicionar compra'}
      </button>
    </form>
  );
}

export function CardInvoicesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<CardInvoicesResponse | null>(null);
  const [activeCardId, setActiveCardId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function loadInvoices() {
    if (user?.cardBuyerOnly) return;

    setLoading(true);
    api<CardInvoicesResponse>(`/reports/card-invoices?month=${month}`)
      .then((response) => {
        setData(response);
        setActiveCardId((current) => {
          if (current && response.cards.some((card) => card.cardId === current)) return current;
          return response.cards[0]?.cardId ?? '';
        });
      })
      .catch((error) => {
        toast.error('Erro ao carregar faturas do cartão', error instanceof Error ? error.message : undefined);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadInvoices, [month, toast, user?.cardBuyerOnly]);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    api<Category[]>('/categories')
      .then(setCategories)
      .catch((error) => {
        toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
      });
  }, [toast, user?.role]);

  const activeInvoice = useMemo(
    () => data?.cards.find((card) => card.cardId === activeCardId) ?? data?.cards[0] ?? null,
    [activeCardId, data?.cards]
  );

  async function submitPurchase(event: FormEvent) {
    event.preventDefault();
    if (!activeInvoice) return;

    setSubmitting(true);
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...purchaseForm,
          totalAmount: currencyInputToNumber(purchaseForm.totalAmount),
          userId: activeInvoice.ownerUserId,
          cardId: activeInvoice.cardId
        })
      });
      toast.success('Compra adicionada', 'A fatura foi recalculada usando a regra de fechamento do cartão.');
      setPurchaseForm(emptyPurchaseForm);
      loadInvoices();
    } catch (error) {
      toast.error('Erro ao adicionar compra', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

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
      ) : data && data.cards.length > 0 && activeInvoice ? (
        <>
          <div className="card-invoice-tabs" role="tablist" aria-label="Cartões da fatura">
            {data.cards.map((invoice) => (
              <button
                key={invoice.cardId}
                type="button"
                className={activeInvoice.cardId === invoice.cardId ? 'active' : ''}
                onClick={() => setActiveCardId(invoice.cardId)}
                role="tab"
                aria-selected={activeInvoice.cardId === invoice.cardId}
              >
                <span>{invoice.cardName} **** {invoice.cardLastFour}</span>
                <strong>{money(Number(invoice.total))}</strong>
              </button>
            ))}
          </div>

          {user?.role === 'admin' && (
            <InvoicePurchaseForm
              invoice={activeInvoice}
              categories={categories}
              submitting={submitting}
              form={purchaseForm}
              onChange={setPurchaseForm}
              onSubmit={submitPurchase}
            />
          )}

          <CardInvoicePanel invoice={activeInvoice} />
        </>
      ) : (
        <div className="panel empty-state">
          <Receipt size={20} />
          Nenhum cartão de dono encontrado para acompanhar.
        </div>
      )}
    </section>
  );
}
