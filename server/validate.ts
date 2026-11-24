import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { bad } from './errors.ts';

export function asyncH(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function str(
  val: unknown,
  label: string,
  opts: { required?: boolean; min?: number; max?: number } = {},
): string | null {
  const { required = true, min = 1, max = 160 } = opts;
  if (val === undefined || val === null || String(val).trim() === '') {
    if (required) throw bad(`${label} wajib diisi.`);
    return null;
  }
  const s = String(val).trim();
  if (s.length < min) throw bad(`${label} minimal ${min} karakter.`);
  if (s.length > max) throw bad(`${label} maksimal ${max} karakter.`);
  return s;
}

export function int(
  val: unknown,
  label: string,
  opts: { required?: boolean; min?: number; max?: number } = {},
): number | null {
  const { required = true, min = 0, max = 2_000_000_000 } = opts;
  if (val === undefined || val === null || val === '') {
    if (required) throw bad(`${label} wajib diisi.`);
    return null;
  }
  const n = Number(val);
  if (!Number.isInteger(n) || Number.isNaN(n)) {
    throw bad(`${label} harus berupa bilangan bulat.`);
  }
  if (n < min) throw bad(`${label} minimal ${min}.`);
  if (n > max) throw bad(`${label} maksimal ${max}.`);
  return n;
}

export function hexColor(val: unknown, label = 'Kode warna'): string {
  const s = str(val, label, { required: true, min: 4, max: 7 })!;
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw bad(`${label} harus format hex seperti #1b1b1b.`);
  }
  return s.toLowerCase();
}

export function tanggal(
  val: unknown,
  label = 'Tanggal',
  opts: { required?: boolean } = {},
): string | null {
  const { required = true } = opts;
  if (val === undefined || val === null || String(val).trim() === '') {
    if (required) throw bad(`${label} wajib diisi.`);
    return null;
  }
  const s = String(val).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw bad(`${label} harus berformat YYYY-MM-DD.`);
  }
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw bad(`${label} tidak valid.`);
  }
  return s;
}

export function idParam(req: Request, name = 'id'): number {
  const raw = req.params?.[name];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw bad(`Parameter ${name} tidak valid.`);
  }
  return n;
}
