import { Router } from 'express';
import { config } from '../config.ts';
import { exec, getDialect, one, query } from '../db.ts';
import { bad, forbidden, notFound } from '../errors.ts';
import { requireRole } from '../auth.ts';
import { PRODUK_SELECT, getProduk } from '../queries.ts';
import { asyncH, idParam, int, str } from '../validate.ts';

const router = Router();

router.get(
  '/',
  asyncH(async (req, res) => {
    const q = req.query;
    const where: string[] = [];
    const params: unknown[] = [];

    if (q.kategori_id) {
      where.push('p.kategori_id = ?');
      params.push(int(q.kategori_id, 'kategori_id', { min: 1 }));
    }
    if (q.warna_id) {
      where.push('p.warna_id = ?');
      params.push(int(q.warna_id, 'warna_id', { min: 1 }));
    }
    if (q.menipis === '1' || q.menipis === 'true') {
      where.push('p.stok <= ?');
      params.push(config.batasStokMenipis);
    }
    if (q.q && String(q.q).trim() !== '') {
      where.push('LOWER(p.nama) LIKE ?');
      params.push(`%${String(q.q).trim().toLowerCase()}%`);
    }

    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(`${PRODUK_SELECT} ${sqlWhere} ORDER BY p.nama ASC, p.id ASC`, params);
    res.json(rows);
  }),
);

router.get(
  '/:id',
  asyncH(async (req, res) => {
    const produk = await getProduk(idParam(req));
    if (!produk) throw notFound('Produk tidak ditemukan.');
    res.json(produk);
  }),
);

router.post(
  '/',
  asyncH(async (req, res) => {
    const b = req.body ?? {};
    const nama = str(b.nama, 'Nama produk', { min: 1, max: 160 })!;
    const kategoriId = int(b.kategori_id, 'Kategori', { min: 1 })!;
    const warnaId =
      b.warna_id === null || b.warna_id === '' || b.warna_id === undefined
        ? null
        : int(b.warna_id, 'Warna', { min: 1 });
    const hargaBeli = int(b.harga_beli, 'Harga beli', { min: 0 })!;
    const hargaJual = int(b.harga_jual, 'Harga jual', { min: 1 })!;
    const stokAwal = int(b.stok, 'Stok awal', { min: 0, required: false }) ?? 0;

    const kat = await one('SELECT id FROM kategori WHERE id = ?', [kategoriId]);
    if (!kat) throw bad('Kategori tidak ditemukan.');
    if (warnaId !== null) {
      const wrn = await one('SELECT id FROM warna WHERE id = ?', [warnaId]);
      if (!wrn) throw bad('Warna tidak ditemukan.');
    }

    const r = await exec(
      'INSERT INTO produk (nama, kategori_id, warna_id, harga_beli, harga_jual, stok) VALUES (?, ?, ?, ?, ?, 0)',
      [nama, kategoriId, warnaId, hargaBeli, hargaJual],
    );
    const produkId = r.insertId;

    if (stokAwal > 0) {
      const curDateExpr =
        getDialect() === 'mysql' ? 'CURDATE()' : "date('now', 'localtime')";
      await exec(
        `INSERT INTO transaksi (tanggal, jenis, produk_id, jumlah, harga, dicatat_oleh) VALUES (${curDateExpr}, 'masuk', ?, ?, ?, ?)`,
        [produkId, stokAwal, hargaBeli, req.user!.id],
      );
    }

    res.status(201).json(await getProduk(produkId));
  }),
);

router.put(
  '/:id',
  asyncH(async (req, res) => {
    const id = idParam(req);
    const b = req.body ?? {};
    const existing = await one<{
      id: number;
      nama: string;
      kategori_id: number;
      warna_id: number | null;
      harga_beli: number;
      harga_jual: number;
      stok: number;
    }>(
      'SELECT id, nama, kategori_id, warna_id, harga_beli, harga_jual, stok FROM produk WHERE id = ?',
      [id],
    );
    if (!existing) throw notFound('Produk tidak ditemukan.');

    const nama =
      b.nama !== undefined
        ? str(b.nama, 'Nama produk', { min: 1, max: 160 })!
        : existing.nama;
    const kategoriId =
      b.kategori_id !== undefined
        ? int(b.kategori_id, 'Kategori', { min: 1 })!
        : existing.kategori_id;
    const warnaId =
      b.warna_id === undefined
        ? existing.warna_id
        : b.warna_id === null || b.warna_id === ''
          ? null
          : int(b.warna_id, 'Warna', { min: 1 });
    const hargaBeli =
      b.harga_beli !== undefined
        ? int(b.harga_beli, 'Harga beli', { min: 0 })!
        : existing.harga_beli;
    const hargaJual =
      b.harga_jual !== undefined
        ? int(b.harga_jual, 'Harga jual', { min: 1 })!
        : existing.harga_jual;

    let stok = existing.stok;
    if (b.stok !== undefined) {
      const requestedStok = int(b.stok, 'Stok', { min: 0 })!;
      if (requestedStok !== existing.stok) {
        if (req.user!.peran !== 'admin') {
          throw forbidden('Koreksi stok manual hanya diperbolehkan untuk Admin.');
        }
        stok = requestedStok;
      }
    }

    await exec(
      'UPDATE produk SET nama = ?, kategori_id = ?, warna_id = ?, harga_beli = ?, harga_jual = ?, stok = ? WHERE id = ?',
      [nama, kategoriId, warnaId, hargaBeli, hargaJual, stok, id],
    );
    res.json(await getProduk(id));
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncH(async (req, res) => {
    const id = idParam(req);
    const r = await exec('DELETE FROM produk WHERE id = ?', [id]);
    if (!r.affectedRows) throw notFound('Produk tidak ditemukan.');
    res.json({ pesan: 'Produk berhasil dihapus. Riwayat transaksi tetap tersimpan.' });
  }),
);

export default router;
