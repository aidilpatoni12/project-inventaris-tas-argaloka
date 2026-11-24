import { useMemo, useState } from 'react';
import type { DashboardData, Product, Transaction } from '../types.ts';
import { BarChart, Donut, Swatch, rp, variantLabel } from './Charts.tsx';

function formatDayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', {
    month: 'short',
    year: '2-digit',
  });
}

export function Dashboard({
  data,
  loading,
  error,
  onReload,
  onEditProduct,
  onEditTx,
}: {
  data: DashboardData | null;
  loading: boolean;
  error: string;
  onReload: () => void;
  onEditProduct: (p: Product) => void;
  onEditTx: (t: Transaction) => void;
}) {
  const [mode, setMode] = useState<'harian' | 'bulanan'>('harian');
  const [by, setBy] = useState<'kategori' | 'warna'>('kategori');

  const series = useMemo(() => {
    if (!data) return [];
    if (mode === 'harian') {
      return data.grafik_7_hari.map((d) => ({
        label: formatDayLabel(d.tanggal),
        revenue: d.penjualan,
        profit: d.keuntungan,
      }));
    }
    return data.grafik_6_bulan.map((d) => ({
      label: formatMonthLabel(d.bulan),
      revenue: d.penjualan,
      profit: d.keuntungan,
    }));
  }, [data, mode]);

  if (loading && !data) {
    return (
      <div className="panel">
        <p className="empty">Memuat ringkasan dashboard...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel">
        <div className="error" style={{ marginTop: 0 }}>
          {error}
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={onReload}>
          Muat ulang
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { ringkasan } = data;
  const hasSales = series.some((d) => d.revenue > 0 || d.profit !== 0);

  const byGroup: Array<{ label: string; nilai: number; hex?: string | null }> =
    by === 'kategori' ? data.keuntungan_per_kategori : data.keuntungan_per_warna;
  const maxGroup = Math.max(1, ...byGroup.map((r) => r.nilai));

  const stockRows: Array<{ label: string; nilai: number; hex?: string | null }> =
    by === 'kategori' ? data.stok_per_kategori : data.stok_per_warna;
  const stockItems = stockRows.map((r) => ({
    label: r.label,
    value: r.nilai,
    color: r.hex || undefined,
  }));

  const toggle = (
    <div className="segment small">
      <button
        type="button"
        className={by === 'kategori' ? 'on' : ''}
        onClick={() => setBy('kategori')}
      >
        Kategori
      </button>
      <button
        type="button"
        className={by === 'warna' ? 'on' : ''}
        onClick={() => setBy('warna')}
      >
        Warna
      </button>
    </div>
  );

  return (
    <>
      <div className="stats">
        <div className="stat feature">
          <span>Keuntungan bulan ini</span>
          <strong>{rp(ringkasan.keuntungan_bulan_ini)}</strong>
          <small>Total sepanjang waktu {rp(ringkasan.keuntungan_total)}</small>
        </div>
        <div className="stat">
          <span>Penjualan bulan ini</span>
          <strong>{rp(ringkasan.penjualan_bulan_ini)}</strong>
          <small>{ringkasan.transaksi_bulan_ini} transaksi</small>
        </div>
        <div className="stat">
          <span>Stok tersedia</span>
          <strong>{ringkasan.total_stok} pcs</strong>
          <small>{ringkasan.jumlah_produk} produk</small>
        </div>
        <div className="stat">
          <span>Nilai stok (modal)</span>
          <strong>{rp(ringkasan.nilai_stok)}</strong>
          <small>Harga beli × stok</small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Penjualan dan keuntungan</h3>
          <div className="segment small">
            <button
              type="button"
              className={mode === 'harian' ? 'on' : ''}
              onClick={() => setMode('harian')}
            >
              7 hari
            </button>
            <button
              type="button"
              className={mode === 'bulanan' ? 'on' : ''}
              onClick={() => setMode('bulanan')}
            >
              6 bulan
            </button>
          </div>
        </div>
        <div className="legend-inline">
          <span>
            <i className="sw rev" />
            Penjualan
          </span>
          <span>
            <i className="sw profit" />
            Keuntungan
          </span>
        </div>
        {hasSales ? (
          <BarChart data={series} />
        ) : (
          <p className="empty">
            Belum ada penjualan pada periode ini. Catat barang keluar untuk melihat grafik.
          </p>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h3>Keuntungan per {by}</h3>
            {toggle}
          </div>
          {byGroup.length === 0 ? (
            <p className="empty">Belum ada penjualan.</p>
          ) : (
            byGroup.map((row) => (
              <div className="bar-row" key={row.label}>
                <span>
                  {by === 'warna' && row.label !== 'Tanpa warna' ? (
                    <Swatch name={row.label} hex={row.hex ?? null} />
                  ) : (
                    row.label
                  )}
                </span>
                <div className="bar">
                  <i
                    style={{
                      width: `${(Math.max(row.nilai, 0) / maxGroup) * 100}%`,
                    }}
                  />
                </div>
                <b>{rp(row.nilai)}</b>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Komposisi stok per {by}</h3>
            {toggle}
          </div>
          <Donut items={stockItems} />
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h3>Stok menipis (≤ {data.batas_stok_menipis} pcs)</h3>
          {data.stok_menipis.length === 0 ? (
            <p className="empty">Semua stok aman.</p>
          ) : (
            <ul className="plain">
              {data.stok_menipis.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.nama}
                    <small>{variantLabel(p)}</small>
                  </span>
                  <span className="row-actions">
                    <b className="warn tabular">{p.stok} pcs</b>
                    <button
                      type="button"
                      className="link"
                      onClick={() => onEditProduct(p)}
                    >
                      Ubah
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h3>Transaksi terakhir</h3>
          {data.transaksi_terakhir.length === 0 ? (
            <p className="empty">Belum ada transaksi.</p>
          ) : (
            <ul className="plain">
              {data.transaksi_terakhir.map((t) => (
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
    </>
  );
}
