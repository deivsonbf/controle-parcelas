import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Pencil, Receipt, Trash2, X } from 'lucide-react';
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

const emptyBulkForm = {
  targetCardId: '',
  categoryId: '',
  expenseType: '',
  purchaseDate: '',
  recurring: '',
  notes: ''
};

function categoryStyle(color: string) {
  return { '--category-color': color } as CSSProperties;
}

function installmentKind(item: MonthlyInstallment) {
  return item.totalInstallments > 1 ? 'installment' : 'oneTime';
}

type PurchaseFormState = typeof emptyPurchaseForm;
type BulkFormState = typeof emptyBulkForm;

type InvoicePurchaseFormProps = {
  title: string;
  invoice: CardInvoice;
  categories: Category[];
  submitting: boolean;
  form: PurchaseFormState;
  submitLabel: string;
  onChange: (form: PurchaseFormState) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
};

function InvoicePurchaseForm({
  title,
  invoice,
  categories,
  submitting,
  form,
  submitLabel,
  onChange,
  onSubmit,
  onCancel
}: InvoicePurchaseFormProps) {
  return (
    <form className="panel form-grid invoice-purchase-form" onSubmit={onSubmit}>
      <div className="form-context">
        <span>{title}</span>
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
        {submitting ? 'Salvando...' : submitLabel}
      </button>
      {onCancel && <button className="secondary-button" type="button" onClick={onCancel}><X size={17} /> Cancelar</button>}
    </form>
  );
}

type CardInvoiceTableProps = {
  items: MonthlyInstallment[];
  selectedIds: string[];
  admin: boolean;
  onToggle: (expenseId: string) => void;
  onToggleAll: (expenseIds: string[]) => void;
  onEdit: (item: MonthlyInstallment) => void;
  onDelete: (item: MonthlyInstallment) => void;
};

