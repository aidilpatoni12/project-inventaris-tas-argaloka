# Argaloka — Sistem Inventaris Tas (Full-Stack React + Express + MySQL)

Aplikasi manajemen inventaris tas dengan frontend React (Vite), backend Express REST API, dan database MySQL lengkap dengan trigger otomatis untuk perhitungan stok, modal rata-rata tertimbang, dan keuntungan penjualan.

## Struktur Proyek

- `src/` — Frontend React + TypeScript
- `server.ts` & `server/` — Backend Express API + Vite dev middleware
- `mysql/01_struktur.sql` — Skema tabel, relasi, dan trigger MySQL
- `mysql/02_data_awal.sql` — Data awal (pengguna, kategori, warna, produk, dan transaksi awal)
- `scripts/hash.ts` — Utilitas pembuat hash kata sandi (`npm run hash -- "sandi"`)

## Menjalankan dengan MySQL

1. Impor skema dan data awal ke MySQL:
   ```bash
   mysql -u root -p < mysql/01_struktur.sql
   mysql -u root -p < mysql/02_data_awal.sql
   ```
2. Salin `.env.example` menjadi `.env` lalu sesuaikan `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, dan isi `JWT_SECRET` (minimal 16 karakter):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Pasang dependensi dan jalankan:
   ```bash
   npm install
   npm run dev
   ```
   Untuk produksi:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

> Catatan lingkungan preview: Bila server MySQL tidak tersedia di mesin lokal/sandbox (`DB_STRICT` tidak disetel `true`), backend otomatis beralih ke database SQLite lokal (`./data/argaloka.sqlite`) dengan skema dan trigger yang identik agar aplikasi tetap bisa dicoba langsung.

## Akun Contoh

| Username | Kata Sandi | Peran |
|----------|------------|-------|
| `admin`  | `admin123` | Admin (akses penuh, termasuk hapus data, koreksi stok manual, dan kelola pengguna) |
| `staff`  | `staff123` | Staf Gudang (lihat dashboard, tambah/ubah produk, kategori, warna, dan catat/ubah transaksi) |
# project-inventaris-tas-argaloka
