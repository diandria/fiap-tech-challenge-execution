import request from 'supertest';
import { createApp } from '../../../../src/app';

const ready = async () => {};

function appWithHops(hops?: string) {
  if (hops === undefined) delete process.env.TRUST_PROXY_HOPS;
  else process.env.TRUST_PROXY_HOPS = hops;
  return createApp(ready);
}

describe('trust proxy', () => {
  const original = process.env.TRUST_PROXY_HOPS;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = original;
  });

  it('should stay disabled GIVEN no configuration WHEN the app is created', () => {
    expect(appWithHops(undefined).get('trust proxy')).toBeFalsy();
  });

  it('should stay disabled GIVEN zero hops WHEN the app is created', () => {
    expect(appWithHops('0').get('trust proxy')).toBeFalsy();
  });

  // Behind the gateway req.ip must come from X-Forwarded-For; otherwise every
  // caller shares the address of a gateway ENI and one rate-limit bucket.
  it('should enable the setting GIVEN one hop WHEN the app is created', () => {
    expect(appWithHops('1').get('trust proxy')).toBe(1);
  });

  it('should still answer health GIVEN a forwarded header WHEN one hop is trusted', async () => {
    const res = await request(appWithHops('1'))
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.9');
    expect(res.status).toBe(200);
  });
});
