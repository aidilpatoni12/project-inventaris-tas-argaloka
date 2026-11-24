import { Router } from 'express';
import { config } from '../config.ts';
import { getDialect, one, query } from '../db.ts';
import { PRODUK_SELECT, TRANSAKSI_SELECT } from '../queries.ts';
import { asyncH } from '../validate.ts';

const router = Router();

const tambahHari = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const tambahBulan = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

router.get(
  '/',
  asyncH(async (_req, res) => {
    const isMysql = getDialect() === 'mysql';
    const hariRow = await one<{ hari: string }>(
      isMysql ? 'SELECT CURDATE() AS hari' : "SELECT date('now', 'localtime') AS hari",
    );
    const hari = hariRow?.hari || new Date().toISOString().slice(0, 10);
    const bulanIni = hari.slice(0, 7);

    const AWAL_BULAN = isMysql
      ? 'DATE_SUB(CURDATE(), INTERVAL DAYOFMONTH(CURDATE()) - 1 DAY)'
      : "date('now', 'localtime', 'start of month')";
    const TUJUH_HARI_LALU = isMysql
      ? 'CURDATE() - INTERVAL 6 DAY'
      : "date('now', 'localtime', '-6 days')";
    const ENAM_BULAN_LALU = isMysql
      ? `DATE_SUB(${AWAL_BULAN}, INTERVAL 5 MONTH)`
      : "date('now', 'localtime', 'start of month', '-5 months')";
    const BULAN_EXPR = isMysql
      ? "DATE_FORMAT(tanggal, '%Y-%m')"
      : "strftime('%Y-%m', tanggal)";
    const intCast = (expr: string) =>
      isMysql ? `CAST(${expr} AS SIGNED)` : expr;

    const PENJUALAN = intCast('COALESCE(SUM(jumlah * harga), 0)');
    const UNTUNG = intCast('COALESCE(SUM(keuntungan), 0)');

    const [
      ringkasan,
      harian,
      bulanan,
      untungKategori,
      untungWarna,
      stokKategori,
      stokWarna,
      menipis,
      terakhir,
    ] = await Promise.all([
      one<{
        jumlah_produk: number;
        total_stok: number;
        nilai_stok: number;
        keuntungan_total: number;
        penjualan_bulan_ini: number;
        keuntungan_bulan_ini: number;
        transaksi_bulan_ini: number;
      }>(`SELECT
            (SELECT COUNT(*) FROM produk) AS jumlah_produk,
            (SELECT ${intCast('COALESCE(SUM(stok), 0)')} FROM produk) AS total_stok,
            (SELECT ${intCast('COALESCE(SUM(stok * harga_beli), 0)')} FROM produk) AS nilai_stok,
            ${UNTUNG} AS keuntungan_total,
            ${intCast(`COALESCE(SUM(CASE WHEN tanggal >= ${AWAL_BULAN} THEN jumlah * harga END), 0)`)} AS penjualan_bulan_ini,
            ${intCast(`COALESCE(SUM(CASE WHEN tanggal >= ${AWAL_BULAN} THEN keuntungan END), 0)`)} AS keuntungan_bulan_ini,
            COUNT(CASE WHEN tanggal >= ${AWAL_BULAN} THEN 1 END) AS transaksi_bulan_ini
          FROM transaksi WHERE jenis = 'keluar'`),
      query<{ tanggal: string; penjualan: number; keuntungan: number }>(
        `SELECT tanggal, ${PENJUALAN} AS penjualan, ${UNTUNG} AS keuntungan
           FROM transaksi WHERE jenis = 'keluar' AND tanggal >= ${TUJUH_HARI_LALU}
          GROUP BY tanggal`,
      ),
      query<{ bulan: string; penjualan: number; keuntungan: number }>(
        `SELECT ${BULAN_EXPR} AS bulan, ${PENJUALAN} AS penjualan, ${UNTUNG} AS keuntungan
           FROM transaksi WHERE jenis = 'keluar' AND tanggal >= ${ENAM_BULAN_LALU}
          GROUP BY ${BULAN_EXPR}`,
      ),
      query<{ label: string; nilai: number }>(
        `SELECT COALESCE(k.nama, 'Lainnya') AS label, ${intCast('SUM(t.keuntungan)')} AS nilai
           FROM transaksi t
           LEFT JOIN produk p ON p.id = t.produk_id
           LEFT JOIN kategori k ON k.id = p.kategori_id
          WHERE t.jenis = 'keluar'
          GROUP BY COALESCE(k.nama, 'Lainnya')
          ORDER BY nilai DESC`,
      ),
      query<{ label: string; hex: string | null; nilai: number }>(
        `SELECT COALESCE(w.nama, 'Tanpa warna') AS label, MAX(w.hex) AS hex, ${intCast('SUM(t.keuntungan)')} AS nilai
           FROM transaksi t
           LEFT JOIN produk p ON p.id = t.produk_id
           LEFT JOIN warna w ON w.id = p.warna_id
          WHERE t.jenis = 'keluar'
          GROUP BY COALESCE(w.nama, 'Tanpa warna')
          ORDER BY nilai DESC`,
      ),
      query<{ label: string; nilai: number }>(
        `SELECT k.nama AS label, ${intCast('SUM(p.stok)')} AS nilai
           FROM produk p
           JOIN kategori k ON k.id = p.kategori_id
          GROUP BY k.id, k.nama
         HAVING SUM(p.stok) > 0
          ORDER BY nilai DESC`,
      ),
      query<{ label: string; hex: string | null; nilai: number }>(
        `SELECT COALESCE(w.nama, 'Tanpa warna') AS label, MAX(w.hex) AS hex, ${intCast('SUM(p.stok)')} AS nilai
           FROM produk p
           LEFT JOIN warna w ON w.id = p.warna_id
          GROUP BY COALESCE(w.nama, 'Tanpa warna')
         HAVING SUM(p.stok) > 0
          ORDER BY nilai DESC`,
      ),
      query(`${PRODUK_SELECT} WHERE p.stok <= ? ORDER BY p.stok ASC, p.nama ASC`, [
        config.batasStokMenipis,
      ]),
      query(`${TRANSAKSI_SELECT} ORDER BY t.tanggal DESC, t.id DESC LIMIT 5`),
    ]);

    const petaHari = new Map(harian.map((r) => [r.tanggal, r]));
    const grafik7Hari = Array.from({ length: 7 }, (_, i) => {
      const tgl = tambahHari(hari, i - 6);
      const r = petaHari.get(tgl);
      return {
        tanggal: tgl,
        penjualan: Number(r?.penjualan ?? 0),
        keuntungan: Number(r?.keuntungan ?? 0),
      };
    });

    const petaBulan = new Map(bulanan.map((r) => [r.bulan, r]));
    const grafik6Bulan = Array.from({ length: 6 }, (_, i) => {
      const bln = tambahBulan(bulanIni, i - 5);
      const r = petaBulan.get(bln);
      return {
        bulan: bln,
        penjualan: Number(r?.penjualan ?? 0),
        keuntungan: Number(r?.keuntungan ?? 0),
      };
    });

    res.json({
      tanggal_server: hari,
      batas_stok_menipis: config.batasStokMenipis,
      ringkasan,
      grafik_7_hari: grafik7Hari,
      grafik_6_bulan: grafik6Bulan,
      keuntungan_per_kategori: untungKategori,
      keuntungan_per_warna: untungWarna,
      stok_per_kategori: stokKategori,
      stok_per_warna: stokWarna,
      stok_menipis: menipis,
      transaksi_terakhir: terakhir,
    });
  }),
);

export default router;
