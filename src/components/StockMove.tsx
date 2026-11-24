import { useState } from 'react';
import { api } from '../api.ts';
import type { Product, Transaction } from '../types.ts';
import { rp } from './Charts.tsx';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function StockMove({
  products,
  recentTxs,
  onSaved,
  onEditTx,
}: {
  products: Product[];
  recentTxs: Transaction[];
  onSaved: () => Promise<void>;
  onEditTx: (t: Transaction) => void;
}) {
  const [type, setType] = useState<'masuk' | 'keluar'>('masuk');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const product = products.find((p) => p.id === Number(productId));
  const defaultPrice = product
    ? type === 'masuk'
      ? product.harga_beli
      : product.harga_jual
    : '';
  const q = Number(qty);
  const unit = price === '' ? Number(defaultPrice || 0) : Number(price);
  const estProfit =
    type === 'keluar' && product ? (unit - product.harga_beli) * q : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!product) {
      return setMsg({ ok: false, text: 'Pilih produk terlebih dahulu.' });
    }
    if (!(q > 0)) {
      return setMsg({ ok: false, text: 'Jumlah harus lebih dari 0.' });
    }

    setBusy(true);
    try {
      await api('/transaksi', {
        method: 'POST',
        body: {
          jenis: type,
          produk_id: product.id,
          jumlah: Math.round(q),
          harga: price === '' ? undefined : Math.round(Number(price)),
          tanggal: date || undefined,
        },
      });
      await onSaved();
      setMsg({
        ok: true,
        text:
          type === 'masuk'
            ? `${q} pcs ${product.nama} masuk ke stok.`
            : `${q} pcs ${product.nama} terjual.`,
      });
      setQty('');
      setPrice('');
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Gagal menyimpan transaksi.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-2 wide-left">
      <section className="panel">
        <h3>Catat pergerakan stok</h3>
        <div className="segment">
          <button
            className={type === 'masuk' ? 'on' : ''}
            onClick={() => {
              setType('masuk');
              setPrice('');
              setMsg(null);
            }}
            type="button"
          >
            Barang masuk
          </button>
          <button
            className={type === 'keluar' ? 'on' : ''}
            onClick={() => {
              setType('keluar');
              setPrice('');
              setMsg(null);
            }}
            type="button"
          >
            Barang keluar (jual)
          </button>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label className="span2">
            Produk
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPrice('');
              }}
            >
              <option value="">Pilih produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.nama}${p.warna ? ' · ' + p.warna : ''} (${p.kategori}) · stok ${p.stok}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jumlah
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label>
            {type === 'masuk' ? 'Harga beli per pcs' : 'Harga jual per pcs'}
            <input
              type="number"
              min="0"
              value={price}
              placeholder={defaultPrice !== '' ? String(defaultPrice) : ''}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Tanggal
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy
                ? 'Menyimpan...'
                : type === 'masuk'
                  ? 'Simpan barang masuk'
                  : 'Simpan penjualan'}
            </button>
          </div>
        </form>

        {estProfit !== null && q > 0 && (
          <p className="preview">
            Perkiraan keuntungan: <b>{rp(estProfit)}</b>
          </p>
        )}
        {msg && (
          <div className={msg.ok ? 'ok' : 'error'} role="status">
            {msg.text}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Catatan terbaru</h3>
        {recentTxs.length === 0 ? (
          <p className="empty">Belum ada catatan.</p>
        ) : (
          <ul className="plain">
            {recentTxs.slice(0, 8).map((t) => (
              <li key={t.id}>
                <span>
                  {t.nama_produk}
                  <small>
                    {t.tanggal}
                    {t.warna ? ` · ${t.warna}` : ''}
                  </small>
                </span>
                <span className="row-actions">
                  <b className={`tabular ${t.jenis === 'masuk' ? 'in' : 'out'}`}>
                    {t.jenis === 'masuk' ? `+${t.jumlah}` : `−${t.jumlah}`}
                  </b>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onEditTx(t)}
                  >
                    Ubah
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
