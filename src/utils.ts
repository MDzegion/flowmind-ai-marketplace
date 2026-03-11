export const fmt = (n: number) => n >= 1_000_000_000 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1_000_000 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
export const fmtPrice = (p: number) => p === 0 ? 'Gratis' : `Rp ${p.toLocaleString('id-ID')}`;
