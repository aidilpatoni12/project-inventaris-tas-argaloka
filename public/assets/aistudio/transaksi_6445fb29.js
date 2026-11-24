import { Router } from 'express'
import { query, one } from '../db.js'
import { bad, notFound } from '../errors.js'
import { asyncH, int, tanggal, idParam } from '../validate.js'
import { requireRole } from '../auth.js'
import { TRANSAKSI_SELECT, getProduk, getTransaksi } from '../queries.js'

const router = Router()

// Filter yang sama dipakai untuk daftar dan hapus massal (alias: t = transaksi, p = produk)
function filter(q) {
  const where = []
  const params = []
  if (q.jenis) {
    if (!['masuk', 'keluar'].includes(q.jenis)) throw bad("jenis harus 'masuk' atau 'keluar'.")
    where.push('t.jenis = ?'); params.push(q.jenis)
  }
  if (q.produk_id) { where.push('t.produk_id = ?'); params.push(int(q.produk_id, 'produk_id', { min: 1 })) }
  if (q.kategori_id) { where.push('p.kategori_id = ?'); params.push(int(q.kategori_id, 'kategori_id', { min: 1 })) }
  if (q.warna_id) { where.push('p.warna_id = ?'); params.push(int(q.warna_id, 'warna_id', { min: 1 })) }
  if (q.dari) { where.push('t.tanggal >= ?'); params.push(tanggal(q.dari, 'dari')) }
  if (q.sampai) { where.push('t.tanggal <= ?'); params.push(tanggal(q.sampai, 'sampai')) }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params, kosong: where.length === 0 }
}

// Riwayat. Filter: ?jenis= &produk_id= &kategori_id= &warna_id= &dari= &sampai= &halaman= &per_halaman=
router.get('/', asyncH(async (req, res) => {
  const f = filter(req.query)
  const perHalaman = int(req.query.per_halaman, 'per_halaman', { min: 1, max: 200, required: false }) ?? 50
  const halaman = int(req.query.halaman, 'halaman', { min: 1, max: 100000, required: false }) ?? 1

  const [data, ringkas] = await Promise.all([
    query(`${TRANSAKSI_SELECT} ${f.sql} ORDER BY t.tanggal DESC, t.id DESC LIMIT ? OFFSET ?`, [...f.params, perHalaman, (halaman - 1) * perHalaman]),
    one(`SELECT COUNT(*) AS total, CAST(COALESCE(SUM(t.keuntungan), 0) AS SIGNED) AS total_keuntungan
           FROM transaksi t LEFT JOIN produk p ON p.id = t.produk_id ${f.sql}`, f.params),
  ])
  res.json({ data, total: ringkas.total, total_keuntungan: ringkas.total_keuntungan, halaman, per_halaman: perHalaman })
}))

// Catat barang masuk atau keluar. Stok, modal, dan keuntungan dihitung oleh trigger MySQL.
router.post('/', asyncH(async (req, res) => {
  const b = req.body ?? {}
  if (!['masuk', 'keluar'].includes(b.jenis)) throw bad("jenis harus 'masuk' atau 'keluar'.")
  const produkId = int(b.produk_id, 'Produk', { min: 1 })
  const jumlah = int(b.jumlah, 'Jumlah', { min: 1 })
  const tgl = tanggal(b.tanggal, 'Tanggal', { required: false })

  const produk = await one('SELECT harga_beli, harga_jual FROM produk WHERE id = ?', [produkId])
  if (!produk) throw notFound('Produk tidak ditemukan.')
  // Bila harga tidak diisi: masuk memakai harga beli, keluar memakai harga jual produk
  const harga = int(b.harga, 'Harga', { min: 0, required: false }) ?? (b.jenis === 'masuk' ? produk.harga_beli : produk.harga_jual)

  const r = await query(
    'INSERT INTO transaksi (tanggal, jenis, produk_id, jumlah, harga, dicatat_oleh) VALUES (COALESCE(?, CURDATE()), ?, ?, ?, ?, ?)',
    [tgl, b.jenis, produkId, jumlah, harga, req.user.id],
  )
  res.status(201).json({ transaksi: await getTransaksi(r.insertId), produk: await getProduk(produkId) })
}))

// Ubah tanggal, jumlah, atau harga. Jenis dan produk tidak bisa diubah (hapus lalu catat ulang).
router.put('/:id', asyncH(async (req, res) => {
  const id = idParam(req)
  const b = req.body ?? {}
  const ada = await one('SELECT produk_id, tanggal, jumlah, harga FROM transaksi WHERE id = ?', [id])
  if (!ada) throw notFound('Transaksi tidak ditemukan.')

  const tgl = b.tanggal !== undefined ? tanggal(b.tanggal) : ada.tanggal
  const jumlah = b.jumlah !== undefined ? int(b.jumlah, 'Jumlah', { min: 1 }) : ada.jumlah
  const harga = b.harga !== undefined ? int(b.harga, 'Harga', { min: 0 }) : ada.harga

  await query('UPDATE transaksi SET tanggal = ?, jumlah = ?, harga = ? WHERE id = ?', [tgl, jumlah, harga, id])
  res.json({ transaksi: await getTransaksi(id), produk: ada.produk_id ? await getProduk(ada.produk_id) : null })
}))

// Hapus massal sesuai filter. Tanpa filter harus menyertakan ?konfirmasi=ya (hapus seluruh riwayat).
router.delete('/', requireRole('admin'), asyncH(async (req, res) => {
  const f = filter(req.query)
  if (f.kosong && req.query.konfirmasi !== 'ya') {
    throw bad('Ini akan menghapus SELURUH riwayat. Tambahkan ?konfirmasi=ya untuk melanjutkan.')
  }
  const r = await query(`DELETE t FROM transaksi t LEFT JOIN produk p ON p.id = t.produk_id ${f.sql}`, f.params)
  res.json({ dihapus: r.affectedRows, pesan: 'Riwayat dihapus. Jumlah stok produk tidak berubah.' })
}))

// Hapus satu catatan. Stok produk tidak berubah.
router.delete('/:id', requireRole('admin'), asyncH(async (req, res) => {
  const r = await query('DELETE FROM transaksi WHERE id = ?', [idParam(req)])
  if (!r.affectedRows) throw notFound('Transaksi tidak ditemukan.')
  res.json({ pesan: 'Catatan dihapus. Jumlah stok produk tidak berubah.' })
}))

export default router
