import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.ts';
import { Dashboard } from './components/Dashboard.tsx';
import { History } from './components/History.tsx';
import {
  ConfirmModal,
  ItemForm,
  Modal,
  PasswordForm,
  ProductForm,
  TxEditForm,
  UserForm,
  type ProductFormValues,
} from './components/Modals.tsx';
import { Products } from './components/Products.tsx';
import { StockMove } from './components/StockMove.tsx';
import { Users } from './components/Users.tsx';
import type {
  Category,
  ColorItem,
  DashboardData,
  Product,
  Transaction,
  TransactionListResponse,
  User,
} from './types.ts';

type Page = 'dashboard' | 'stok' | 'produk' | 'riwayat' | 'pengguna';

type EditingState =
  | { kind: 'product'; item: Product }
  | { kind: 'tx'; item: Transaction }
  | { kind: 'cat'; item: Category }
  | { kind: 'color'; item: ColorItem }
  | { kind: 'user'; item: User }
  | { kind: 'password' }
  | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

function Login({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { username: username.trim(), kata_sandi: password },
        skipAuthRedirect: true,
      });
      setToken(res.token);
      onLogin(res.user, res.token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Username atau kata sandi salah. Coba lagi.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <h1>Argaloka</h1>
        <p>
          Sistem inventaris tas. Kelola stok, kategori, warna, dan keuntungan
          penjualan dalam satu tempat.
        </p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <h2>Masuk</h2>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
        </label>
        <label>
          Kata sandi
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Memeriksa...' : 'Masuk'}
        </button>
        <p className="hint">
          Akun contoh: <b>admin</b> / admin123 atau <b>staff</b> / staff123
        </p>
      </form>
    </div>
  );
}

