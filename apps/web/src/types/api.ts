import type { AuthUser, ExpenseType, MonthlyInstallment } from '@card-manager/shared';

export type { AuthUser, ExpenseType, MonthlyInstallment };

export type User = AuthUser & {
  active: boolean;
  cardBuyerOnly: boolean;
  jointAccount: boolean;
  created_at?: string;
};

export type Card = {
  id: string;
  name: string;
  lastFour: string;
  ownerName: string;
  ownerUserId?: string | null;
  ownerUserName?: string | null;
  imageUrl?: string | null;
  closingDay: number;
  dueDay: number;
  active: boolean;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Expense = {
  id: string;
  description: string;
  totalAmount: string;
  installments: number;
  purchaseDate: string;
  expenseType: ExpenseType;
  recurring: boolean;
  userId: string;
  userName: string;
  cardId: string;
  cardName: string;
  categoryId: string;
  categoryName: string;
  notes?: string | null;
};

export type InvoicePayment = {
  id: string;
  cardId: string;
  cardName: string;
  cardLastFour: string;
  month: string;
  amount: string;
  paymentDate: string;
  notes?: string | null;
};

export type FixedExpense = {
  id: string;
  description: string;
  amount: string;
  dueDay: number;
  startsOn: string;
  recurring: boolean;
  active: boolean;
  notes?: string | null;
  userId: string;
  userName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
};

export type FinancialIncome = {
  id: string;
  userId: string;
  userName: string;
  month: string;
  description: string;
  amount: string;
  receivedDate: string;
  notes?: string | null;
};

export type FinancialPayable = {
  id?: string;
  cardId?: string;
  cardName?: string;
  cardLastFour?: string;
  ownerUserName?: string | null;
  description?: string;
  userName?: string;
  categoryName?: string;
  dueDay?: number;
  amount: string;
  grossTotal?: string;
  invoicePaymentsTotal?: string;
  paid: boolean;
  paymentId?: string | null;
  paidAmount: string;
  paidDate?: string | null;
  paymentNotes?: string | null;
};

export type FinancialControlSummary = {
  month: string;
  incomeTotal: number;
  fixedExpensesTotal: number;
  cardInvoicesTotal: number;
  expensesTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  balanceAfterExpenses: number;
  incomes: FinancialIncome[];
  fixedExpenses: FinancialPayable[];
  cardInvoices: FinancialPayable[];
};

export type MonthlyResponse = {
  month: string;
  total: number;
  items: MonthlyInstallment[];
};

export type DashboardCardTotal = {
  cardId: string;
  cardName: string;
  cardLastFour: string;
  ownerName?: string | null;
  ownerUserId?: string | null;
  ownerUserName?: string | null;
  total: string;
  installments: number;
  ownerTotal: string;
  ownerInstallments: number;
  buyerTotal: string;
  buyerInstallments: number;
  grossTotal: string;
  netTotal: string;
  invoicePaymentsTotal: string;
  ownerNetTotal: string;
};

export type DashboardUserGroup = {
  key: 'owners' | 'buyers';
  label: string;
  users: number;
  cardsTotal: string;
  fixedExpensesTotal: string;
  grandTotal: string;
};

export type DashboardSummary = {
  month: string;
  cardsTotal: number;
  grossCardsTotal: number;
  invoicePaymentsTotal: number;
  fixedExpensesTotal: number;
  grandTotal: number;
  cards: DashboardCardTotal[];
  fixedExpenses: FixedExpense[];
  userGroups: DashboardUserGroup[];
  viewerCardBuyerOnly: boolean;
};

export type MonthlySummary = {
  month: string;
  userId: string;
  userName: string;
  total: string;
  installments: number;
};

export type InstallmentProjectionCategory = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: string;
  installments: number;
};

export type InstallmentProjectionMonth = {
  month: string;
  total: string;
  installments: number;
  cardTotal: string;
  cardInstallments: number;
  fixedTotal: string;
  fixedExpenses: number;
  categories: InstallmentProjectionCategory[];
  cardCategories: InstallmentProjectionCategory[];
  fixedCategories: InstallmentProjectionCategory[];
};

export type InstallmentProjection = {
  startMonth: string;
  endMonth: string;
  grandTotal: number;
  cardTotal: number;
  fixedTotal: number;
  installments: number;
  cardInstallments: number;
  fixedExpenses: number;
  months: InstallmentProjectionMonth[];
};
