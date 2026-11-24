import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import type {
  Category,
  ColorItem,
  Transaction,
  TransactionListResponse,
} from '../types.ts';
import { rp } from './Charts.tsx';

export function History({
  cats,
  colors,
  isAdmin,
  refreshKey,
  onEditTx,
  onDeleteTx,
  onBulkDelete,
}: {
  cats: Category[];
  colors: ColorItem[];
  isAdmin: boolean;
  refreshKey: number;
  onEditTx: (t: Transaction) => void;
  onDeleteTx: (t: Transaction) => void;
  onBulkDelete: (params: URLSearchParams, count: number, filtered: boolean) => void;
}) {
  const [type, setType] = useState('semua');
  const [catId, setCatId] = useState('');
  const [colorId, setColorId] = useState('');
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [page, setPage] = useState(1);

  const [resp, setResp] = useState<TransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const buildQueryParams = useCallback(() => {
    const p = new URLSearchParams();
    if (type !== 'semua') p.set('jenis', type);
    if (catId) p.set('kategori_id', catId);
    if (colorId) p.set('warna_id', colorId);
    if (dari) p.set('dari', dari);
    if (sampai) p.set('sampai', sampai);
    return p;
  }, [type, catId, colorId, dari, sampai]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = buildQueryParams();
      p.set('halaman', String(page));
      p.set('per_halaman', '25');
      const data = await api<TransactionListResponse>(`/transaksi?${p.toString()}`);
      setResp(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  const filtered =
    type !== 'semua' || catId !== '' || colorId !== '' || dari !== '' || sampai !== '';
  const rows = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const totalProfit = resp?.total_keuntungan ?? 0;
  const perPage = resp?.per_halaman ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const resetPageAnd = (fn: () => void) => {
    setPage(1);
    fn();
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Riwayat transaksi</h3>
        <div className="inline">
          <select
            value={type}
            onChange={(e) => resetPageAnd(() => setType(e.target.value))}
            aria-label="Filter jenis"
          >
            <option value="semua">Semua jenis</option>
            <option value="masuk">Barang masuk</option>
            <option value="keluar">Barang keluar</option>
          </select>
          <select
            value={catId}
            onChange={(e) => resetPageAnd(() => setCatId(e.target.value))}
            aria-label="Filter kategori"
          >
            <option value="">Semua kategori</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </select>
          <select
            value={colorId}
            onChange={(e) => resetPageAnd(() => setColorId(e.target.value))}
            aria-label="Filter warna"
          >
            <option value="">Semua warna</option>
            {colors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dari}
            onChange={(e) => resetPageAnd(() => setDari(e.target.value))}
            aria-label="Dari tanggal"
            title="Dari tanggal"
          />
          <input
            type="date"
            value={sampai}
            onChange={(e) => resetPageAnd(() => setSampai(e.target.value))}
            aria-label="Sampai tanggal"
            title="Sampai tanggal"
          />
          {isAdmin && (
            <button
              type="button"
              className="btn danger"
              onClick={() => onBulkDelete(buildQueryParams(), total, filtered)}
              disabled={total === 0}
            >
              {filtered ? 'Hapus hasil filter' : 'Hapus semua riwayat'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginTop: 0, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {loading && !resp ? (
        <p className="empty">Memuat riwayat transaksi...</p>
      ) : rows.length === 0 ? (
        <p className="empty">Belum ada transaksi yang cocok.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Produk</th>
                <th>Jenis</th>
                <th className="r">Jumlah</th>
                <th className="r">Harga</th>
                <th className="r">Keuntungan</th>
                <th>Pencatat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{t.tanggal}</td>
                  <td>
                    {t.nama_produk}
                    <small>
                      {[t.kategori, t.warna].filter(Boolean).join(' · ')}
                    </small>
                  </td>
                  <td>
                    <span className={`jenis-text ${t.jenis}`}>
                      {t.jenis === 'masuk' ? 'Masuk' : 'Keluar'}
                    </span>
                  </td>
                  <td className="r">{t.jumlah}</td>
                  <td className="r">{rp(t.harga)}</td>
                  <td className="r">
                    {t.jenis === 'keluar' ? rp(t.keuntungan) : '-'}
                  </td>
                  <td>{t.pencatat || '-'}</td>
                  <td className="r nowrap">
                    <button
                      type="button"
                      className="link"
                      onClick={() => onEditTx(t)}
                    >
                      Ubah
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="link danger"
                        onClick={() => onDeleteTx(t)}
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

      <div className="pagination">
        <p className="preview" style={{ margin: 0 }}>
          Total keuntungan ({total} catatan): <b>{rp(totalProfit)}</b>
        </p>
        {totalPages > 1 && (
          <div className="row-actions">
            <button
              type="button"
              className="btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </button>
            <span className="hint tabular">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
