import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Pencil, Receipt, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import type { CardInvoice, CardInvoicesResponse, Category, ExpenseType, InvoiceCredit, MonthlyInstallment, User } from '../types/api';
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

const creditKindLabel = 'Credito';

const emptyPurchaseForm = {
  description: '',
  totalAmount: '',
  installments: 1,
  purchaseDate: new Date().toISOString().slice(0, 10),
  expenseType: 'card' as ExpenseType,
  recurring: false,
  userId: '',
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

type InvoiceRow =
  | { rowType: 'purchase'; sortDate: string; item: MonthlyInstallment }
  | { rowType: 'credit'; sortDate: string; item: InvoiceCredit };

type InvoicePurchaseFormProps = {
  title: string;
  invoice: CardInvoice;
  categories: Category[];
  users?: User[];
  showUserSelect?: boolean;
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
  users = [],
  showUserSelect = false,
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
      {showUserSelect && (
        <label className="form-field">
          Utilizador
          <select value={form.userId} onChange={(event) => onChange({ ...form, userId: event.target.value })} required>
            <option value="">Selecione</option>
            {users.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.name}</option>)}
          </select>
        </label>
      )}
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
  rows: InvoiceRow[];
  selectedIds: string[];
  admin: boolean;
  onToggle: (expenseId: string) => void;
  onToggleAll: (expenseIds: string[]) => void;
  onEdit: (item: MonthlyInstallment) => void;
  onDelete: (item: MonthlyInstallment) => void;
};

