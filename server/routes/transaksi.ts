import { Router } from 'express';
import { exec, getDialect, one, query } from '../db.ts';
import { bad, notFound } from '../errors.ts';
import { requireRole } from '../auth.ts';
import { TRANSAKSI_SELECT, getProduk, getTransaksi } from '../queries.ts';
import { asyncH, idParam, int, tanggal } from '../validate.ts';

const router = Router();

function filter(q: Record<string, unknown>) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.jenis) {
    if (!['masuk', 'keluar'].includes(String(q.jenis))) {
      throw bad("jenis harus 'masuk' atau 'keluar'.");
    }
    where.push('t.jenis = ?');
    params.push(String(q.jenis));
  }
  if (q.produk_id) {
    where.push('t.produk_id = ?');
    params.push(int(q.produk_id, 'produk_id', { min: 1 }));
  }
  if (q.kategori_id) {
    where.push('p.kategori_id = ?');
    params.push(int(q.kategori_id, 'kategori_id', { min: 1 }));
  }
  if (q.warna_id) {
    where.push('p.warna_id = ?');
    params.push(int(q.warna_id, 'warna_id', { min: 1 }));
  }
  if (q.dari) {
    where.push('t.tanggal >= ?');
    params.push(tanggal(q.dari, 'dari'));
  }
  if (q.sampai) {
    where.push('t.tanggal <= ?');
    params.push(tanggal(q.sampai, 'sampai'));
  }
  return {
    sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
    kosong: where.length === 0,
  };
}

router.get(
  '/',
  asyncH(async (req, res) => {
    const f = filter(req.query as Record<string, unknown>);
    const perHalaman =
      int(req.query.per_halaman, 'per_halaman', { min: 1, max: 200, required: false }) ?? 50;
    const halaman =
      int(req.query.halaman, 'halaman', { min: 1, max: 100000, required: false }) ?? 1;

    const sumExpr =
      getDialect() === 'mysql'
        ? 'CAST(COALESCE(SUM(t.keuntungan), 0) AS SIGNED)'
        : 'COALESCE(SUM(t.keuntungan), 0)';

    const [data, ringkas] = await Promise.all([
      query(
        `${TRANSAKSI_SELECT} ${f.sql} ORDER BY t.tanggal DESC, t.id DESC LIMIT ? OFFSET ?`,
        [...f.params, perHalaman, (halaman - 1) * perHalaman],
      ),
      one<{ total: number; total_keuntungan: number }>(
        `SELECT COUNT(*) AS total, ${sumExpr} AS total_keuntungan
           FROM transaksi t
           LEFT JOIN produk p ON p.id = t.produk_id
          ${f.sql}`,
        f.params,
      ),
    ]);

    res.json({
      data,
      total: Number(ringkas?.total ?? 0),
      total_keuntungan: Number(ringkas?.total_keuntungan ?? 0),
      halaman,
      per_halaman: perHalaman,
    });
  }),
);

router.post(
  '/',
  asyncH(async (req, res) => {
    const b = req.body ?? {};
    if (!['masuk', 'keluar'].includes(String(b.jenis))) {
      throw bad("jenis harus 'masuk' atau 'keluar'.");
    }
    const jenis = String(b.jenis) as 'masuk' | 'keluar';
    const produkId = int(b.produk_id, 'Produk', { min: 1 })!;
    const jumlah = int(b.jumlah, 'Jumlah', { min: 1 })!;
    const tgl = tanggal(b.tanggal, 'Tanggal', { required: false });

    const produk = await one<{ harga_beli: number; harga_jual: number }>(
      'SELECT harga_beli, harga_jual FROM produk WHERE id = ?',
      [produkId],
    );
    if (!produk) throw notFound('Produk tidak ditemukan.');

    const harga =
      int(b.harga, 'Harga', { min: 0, required: false }) ??
      (jenis === 'masuk' ? produk.harga_beli : produk.harga_jual);

    const todayExpr = getDialect() === 'mysql' ? 'CURDATE()' : "date('now', 'localtime')";

    const r = await exec(
      `INSERT INTO transaksi (tanggal, jenis, produk_id, jumlah, harga, dicatat_oleh) VALUES (COALESCE(?, ${todayExpr}), ?, ?, ?, ?, ?)`,
      [tgl, jenis, produkId, jumlah, harga, req.user!.id],
    );
    res.status(201).json({
      transaksi: await getTransaksi(r.insertId),
      produk: await getProduk(produkId),
    });
  }),
);

router.put(
  '/:id',
  asyncH(async (req, res) => {
    const id = idParam(req);
    const b = req.body ?? {};
    const ada = await one<{
      produk_id: number | null;
      tanggal: string;
      jumlah: number;
      harga: number;
    }>('SELECT produk_id, tanggal, jumlah, harga FROM transaksi WHERE id = ?', [id]);
    if (!ada) throw notFound('Transaksi tidak ditemukan.');

    const tgl = b.tanggal !== undefined ? tanggal(b.tanggal) : ada.tanggal;
    const jumlah =
      b.jumlah !== undefined ? int(b.jumlah, 'Jumlah', { min: 1 }) : ada.jumlah;
    const harga =
      b.harga !== undefined ? int(b.harga, 'Harga', { min: 0 }) : ada.harga;

    await exec('UPDATE transaksi SET tanggal = ?, jumlah = ?, harga = ? WHERE id = ?', [
      tgl,
      jumlah,
      harga,
      id,
    ]);

    res.json({
      transaksi: await getTransaksi(id),
      produk: ada.produk_id ? await getProduk(ada.produk_id) : null,
    });
  }),
);

router.delete(
  '/',
  requireRole('admin'),
  asyncH(async (req, res) => {
    const f = filter(req.query as Record<string, unknown>);
    if (f.kosong && req.query.konfirmasi !== 'ya') {
      throw bad('Ini akan menghapus SELURUH riwayat. Tambahkan ?konfirmasi=ya untuk melanjutkan.');
    }

    const r =
      getDialect() === 'mysql'
        ? await exec(
            `DELETE t FROM transaksi t LEFT JOIN produk p ON p.id = t.produk_id ${f.sql}`,
            f.params,
          )
        : await exec(
            `DELETE FROM transaksi WHERE id IN (SELECT t.id FROM transaksi t LEFT JOIN produk p ON p.id = t.produk_id ${f.sql})`,
            f.params,
          );

    res.json({
      dihapus: r.affectedRows,
      pesan: 'Riwayat dihapus. Jumlah stok produk tidak berubah.',
    });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncH(async (req, res) => {
    const r = await exec('DELETE FROM transaksi WHERE id = ?', [idParam(req)]);
    if (!r.affectedRows) throw notFound('Transaksi tidak ditemukan.');
    res.json({ pesan: 'Catatan dihapus. Jumlah stok produk tidak berubah.' });
  }),
);

export default router;
