import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { requireAuth } from './auth.ts';
import { config } from './config.ts';
import { getDialect, pingDb } from './db.ts';
import { errorHandler } from './errors.ts';
import authRoutes from './routes/auth.ts';
import dashboardRoutes from './routes/dashboard.ts';
import kategoriRoutes from './routes/kategori.ts';
import penggunaRoutes from './routes/pengguna.ts';
import produkRoutes from './routes/produk.ts';
import transaksiRoutes from './routes/transaksi.ts';
import warnaRoutes from './routes/warna.ts';
import { asyncH } from './validate.ts';

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  }),
);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '200kb' }));

// Publik
app.get(
  '/api/health',
  asyncH(async (_req, res) => {
    await pingDb();
    res.json({ status: 'ok', database: getDialect() });
  }),
);
app.use('/api/auth', authRoutes);

// Semua rute API di bawah ini wajib login
app.use('/api', requireAuth);
app.use('/api/pengguna', penggunaRoutes);
app.use('/api/kategori', kategoriRoutes);
app.use('/api/warna', warnaRoutes);
app.use('/api/produk', produkRoutes);
app.use('/api/transaksi', transaksiRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rute API tidak ditemukan.' });
});

app.use(errorHandler);
