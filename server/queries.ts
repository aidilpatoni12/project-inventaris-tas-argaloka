import { one } from './db.ts';

export const PRODUK_SELECT = `
  SELECT p.id,
         p.nama,
         p.kategori_id,
         k.nama AS kategori,
         p.warna_id,
         w.nama AS warna,
         w.hex AS warna_hex,
         p.harga_beli,
         p.harga_jual,
         p.stok,
         p.dibuat_pada
    FROM produk p
    JOIN kategori k ON k.id = p.kategori_id
    LEFT JOIN warna w ON w.id = p.warna_id
`;

export const TRANSAKSI_SELECT = `
  SELECT t.id,
         t.tanggal,
         t.jenis,
         t.produk_id,
         COALESCE(p.nama, t.nama_produk) AS nama_produk,
         k.nama AS kategori,
         w.nama AS warna,
         w.hex AS warna_hex,
         t.jumlah,
         t.harga,
         t.harga_modal,
         t.keuntungan,
         t.dicatat_oleh,
         u.nama AS pencatat,
         t.dibuat_pada
    FROM transaksi t
    LEFT JOIN produk p ON p.id = t.produk_id
    LEFT JOIN kategori k ON k.id = p.kategori_id
    LEFT JOIN warna w ON w.id = p.warna_id
    LEFT JOIN pengguna u ON u.id = t.dicatat_oleh
`;

export function getProduk(id: number) {
  return one(`${PRODUK_SELECT} WHERE p.id = ?`, [id]);
}

export function getTransaksi(id: number) {
  return one(`${TRANSAKSI_SELECT} WHERE t.id = ?`, [id]);
}
