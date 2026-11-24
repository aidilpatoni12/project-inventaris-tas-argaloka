import { Router } from 'express';
import { exec, one, query } from '../db.ts';
import { conflict, notFound } from '../errors.ts';
import { requireRole } from '../auth.ts';
import { asyncH, idParam, str } from '../validate.ts';

const router = Router();

router.get(
  '/',
  asyncH(async (_req, res) => {
    const rows = await query(`
      SELECT k.id,
             k.nama,
             COUNT(p.id) AS jumlah_produk
        FROM kategori k
        LEFT JOIN produk p ON p.kategori_id = k.id
       GROUP BY k.id, k.nama
       ORDER BY k.nama ASC
    `);
    res.json(rows);
  }),
);

router.post(
  '/',
  asyncH(async (req, res) => {
    const nama = str(req.body?.nama, 'Nama kategori', { min: 1, max: 80 })!;
    const r = await exec('INSERT INTO kategori (nama) VALUES (?)', [nama]);
    const created = await one(
      'SELECT id, nama, 0 AS jumlah_produk FROM kategori WHERE id = ?',
      [r.insertId],
    );
    res.status(201).json(created);
  }),
);

router.put(
  '/:id',
  asyncH(async (req, res) => {
    const id = idParam(req);
    const nama = str(req.body?.nama, 'Nama kategori', { min: 1, max: 80 })!;
    const r = await exec('UPDATE kategori SET nama = ? WHERE id = ?', [nama, id]);
    if (!r.affectedRows) throw notFound('Kategori tidak ditemukan.');
    const updated = await one(
      `SELECT k.id, k.nama, COUNT(p.id) AS jumlah_produk
         FROM kategori k LEFT JOIN produk p ON p.kategori_id = k.id
        WHERE k.id = ?
        GROUP BY k.id, k.nama`,
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
      'SELECT COUNT(*) AS cnt FROM produk WHERE kategori_id = ?',
      [id],
    );
    if (used && used.cnt > 0) {
      throw conflict('Kategori masih dipakai produk. Pindahkan atau hapus produknya dulu.');
    }
    const r = await exec('DELETE FROM kategori WHERE id = ?', [id]);
    if (!r.affectedRows) throw notFound('Kategori tidak ditemukan.');
    res.json({ pesan: 'Kategori berhasil dihapus.' });
  }),
);

export default router;
