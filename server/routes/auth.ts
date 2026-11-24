import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exec, one } from '../db.ts';
import { bad, notFound, unauthorized } from '../errors.ts';
import { hashPassword, verifyPassword } from '../password.ts';
import { requireAuth, signToken } from '../auth.ts';
import { asyncH, str } from '../validate.ts';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.' },
});

interface PenggunaRow {
  id: number;
  username: string;
  nama: string;
  peran: 'admin' | 'staf';
  kata_sandi_hash: string;
}

router.post(
  '/login',
  loginLimiter,
  asyncH(async (req, res) => {
    const b = req.body ?? {};
    const username = str(b.username, 'Username', { min: 1, max: 60 })!;
    const kataSandi = str(b.kata_sandi, 'Kata sandi', { min: 1, max: 200 })!;

    const user = await one<PenggunaRow>(
      'SELECT id, username, nama, peran, kata_sandi_hash FROM pengguna WHERE username = ?',
      [username],
    );
    if (!user || !verifyPassword(kataSandi, user.kata_sandi_hash)) {
      throw unauthorized('Username atau kata sandi salah. Coba lagi.');
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      peran: user.peran,
    };
    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  }),
);

router.get(
  '/saya',
  requireAuth,
  asyncH(async (req, res) => {
    const user = await one<Omit<PenggunaRow, 'kata_sandi_hash'>>(
      'SELECT id, username, nama, peran, dibuat_pada FROM pengguna WHERE id = ?',
      [req.user!.id],
    );
    if (!user) throw notFound('Akun tidak ditemukan.');
    res.json({ user });
  }),
);

router.post(
  '/ganti-sandi',
  requireAuth,
  asyncH(async (req, res) => {
    const b = req.body ?? {};
    const sandiLama = str(b.sandi_lama, 'Kata sandi lama', { min: 1, max: 200 })!;
    const sandiBaru = str(b.sandi_baru, 'Kata sandi baru', { min: 8, max: 200 })!;

    if (sandiLama === sandiBaru) {
      throw bad('Kata sandi baru harus berbeda dari kata sandi lama.');
    }

    const user = await one<PenggunaRow>(
      'SELECT id, kata_sandi_hash FROM pengguna WHERE id = ?',
      [req.user!.id],
    );
    if (!user) throw notFound('Akun tidak ditemukan.');
    if (!verifyPassword(sandiLama, user.kata_sandi_hash)) {
      throw bad('Kata sandi lama tidak sesuai.');
    }

    await exec('UPDATE pengguna SET kata_sandi_hash = ? WHERE id = ?', [
      hashPassword(sandiBaru),
      req.user!.id,
    ]);
    res.json({ pesan: 'Kata sandi berhasil diperbarui.' });
  }),
);

export default router;