const NAV_ITEMS: Array<[Page, string, boolean?]> = [
  ['dashboard', 'Dashboard'],
  ['stok', 'Stok masuk & keluar'],
  ['produk', 'Produk, kategori & warna'],
  ['riwayat', 'Riwayat'],
  ['pengguna', 'Pengguna', true],
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [page, setPage] = useState<Page>('dashboard');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setDashboard(null);
    setProducts([]);
    setCats([]);
    setColors([]);
    setEditing(null);
    setConfirmState(null);
    setPage('dashboard');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api<{ user: User }>('/auth/saya', { skipAuthRedirect: true })
      .then((res) => setUser(res.user))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const loadCoreData = useCallback(async () => {
    setDashLoading(true);
    setDashError('');
    try {
      const [dashRes, prodRes, catRes, colorRes] = await Promise.all([
        api<DashboardData>('/dashboard'),
        api<Product[]>('/produk'),
        api<Category[]>('/kategori'),
        api<ColorItem[]>('/warna'),
      ]);
      setDashboard(dashRes);
      setProducts(prodRes);
      setCats(catRes);
      setColors(colorRes);
    } catch (err) {
      setDashError(err instanceof Error ? err.message : 'Gagal memuat data.');
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadCoreData();
    }
  }, [user, loadCoreData]);

  const reloadAll = useCallback(async () => {
    await loadCoreData();
    setRefreshKey((k) => k + 1);
  }, [loadCoreData]);

  if (checkingSession) {
    return (
      <div className="login">
        <div className="login-brand">
          <h1>Argaloka</h1>
          <p>Memeriksa sesi masuk...</p>
        </div>
        <div className="login-form">
          <p className="empty">Menghubungkan ke server...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          setPage('dashboard');
        }}
      />
    );
  }

  const isAdmin = user.peran === 'admin';
  const visibleNav = NAV_ITEMS.filter(([, , adminOnly]) => !adminOnly || isAdmin);
  const currentTitle =
    visibleNav.find(([k]) => k === page)?.[1] ?? 'Dashboard';

  const exportBackup = async () => {
    try {
      const [prodRes, catRes, colorRes, txRes] = await Promise.all([
        api<Product[]>('/produk'),
        api<Category[]>('/kategori'),
        api<ColorItem[]>('/warna'),
        api<TransactionListResponse>('/transaksi?per_halaman=200&halaman=1'),
      ]);
      const data = {
        app: 'argaloka-inventaris',
        version: 2,
        exportedAt: new Date().toISOString(),
        products: prodRes,
        cats: catRes,
        colors: colorRes,
        txs: txRes.data,
      };
      const todayIso = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `argaloka-cadangan-${todayIso}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify(true, 'Cadangan data JSON berhasil diunduh.');
    } catch (err) {
      notify(false, err instanceof Error ? err.message : 'Gagal membuat cadangan.');
    }
  };

  const runConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleDeleteProduct = (p: Product) => {
    setConfirmState({
      title: 'Hapus produk',
      message: `Hapus produk "${p.nama}"? Riwayat transaksi produk ini tetap tersimpan.`,
      confirmLabel: 'Hapus produk',
      onConfirm: async () => {
        try {
          await api(`/produk/${p.id}`, { method: 'DELETE' });
          await reloadAll();
          notify(true, `Produk "${p.nama}" dihapus.`);
        } catch (err) {
          notify(false, err instanceof Error ? err.message : 'Gagal menghapus produk.');
        }
      },
    });
  };

  const handleDeleteTx = (t: Transaction) => {
    setConfirmState({
      title: 'Hapus catatan transaksi',
      message: 'Hapus catatan ini dari riwayat? Jumlah stok produk tidak berubah.',
      confirmLabel: 'Hapus catatan',
      onConfirm: async () => {
        try {
          await api(`/transaksi/${t.id}`, { method: 'DELETE' });
          await reloadAll();
          notify(true, 'Catatan transaksi dihapus.');
        } catch (err) {
          notify(false, err instanceof Error ? err.message : 'Gagal menghapus transaksi.');
        }
      },
    });
  };

  const handleBulkDeleteTx = (
    params: URLSearchParams,
    count: number,
    filtered: boolean,
  ) => {
    const what = filtered
      ? `${count} catatan hasil filter`
      : `seluruh riwayat (${count} catatan)`;
    setConfirmState({
      title: 'Hapus riwayat transaksi',
      message: `Hapus ${what}? Jumlah stok produk tidak berubah, tetapi grafik dan ringkasan keuntungan akan diperbarui.`,
      confirmLabel: 'Ya, hapus',
      onConfirm: async () => {
        try {
          const qs = new URLSearchParams(params);
          if (!filtered) qs.set('konfirmasi', 'ya');
          const queryStr = qs.toString();
          await api(`/transaksi${queryStr ? `?${queryStr}` : ''}`, {
            method: 'DELETE',
          });
          await reloadAll();
          notify(true, 'Riwayat transaksi berhasil dihapus.');
        } catch (err) {
          notify(false, err instanceof Error ? err.message : 'Gagal menghapus riwayat.');
        }
      },
    });
  };

  const handleDeleteUser = (u: User) => {
    setConfirmState({
      title: 'Hapus pengguna',
      message: `Hapus akun "${u.nama}" (${u.username})?`,
      confirmLabel: 'Hapus pengguna',
      onConfirm: async () => {
        try {
          await api(`/pengguna/${u.id}`, { method: 'DELETE' });
          await reloadAll();
          notify(true, `Akun "${u.username}" dihapus.`);
        } catch (err) {
          notify(false, err instanceof Error ? err.message : 'Gagal menghapus pengguna.');
        }
      },
    });
  };

  const modalTitles: Record<NonNullable<EditingState>['kind'], string> = {
    product: 'Ubah produk',
    tx: 'Ubah transaksi',
    cat: 'Ubah kategori',
    color: 'Ubah warna',
    user: 'Ubah pengguna',
    password: 'Ganti kata sandi',
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">
          Argaloka<small>Inventaris tas</small>
        </div>
        <nav>
          {visibleNav.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={page === key ? 'on' : ''}
              onClick={() => setPage(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="side-tools">
          <button type="button" onClick={() => setEditing({ kind: 'password' })}>
            Ganti kata sandi
          </button>
          <button type="button" onClick={exportBackup}>
            Cadangkan data (JSON)
          </button>
        </div>

        <div className="who">
          <div className="who-meta">
            <span className="who-name">{user.nama}</span>
            <span className="who-role">
              {user.peran === 'admin' ? 'Admin' : 'Staf Gudang'}
            </span>
          </div>
          <button type="button" className="link" onClick={logout}>
            Keluar
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="page-head">
          <h2 className="title">{currentTitle}</h2>
        </div>

        {toast && (
          <div className={`toast ${toast.ok ? 'ok' : 'error'}`} role="status">
            <span>{toast.text}</span>
            <button
              type="button"
              className="link"
              onClick={() => setToast(null)}
            >
              Tutup
            </button>
          </div>
        )}

        {page === 'dashboard' && (
          <Dashboard
            data={dashboard}
            loading={dashLoading}
            error={dashError}
            onReload={reloadAll}
            onEditProduct={(item) => setEditing({ kind: 'product', item })}
            onEditTx={(item) => setEditing({ kind: 'tx', item })}
          />
        )}

        {page === 'stok' && (
          <StockMove
            products={products}
            recentTxs={dashboard?.transaksi_terakhir ?? []}
            onSaved={reloadAll}
            onEditTx={(item) => setEditing({ kind: 'tx', item })}
          />
        )}

        {page === 'produk' && (
          <Products
            products={products}
            cats={cats}
            colors={colors}
            isAdmin={isAdmin}
            lowStockLimit={dashboard?.batas_stok_menipis ?? 5}
            onReload={reloadAll}
            onEditProduct={(item) => setEditing({ kind: 'product', item })}
            onDeleteProduct={handleDeleteProduct}
            onEditCat={(item) => setEditing({ kind: 'cat', item })}
            onEditColor={(item) => setEditing({ kind: 'color', item })}
            onNotify={notify}
          />
        )}

        {page === 'riwayat' && (
          <History
            cats={cats}
            colors={colors}
            isAdmin={isAdmin}
            refreshKey={refreshKey}
            onEditTx={(item) => setEditing({ kind: 'tx', item })}
            onDeleteTx={handleDeleteTx}
            onBulkDelete={handleBulkDeleteTx}
          />
        )}

        {page === 'pengguna' && isAdmin && (
          <Users
            currentUserId={user.id}
            refreshKey={refreshKey}
            onEditUser={(item) => setEditing({ kind: 'user', item })}
            onDeleteUser={handleDeleteUser}
            onNotify={notify}
          />
        )}
      </main>

      {editing && (
        <Modal
          title={modalTitles[editing.kind]}
          onClose={() => setEditing(null)}
          narrow={editing.kind === 'password'}
        >
          {editing.kind === 'product' && (
            <ProductForm
              isEdit
              canEditStock={isAdmin}
              initial={{
                nama: editing.item.nama,
                kategori_id: editing.item.kategori_id,
                warna_id: editing.item.warna_id ?? '',
                harga_beli: editing.item.harga_beli,
                harga_jual: editing.item.harga_jual,
                stok: editing.item.stok,
              }}
              cats={cats}
              colors={colors}
              submitLabel="Simpan perubahan"
              onCancel={() => setEditing(null)}
              onSubmit={async (data: ProductFormValues) => {
                try {
                  const body = isAdmin
                    ? data
                    : {
                        nama: data.nama,
                        kategori_id: data.kategori_id,
                        warna_id: data.warna_id,
                        harga_beli: data.harga_beli,
                        harga_jual: data.harga_jual,
                      };
                  await api(`/produk/${editing.item.id}`, {
                    method: 'PUT',
                    body,
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Data produk diperbarui.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal menyimpan produk.';
                }
              }}
            />
          )}

          {editing.kind === 'tx' && (
            <TxEditForm
              tx={editing.item}
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                try {
                  await api(`/transaksi/${editing.item.id}`, {
                    method: 'PUT',
                    body: data,
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Transaksi diperbarui.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal mengubah transaksi.';
                }
              }}
            />
          )}

          {editing.kind === 'cat' && (
            <ItemForm
              kind="cat"
              item={editing.item}
              canDelete={isAdmin}
              onCancel={() => setEditing(null)}
              onSubmit={async ({ nama }) => {
                try {
                  await api(`/kategori/${editing.item.id}`, {
                    method: 'PUT',
                    body: { nama },
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Kategori diperbarui.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal mengubah kategori.';
                }
              }}
              onDelete={async () => {
                try {
                  await api(`/kategori/${editing.item.id}`, {
                    method: 'DELETE',
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Kategori dihapus.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal menghapus kategori.';
                }
              }}
            />
          )}

          {editing.kind === 'color' && (
            <ItemForm
              kind="color"
              item={editing.item}
              canDelete={isAdmin}
              onCancel={() => setEditing(null)}
              onSubmit={async ({ nama, hex }) => {
                try {
                  await api(`/warna/${editing.item.id}`, {
                    method: 'PUT',
                    body: { nama, hex },
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Warna diperbarui.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal mengubah warna.';
                }
              }}
              onDelete={async () => {
                try {
                  await api(`/warna/${editing.item.id}`, {
                    method: 'DELETE',
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Warna dihapus.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal menghapus warna.';
                }
              }}
            />
          )}

          {editing.kind === 'user' && (
            <UserForm
              user={editing.item}
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                try {
                  await api(`/pengguna/${editing.item.id}`, {
                    method: 'PUT',
                    body: data,
                  });
                  setEditing(null);
                  await reloadAll();
                  notify(true, 'Data pengguna diperbarui.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal mengubah pengguna.';
                }
              }}
            />
          )}

          {editing.kind === 'password' && (
            <PasswordForm
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                try {
                  await api('/auth/ganti-sandi', {
                    method: 'POST',
                    body: data,
                  });
                  setEditing(null);
                  notify(true, 'Kata sandi berhasil diperbarui.');
                  return null;
                } catch (err) {
                  return err instanceof Error
                    ? err.message
                    : 'Gagal mengganti kata sandi.';
                }
              }}
            />
          )}
        </Modal>
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          busy={confirmBusy}
          onConfirm={runConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