function CardInvoiceTable({ rows, selectedIds, admin, onToggle, onToggleAll, onEdit, onDelete }: CardInvoiceTableProps) {
  const visibleExpenseIds = [...new Set(rows
    .filter((row): row is Extract<InvoiceRow, { rowType: 'purchase' }> => row.rowType === 'purchase')
    .map((row) => row.item.expenseId))];
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
          {rows.map((row) => {
            if (row.rowType === 'credit') {
              const credit = row.item;
              return (
                <tr key={`credit-${credit.id}`}>
                  {admin && <td />}
                  <td>{credit.notes ? `Credito - ${credit.notes}` : 'Credito na fatura'}</td>
                  <td>{formatDate(credit.paymentDate)}</td>
                  <td><span className="category-tag credit-tag">Abatimento</span></td>
                  <td><span className="invoice-kind credit">{creditKindLabel}</span></td>
                  <td>-</td>
                  <td>-</td>
                  <td>-{money(Number(credit.amount))}</td>
                  {admin && <td />}
                </tr>
              );
            }

            const item = row.item;
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
  emptyMessage,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete
}: {
  invoice: CardInvoice;
  selectedIds: string[];
  admin: boolean;
  emptyMessage: string;
  onToggle: (expenseId: string) => void;
  onToggleAll: (expenseIds: string[]) => void;
  onEdit: (item: MonthlyInstallment) => void;
  onDelete: (item: MonthlyInstallment) => void;
}) {
  const rows = useMemo(
    () => [
      ...invoice.items.map((item) => ({ rowType: 'purchase' as const, sortDate: item.purchaseDate, item })),
      ...(invoice.credits ?? []).map((item) => ({ rowType: 'credit' as const, sortDate: item.paymentDate, item }))
    ].sort((left, right) => right.sortDate.localeCompare(left.sortDate)),
    [invoice.items, invoice.credits]
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
          <small>Bruto: {money(Number(invoice.grossTotal))}</small>
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
        <div>
          <span>Creditos</span>
          <strong>-{money(Number(invoice.invoicePaymentsTotal))}</strong>
          <small>{(invoice.credits ?? []).length} abatimentos</small>
        </div>
      </div>

      {rows.length > 0 ? (
        <CardInvoiceTable
          rows={rows}
          selectedIds={selectedIds}
          admin={admin}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </div>
  );
}

type CardInvoicesPageProps = {
  mode?: 'owners' | 'thirdParty';
};

export function CardInvoicesPage({ mode = 'owners' }: CardInvoicesPageProps) {
  const { user } = useAuth();
  const toast = useToast();
  const isThirdParty = mode === 'thirdParty';
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<CardInvoicesResponse | null>(null);
  const [activeCardId, setActiveCardId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [buyers, setBuyers] = useState<User[]>([]);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [editingExpenseId, setEditingExpenseId] = useState('');
  const [editForm, setEditForm] = useState(emptyPurchaseForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = user?.role === 'admin';

  function loadInvoices() {
    if (!isThirdParty && user?.cardBuyerOnly) return;

    setLoading(true);
    api<CardInvoicesResponse>(`/reports/${isThirdParty ? 'third-party-card-invoices' : 'card-invoices'}?month=${month}`)
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

  useEffect(loadInvoices, [isThirdParty, month, toast, user?.cardBuyerOnly]);

  useEffect(() => {
    if (!isAdmin) return;

    api<Category[]>('/categories')
      .then(setCategories)
      .catch((error) => {
        toast.error('Erro ao carregar categorias', error instanceof Error ? error.message : undefined);
      });

    if (isThirdParty) {
      api<User[]>('/users')
        .then((items) => setBuyers(items.filter((item) => item.cardBuyerOnly)))
        .catch((error) => {
          toast.error('Erro ao carregar utilizadores', error instanceof Error ? error.message : undefined);
        });
    }
  }, [isAdmin, isThirdParty, toast]);

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
          userId: isThirdParty ? purchaseForm.userId : activeInvoice.ownerUserId,
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
      userId: item.userId,
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
          userId: isThirdParty ? editForm.userId : activeInvoice.ownerUserId,
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
    if (isThirdParty) body.preserveUserId = true;
    if (bulkForm.targetCardId) body.targetCardId = bulkForm.targetCardId;
    if (bulkForm.categoryId) body.categoryId = bulkForm.categoryId;
    if (bulkForm.expenseType) body.expenseType = bulkForm.expenseType;
    if (bulkForm.purchaseDate) body.purchaseDate = bulkForm.purchaseDate;
    if (bulkForm.recurring) body.recurring = bulkForm.recurring === 'true';
    if (bulkForm.notes.trim()) body.notes = bulkForm.notes.trim();

    if (!bulkForm.targetCardId && !bulkForm.categoryId && !bulkForm.expenseType && !bulkForm.purchaseDate && !bulkForm.recurring && !bulkForm.notes.trim()) {
      toast.info('Nenhuma alteração informada');
      return;
    }

    setSubmitting(true);
    try {
      await api('/expenses/bulk-update', {
        method: 'POST',
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

  if (!isThirdParty && user?.cardBuyerOnly) {
    return (
      <section className="page">
        <div className="panel">
          <h2>Acesso restrito</h2>
          <p className="empty-state">A fatura do cartão é exibida apenas para donos de cartão.</p>
        </div>
      </section>
    );
  }

  const pageTitle = isThirdParty ? 'Compras de terceiros' : 'Fatura do cartao';
  const pageDescription = isThirdParty
    ? 'Acompanhe apenas compras de utilizadores que nao sao donos do cartao, separadas por mes e por cartao.'
    : 'Acompanhe as compras mensais dos donos, separadas por cartao e por tipo de lancamento.';
  const countLabel = isThirdParty ? 'Compras de terceiros' : 'Compras dos donos';
  const emptyCardMessage = isThirdParty
    ? 'Nenhuma compra de terceiro encontrada para este mes.'
    : 'Nenhum cartao de dono encontrado para acompanhar.';
  const emptyInvoiceMessage = isThirdParty
    ? 'Nenhuma compra de terceiro neste cartao para o mes selecionado.'
    : 'Nenhuma compra do dono neste cartao para o mes selecionado.';

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
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
          <span>{countLabel}</span>
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
                users={buyers}
                showUserSelect={isThirdParty}
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
                users={buyers}
                showUserSelect={isThirdParty}
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
            emptyMessage={emptyInvoiceMessage}
            onToggle={toggleSelection}
            onToggleAll={toggleAll}
            onEdit={startEdit}
            onDelete={(item) => deleteExpenses([item.expenseId], `"${item.description}"`)}
          />
        </>
      ) : (
        <div className="panel empty-state">
          <Receipt size={20} />
          {emptyCardMessage}
        </div>
      )}
    </section>
  );
}

