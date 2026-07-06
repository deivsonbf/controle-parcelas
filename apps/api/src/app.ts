import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { applySecurity } from './middleware/security.js';
import authRoutes from './routes/auth.js';
import cardsRoutes from './routes/cards.js';
import categoriesRoutes from './routes/categories.js';
import expensesRoutes from './routes/expenses.js';
import financialControlRoutes from './routes/financialControl.js';
import fixedExpensesRoutes from './routes/fixedExpenses.js';
import invoicePaymentsRoutes from './routes/invoicePayments.js';
import reportsRoutes from './routes/reports.js';
import usersRoutes from './routes/users.js';
import { swaggerSpec } from './swagger.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  applySecurity(app);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, {
    swaggerOptions: {
      url: '/docs.json'
    },
    customSiteTitle: 'Card Installments API'
  }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/cards', cardsRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/financial-control', financialControlRoutes);
  app.use('/api/fixed-expenses', fixedExpensesRoutes);
  app.use('/api/invoice-payments', invoicePaymentsRoutes);
  app.use('/api/reports', reportsRoutes);

  app.use((_req, res) => res.status(404).json({ message: 'Rota nao encontrada' }));
  return app;
}
