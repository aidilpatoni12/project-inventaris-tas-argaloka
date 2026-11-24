import { Router } from 'express';
import { exec, one, query } from '../db.ts';
import { conflict, notFound } from '../errors.ts';
import { requireRole } from '../auth.ts';
import { asyncH, hexColor, idParam, str } from '../validate.ts';

const router = Router();

router.get(
  '/',
  asyncH(async (_req, res) => {
    const rows = await query(`
      SELECT w.id,
             w.nama,
             w.hex,
             COUNT(p.id) AS jumlah_produk
        FROM warna w
        LEFT JOIN produk p ON p.warna_id = w.id
       GROUP BY w.id, w.nama, w.hex
       ORDER BY w.nama ASC
    `);
    res.json(rows);
  }),
);

router.post(
  '/',
  asyncH(async (req, res) => {
    const b = req.body ?? {};
    const nama = str(b.nama, 'Nama warna', { min: 1, max: 80 })!;
    const hex = b.hex ? hexColor(b.hex) : '#1b1b1b';
    const r = await exec('INSERT INTO warna (nama, hex) VALUES (?, ?)', [nama, hex]);
    const created = await one(
      'SELECT id, nama, hex, 0 AS jumlah_produk FROM warna WHERE id = ?',
      [r.insertId],
    );
    res.status(201).json(created);
  }),
);

router.put(
  '/:id',
  asyncH(async (req, res) => {
    const id = idParam(req);
    const b = req.body ?? {};
    const existing = await one<{ id: number; nama: string; hex: string }>(
      'SELECT id, nama, hex FROM warna WHERE id = ?',
      [id],
    );
    if (!existing) throw notFound('Warna tidak ditemukan.');

    const nama = b.nama !== undefined ? str(b.nama, 'Nama warna', { min: 1, max: 80 })! : existing.nama;
    const hex = b.hex !== undefined ? hexColor(b.hex) : existing.hex;
    await exec('UPDATE warna SET nama = ?, hex = ? WHERE id = ?', [nama, hex, id]);
    const updated = await one(
      `SELECT w.id, w.nama, w.hex, COUNT(p.id) AS jumlah_produk
         FROM warna w LEFT JOIN produk p ON p.warna_id = w.id
        WHERE w.id = ?
        GROUP BY w.id, w.nama, w.hex`,
      [id],
    );
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncH(async (req, res) => {
    const id = idParam(req);
    const used = await one<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM produk WHERE warna_id = ?',
      [id],
    );
    if (used && used.cnt > 0) {
      throw conflict('Warna masih dipakai produk. Ubah warna produknya dulu.');
    }
    const r = await exec('DELETE FROM warna WHERE id = ?', [id]);
    if (!r.affectedRows) throw notFound('Warna tidak ditemukan.');
    res.json({ pesan: 'Warna berhasil dihapus.' });
  }),
);

export default router;
