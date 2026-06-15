import compression from 'compression';
import cors from 'cors';
import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../config/env.js';

export function applySecurity(app: Express) {
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
}
