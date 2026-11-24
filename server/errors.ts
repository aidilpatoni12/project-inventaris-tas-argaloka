import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const bad = (message: string) => new AppError(400, message);
export const unauthorized = (message = 'Sesi tidak valid atau sudah kedaluwarsa.') =>
  new AppError(401, message);
export const forbidden = (message = 'Anda tidak memiliki izin untuk aksi ini.') =>
  new AppError(403, message);
export const notFound = (message = 'Data tidak ditemukan.') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);

interface DbLikeError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  const dbErr = err as DbLikeError;

  // Trigger MySQL SIGNAL SQLSTATE '45000'
  if (dbErr?.sqlState === '45000' || dbErr?.errno === 1644) {
    res.status(400).json({ error: dbErr.sqlMessage || dbErr.message || 'Validasi database gagal.' });
    return;
  }

  // Trigger SQLite RAISE(ABORT, ...)
  if (
    dbErr?.message &&
    (dbErr.message.includes('Stok tidak cukup') ||
      dbErr.message.includes('membuat stok produk menjadi negatif'))
  ) {
    res.status(400).json({ error: dbErr.message });
    return;
  }

  // Duplikat unique key (MySQL ER_DUP_ENTRY / SQLite UNIQUE constraint)
  if (
    dbErr?.code === 'ER_DUP_ENTRY' ||
    dbErr?.message?.includes('UNIQUE constraint failed')
  ) {
    res.status(409).json({ error: 'Data dengan nama atau username tersebut sudah ada.' });
    return;
  }

  // Foreign key RESTRICT (masih dipakai produk)
  if (
    dbErr?.code === 'ER_ROW_IS_REFERENCED_2' ||
    dbErr?.code === 'ER_ROW_IS_REFERENCED' ||
    dbErr?.message?.includes('FOREIGN KEY constraint failed')
  ) {
    res.status(409).json({ error: 'Data masih dipakai oleh produk lain dan tidak bisa dihapus.' });
    return;
  }

  // Foreign key parent tidak ada
  if (dbErr?.code === 'ER_NO_REFERENCED_ROW_2') {
    res.status(400).json({ error: 'Data referensi tidak ditemukan.' });
    return;
  }

  console.error('[api error]', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
}
