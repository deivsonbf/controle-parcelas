export type UserRole = 'admin' | 'user';
export type ExpenseType = 'fixed' | 'card' | 'unplanned';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type MonthlyInstallment = {
  expenseId: string;
  installmentNumber: number;
  totalInstallments: number;
  installmentAmount: string;
  referenceMonth: string;
  invoiceMonth: string;
  paymentDate: string;
  description: string;
  expenseType: ExpenseType;
  totalAmount: string;
  purchaseDate: string;
  userId: string;
  userName: string;
  cardId: string;
  cardName: string;
  cardLastFour: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
};
