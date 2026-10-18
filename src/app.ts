import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { Application, Request, Response } from 'express';
import httpStatus from 'http-status';
import morgan from 'morgan';
import path from 'path';
import router from './app/routes';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import config from './config';

const app: Application = express();

// ── Request Logger ──────────────────────────────────────────────────────────
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.cors_origins,
    credentials: true,
  }),
);

// ── Body Parsers ──────────────────────────────────────────────────────────────
// 10mb is sufficient for JSON payloads; increase per-route for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ── Static Uploads ────────────────────────────────────────────────────────────
app.use('/upload', express.static(path.join(__dirname, 'app', 'upload')));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: `${config.app_name} API is running`,
    env: config.env,
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(globalErrorHandler);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
    error: {
      path: req.originalUrl,
      message: 'The requested route does not exist',
    },
  });
});

export default app;
