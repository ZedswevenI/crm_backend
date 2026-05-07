import express from 'express';
import { json, urlencoded } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routerIndex from './src/routes/index.routes.js';
import connectDB from './src/config/connect.js';
import errorHandler from './src/middlewares/errorHandler.js';
import { startCommunicationScheduler } from './src/helpers/communicationScheduler.helper.js';
import logger from './src/helpers/logger.js';
import cookieParser from 'cookie-parser';

const app = express();

dotenv.config();
const parsed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const devDefaults = ['http://localhost:4200', 'http://127.0.0.1:4200'];
const allowedOrigins = parsed.length ? parsed : process.env.NODE_ENV === 'production' ? [] : devDefaults;
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');
  if (!origin) return callback(null, { origin: false });
  const isAllowed = allowedOrigins.some((o) => o === origin);
  if (isAllowed) {
    return callback(null, {
      origin: origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    });
  }
  return callback(null, { origin: false });
};
app.use(cors(corsOptionsDelegate));
app.use(cookieParser());
// app.use(json());
// app.use(urlencoded({ extended: true }));
app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return cors(corsOptionsDelegate)(req, res, () => res.sendStatus(204));
  }
  next();
});
app.use('/uploads', express.static('uploads'));
app.use('/api/crm', routerIndex);
app.use(errorHandler);
const PORT = process.env.PORT;
connectDB();
app.listen(PORT, () => {
  logger.info(`Server started , running on ${PORT}`);
  startCommunicationScheduler();
});

export default app;
