import { configureTrustedProxy, parseTrustedProxyHops } from './trusted-proxy';

describe('trusted proxy configuration', () => {
  it('keeps proxy trust disabled unless an explicit positive hop count is set', () => {
    expect(parseTrustedProxyHops(undefined)).toBeNull();
    expect(parseTrustedProxyHops('')).toBeNull();
    expect(parseTrustedProxyHops('0')).toBeNull();
  });

  it('accepts a bounded explicit hop count and rejects unsafe values', () => {
    expect(parseTrustedProxyHops('1')).toBe(1);
    expect(parseTrustedProxyHops('2')).toBe(2);
    expect(() => parseTrustedProxyHops('-1')).toThrow(
      'GRIDGO_TRUST_PROXY_HOPS',
    );
    expect(() => parseTrustedProxyHops('all')).toThrow(
      'GRIDGO_TRUST_PROXY_HOPS',
    );
    expect(() => parseTrustedProxyHops('6')).toThrow('GRIDGO_TRUST_PROXY_HOPS');
  });

  it('configures Express only when proxy trust is explicitly enabled', () => {
    const set = jest.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
    };

    configureTrustedProxy(app, '1');
    expect(set).toHaveBeenCalledWith('trust proxy', 1);

    set.mockClear();
    configureTrustedProxy(app, '0');
    expect(set).not.toHaveBeenCalled();
  });
});
