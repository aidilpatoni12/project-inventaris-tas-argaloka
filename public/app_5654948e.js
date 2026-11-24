import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config.js'
import { pool } from './db.js'
import { requireAuth } from './auth.js'
import { errorHandler } from './errors.js'
import { asyncH } from './validate.js'
import authRoutes from './routes/auth.js'
import penggunaRoutes from './routes/pengguna.js'
import kategoriRoutes from './routes/kategori.js'
import warnaRoutes from './routes/warna.js'
import produkRoutes from './routes/produk.js'
import transaksiRoutes from './routes/transaksi.js'
import dashboardRoutes from './routes/dashboard.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: '100kb' }))

// Publik
app.get('/api/health', asyncH(async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok' })
}))
app.use('/api/auth', authRoutes)

// Semua rute di bawah ini wajib login
app.use('/api', requireAuth)
app.use('/api/pengguna', penggunaRoutes)
app.use('/api/kategori', kategoriRoutes)
app.use('/api/warna', warnaRoutes)
app.use('/api/produk', produkRoutes)
app.use('/api/transaksi', transaksiRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use((_req, res) => res.status(404).json({ error: 'Rute tidak ditemukan.' }))
app.use(errorHandler)
