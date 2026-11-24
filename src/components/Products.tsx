import { useMemo, useState } from 'react';
import { api } from '../api.ts';
import type { Category, ColorItem, Product } from '../types.ts';
import { Swatch, rp } from './Charts.tsx';
import { ProductForm, type ProductFormValues } from './Modals.tsx';

export function Products({
  products,
  cats,
  colors,
  isAdmin,
  lowStockLimit,
  onReload,
  onEditProduct,
  onDeleteProduct,
  onEditCat,
  onEditColor,
  onNotify,
}: {
  products: Product[];
  cats: Category[];
  colors: ColorItem[];
  isAdmin: boolean;
  lowStockLimit: number;
  onReload: () => Promise<void>;
  onEditProduct: (p: Product) => void;
  onDeleteProduct: (p: Product) => void;
  onEditCat: (c: Category) => void;
  onEditColor: (c: ColorItem) => void;
  onNotify: (ok: boolean, text: string) => void;
}) {
  const [catFilter, setCatFilter] = useState<string>('Semua');
  const [colorFilter, setColorFilter] = useState<string>('Semua');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newHex, setNewHex] = useState('#1b1b1b');
  const [busyCat, setBusyCat] = useState(false);
  const [busyColor, setBusyColor] = useState(false);

  const blank = useMemo(
    () => ({
      nama: '',
      kategori_id: cats[0]?.id ?? '',
      warna_id: colors[0]?.id ?? '',
      harga_beli: '',
      harga_jual: '',
      stok: '',
    }),
    [cats, colors],
  );

  const addProduct = async (data: ProductFormValues): Promise<string | null> => {
    try {
      await api('/produk', { method: 'POST', body: data });
      await onReload();
      onNotify(true, `Produk "${data.nama}" berhasil ditambahkan.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Gagal menambah produk.';
    }
  };

  const addCat = async (e: React.FormEvent) => {
    e.preventDefault();
    const nama = newCat.trim();
    if (!nama) return;
    setBusyCat(true);
    try {
      await api('/kategori', { method: 'POST', body: { nama } });
      setNewCat('');
      await onReload();
      onNotify(true, `Kategori "${nama}" ditambahkan.`);
    } catch (err) {
      onNotify(false, err instanceof Error ? err.message : 'Gagal menambah kategori.');
    } finally {
      setBusyCat(false);
    }
  };

  const addColor = async (e: React.FormEvent) => {
    e.preventDefault();
    const nama = newColor.trim();
    if (!nama) return;
    setBusyColor(true);
    try {
      await api('/warna', { method: 'POST', body: { nama, hex: newHex } });
      setNewColor('');
      await onReload();
      onNotify(true, `Warna "${nama}" ditambahkan.`);
    } catch (err) {
      onNotify(false, err instanceof Error ? err.message : 'Gagal menambah warna.');
    } finally {
      setBusyColor(false);
    }
  };

  const shown = products.filter((p) => {
    if (catFilter !== 'Semua' && p.kategori !== catFilter) return false;
    if (colorFilter !== 'Semua' && (p.warna || '') !== colorFilter) return false;
    if (onlyLow && p.stok > lowStockLimit) return false;
    if (search.trim() && !p.nama.toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <>
      <section className="panel">
        <h3>Tambah produk</h3>
        <ProductForm
          initial={blank}
          cats={cats}
          colors={colors}
          submitLabel="Tambah produk"
          onSubmit={addProduct}
        />
        <p className="hint">
          Satu produk dengan beberapa warna dicatat sebagai baris terpisah agar stok tiap warna terlacak. Stok awal otomatis tercatat sebagai barang masuk.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Daftar produk</h3>
          <div className="inline">
            <input
              type="search"
              placeholder="Cari nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari produk"
            />
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              aria-label="Filter warna"
            >
              <option value="Semua">Semua warna</option>
              {colors.map((c) => (
                <option key={c.id} value={c.nama}>
                  {c.nama}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`chip ${onlyLow ? 'on' : ''}`}
              onClick={() => setOnlyLow((v) => !v)}
            >
              Stok menipis
            </button>
          </div>
        </div>

        <div className="chips spaced">
          <button
            type="button"
            className={`chip ${catFilter === 'Semua' ? 'on' : ''}`}
            onClick={() => setCatFilter('Semua')}
          >
            Semua
          </button>
          {cats.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`chip ${catFilter === c.nama ? 'on' : ''}`}
              onClick={() => setCatFilter(c.nama)}
            >
              {c.nama}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="empty">Tidak ada produk yang cocok dengan filter ini.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Warna</th>
                  <th className="r">Modal</th>
                  <th className="r">Harga jual</th>
                  <th className="r">Margin</th>
                  <th className="r">Stok</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nama}</td>
                    <td>{p.kategori}</td>
                    <td>
                      <Swatch name={p.warna} hex={p.warna_hex} />
                    </td>
                    <td className="r">{rp(p.harga_beli)}</td>
                    <td className="r">{rp(p.harga_jual)}</td>
                    <td className="r">{rp(p.harga_jual - p.harga_beli)}</td>
                    <td className={`r ${p.stok <= lowStockLimit ? 'warn' : ''}`}>
                      {p.stok}
                    </td>
                    <td className="r nowrap">
                      <button
                        type="button"
                        className="link"
                        onClick={() => onEditProduct(p)}
                      >
                        Ubah
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="link danger"
                          onClick={() => onDeleteProduct(p)}
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

      <div className="grid-2">
        <section className="panel">
          <h3>Kategori</h3>
          <div className="chips">
            {cats.map((c) => (
              <button
                type="button"
                className="chip"
                key={c.id}
                onClick={() => onEditCat(c)}
                title="Ubah kategori"
              >
                {c.nama} · {c.jumlah_produk}
              </button>
            ))}
          </div>
          <form className="inline" onSubmit={addCat}>
            <input
              placeholder="Nama kategori baru"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button className="btn" type="submit" disabled={busyCat}>
              {busyCat ? 'Menambah...' : 'Tambah'}
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>Warna tas</h3>
          <div className="chips">
            {colors.map((c) => (
              <button
                type="button"
                className="chip"
                key={c.id}
                onClick={() => onEditColor(c)}
                title="Ubah warna"
              >
                <Swatch name={c.nama} hex={c.hex} /> · {c.jumlah_produk}
              </button>
            ))}
          </div>
          <form className="inline" onSubmit={addColor}>
            <input
              placeholder="Nama warna baru"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />
            <input
              type="color"
              className="color-input"
              value={newHex}
              onChange={(e) => setNewHex(e.target.value)}
              aria-label="Pilih warna"
            />
            <button className="btn" type="submit" disabled={busyColor}>
              {busyColor ? 'Menambah...' : 'Tambah'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
