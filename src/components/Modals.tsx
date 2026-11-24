import { useEffect, useState, type ReactNode } from 'react';
import type { Category, ColorItem, Transaction, User, UserRole } from '../types.ts';

export function Modal({
  title,
  onClose,
  narrow,
  children,
}: {
  title: string;
  onClose: () => void;
  narrow?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${narrow ? 'narrow' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="link" onClick={onClose}>
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Hapus',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} narrow>
      <p style={{ margin: '0 0 18px', color: 'var(--ink)' }}>{message}</p>
      <div className="actions">
        <button
          type="button"
          className={`btn ${danger ? 'danger-solid' : 'primary'}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Memproses...' : confirmLabel}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Batal
        </button>
      </div>
    </Modal>
  );
}

export interface ProductFormValues {
  nama: string;
  kategori_id: number;
  warna_id: number | null;
  harga_beli: number;
  harga_jual: number;
  stok: number;
}

export function ProductForm({
  initial,
  cats,
  colors,
  isEdit,
  canEditStock = true,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: {
    nama: string;
    kategori_id: string | number;
    warna_id: string | number;
    harga_beli: string | number;
    harga_jual: string | number;
    stok: string | number;
  };
  cats: Category[];
  colors: ColorItem[];
  isEdit?: boolean;
  canEditStock?: boolean;
  submitLabel: string;
  onSubmit: (data: ProductFormValues) => Promise<string | null> | void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setF(initial);
  }, [initial.nama, initial.kategori_id, initial.warna_id, initial.harga_beli, initial.harga_jual, initial.stok]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const nama = String(f.nama).trim();
    const kategoriId = Number(f.kategori_id);
    const warnaId = f.warna_id === '' || f.warna_id === null ? null : Number(f.warna_id);
    const hargaBeli = Number(f.harga_beli);
    const hargaJual = Number(f.harga_jual);
    const stok = Number(f.stok || 0);

    if (!nama) return setError('Nama produk wajib diisi.');
    if (!kategoriId) return setError('Pilih kategori terlebih dahulu.');
    if (Number.isNaN(hargaBeli) || hargaBeli < 0) return setError('Harga beli tidak valid.');
    if (Number.isNaN(hargaJual) || hargaJual <= 0) return setError('Harga jual harus lebih dari 0.');
    if (Number.isNaN(stok) || stok < 0) return setError('Stok tidak boleh negatif.');

    setBusy(true);
    try {
      const err = await onSubmit({
        nama,
        kategori_id: kategoriId,
        warna_id: warnaId,
        harga_beli: Math.round(hargaBeli),
        harga_jual: Math.round(hargaJual),
        stok: Math.round(stok),
      });
      if (err) {
        setError(err);
      } else if (!isEdit) {
        setF(initial);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span2">
        Nama produk
        <input value={f.nama} onChange={set('nama')} required />
      </label>
      <label>
        Kategori
        <select value={f.kategori_id} onChange={set('kategori_id')} required>
          {cats.length === 0 && <option value="">Belum ada kategori</option>}
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nama}
            </option>
          ))}
        </select>
      </label>
      <label>
        Warna
        <select value={f.warna_id} onChange={set('warna_id')}>
          <option value="">Tanpa warna</option>
          {colors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nama}
            </option>
          ))}
        </select>
      </label>
      <label>
        Harga beli (modal)
        <input
          type="number"
          min="0"
          value={f.harga_beli}
          onChange={set('harga_beli')}
          required
        />
      </label>
      <label>
        Harga jual
        <input
          type="number"
          min="1"
          value={f.harga_jual}
          onChange={set('harga_jual')}
          required
        />
      </label>
      <label>
        {isEdit
          ? canEditStock
            ? 'Stok (koreksi manual)'
            : 'Stok (koreksi khusus Admin)'
          : 'Stok awal'}
        <input
          type="number"
          min="0"
          value={f.stok}
          onChange={set('stok')}
          disabled={Boolean(isEdit && !canEditStock)}
        />
      </label>
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy || cats.length === 0}>
          {busy ? 'Menyimpan...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Batal
          </button>
        )}
      </div>
    </form>
  );
}

export function TxEditForm({
  tx,
  onSubmit,
  onCancel,
}: {
  tx: Transaction;
  onSubmit: (data: { tanggal: string; jumlah: number; harga: number }) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [tanggal, setTanggal] = useState(tx.tanggal);
  const [jumlah, setJumlah] = useState(String(tx.jumlah));
  const [harga, setHarga] = useState(String(tx.harga));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tanggal) return setError('Tanggal wajib diisi.');
    if (!(Number(jumlah) > 0)) return setError('Jumlah harus lebih dari 0.');
    if (harga === '' || Number(harga) < 0) return setError('Harga tidak valid.');

    setBusy(true);
    try {
      const err = await onSubmit({
        tanggal,
        jumlah: Math.round(Number(jumlah)),
        harga: Math.round(Number(harga)),
      });
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <p className="preview full">
        {tx.nama_produk} · {tx.jenis === 'masuk' ? 'Barang masuk' : 'Barang keluar'}
      </p>
      <label>
        Tanggal
        <input
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
        />
      </label>
      <label>
        Jumlah
        <input
          type="number"
          min="1"
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
        />
      </label>
      <label>
        {tx.jenis === 'masuk' ? 'Harga beli per pcs' : 'Harga jual per pcs'}
        <input
          type="number"
          min="0"
          value={harga}
          onChange={(e) => setHarga(e.target.value)}
        />
      </label>
      <p className="hint full">
        Stok produk ikut disesuaikan otomatis dengan perubahan jumlah.
      </p>
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
}

export function ItemForm({
  kind,
  item,
  canDelete,
  onSubmit,
  onDelete,
  onCancel,
}: {
  kind: 'cat' | 'color';
  item: { id: number; nama: string; hex?: string };
  canDelete: boolean;
  onSubmit: (data: { nama: string; hex?: string }) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
  onCancel: () => void;
}) {
  const [nama, setNama] = useState(item.nama);
  const [hex, setHex] = useState(item.hex || '#1b1b1b');
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = kind === 'cat' ? 'kategori' : 'warna';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const n = nama.trim();
    if (!n) return setError('Nama tidak boleh kosong.');
    setBusy(true);
    try {
      const err = await onSubmit(kind === 'color' ? { nama: n, hex } : { nama: n });
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setBusy(true);
    try {
      const err = await onDelete();
      if (err) {
        setError(err);
        setConfirmingDelete(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className={kind === 'color' ? 'span2' : 'span2'}>
        Nama {label}
        <input value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
      </label>
      {kind === 'color' && (
        <label>
          Warna tampilan
          <input
            type="color"
            className="color-input"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
          />
        </label>
      )}
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      {confirmingDelete ? (
        <div className="error full" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Hapus {label} "{item.nama}"?</span>
          <span className="row-actions">
            <button type="button" className="btn danger-solid" disabled={busy} onClick={handleDelete}>
              {busy ? 'Menghapus...' : 'Ya, hapus'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirmingDelete(false)}>
              Batal
            </button>
          </span>
        </div>
      ) : (
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan perubahan'}
          </button>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          {canDelete && (
            <button
              type="button"
              className="btn danger push"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              Hapus {label}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export function PasswordForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { sandi_lama: string; sandi_baru: string }) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sandiLama) return setError('Kata sandi lama wajib diisi.');
    if (sandiBaru.length < 8) return setError('Kata sandi baru minimal 8 karakter.');
    if (sandiBaru !== konfirmasi) return setError('Konfirmasi kata sandi tidak sama.');

    setBusy(true);
    try {
      const err = await onSubmit({ sandi_lama: sandiLama, sandi_baru: sandiBaru });
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="full">
        Kata sandi saat ini
        <input
          type="password"
          value={sandiLama}
          onChange={(e) => setSandiLama(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label className="span2">
        Kata sandi baru (minimal 8 karakter)
        <input
          type="password"
          value={sandiBaru}
          onChange={(e) => setSandiBaru(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Ulangi sandi baru
        <input
          type="password"
          value={konfirmasi}
          onChange={(e) => setKonfirmasi(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Perbarui kata sandi'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
}

export function UserForm({
  user,
  onSubmit,
  onCancel,
}: {
  user: User;
  onSubmit: (data: { nama: string; peran: UserRole; kata_sandi?: string }) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [nama, setNama] = useState(user.nama);
  const [peran, setPeran] = useState<UserRole>(user.peran);
  const [kataSandi, setKataSandi] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nama.trim()) return setError('Nama wajib diisi.');
    if (kataSandi && kataSandi.length < 8) {
      return setError('Kata sandi baru minimal 8 karakter.');
    }

    setBusy(true);
    try {
      const payload: { nama: string; peran: UserRole; kata_sandi?: string } = {
        nama: nama.trim(),
        peran,
      };
      if (kataSandi.trim()) payload.kata_sandi = kataSandi;
      const err = await onSubmit(payload);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span2">
        Nama lengkap ({user.username})
        <input value={nama} onChange={(e) => setNama(e.target.value)} required />
      </label>
      <label>
        Peran
        <select value={peran} onChange={(e) => setPeran(e.target.value as UserRole)}>
          <option value="staf">Staf Gudang</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="full">
        Kata sandi baru (kosongkan bila tidak ingin mengubah)
        <input
          type="password"
          value={kataSandi}
          onChange={(e) => setKataSandi(e.target.value)}
          placeholder="Minimal 8 karakter"
        />
      </label>
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
}
