import 'dotenv/config';

const rawCors = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173';
const corsOrigins = rawCors
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const envSecret = process.env.JWT_SECRET?.trim() || '';
if (envSecret && envSecret.length < 16) {
  console.warn('[config] JWT_SECRET terlalu pendek (minimal 16 karakter).');
}

export const config = {
  port: Number(process.env.PORT || 3000),
  corsOrigin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'argaloka_inventaris',
  },
  dbStrict: process.env.DB_STRICT === 'true',
  dbDriver: process.env.DB_DRIVER || 'auto',
  jwtSecret:
    envSecret.length >= 16
      ? envSecret
      : 'argaloka-dev-secret-ganti-di-env-minimal-32-karakter',
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  batasStokMenipis: Number(process.env.BATAS_STOK_MENIPIS || 5),
};