function CardInvoiceTable({ items, selectedIds, admin, onToggle, onToggleAll, onEdit, onDelete }: CardInvoiceTableProps) {
  const visibleExpenseIds = [...new Set(items.map((item) => item.expenseId))];
  const allSelected = visibleExpenseIds.length > 0 && visibleExpenseIds.every((id) => selectedIds.includes(id));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {admin && (
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Selecionar compras da fatura"
                  onChange={() => onToggleAll(visibleExpenseIds)}
                />
              </th>
            )}
            <th>Compra</th>
            <th>Data da compra</th>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Parcela atual</th>
            <th>Total de parcelas</th>
            <th>Valor na fatura</th>
            {admin && <th aria-label="Ações" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const kind = installmentKind(item);
            const selected = selectedIds.includes(item.expenseId);
            return (
              <tr key={`${item.expenseId}-${item.installmentNumber}`}>
                {admin && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected}
                      aria-label={`Selecionar ${item.description}`}
                      onChange={() => onToggle(item.expenseId)}
                    />
                  </td>
                )}
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
                {admin && (
                  <td className="actions-cell">
                    <div className="table-actions">
                      <button className="icon-button" type="button" title="Editar compra" aria-label={`Editar ${item.description}`} onClick={() => onEdit(item)}>
                        <Pencil size={17} />
                      </button>
                      <button className="icon-button danger" type="button" title="Excluir compra" aria-label={`Excluir ${item.description}`} onClick={() => onDelete(item)}>
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type BulkActionsProps = {
  selectedCount: number;
  cards: CardInvoice[];
  activeCardId: string;
  categories: Category[];
  form: BulkFormState;
  submitting: boolean;
  onChange: (form: BulkFormState) => void;
  onApply: () => void;
  onDelete: () => void;
  onClear: () => void;
};

function BulkActions({ selectedCount, cards, activeCardId, categories, form, submitting, onChange, onApply, onDelete, onClear }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="panel bulk-actions-panel">
      <div className="section-heading">
        <div>
          <h2>Ações em lote</h2>
          <span>{selectedCount} compras selecionadas</span>
        </div>
        <button className="secondary-button compact" type="button" onClick={onClear}>Limpar seleção</button>
      </div>
      <div className="bulk-actions-grid">
        <label className="form-field">
          Mover para cartão
          <select value={form.targetCardId} onChange={(event) => onChange({ ...form, targetCardId: event.target.value })}>
            <option value="">Manter cartão</option>
            {cards.filter((card) => card.cardId !== activeCardId).map((card) => (
              <option key={card.cardId} value={card.cardId}>{card.cardName} **** {card.cardLastFour}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Categoria
          <select value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })}>
            <option value="">Manter categoria</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          Tipo
          <select value={form.expenseType} onChange={(event) => onChange({ ...form, expenseType: event.target.value })}>
            <option value="">Manter tipo</option>
            {Object.entries(expenseTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">
          Data da compra
          <input type="date" value={form.purchaseDate} onChange={(event) => onChange({ ...form, purchaseDate: event.target.value })} />
        </label>
        <label className="form-field">
          Recorrente
          <select value={form.recurring} onChange={(event) => onChange({ ...form, recurring: event.target.value })}>
            <option value="">Manter</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </label>
        <label className="form-field">
          Observações
          <input placeholder="Deixe em branco para manter" value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
        </label>
        <div className="bulk-actions-buttons">
          <button className="primary-button" type="button" disabled={submitting} onClick={onApply}>
            {submitting ? 'Aplicando...' : 'Aplicar alterações'}
          </button>
          <button className="icon-button danger" type="button" title="Excluir selecionadas" aria-label="Excluir selecionadas" disabled={submitting} onClick={onDelete}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CardInvoicePanel({
  invoice,
  selectedIds,
  admin,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete
}: {
  invoice: CardInvoice;
  selectedIds: string[];
  admin: boolean;
  onToggle: (expenseId: string) => void;
  onToggleAll: (expenseIds: string[]) => void;
  onEdit: (item: MonthlyInstallment) => void;
  onDelete: (item: MonthlyInstallment) => void;
}) {
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
        <CardInvoiceTable
          items={sortedItems}
          selectedIds={selectedIds}
          admin={admin}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          onEdit={onEdit}
          onDelete={onDelete}
        />
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
  const [activeCardId, setActiveCardId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [editingExpenseId, setEditingExpenseId] = useState('');
  const [editForm, setEditForm] = useState(emptyPurchaseForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = user?.role === 'admin';

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
    if (!isAdmin) return;

    api<Category[]>('/categories')
      .then(setCategories)
      .catch((error) => {
        toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
      });
  }, [isAdmin, toast]);

  useEffect(() => {
    setSelectedIds([]);
    setEditingExpenseId('');
    setBulkForm(emptyBulkForm);
  }, [activeCardId, month]);

  const activeInvoice = useMemo(
    () => data?.cards.find((card) => card.cardId === activeCardId) ?? data?.cards[0] ?? null,
    [activeCardId, data?.cards]
  );

  function toggleSelection(expenseId: string) {
    setSelectedIds((current) => current.includes(expenseId)
      ? current.filter((id) => id !== expenseId)
      : [...current, expenseId]);
  }

  function toggleAll(expenseIds: string[]) {
    setSelectedIds((current) => {
      const allSelected = expenseIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !expenseIds.includes(id));
      return [...new Set([...current, ...expenseIds])];
    });
  }

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

  function startEdit(item: MonthlyInstallment) {
    setEditingExpenseId(item.expenseId);
    setEditForm({
      description: item.description,
      totalAmount: formatCurrencyInput(String(Math.round(Number(item.totalAmount) * 100))),
      installments: item.totalInstallments,
      purchaseDate: item.purchaseDate.slice(0, 10),
      expenseType: item.expenseType,
      recurring: item.recurring ?? false,
      categoryId: item.categoryId,
      notes: item.notes ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!activeInvoice || !editingExpenseId) return;

    setSubmitting(true);
    try {
      await api(`/expenses/${editingExpenseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          totalAmount: currencyInputToNumber(editForm.totalAmount),
          userId: activeInvoice.ownerUserId,
          cardId: activeInvoice.cardId
        })
      });
      toast.success('Compra atualizada', 'A fatura foi recalculada.');
      setEditingExpenseId('');
      setEditForm(emptyPurchaseForm);
      loadInvoices();
    } catch (error) {
      toast.error('Erro ao atualizar compra', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpenses(ids: string[], label: string) {
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${label}? Todas as parcelas relacionadas serão removidas.`)) return;

    setSubmitting(true);
    try {
      await api('/expenses/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      toast.success(ids.length === 1 ? 'Compra excluída' : 'Compras excluídas');
      setSelectedIds([]);
      loadInvoices();
    } catch (error) {
      toast.error('Erro ao excluir compra', error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function applyBulkChanges() {
    if (selectedIds.length === 0) return;

    const body: Record<string, unknown> = { ids: selectedIds };
    if (bulkForm.targetCardId) body.targetCardId = bulkForm.targetCardId;
    if (bulkForm.categoryId) body.categoryId = bulkForm.categoryId;
    if (bulkForm.expenseType) body.expenseType = bulkForm.expenseType;
    if (bulkForm.purchaseDate) body.purchaseDate = bulkForm.purchaseDate;
    if (bulkForm.recurring) body.recurring = bulkForm.recurring === 'true';
    if (bulkForm.notes.trim()) body.notes = bulkForm.notes.trim();

    if (Object.keys(body).length === 1) {
      toast.info('Nenhuma alteração informada');
      return;
    }

    setSubmitting(true);
    try {
      await api('/expenses/bulk', {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      toast.success('Compras atualizadas', 'As faturas foram recalculadas.');
      setSelectedIds([]);
      setBulkForm(emptyBulkForm);
      loadInvoices();
    } catch (error) {
      toast.error('Erro ao alterar compras', error instanceof Error ? error.message : undefined);
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

          {isAdmin && (
            editingExpenseId ? (
              <InvoicePurchaseForm
                title="Editar compra"
                invoice={activeInvoice}
                categories={categories}
                submitting={submitting}
                form={editForm}
                submitLabel="Salvar alterações"
                onChange={setEditForm}
                onSubmit={submitEdit}
                onCancel={() => {
                  setEditingExpenseId('');
                  setEditForm(emptyPurchaseForm);
                }}
              />
            ) : (
              <InvoicePurchaseForm
                title="Compra direta no cartão"
                invoice={activeInvoice}
                categories={categories}
                submitting={submitting}
                form={purchaseForm}
                submitLabel="Adicionar compra"
                onChange={setPurchaseForm}
                onSubmit={submitPurchase}
              />
            )
          )}

          {isAdmin && (
            <BulkActions
              selectedCount={selectedIds.length}
              cards={data.cards}
              activeCardId={activeInvoice.cardId}
              categories={categories}
              form={bulkForm}
              submitting={submitting}
              onChange={setBulkForm}
              onApply={applyBulkChanges}
              onDelete={() => deleteExpenses(selectedIds, `${selectedIds.length} compras selecionadas`)}
              onClear={() => setSelectedIds([])}
            />
          )}

          <CardInvoicePanel
            invoice={activeInvoice}
            selectedIds={selectedIds}
            admin={isAdmin}
            onToggle={toggleSelection}
            onToggleAll={toggleAll}
            onEdit={startEdit}
            onDelete={(item) => deleteExpenses([item.expenseId], `"${item.description}"`)}
          />
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
