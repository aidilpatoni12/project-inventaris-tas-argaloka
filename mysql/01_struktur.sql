-- Struktur database MySQL untuk Sistem Inventaris Tas Argaloka
-- Jalankan file ini terlebih dahulu, lalu jalankan 02_data_awal.sql

CREATE DATABASE IF NOT EXISTS argaloka_inventaris
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE argaloka_inventaris;

DROP TABLE IF EXISTS transaksi;
DROP TABLE IF EXISTS produk;
DROP TABLE IF EXISTS warna;
DROP TABLE IF EXISTS kategori;
DROP TABLE IF EXISTS pengguna;

CREATE TABLE pengguna (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(60) NOT NULL,
  nama VARCHAR(120) NOT NULL,
  peran ENUM('admin', 'staf') NOT NULL DEFAULT 'staf',
  kata_sandi_hash VARCHAR(255) NOT NULL,
  dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pengguna_username (username)
) ENGINE=InnoDB;

CREATE TABLE kategori (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kategori_nama (nama)
) ENGINE=InnoDB;

CREATE TABLE warna (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama VARCHAR(80) NOT NULL,
  hex CHAR(7) NOT NULL DEFAULT '#1b1b1b',
  PRIMARY KEY (id),
  UNIQUE KEY uq_warna_nama (nama)
) ENGINE=InnoDB;

CREATE TABLE produk (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama VARCHAR(160) NOT NULL,
  kategori_id INT UNSIGNED NOT NULL,
  warna_id INT UNSIGNED NULL,
  harga_beli INT UNSIGNED NOT NULL DEFAULT 0,
  harga_jual INT UNSIGNED NOT NULL,
  stok INT UNSIGNED NOT NULL DEFAULT 0,
  dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_produk_kategori (kategori_id),
  KEY idx_produk_warna (warna_id),
  KEY idx_produk_stok (stok),
  CONSTRAINT fk_produk_kategori
    FOREIGN KEY (kategori_id) REFERENCES kategori (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_produk_warna
    FOREIGN KEY (warna_id) REFERENCES warna (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE transaksi (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tanggal DATE NOT NULL,
  jenis ENUM('masuk', 'keluar') NOT NULL,
  produk_id INT UNSIGNED NULL,
  nama_produk VARCHAR(160) NOT NULL DEFAULT '',
  jumlah INT UNSIGNED NOT NULL,
  harga INT UNSIGNED NOT NULL,
  harga_modal INT UNSIGNED NOT NULL DEFAULT 0,
  keuntungan BIGINT NOT NULL DEFAULT 0,
  dicatat_oleh INT UNSIGNED NULL,
  dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transaksi_tanggal (tanggal),
  KEY idx_transaksi_jenis_tanggal (jenis, tanggal),
  KEY idx_transaksi_produk (produk_id),
  CONSTRAINT fk_transaksi_produk
    FOREIGN KEY (produk_id) REFERENCES produk (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_transaksi_pengguna
    FOREIGN KEY (dicatat_oleh) REFERENCES pengguna (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER trg_transaksi_before_insert
BEFORE INSERT ON transaksi
FOR EACH ROW
BEGIN
  DECLARE v_nama VARCHAR(160);
  DECLARE v_beli INT UNSIGNED;
  DECLARE v_stok INT UNSIGNED;

  IF NEW.produk_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Produk wajib dipilih.';
  END IF;

  SELECT nama, harga_beli, stok
    INTO v_nama, v_beli, v_stok
    FROM produk
   WHERE id = NEW.produk_id
   LIMIT 1;

  IF v_nama IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Produk tidak ditemukan.';
  END IF;

  IF NEW.jenis = 'keluar' AND v_stok < NEW.jumlah THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stok tidak cukup untuk penjualan ini.';
  END IF;

  IF NEW.nama_produk = '' OR NEW.nama_produk IS NULL THEN
    SET NEW.nama_produk = v_nama;
  END IF;

  SET NEW.harga_modal = v_beli;
  IF NEW.jenis = 'keluar' THEN
    SET NEW.keuntungan = (CAST(NEW.harga AS SIGNED) - CAST(v_beli AS SIGNED)) * CAST(NEW.jumlah AS SIGNED);
  ELSE
    SET NEW.keuntungan = 0;
  END IF;
END$$

CREATE TRIGGER trg_transaksi_after_insert
AFTER INSERT ON transaksi
FOR EACH ROW
BEGIN
  DECLARE v_stok INT UNSIGNED;
  DECLARE v_beli INT UNSIGNED;
  DECLARE v_total INT UNSIGNED;

  IF NEW.jenis = 'masuk' THEN
    SELECT stok, harga_beli INTO v_stok, v_beli FROM produk WHERE id = NEW.produk_id;
    SET v_total = v_stok + NEW.jumlah;
    UPDATE produk
       SET stok = v_total,
           harga_beli = IF(
             v_total > 0,
             ROUND(((CAST(v_stok AS UNSIGNED) * CAST(v_beli AS UNSIGNED)) + (CAST(NEW.jumlah AS UNSIGNED) * CAST(NEW.harga AS UNSIGNED))) / v_total),
             NEW.harga
           )
     WHERE id = NEW.produk_id;
  ELSE
    UPDATE produk
       SET stok = stok - NEW.jumlah
     WHERE id = NEW.produk_id;
  END IF;
END$$

CREATE TRIGGER trg_transaksi_before_update
BEFORE UPDATE ON transaksi
FOR EACH ROW
BEGIN
  DECLARE v_stok INT UNSIGNED;
  DECLARE v_delta BIGINT;
  DECLARE v_stok_baru BIGINT;

  IF NEW.produk_id IS NOT NULL THEN
    SELECT stok INTO v_stok FROM produk WHERE id = NEW.produk_id;
    SET v_delta = CAST(NEW.jumlah AS SIGNED) - CAST(OLD.jumlah AS SIGNED);
    IF OLD.jenis = 'masuk' THEN
      SET v_stok_baru = CAST(v_stok AS SIGNED) + v_delta;
    ELSE
      SET v_stok_baru = CAST(v_stok AS SIGNED) - v_delta;
    END IF;

    IF v_stok_baru < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Perubahan ini membuat stok produk menjadi negatif. Kurangi jumlahnya.';
    END IF;
  END IF;

  IF NEW.jenis = 'keluar' THEN
    SET NEW.keuntungan = (CAST(NEW.harga AS SIGNED) - CAST(NEW.harga_modal AS SIGNED)) * CAST(NEW.jumlah AS SIGNED);
  ELSE
    SET NEW.keuntungan = 0;
  END IF;
END$$

CREATE TRIGGER trg_transaksi_after_update
AFTER UPDATE ON transaksi
FOR EACH ROW
BEGIN
  DECLARE v_delta BIGINT;

  IF NEW.produk_id IS NOT NULL AND NEW.jumlah <> OLD.jumlah THEN
    SET v_delta = CAST(NEW.jumlah AS SIGNED) - CAST(OLD.jumlah AS SIGNED);
    IF OLD.jenis = 'masuk' THEN
      UPDATE produk SET stok = CAST(stok AS SIGNED) + v_delta WHERE id = NEW.produk_id;
    ELSE
      UPDATE produk SET stok = CAST(stok AS SIGNED) - v_delta WHERE id = NEW.produk_id;
    END IF;
  END IF;
END$$

DELIMITER ;
