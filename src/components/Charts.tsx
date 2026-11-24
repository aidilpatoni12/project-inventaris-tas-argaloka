import type { Product } from '../types.ts';

export const PALETTE = [
  '#1f3a32',
  '#b98a2e',
  '#3f6b4f',
  '#8c9a7b',
  '#6b5a3a',
  '#c9b98f',
];

export const rp = (n: number | null | undefined) =>
  'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

export const variantLabel = (p: Pick<Product, 'kategori' | 'warna'>) =>
  [p.kategori, p.warna].filter(Boolean).join(' · ');

const short = (n: number) => {
  if (n >= 1e6)
    return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.0', '') + ' jt';
  if (n >= 1e3) return Math.round(n / 1e3) + ' rb';
  return String(n);
};

const niceMax = (max: number) => {
  if (max <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(max));
  return (Math.ceil((max / mag) * 2) / 2) * mag;
};

export function Swatch({
  name,
  hex,
}: {
  name: string | null | undefined;
  hex?: string | null;
}) {
  if (!name) return <span className="muted">-</span>;
  return (
    <span className="swatch">
      <i style={{ background: hex || '#c2bba9' }} />
      {name}
    </span>
  );
}

export interface ChartPoint {
  label: string;
  revenue: number;
  profit: number;
}

export function BarChart({ data }: { data: ChartPoint[] }) {
  const W = 640;
  const H = 250;
  const L = 52;
  const R = 8;
  const T = 12;
  const B = 28;
  const iw = W - L - R;
  const ih = H - T - B;
  const max = niceMax(
    Math.max(1, ...data.flatMap((d) => [d.revenue, Math.max(0, d.profit)])),
  );
  const group = iw / Math.max(1, data.length);
  const bw = Math.min(24, group * 0.3);
  const y = (v: number) => T + ih - (Math.max(0, v) / max) * ih;

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
        const revY = y(d.revenue);
        const profY = y(d.profit);
        return (
          <g key={d.label}>
            <rect
              x={cx - bw - 2}
              y={revY}
              width={bw}
              height={Math.max(0, T + ih - revY)}
              rx="3"
              className="c-rev"
            >
              <title>{`${d.label}: penjualan ${rp(d.revenue)}`}</title>
            </rect>
            <rect
              x={cx + 2}
              y={profY}
              width={bw}
              height={Math.max(0, T + ih - profY)}
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

export interface DonutItem {
  label: string;
  value: number;
  color?: string;
}

export function Donut({ items }: { items: DonutItem[] }) {
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
        aria-label="Komposisi stok"
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
