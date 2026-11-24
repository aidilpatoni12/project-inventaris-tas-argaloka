# Backend Inventaris Argaloka

REST API dengan Node.js, Express, dan MySQL untuk aplikasi inventaris tas Argaloka. Database memakai file di folder `mysql/` (`01_struktur.sql` lalu `02_data_awal.sql`). Stok, modal, dan keuntungan dihitung oleh trigger MySQL, jadi API hanya perlu mencatat transaksi.

## Pemasangan

Kebutuhan: Node.js 18.11 atau lebih baru, dan database yang sudah diimpor dari folder `mysql/`.

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Isi `.env`: sesuaikan `DB_USER` dan `DB_PASSWORD` dengan MySQL Anda, lalu buat `JWT_SECRET` dengan perintah ini dan tempel hasilnya:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Jalankan:

```bash
npm run dev     # mode pengembangan (restart otomatis)
npm start       # mode biasa
```

Bila berhasil, terminal menampilkan `Terhubung ke MySQL` dan `Berjalan di http://localhost:3001/api`. Cek di browser: `http://localhost:3001/api/health` harus menjawab `{"status":"ok"}`.

## Peran dan hak akses

| Aksi | admin | staf |
|------|:-----:|:----:|
| Melihat semua data, dashboard | ya | ya |
| Tambah dan ubah produk, kategori, warna | ya | ya |
| Catat dan ubah transaksi | ya | ya |
| Koreksi stok manual lewat ubah produk | ya | tidak |
| Hapus produk, kategori, warna, transaksi | ya | tidak |
| Kelola akun pengguna | ya | tidak |

Untuk mengubah aturan ini, edit `requireRole(...)` pada rute yang bersangkutan.

## Daftar endpoint

Semua endpoint diawali `/api`. Kecuali `/health` dan `/auth/login`, setiap permintaan wajib menyertakan header `Authorization: Bearer <token>`. Kesalahan selalu berbentuk `{ "error": "pesan" }`.

| Metode | Alamat | Fungsi |
|--------|--------|--------|
| GET | `/health` | Cek server dan koneksi database |
| POST | `/auth/login` | Body `{ username, kata_sandi }`, menjawab `{ token, user }` |
| GET | `/auth/saya` | Data akun yang sedang login |
| POST | `/auth/ganti-sandi` | Body `{ sandi_lama, sandi_baru }` (minimal 8 karakter) |
| GET, POST | `/kategori` | Daftar (dengan jumlah produk) dan tambah `{ nama }` |
| PUT, DELETE | `/kategori/:id` | Ubah `{ nama }` dan hapus (ditolak bila masih dipakai produk) |
| GET, POST | `/warna` | Daftar dan tambah `{ nama, hex }` |
| PUT, DELETE | `/warna/:id` | Ubah `{ nama, hex }` dan hapus (ditolak bila masih dipakai) |
| GET | `/produk` | Filter: `kategori_id`, `warna_id`, `q`, `menipis=1` |
| POST | `/produk` | `{ nama, kategori_id, warna_id?, harga_beli, harga_jual, stok? }` |
| GET, PUT, DELETE | `/produk/:id` | Detail, ubah (admin boleh menyertakan `stok`), hapus |
| GET | `/transaksi` | Filter: `jenis`, `produk_id`, `kategori_id`, `warna_id`, `dari`, `sampai`, `halaman`, `per_halaman` |
| POST | `/transaksi` | `{ jenis, produk_id, jumlah, harga?, tanggal? }` |
| PUT | `/transaksi/:id` | Ubah `{ tanggal?, jumlah?, harga? }` |
| DELETE | `/transaksi/:id` | Hapus satu catatan |
| DELETE | `/transaksi` | Hapus massal sesuai filter yang sama. Tanpa filter wajib `?konfirmasi=ya` |
| GET | `/dashboard` | Seluruh data dashboard dalam satu panggilan |
| GET, POST | `/pengguna` | Admin: daftar dan tambah `{ username, nama, peran, kata_sandi }` |
| PUT, DELETE | `/pengguna/:id` | Admin: ubah `{ nama, peran, kata_sandi? }` dan hapus |

Catatan perilaku:

- `harga` pada transaksi boleh dikosongkan: barang masuk memakai harga beli produk, barang keluar memakai harga jual produk. `tanggal` kosong berarti hari ini.
- `POST` dan `PUT` transaksi menjawab `{ transaksi, produk }`, berisi stok produk terbaru.
- Penjualan melebihi stok ditolak dengan status 400 dan pesan "Stok tidak cukup untuk penjualan ini."
- Stok awal pada `POST /produk` dicatat otomatis sebagai transaksi "masuk".
- Menghapus transaksi tidak mengubah stok. Menghapus produk tidak menghapus riwayatnya.
- Jenis dan produk sebuah transaksi tidak bisa diubah. Hapus lalu catat ulang.

Isi `/dashboard`: `ringkasan` (keuntungan dan penjualan bulan ini, total stok, nilai stok), `grafik_7_hari`, `grafik_6_bulan`, `keuntungan_per_kategori`, `keuntungan_per_warna`, `stok_per_kategori`, `stok_per_warna`, `stok_menipis`, dan `transaksi_terakhir`. Hari dan bulan tanpa penjualan sudah diisi nol.

## Coba dengan curl

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","kata_sandi":"admin123"}'

# Pakai token hasil login
curl http://localhost:3001/api/dashboard -H "Authorization: Bearer TOKEN_ANDA"

# Catat penjualan 1 pcs untuk produk dengan id 1
curl -X POST http://localhost:3001/api/transaksi \
  -H "Authorization: Bearer TOKEN_ANDA" -H "Content-Type: application/json" \
  -d '{"jenis":"keluar","produk_id":1,"jumlah":1}'
```

## Memanggil dari React

```js
const API = 'http://localhost:3001/api'

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('argaloka_token')
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal')
  return data
}

// const { token, user } = await api('/auth/login', { method: 'POST', body: { username, kata_sandi } })
```

Pastikan alamat aplikasi React (misalnya `http://localhost:5173`) ada di `CORS_ORIGIN`.

## Keamanan

- Kata sandi disimpan sebagai hash `scrypt`, dan login dibatasi 20 percobaan per 15 menit per alamat IP.
- Ganti kata sandi akun contoh (`admin123`, `staff123`) sebelum dipakai sungguhan, lewat `POST /auth/ganti-sandi`.
- Jangan membagikan atau meng-commit file `.env`. File ini sudah masuk `.gitignore`.
- Token berlaku sesuai `JWT_EXPIRES` (awalnya 12 jam). Menghapus akun tidak langsung mencabut token yang sudah terbit, sampai token itu kedaluwarsa.
- Untuk dipakai di internet, jalankan di belakang HTTPS (misalnya Nginx atau layanan hosting) dan buat pengguna MySQL khusus yang hanya punya akses ke database `argaloka_inventaris`, bukan `root`.

## Struktur folder

```
backend/
  src/
    server.js        titik masuk, koneksi database
    app.js           pemasangan middleware dan rute
    config.js        pembacaan .env
    db.js            koneksi MySQL
    auth.js          token dan pengecekan peran
    errors.js        pesan kesalahan, termasuk dari trigger MySQL
    validate.js      validasi input
    password.js      hash scrypt
    queries.js       query SELECT yang dipakai bersama
    routes/          auth, pengguna, kategori, warna, produk, transaksi, dashboard
  scripts/hash.js    membuat hash kata sandi: npm run hash -- "sandi-baru"
```
