import { useEffect, useMemo, useState } from "react";
import "./App.css";

/* ---------- Data awal & pengguna ---------- */
const USERS = [
  { username: "admin", password: "admin123", name: "Admin Argaloka" },
  { username: "staff", password: "staff123", name: "Staf Gudang" },
];
const DEFAULT_CATS = ["Ransel", "Tote Bag", "Sling Bag", "Dompet", "Pouch"];
const SEED_PRODUCTS = [
  {
    id: 1,
    name: "Ransel Rinjani 30L",
    category: "Ransel",
    color: "Hitam",
    buy: 180000,
    sell: 289000,
    stock: 24,
  },
  {
    id: 2,
    name: "Tote Canvas Merbabu",
    category: "Tote Bag",
    color: "Krem",
    buy: 55000,
    sell: 99000,
    stock: 40,
  },
  {
    id: 3,
    name: "Sling Bag Semeru",
    category: "Sling Bag",
    color: "Hijau Army",
    buy: 85000,
    sell: 149000,
    stock: 4,
  },
  {
    id: 4,
    name: "Dompet Kulit Bromo",
    category: "Dompet",
    color: "Coklat",
    buy: 60000,
    sell: 119000,
    stock: 18,
  },
];
const DEFAULT_COLORS = [
  { name: "Hitam", hex: "#1b1b1b" },
  { name: "Navy", hex: "#1f2f55" },
  { name: "Hijau Army", hex: "#4b5a3a" },
  { name: "Coklat", hex: "#6b4a2f" },
  { name: "Krem", hex: "#d8c9a8" },
  { name: "Abu-abu", hex: "#8a8f93" },
];
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => ymd(new Date());
const rp = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const LOW_STOCK = 5;
const colorHex = (colors, name) =>
  colors.find((c) => c.name === name)?.hex || "#c2bba9";
const variantLabel = (p) => [p.category, p.color].filter(Boolean).join(" · ");

function load(key, fallback) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // Data rusak: simpan salinannya dulu agar tidak tertimpa data awal
    try {
      if (raw) localStorage.setItem(`${key}__rusak_${Date.now()}`, raw);
    } catch {
      /* abaikan */
    }
    return fallback;
  }
}

const announce = (detail) =>
  window.dispatchEvent(new CustomEvent("argaloka-save", { detail }));

// Menyimpan otomatis setiap data berubah, dan menyinkronkan antar tab browser
function usePersist(key, initial) {
  const [value, setValue] = useState(() => load(key, initial));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      announce({ ok: true, time: new Date() });
    } catch {
      announce({ ok: false, time: new Date() });
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.storageArea === localStorage && e.key === key && e.newValue) {
        try {
          setValue(JSON.parse(e.newValue));
        } catch {
          /* abaikan */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue];
}

/* ---------- Login ---------- */
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const user = USERS.find(
      (u) => u.username === username.trim() && u.password === password,
    );
    if (!user) return setError("Username atau kata sandi salah. Coba lagi.");
    onLogin({ username: user.username, name: user.name });
  };

  return (
    <div className="login">
      <div className="login-brand">
        <h1>Aidiloka</h1>
        <p>
          Sistem inventaris tas. Kelola stok, kategori, dan keuntungan penjualan
          dalam satu tempat.
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
          />
        </label>
        <label>
          Kata sandi
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="btn primary" type="submit">
          Masuk
        </button>
        <p className="hint">
          Akun contoh: <b>admin</b> / admin123 atau <b>staff</b> / staff123
        </p>
      </form>
    </div>
  );
}

/* ---------- Grafik ---------- */
const PALETTE = [
  "#1f3a32",
  "#b98a2e",
  "#3f6b4f",
  "#8c9a7b",
  "#6b5a3a",
  "#c9b98f",
];

const short = (n) => {
  if (n >= 1e6)
    return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(".0", "") + " jt";
  if (n >= 1e3) return Math.round(n / 1e3) + " rb";
  return String(n);
};
const niceMax = (max) => {
  const mag = 10 ** Math.floor(Math.log10(max));
  return (Math.ceil((max / mag) * 2) / 2) * mag;
};

