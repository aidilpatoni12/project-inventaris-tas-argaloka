export type UserRole = 'admin' | 'staf';

export interface User {
  id: number;
  username: string;
  nama: string;
  peran: UserRole;
  dibuat_pada?: string;
}

export interface Category {
  id: number;
  nama: string;
  jumlah_produk: number;
}

export interface ColorItem {
  id: number;
  nama: string;
  hex: string;
  jumlah_produk: number;
}

export interface Product {
  id: number;
  nama: string;
  kategori_id: number;
  kategori: string;
  warna_id: number | null;
  warna: string | null;
  warna_hex: string | null;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  dibuat_pada?: string;
}

export interface Transaction {
  id: number;
  tanggal: string;
  jenis: 'masuk' | 'keluar';
  produk_id: number | null;
  nama_produk: string;
  kategori: string | null;
  warna: string | null;
  warna_hex: string | null;
  jumlah: number;
  harga: number;
  harga_modal: number;
  keuntungan: number;
  dicatat_oleh: number | null;
  pencatat: string | null;
  dibuat_pada?: string;
}

export interface TransactionListResponse {
  data: Transaction[];
  total: number;
  total_keuntungan: number;
  halaman: number;
  per_halaman: number;
}

export interface DashboardSummary {
  jumlah_produk: number;
  total_stok: number;
  nilai_stok: number;
  keuntungan_total: number;
  penjualan_bulan_ini: number;
  keuntungan_bulan_ini: number;
  transaksi_bulan_ini: number;
}

export interface DashboardData {
  tanggal_server: string;
  batas_stok_menipis: number;
  ringkasan: DashboardSummary;
  grafik_7_hari: Array<{ tanggal: string; penjualan: number; keuntungan: number }>;
  grafik_6_bulan: Array<{ bulan: string; penjualan: number; keuntungan: number }>;
  keuntungan_per_kategori: Array<{ label: string; nilai: number }>;
  keuntungan_per_warna: Array<{ label: string; hex: string | null; nilai: number }>;
  stok_per_kategori: Array<{ label: string; nilai: number }>;
  stok_per_warna: Array<{ label: string; hex: string | null; nilai: number }>;
  stok_menipis: Product[];
  transaksi_terakhir: Transaction[];
}
