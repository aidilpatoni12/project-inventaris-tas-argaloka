import { Router } from 'express';
import { exec, one, query } from '../db.ts';
import { bad, notFound } from '../errors.ts';
import { hashPassword } from '../password.ts';
import { requireRole } from '../auth.ts';
import { asyncH, idParam, str } from '../validate.ts';

const router = Router();
router.use(requireRole('admin'));

const VALID_ROLES = ['admin', 'staf'] as const;

router.get(
  '/',
  asyncH(async (_req, res) => {
    const rows = await query(
      'SELECT id, username, nama, peran, dibuat_pada FROM pengguna ORDER BY id ASC',
    );
    res.json(rows);
  }),
);

router.post(
  '/',
  asyncH(async (req, res) => {
    const b = req.body ?? {};
    const username = str(b.username, 'Username', { min: 3, max: 60 })!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      throw bad('Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.');
    }
    const nama = str(b.nama, 'Nama lengkap', { min: 2, max: 120 })!;
    const peran = String(b.peran || 'staf') as 'admin' | 'staf';
    if (!VALID_ROLES.includes(peran)) {
      throw bad("Peran harus 'admin' atau 'staf'.");
    }
    const kataSandi = str(b.kata_sandi, 'Kata sandi', { min: 8, max: 200 })!;

    const r = await exec(
      'INSERT INTO pengguna (username, nama, peran, kata_sandi_hash) VALUES (?, ?, ?, ?)',
      [username, nama, peran, hashPassword(kataSandi)],
    );
    const created = await one(
      'SELECT id, username, nama, peran, dibuat_pada FROM pengguna WHERE id = ?',
      [r.insertId],
    );
    res.status(201).json(created);
  }),
);

router.put(
  '/:id',
  asyncH(async (req, res) => {
    const id = idParam(req);
    const b = req.body ?? {};
    const existing = await one<{ id: number; nama: string; peran: 'admin' | 'staf' }>(
      'SELECT id, nama, peran FROM pengguna WHERE id = ?',
      [id],
    );
    if (!existing) throw notFound('Pengguna tidak ditemukan.');

    const nama = b.nama !== undefined ? str(b.nama, 'Nama lengkap', { min: 2, max: 120 })! : existing.nama;
    const peran = (b.peran !== undefined ? String(b.peran) : existing.peran) as 'admin' | 'staf';
    if (!VALID_ROLES.includes(peran)) {
      throw bad("Peran harus 'admin' atau 'staf'.");
    }
    if (req.user!.id === id && peran !== 'admin') {
      throw bad('Anda tidak bisa menurunkan peran akun Anda sendiri.');
    }

    if (b.kata_sandi !== undefined && String(b.kata_sandi).trim() !== '') {
      const kataSandi = str(b.kata_sandi, 'Kata sandi', { min: 8, max: 200 })!;
      await exec('UPDATE pengguna SET nama = ?, peran = ?, kata_sandi_hash = ? WHERE id = ?', [
        nama,
        peran,
        hashPassword(kataSandi),
        id,
      ]);
    } else {
      await exec('UPDATE pengguna SET nama = ?, peran = ? WHERE id = ?', [nama, peran, id]);
    }

    const updated = await one(
      'SELECT id, username, nama, peran, dibuat_pada FROM pengguna WHERE id = ?',
      [id],
    );
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  asyncH(async (req, res) => {
    const id = idParam(req);
    if (req.user!.id === id) {
      throw bad('Anda tidak bisa menghapus akun yang sedang digunakan.');
    }
    const r = await exec('DELETE FROM pengguna WHERE id = ?', [id]);
    if (!r.affectedRows) throw notFound('Pengguna tidak ditemukan.');
    res.json({ pesan: 'Pengguna berhasil dihapus.' });
  }),
);

export default router;
