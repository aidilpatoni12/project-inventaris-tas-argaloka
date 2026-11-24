-- Data awal Sistem Inventaris Tas Argaloka
-- Catatan: ganti kata sandi akun contoh setelah login pertama kali.

USE argaloka_inventaris;

INSERT INTO pengguna (id, username, nama, peran, kata_sandi_hash) VALUES
  (1, 'admin', 'Admin Argaloka', 'admin', 'scrypt:51534196aad3eefab38014578689cace:cb13f39c8f9c05e9e432252579d5b82cdb7d4719c010fa1af9715b4a88cd090e8f7ff99b84635e617102ff6addd8f0e00ed5566c6d774d1d3a8194e5a2086ff7'),
  (2, 'staff', 'Staf Gudang', 'staf', 'scrypt:71fe1ea22da77123898daa0eb8906b0e:f912923ceda133bf9072bd7aa89242508728033d188b40961cc44b84aa2bf4340d13e18c48e2ba4e62a93f5fd026515349f1f15397b8068e682100ab7ad94122');

INSERT INTO kategori (id, nama) VALUES
  (1, 'Ransel'),
  (2, 'Tote Bag'),
  (3, 'Sling Bag'),
  (4, 'Dompet'),
  (5, 'Pouch');

INSERT INTO warna (id, nama, hex) VALUES
  (1, 'Hitam', '#1b1b1b'),
  (2, 'Navy', '#1f2f55'),
  (3, 'Hijau Army', '#4b5a3a'),
  (4, 'Coklat', '#6b4a2f'),
  (5, 'Krem', '#d8c9a8'),
  (6, 'Abu-abu', '#8a8f93');

-- Produk dimulai dengan stok 0 lalu diisi lewat transaksi awal agar trigger mencatat stok secara konsisten
INSERT INTO produk (id, nama, kategori_id, warna_id, harga_beli, harga_jual, stok) VALUES
  (1, 'Ransel Rinjani 30L', 1, 1, 180000, 289000, 0),
  (2, 'Tote Canvas Merbabu', 2, 5, 55000, 99000, 0),
  (3, 'Sling Bag Semeru', 3, 3, 85000, 149000, 0),
  (4, 'Dompet Kulit Bromo', 4, 4, 60000, 119000, 0);

INSERT INTO transaksi (tanggal, jenis, produk_id, jumlah, harga, dicatat_oleh) VALUES
  (DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'masuk', 1, 30, 180000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 9 DAY), 'masuk', 2, 50, 55000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'masuk', 3, 10, 85000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'masuk', 4, 22, 60000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'keluar', 1, 4, 289000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'keluar', 2, 6, 99000, 2),
  (DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'keluar', 3, 4, 149000, 2),
  (DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'keluar', 4, 4, 119000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'keluar', 1, 2, 289000, 1),
  (DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'keluar', 2, 4, 99000, 2),
  (CURDATE(), 'keluar', 3, 2, 149000, 1);
