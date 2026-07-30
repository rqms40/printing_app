type ExpressProxyConfigurable = {
  getHttpAdapter(): {
    getInstance(): {
      set(name: 'trust proxy', value: number): unknown;
    };
  };
};

export function parseTrustedProxyHops(raw: string | undefined): number | null {
  const normalized = raw?.trim() ?? '';
  if (normalized === '' || normalized === '0') return null;
  if (!/^[1-5]$/.test(normalized)) {
    throw new Error(
      'GRIDGO_TRUST_PROXY_HOPS must be an integer from 0 through 5',
    );
  }
  return Number(normalized);
}

export function configureTrustedProxy(
  app: ExpressProxyConfigurable,
  raw = process.env.GRIDGO_TRUST_PROXY_HOPS,
): void {
  const hops = parseTrustedProxyHops(raw);
  if (hops === null) return;
  app.getHttpAdapter().getInstance().set('trust proxy', hops);
}
