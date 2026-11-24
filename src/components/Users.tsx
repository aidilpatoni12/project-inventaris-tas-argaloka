import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { User, UserRole } from '../types.ts';

export function Users({
  currentUserId,
  onEditUser,
  onDeleteUser,
  onNotify,
  refreshKey,
}: {
  currentUserId: number;
  onEditUser: (u: User) => void;
  onDeleteUser: (u: User) => void;
  onNotify: (ok: boolean, text: string) => void;
  refreshKey: number;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [nama, setNama] = useState('');
  const [peran, setPeran] = useState<UserRole>('staf');
  const [kataSandi, setKataSandi] = useState('');
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<User[]>('/pengguna');
      setUsers(data);
    } catch (err) {
      onNotify(false, err instanceof Error ? err.message : 'Gagal memuat pengguna.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshKey]);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/pengguna', {
        method: 'POST',
        body: {
          username: username.trim(),
          nama: nama.trim(),
          peran,
          kata_sandi: kataSandi,
        },
      });
      setUsername('');
      setNama('');
      setPeran('staf');
      setKataSandi('');
      await loadUsers();
      onNotify(true, 'Akun pengguna baru berhasil ditambahkan.');
    } catch (err) {
      onNotify(false, err instanceof Error ? err.message : 'Gagal menambah akun.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel">
        <h3>Tambah akun pengguna</h3>
        <form className="form-grid" onSubmit={addUser}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mis. kasir1"
              required
            />
          </label>
          <label>
            Nama lengkap
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="mis. Budi Santoso"
              required
            />
          </label>
          <label>
            Peran
            <select
              value={peran}
              onChange={(e) => setPeran(e.target.value as UserRole)}
            >
              <option value="staf">Staf Gudang</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="span2">
            Kata sandi awal (minimal 8 karakter)
            <input
              type="password"
              value={kataSandi}
              onChange={(e) => setKataSandi(e.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Tambah pengguna'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h3>Daftar pengguna</h3>
        {loading && users.length === 0 ? (
          <p className="empty">Memuat daftar pengguna...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Nama</th>
                  <th>Peran</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.nama}</td>
                    <td>{u.peran === 'admin' ? 'Admin' : 'Staf Gudang'}</td>
                    <td className="r nowrap">
                      <button
                        type="button"
                        className="link"
                        onClick={() => onEditUser(u)}
                      >
                        Ubah
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          type="button"
                          className="link danger"
                          onClick={() => onDeleteUser(u)}
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