function buildSeries(sales, mode) {
  const now = new Date();
  const buckets = [];
  if (mode === "harian") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = ymd(d);
      buckets.push({
        label: d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        }),
        match: (t) => t.date === key,
      });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = ymd(d).slice(0, 7);
      buckets.push({
        label: d.toLocaleDateString("id-ID", {
          month: "short",
          year: "2-digit",
        }),
        match: (t) => t.date.startsWith(key),
      });
    }
  }
  return buckets.map((b) => {
    const rows = sales.filter(b.match);
    return {
      label: b.label,
      revenue: rows.reduce((a, t) => a + t.price * t.qty, 0),
      profit: rows.reduce((a, t) => a + t.profit, 0),
    };
  });
}

function BarChart({ data }) {
  const W = 640,
    H = 250,
    L = 52,
    R = 8,
    T = 12,
    B = 28;
  const iw = W - L - R,
    ih = H - T - B;
  const max = niceMax(
    Math.max(1, ...data.flatMap((d) => [d.revenue, d.profit])),
  );
  const group = iw / data.length;
  const bw = Math.min(24, group * 0.3);
  const y = (v) => T + ih - (v / max) * ih;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      role="img"
      aria-label="Grafik penjualan dan keuntungan"
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (max / 4) * i;
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="axis">
              {short(v)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = L + group * i + group / 2;
        return (
          <g key={d.label}>
            <rect
              x={cx - bw - 2}
              y={y(d.revenue)}
              width={bw}
              height={T + ih - y(d.revenue)}
              rx="3"
              className="c-rev"
            >
              <title>{`${d.label}: penjualan ${rp(d.revenue)}`}</title>
            </rect>
            <rect
              x={cx + 2}
              y={y(d.profit)}
              width={bw}
              height={T + ih - y(d.profit)}
              rx="3"
              className="c-profit"
            >
              <title>{`${d.label}: keuntungan ${rp(d.profit)}`}</title>
            </rect>
            <text x={cx} y={H - 8} textAnchor="middle" className="axis">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ items }) {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return <p className="empty">Belum ada stok.</p>;
  const r = 42;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg
        viewBox="0 0 120 120"
        className="donut"
        role="img"
        aria-label="Komposisi stok per kategori"
      >
        <g transform="rotate(-90 60 60)">
          {items.map((it, i) => {
            const len = (it.value / total) * C;
            const el = (
              <circle
                key={it.label}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={it.color || PALETTE[i % PALETTE.length]}
                strokeWidth="18"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              >
                <title>{`${it.label}: ${it.value} pcs`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="60" y="58" textAnchor="middle" className="donut-num">
          {total}
        </text>
        <text x="60" y="73" textAnchor="middle" className="donut-lbl">
          pcs
        </text>
      </svg>
      <ul className="legend">
        {items.map((it, i) => (
          <li key={it.label}>
            <i
              style={{ background: it.color || PALETTE[i % PALETTE.length] }}
            />
            <span>{it.label}</span>
            <b>{it.value} pcs</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Swatch({ name, colors }) {
  if (!name) return <span className="muted">-</span>;
  return (
    <span className="swatch">
      <i style={{ background: colorHex(colors, name) }} />
      {name}
    </span>
  );
}

function Dashboard({ products, txs, colors, onEditProduct, onEditTx }) {
  const [mode, setMode] = useState("harian");
  const [by, setBy] = useState("kategori");
  const month = today().slice(0, 7);
  const sales = txs.filter((t) => t.type === "keluar");
  const monthSales = sales.filter((t) => t.date.startsWith(month));
  const sum = (arr, f) => arr.reduce((a, t) => a + f(t), 0);

  const totalUnits = sum(products, (p) => p.stock);
  const stockValue = sum(products, (p) => p.stock * p.buy);
  const monthRevenue = sum(monthSales, (t) => t.price * t.qty);
  const monthProfit = sum(monthSales, (t) => t.profit);
  const allProfit = sum(sales, (t) => t.profit);

  const series = useMemo(() => buildSeries(sales, mode), [sales, mode]);
  const hasSales = series.some((d) => d.revenue > 0 || d.profit !== 0);

  const groupOf = (p) =>
    p ? (by === "kategori" ? p.category : p.color || "Tanpa warna") : "Lainnya";

  const byGroup = useMemo(() => {
    const map = {};
    sales.forEach((t) => {
      const g = groupOf(products.find((x) => x.id === t.productId));
      map[g] = (map[g] || 0) + t.profit;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sales, products, by]);
  const maxGroup = Math.max(1, ...byGroup.map(([, v]) => v));

  const stockBy = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const g = groupOf(p);
      map[g] = (map[g] || 0) + p.stock;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({
        label,
        value,
        color: by === "warna" ? colorHex(colors, label) : undefined,
      }));
  }, [products, colors, by]);

  const low = products.filter((p) => p.stock <= LOW_STOCK);

  const toggle = (
    <div className="segment small">
      <button
        type="button"
        className={by === "kategori" ? "on" : ""}
        onClick={() => setBy("kategori")}
      >
        Kategori
      </button>
      <button
        type="button"
        className={by === "warna" ? "on" : ""}
        onClick={() => setBy("warna")}
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
          <strong>{rp(monthProfit)}</strong>
          <small>Total sepanjang waktu {rp(allProfit)}</small>
        </div>
        <div className="stat">
          <span>Penjualan bulan ini</span>
          <strong>{rp(monthRevenue)}</strong>
          <small>{monthSales.length} transaksi</small>
        </div>
        <div className="stat">
          <span>Stok tersedia</span>
          <strong>{totalUnits} pcs</strong>
          <small>{products.length} produk</small>
        </div>
        <div className="stat">
          <span>Nilai stok (modal)</span>
          <strong>{rp(stockValue)}</strong>
          <small>Harga beli × stok</small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Penjualan dan keuntungan</h3>
          <div className="segment small">
            <button
              type="button"
              className={mode === "harian" ? "on" : ""}
              onClick={() => setMode("harian")}
            >
              7 hari
            </button>
            <button
              type="button"
              className={mode === "bulanan" ? "on" : ""}
              onClick={() => setMode("bulanan")}
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
            Belum ada penjualan pada periode ini. Catat barang keluar untuk
            melihat grafik.
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
            byGroup.map(([g, v]) => (
              <div className="bar-row" key={g}>
                <span>
                  {by === "warna" && g !== "Lainnya" ? (
                    <Swatch
                      name={g === "Tanpa warna" ? "" : g}
                      colors={colors}
                    />
                  ) : (
                    g
                  )}
                </span>
                <div className="bar">
                  <i
                    style={{ width: `${(Math.max(v, 0) / maxGroup) * 100}%` }}
                  />
                </div>
                <b>{rp(v)}</b>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Komposisi stok per {by}</h3>
            {toggle}
          </div>
          <Donut items={stockBy} />
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h3>Stok menipis</h3>
          {low.length === 0 ? (
            <p className="empty">Semua stok aman.</p>
          ) : (
            <ul className="plain">
              {low.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.name}
                    <small>{variantLabel(p)}</small>
                  </span>
                  <span className="row-actions">
                    <b className="warn">{p.stock} pcs</b>
                    <button className="link" onClick={() => onEditProduct(p)}>
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
          <ul className="plain">
            {txs.slice(0, 5).map((t) => {
              const p = products.find((x) => x.id === t.productId);
              return (
                <li key={t.id}>
                  <span>
                    {p ? p.name : t.productName}
                    <small>
                      {t.date}
                      {p?.color ? ` · ${p.color}` : ""}
                    </small>
                  </span>
                  <span className="row-actions">
                    <b className={t.type === "masuk" ? "in" : "out"}>
                      {t.type === "masuk" ? `+${t.qty}` : `−${t.qty}`}
                    </b>
                    <button className="link" onClick={() => onEditTx(t)}>
                      Ubah
                    </button>
                  </span>
                </li>
              );
            })}
            {txs.length === 0 && <p className="empty">Belum ada transaksi.</p>}
          </ul>
        </section>
      </div>
    </>
  );
}

function TxTable({ txs, products, onEdit, onDelete }) {
  if (txs.length === 0) return <p className="empty">Belum ada transaksi.</p>;
  const hasActions = onEdit || onDelete;
  return (
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
            {hasActions && <th />}
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => {
            const p = products.find((x) => x.id === t.productId);
            return (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  {p ? p.name : t.productName}
                  <small>{p ? variantLabel(p) : ""}</small>
                </td>
                <td>
                  <span className={`tag ${t.type}`}>
                    {t.type === "masuk" ? "Masuk" : "Keluar"}
                  </span>
                </td>
                <td className="r">{t.qty}</td>
                <td className="r">{rp(t.price)}</td>
                <td className="r">
                  {t.type === "keluar" ? rp(t.profit) : "-"}
                </td>
                {hasActions && (
                  <td className="r nowrap">
                    {onEdit && (
                      <button className="link" onClick={() => onEdit(t)}>
                        Ubah
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="link danger"
                        onClick={() => onDelete(t)}
                      >
                        Hapus
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Modal & form ubah ---------- */
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-back"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="link" onClick={onClose}>
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductForm({
  initial,
  cats,
  colors,
  isEdit,
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const data = {
      name: f.name.trim(),
      category: f.category,
      color: f.color,
      buy: +f.buy,
      sell: +f.sell,
      stock: +f.stock || 0,
    };
    if (
      !data.name ||
      !data.category ||
      data.buy < 0 ||
      data.sell <= 0 ||
      data.stock < 0
    )
      return;
    onSubmit(data);
    if (!isEdit) setF(initial);
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span2">
        Nama produk
        <input value={f.name} onChange={set("name")} required />
      </label>
      <label>
        Kategori
        <select value={f.category} onChange={set("category")}>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Warna
        <select value={f.color} onChange={set("color")}>
          <option value="">Tanpa warna</option>
          {colors.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        Harga beli (modal)
        <input
          type="number"
          min="0"
          value={f.buy}
          onChange={set("buy")}
          required
        />
      </label>
      <label>
        Harga jual
        <input
          type="number"
          min="1"
          value={f.sell}
          onChange={set("sell")}
          required
        />
      </label>
      <label>
        {isEdit ? "Stok (koreksi manual)" : "Stok awal"}
        <input type="number" min="0" value={f.stock} onChange={set("stock")} />
      </label>
      <div className="actions">
        <button className="btn primary" type="submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Batal
          </button>
        )}
      </div>
    </form>
  );
}

function TxEditForm({ tx, product, onSubmit, onCancel }) {
  const [date, setDate] = useState(tx.date);
  const [qty, setQty] = useState(tx.qty);
  const [price, setPrice] = useState(tx.price);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!date) return setError("Tanggal wajib diisi.");
    if (!(+qty > 0)) return setError("Jumlah harus lebih dari 0.");
    if (price === "" || +price < 0) return setError("Harga tidak valid.");
    const err = onSubmit({ date, qty: +qty, price: +price });
    if (err) setError(err);
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <p className="preview full">
        {product ? product.name : tx.productName} ·{" "}
        {tx.type === "masuk" ? "Barang masuk" : "Barang keluar"}
      </p>
      <label>
        Tanggal
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
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
        {tx.type === "masuk" ? "Harga beli per pcs" : "Harga jual per pcs"}
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <p className="hint full">
        Stok produk ikut disesuaikan dengan perubahan jumlah.
      </p>
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn primary" type="submit">
          Simpan perubahan
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}

function ItemForm({ kind, item, onSubmit, onDelete, onCancel }) {
  const [name, setName] = useState(item.name);
  const [hex, setHex] = useState(item.hex || "#1b1b1b");
  const [error, setError] = useState("");
  const label = kind === "cat" ? "kategori" : "warna";

  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Nama tidak boleh kosong.");
    const err = onSubmit({ name: n, hex });
    if (err) setError(err);
  };
  const del = () => {
    if (!confirm(`Hapus ${label} "${item.name}"?`)) return;
    const err = onDelete();
    if (err) setError(err);
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className={kind === "color" ? "" : "span2"}>
        Nama {label}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      {kind === "color" && (
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
      <div className="actions">
        <button className="btn primary" type="submit">
          Simpan perubahan
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="btn danger push" onClick={del}>
          Hapus {label}
        </button>
      </div>
    </form>
  );
}

/* ---------- Produk, kategori & warna ---------- */
function Products({
  products,
  setProducts,
  cats,
  setCats,
  colors,
  setColors,
  onEditProduct,
  onEditCat,
  onEditColor,
}) {
  const [filter, setFilter] = useState("Semua");
  const [colorFilter, setColorFilter] = useState("Semua");
  const [newCat, setNewCat] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newHex, setNewHex] = useState("#1b1b1b");

  const blank = {
    name: "",
    category: cats[0] || "",
    color: colors[0]?.name || "",
    buy: "",
    sell: "",
    stock: "",
  };
  const add = (data) => setProducts([...products, { id: Date.now(), ...data }]);
  const remove = (p) => {
    if (confirm(`Hapus produk "${p.name}"?`))
      setProducts(products.filter((x) => x.id !== p.id));
  };
  const addCat = (e) => {
    e.preventDefault();
    const c = newCat.trim();
    if (c && !cats.includes(c)) setCats([...cats, c]);
    setNewCat("");
  };
  const addColor = (e) => {
    e.preventDefault();
    const n = newColor.trim();
    if (n && !colors.some((c) => c.name === n))
      setColors([...colors, { name: n, hex: newHex }]);
    setNewColor("");
  };

  const shown = products.filter(
    (p) =>
      (filter === "Semua" || p.category === filter) &&
      (colorFilter === "Semua" || (p.color || "") === colorFilter),
  );

  return (
    <>
      <section className="panel">
        <h3>Tambah produk</h3>
        <ProductForm
          initial={blank}
          cats={cats}
          colors={colors}
          submitLabel="Tambah produk"
          onSubmit={add}
        />
        <p className="hint">
          Satu produk dengan beberapa warna dicatat sebagai baris terpisah,
          supaya stok tiap warna terpisah.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Daftar produk</h3>
          <div className="inline">
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              aria-label="Filter warna"
            >
              <option>Semua</option>
              {colors.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="chips spaced">
          {["Semua", ...cats].map((c) => (
            <button
              key={c}
              className={`chip ${filter === c ? "on" : ""}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="empty">
            Tidak ada produk yang cocok dengan filter ini.
          </p>
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
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>
                      <Swatch name={p.color} colors={colors} />
                    </td>
                    <td className="r">{rp(p.buy)}</td>
                    <td className="r">{rp(p.sell)}</td>
                    <td className="r">{rp(p.sell - p.buy)}</td>
                    <td className={`r ${p.stock <= LOW_STOCK ? "warn" : ""}`}>
                      {p.stock}
                    </td>
                    <td className="r nowrap">
                      <button className="link" onClick={() => onEditProduct(p)}>
                        Ubah
                      </button>
                      <button className="link danger" onClick={() => remove(p)}>
                        Hapus
                      </button>
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
                className="chip"
                key={c}
                onClick={() => onEditCat({ name: c })}
                title="Ubah kategori"
              >
                {c} · Ubah
              </button>
            ))}
          </div>
          <form className="inline" onSubmit={addCat}>
            <input
              placeholder="Nama kategori baru"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button className="btn" type="submit">
              Tambah
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>Warna tas</h3>
          <div className="chips">
            {colors.map((c) => (
              <button
                className="chip"
                key={c.name}
                onClick={() => onEditColor(c)}
                title="Ubah warna"
              >
                <Swatch name={c.name} colors={colors} /> · Ubah
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
            <button className="btn" type="submit">
              Tambah
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

/* ---------- Stok masuk / keluar ---------- */
function StockMove({ products, setProducts, txs, setTxs, onEditTx }) {
  const [type, setType] = useState("masuk");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today());
  const [msg, setMsg] = useState(null);

  const product = products.find((p) => p.id === +productId);
  const defaultPrice = product
    ? type === "masuk"
      ? product.buy
      : product.sell
    : "";
  const q = +qty;
  const unit = price === "" ? +defaultPrice : +price;
  const estProfit =
    type === "keluar" && product ? (unit - product.buy) * q : null;

  const submit = (e) => {
    e.preventDefault();
    if (!product)
      return setMsg({ ok: false, text: "Pilih produk terlebih dahulu." });
    if (!(q > 0))
      return setMsg({ ok: false, text: "Jumlah harus lebih dari 0." });
    if (type === "keluar" && q > product.stock)
      return setMsg({
        ok: false,
        text: `Stok ${product.name} hanya ${product.stock} pcs.`,
      });

    let updated;
    if (type === "masuk") {
      // Modal dihitung rata-rata tertimbang agar keuntungan tetap akurat
      const total = product.stock + q;
      const avg = total
        ? (product.stock * product.buy + q * unit) / total
        : unit;
      updated = { ...product, stock: total, buy: Math.round(avg) };
    } else {
      updated = { ...product, stock: product.stock - q };
    }
    setProducts(products.map((p) => (p.id === product.id ? updated : p)));
    setTxs([
      {
        id: Date.now(),
        date,
        type,
        productId: product.id,
        productName: product.name,
        qty: q,
        price: unit,
        cost: product.buy,
        profit: type === "keluar" ? (unit - product.buy) * q : 0,
      },
      ...txs,
    ]);
    setMsg({
      ok: true,
      text:
        type === "masuk"
          ? `${q} pcs ${product.name} masuk ke stok.`
          : `${q} pcs ${product.name} terjual.`,
    });
    setQty("");
    setPrice("");
  };

  return (
    <div className="grid-2 wide-left">
      <section className="panel">
        <h3>Catat pergerakan stok</h3>
        <div className="segment">
          <button
            className={type === "masuk" ? "on" : ""}
            onClick={() => {
              setType("masuk");
              setPrice("");
            }}
            type="button"
          >
            Barang masuk
          </button>
          <button
            className={type === "keluar" ? "on" : ""}
            onClick={() => {
              setType("keluar");
              setPrice("");
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
                setPrice("");
              }}
            >
              <option value="">Pilih produk</option>
              {products.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                >{`${p.name}${p.color ? " · " + p.color : ""} (${p.category}) · stok ${p.stock}`}</option>
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
            {type === "masuk" ? "Harga beli per pcs" : "Harga jual per pcs"}
            <input
              type="number"
              min="0"
              value={price}
              placeholder={defaultPrice}
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
            <button className="btn primary" type="submit">
              {type === "masuk" ? "Simpan barang masuk" : "Simpan penjualan"}
            </button>
          </div>
        </form>
        {estProfit !== null && q > 0 && (
          <p className="preview">
            Perkiraan keuntungan: <b>{rp(estProfit)}</b>
          </p>
        )}
        {msg && (
          <div className={msg.ok ? "ok" : "error"} role="status">
            {msg.text}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Catatan terbaru</h3>
        <ul className="plain">
          {txs.slice(0, 6).map((t) => (
            <li key={t.id}>
              <span>
                {products.find((p) => p.id === t.productId)?.name ??
                  t.productName}
                <small>{t.date}</small>
              </span>
              <span className="row-actions">
                <b className={t.type === "masuk" ? "in" : "out"}>
                  {t.type === "masuk" ? "+" : "−"}
                  {t.qty}
                </b>
                <button className="link" onClick={() => onEditTx(t)}>
                  Ubah
                </button>
              </span>
            </li>
          ))}
          {txs.length === 0 && <p className="empty">Belum ada catatan.</p>}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Riwayat ---------- */
function History({ products, colors, txs, setTxs, cats, onEditTx }) {
  const [type, setType] = useState("semua");
  const [cat, setCat] = useState("Semua");
  const [col, setCol] = useState("Semua");
  const filtered = type !== "semua" || cat !== "Semua" || col !== "Semua";
  const rows = txs.filter((t) => {
    const p = products.find((x) => x.id === t.productId);
    return (
      (type === "semua" || t.type === type) &&
      (cat === "Semua" || p?.category === cat) &&
      (col === "Semua" || p?.color === col)
    );
  });
  const profit = rows.reduce((a, t) => a + t.profit, 0);

  const removeOne = (t) => {
    if (
      confirm(
        "Hapus catatan ini dari riwayat? Jumlah stok produk tidak berubah.",
      )
    ) {
      setTxs(txs.filter((x) => x.id !== t.id));
    }
  };
  const removeShown = () => {
    if (rows.length === 0) return;
    const what = filtered
      ? `${rows.length} catatan hasil filter`
      : `seluruh riwayat (${rows.length} catatan)`;
    if (
      confirm(
        `Hapus ${what}? Jumlah stok produk tidak berubah, tetapi grafik dan keuntungan ikut berkurang.`,
      )
    ) {
      const ids = new Set(rows.map((r) => r.id));
      setTxs(txs.filter((t) => !ids.has(t.id)));
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Riwayat transaksi</h3>
        <div className="inline">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter jenis"
          >
            <option value="semua">Semua jenis</option>
            <option value="masuk">Barang masuk</option>
            <option value="keluar">Barang keluar</option>
          </select>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filter kategori"
          >
            {["Semua", ...cats].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={col}
            onChange={(e) => setCol(e.target.value)}
            aria-label="Filter warna"
          >
            <option>Semua</option>
            {colors.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
          <button
            className="btn danger"
            onClick={removeShown}
            disabled={rows.length === 0}
          >
            {filtered ? "Hapus hasil filter" : "Hapus semua riwayat"}
          </button>
        </div>
      </div>
      <TxTable
        txs={rows}
        products={products}
        onEdit={onEditTx}
        onDelete={removeOne}
      />
      <p className="preview">
        Total keuntungan dari hasil filter: <b>{rp(profit)}</b>
      </p>
    </section>
  );
}

/* ---------- Kerangka aplikasi ---------- */
function SaveStatus() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const on = (e) => setS(e.detail);
    window.addEventListener("argaloka-save", on);
    return () => window.removeEventListener("argaloka-save", on);
  }, []);
  const bad = s && !s.ok;
  const time = s
    ? s.time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div className={`save ${bad ? "bad" : ""}`} role="status">
      {bad
        ? "Gagal menyimpan. Penyimpanan browser penuh atau diblokir. Cadangkan data sekarang."
        : `Tersimpan otomatis${time ? ` · ${time}` : ""}`}
    </div>
  );
}

const NAV = [
  ["dashboard", "Dashboard"],
  ["stok", "Stok masuk & keluar"],
  ["produk", "Produk, kategori & warna"],
  ["riwayat", "Riwayat"],
];

export default function App() {
  const [session, setSession] = usePersist("argaloka_session", null);
  const [products, setProducts] = usePersist(
    "argaloka_products",
    SEED_PRODUCTS,
  );
  const [cats, setCats] = usePersist("argaloka_cats", DEFAULT_CATS);
  const [colors, setColors] = usePersist("argaloka_colors", DEFAULT_COLORS);
  const [txs, setTxs] = usePersist("argaloka_txs", []);
  const [page, setPage] = useState("dashboard");
  const [editing, setEditing] = useState(null); // { kind: 'product' | 'tx' | 'cat' | 'color', item }

  // Minta browser agar tidak menghapus data penyimpanan secara otomatis
  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  if (!session) return <Login onLogin={setSession} />;

  const close = () => setEditing(null);

  /* ----- cadangan & pemulihan data ----- */
  const exportData = () => {
    const data = {
      app: "argaloka-inventaris",
      version: 1,
      exportedAt: new Date().toISOString(),
      products,
      cats,
      colors,
      txs,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `argaloka-cadangan-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (![d.products, d.cats, d.colors, d.txs].every(Array.isArray))
        throw new Error("format");
      if (
        !confirm(
          `Pulihkan cadangan ini? ${d.products.length} produk dan ${d.txs.length} transaksi akan menggantikan data saat ini.`,
        )
      )
        return;
      setProducts(d.products);
      setCats(d.cats);
      setColors(d.colors);
      setTxs(d.txs);
      alert("Data berhasil dipulihkan.");
    } catch {
      alert(
        "File cadangan tidak valid. Pilih file .json hasil Cadangkan data.",
      );
    }
  };
  const editProduct = (item) => setEditing({ kind: "product", item });
  const editTx = (item) => setEditing({ kind: "tx", item });
  const editCat = (item) => setEditing({ kind: "cat", item });
  const editColor = (item) => setEditing({ kind: "color", item });

  /* ----- simpan perubahan ----- */
  const saveProduct = (id, data) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, ...data } : p)));
    setTxs(
      txs.map((t) =>
        t.productId === id ? { ...t, productName: data.name } : t,
      ),
    );
    close();
  };

  const saveTx = (tx, data) => {
    const p = products.find((x) => x.id === tx.productId);
    if (!p) return "Produk sudah dihapus, jadi catatan ini tidak bisa diubah.";
    const sign = tx.type === "masuk" ? 1 : -1;
    const newStock = p.stock + sign * (data.qty - tx.qty);
    if (newStock < 0)
      return `Perubahan ini membuat stok ${p.name} menjadi ${newStock}. Kurangi jumlahnya.`;
    setProducts(
      products.map((x) => (x.id === p.id ? { ...x, stock: newStock } : x)),
    );
    setTxs(
      txs.map((t) =>
        t.id === tx.id
          ? {
              ...t,
              ...data,
              profit:
                t.type === "keluar"
                  ? (data.price - (t.cost ?? p.buy)) * data.qty
                  : 0,
            }
          : t,
      ),
    );
    close();
    return null;
  };

  const saveCat = (old, { name }) => {
    if (name !== old && cats.includes(name)) return "Kategori itu sudah ada.";
    setCats(cats.map((c) => (c === old ? name : c)));
    setProducts(
      products.map((p) => (p.category === old ? { ...p, category: name } : p)),
    );
    close();
    return null;
  };
  const deleteCat = (name) => {
    if (products.some((p) => p.category === name))
      return "Kategori masih dipakai produk. Pindahkan atau hapus produknya dulu.";
    setCats(cats.filter((c) => c !== name));
    close();
    return null;
  };

  const saveColor = (old, { name, hex }) => {
    if (name !== old.name && colors.some((c) => c.name === name))
      return "Warna itu sudah ada.";
    setColors(colors.map((c) => (c.name === old.name ? { name, hex } : c)));
    setProducts(
      products.map((p) => (p.color === old.name ? { ...p, color: name } : p)),
    );
    close();
    return null;
  };
  const deleteColor = (name) => {
    if (products.some((p) => p.color === name))
      return "Warna masih dipakai produk. Ubah warna produknya dulu.";
    setColors(colors.filter((c) => c.name !== name));
    close();
    return null;
  };

  const titles = {
    product: "Ubah produk",
    tx: "Ubah transaksi",
    cat: "Ubah kategori",
    color: "Ubah warna",
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">
          Argaloka<small>Inventaris tas</small>
        </div>
        <nav>
          {NAV.map(([key, label]) => (
            <button
              key={key}
              className={page === key ? "on" : ""}
              onClick={() => setPage(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="side-tools">
          <SaveStatus />
          <button type="button" onClick={exportData}>
            Cadangkan data
          </button>
          <label className="tool">
            Pulihkan data
            <input
              type="file"
              accept="application/json,.json"
              onChange={importData}
              hidden
            />
          </label>
        </div>
        <div className="who">
          <span>{session.name}</span>
          <button
            className="link"
            onClick={() => setSession(null)}
            title="Data tetap tersimpan"
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="main">
        <h2 className="title">{NAV.find(([k]) => k === page)[1]}</h2>
        {page === "dashboard" && (
          <Dashboard
            products={products}
            txs={txs}
            colors={colors}
            onEditProduct={editProduct}
            onEditTx={editTx}
          />
        )}
        {page === "stok" && (
          <StockMove
            products={products}
            setProducts={setProducts}
            txs={txs}
            setTxs={setTxs}
            onEditTx={editTx}
          />
        )}
        {page === "produk" && (
          <Products
            products={products}
            setProducts={setProducts}
            cats={cats}
            setCats={setCats}
            colors={colors}
            setColors={setColors}
            onEditProduct={editProduct}
            onEditCat={editCat}
            onEditColor={editColor}
          />
        )}
        {page === "riwayat" && (
          <History
            products={products}
            colors={colors}
            txs={txs}
            setTxs={setTxs}
            cats={cats}
            onEditTx={editTx}
          />
        )}
      </main>

      {editing && (
        <Modal title={titles[editing.kind]} onClose={close}>
          {editing.kind === "product" && (
            <ProductForm
              isEdit
              initial={{ ...editing.item, color: editing.item.color || "" }}
              cats={cats}
              colors={colors}
              submitLabel="Simpan perubahan"
              onCancel={close}
              onSubmit={(data) => saveProduct(editing.item.id, data)}
            />
          )}
          {editing.kind === "tx" && (
            <TxEditForm
              tx={editing.item}
              product={products.find((p) => p.id === editing.item.productId)}
              onCancel={close}
              onSubmit={(data) => saveTx(editing.item, data)}
            />
          )}
          {editing.kind === "cat" && (
            <ItemForm
              kind="cat"
              item={editing.item}
              onCancel={close}
              onSubmit={(data) => saveCat(editing.item.name, data)}
              onDelete={() => deleteCat(editing.item.name)}
            />
          )}
          {editing.kind === "color" && (
            <ItemForm
              kind="color"
              item={editing.item}
              onCancel={close}
              onSubmit={(data) => saveColor(editing.item, data)}
              onDelete={() => deleteColor(editing.item.name)}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
