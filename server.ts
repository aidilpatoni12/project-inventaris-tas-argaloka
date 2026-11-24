import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { app } from './server/app.ts';
import { config } from './server/config.ts';
import { closeDb, initDb } from './server/db.ts';

async function startServer() {
  try {
    await initDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[db] Gagal terhubung ke MySQL: ${msg}`);
    console.error('     Periksa nilai DB_* di file .env dan pastikan database sudah diimpor.');
    process.exit(1);
  }

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] Berjalan di http://localhost:${config.port}`);
  });

  const tutup = () => {
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', tutup);
  process.on('SIGTERM', tutup);
}

startServer();
