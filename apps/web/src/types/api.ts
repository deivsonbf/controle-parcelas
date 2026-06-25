import type { AuthUser, MonthlyInstallment } from '@card-manager/shared';

export type { AuthUser, MonthlyInstallment };

export type User = AuthUser & {
  active: boolean;
  created_at?: string;
};

export type Card = {
  id: string;
  name: string;
  lastFour: string;
  ownerName: string;
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
  userId: string;
  userName: string;
  cardId: string;
  cardName: string;
  categoryId: string;
  categoryName: string;
};

export type MonthlyResponse = {
  month: string;
  total: number;
  items: MonthlyInstallment[];
};

export type MonthlySummary = {
  month: string;
  userId: string;
  userName: string;
  total: string;
};
