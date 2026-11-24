import { Router } from 'express'
import { query, one } from '../db.js'
import { config } from '../config.js'
import { asyncH } from '../validate.js'
import { PRODUK_SELECT, TRANSAKSI_SELECT } from '../queries.js'

const router = Router()

const tambahHari = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const tambahBulan = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const AWAL_BULAN = 'DATE_SUB(CURDATE(), INTERVAL DAYOFMONTH(CURDATE()) - 1 DAY)'
const PENJUALAN = 'CAST(COALESCE(SUM(jumlah * harga), 0) AS SIGNED)'
const UNTUNG = 'CAST(COALESCE(SUM(keuntungan), 0) AS SIGNED)'

// Semua data dashboard dalam satu panggilan
router.get('/', asyncH(async (_req, res) => {
  const { hari } = await one('SELECT CURDATE() AS hari')
  const bulanIni = hari.slice(0, 7)

  const [ringkasan, harian, bulanan, untungKategori, untungWarna, stokKategori, stokWarna, menipis, terakhir] =
    await Promise.all([
      one(`SELECT
             (SELECT COUNT(*) FROM produk) AS jumlah_produk,
             (SELECT CAST(COALESCE(SUM(stok), 0) AS SIGNED) FROM produk) AS total_stok,
             (SELECT CAST(COALESCE(SUM(stok * harga_beli), 0) AS SIGNED) FROM produk) AS nilai_stok,
             ${UNTUNG} AS keuntungan_total,
             CAST(COALESCE(SUM(CASE WHEN tanggal >= ${AWAL_BULAN} THEN jumlah * harga END), 0) AS SIGNED) AS penjualan_bulan_ini,
             CAST(COALESCE(SUM(CASE WHEN tanggal >= ${AWAL_BULAN} THEN keuntungan END), 0) AS SIGNED) AS keuntungan_bulan_ini,
             COUNT(CASE WHEN tanggal >= ${AWAL_BULAN} THEN 1 END) AS transaksi_bulan_ini
           FROM transaksi WHERE jenis = 'keluar'`),
      query(`SELECT tanggal, ${PENJUALAN} AS penjualan, ${UNTUNG} AS keuntungan
               FROM transaksi WHERE jenis = 'keluar' AND tanggal >= CURDATE() - INTERVAL 6 DAY GROUP BY tanggal`),
      query(`SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bulan, ${PENJUALAN} AS penjualan, ${UNTUNG} AS keuntungan
               FROM transaksi WHERE jenis = 'keluar' AND tanggal >= DATE_SUB(${AWAL_BULAN}, INTERVAL 5 MONTH)
              GROUP BY DATE_FORMAT(tanggal, '%Y-%m')`),
      query(`SELECT COALESCE(k.nama, 'Lainnya') AS label, CAST(SUM(t.keuntungan) AS SIGNED) AS nilai
               FROM transaksi t LEFT JOIN produk p ON p.id = t.produk_id LEFT JOIN kategori k ON k.id = p.kategori_id
              WHERE t.jenis = 'keluar' GROUP BY COALESCE(k.nama, 'Lainnya') ORDER BY nilai DESC`),
      query(`SELECT COALESCE(w.nama, 'Tanpa warna') AS label, MAX(w.hex) AS hex, CAST(SUM(t.keuntungan) AS SIGNED) AS nilai
               FROM transaksi t LEFT JOIN produk p ON p.id = t.produk_id LEFT JOIN warna w ON w.id = p.warna_id
              WHERE t.jenis = 'keluar' GROUP BY COALESCE(w.nama, 'Tanpa warna') ORDER BY nilai DESC`),
      query(`SELECT k.nama AS label, CAST(SUM(p.stok) AS SIGNED) AS nilai
               FROM produk p JOIN kategori k ON k.id = p.kategori_id
              GROUP BY k.id, k.nama HAVING SUM(p.stok) > 0 ORDER BY nilai DESC`),
      query(`SELECT COALESCE(w.nama, 'Tanpa warna') AS label, MAX(w.hex) AS hex, CAST(SUM(p.stok) AS SIGNED) AS nilai
               FROM produk p LEFT JOIN warna w ON w.id = p.warna_id
              GROUP BY COALESCE(w.nama, 'Tanpa warna') HAVING SUM(p.stok) > 0 ORDER BY nilai DESC`),
      query(`${PRODUK_SELECT} WHERE p.stok <= ? ORDER BY p.stok, p.nama`, [config.batasStokMenipis]),
      query(`${TRANSAKSI_SELECT} ORDER BY t.tanggal DESC, t.id DESC LIMIT 5`),
    ])

  // Isi hari dan bulan tanpa penjualan dengan nol agar grafik tidak bolong
  const petaHari = new Map(harian.map((r) => [r.tanggal, r]))
  const grafik7Hari = Array.from({ length: 7 }, (_, i) => {
    const tgl = tambahHari(hari, i - 6)
    const r = petaHari.get(tgl)
    return { tanggal: tgl, penjualan: r?.penjualan ?? 0, keuntungan: r?.keuntungan ?? 0 }
  })
  const petaBulan = new Map(bulanan.map((r) => [r.bulan, r]))
  const grafik6Bulan = Array.from({ length: 6 }, (_, i) => {
    const bln = tambahBulan(bulanIni, i - 5)
    const r = petaBulan.get(bln)
    return { bulan: bln, penjualan: r?.penjualan ?? 0, keuntungan: r?.keuntungan ?? 0 }
  })

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
  })
}))

export default router
