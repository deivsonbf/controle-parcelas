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
  userId: string;
  userName: string;
  cardId: string;
  cardName: string;
  categoryId: string;
  categoryName: string;
};

export type FixedExpense = {
  id: string;
  description: string;
  amount: string;
  dueDay: number;
  startsOn: string;
  active: boolean;
  notes?: string | null;
  userId: string;
  userName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
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
  fixedExpensesTotal: number;
  grandTotal: number;
  cards: DashboardCardTotal[];
  fixedExpenses: FixedExpense[];
  userGroups: DashboardUserGroup[];
};

export type MonthlySummary = {
  month: string;
  userId: string;
  userName: string;
  total: string;
};
