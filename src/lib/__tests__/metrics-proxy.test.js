import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';
import handler from '../../pages/api/metrics.js';

function mockResponse() {
  const res = {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

const loopback = { remoteAddress: '127.0.0.1' };
const originalEnv = { ...process.env };

beforeEach(() => {
  axios.get.mockReset();
  delete process.env.VOQORA_METRICS_TOKEN;
  delete process.env.VOQORA_API_BASE;
  delete process.env.DASHBOARD_ALLOW_REMOTE;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('metrics proxy route', () => {
  test('forwards the bearer token server-side when configured', async () => {
    process.env.VOQORA_METRICS_TOKEN = 'secret-token';
    axios.get.mockResolvedValueOnce({ status: 200, data: { metrics_contract_version: 'x' } });
    const res = mockResponse();

    await handler({ method: 'GET', query: { days: '30', weeks: '8' }, socket: loopback }, res);

    expect(axios.get).toHaveBeenCalledWith(
      'https://himudigonda.me/api/voqora/metrics',
      expect.objectContaining({
        params: { days: 30, weeks: 8 },
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ metrics_contract_version: 'x' });
    expect(JSON.stringify(res.body)).not.toContain('secret-token');
  });

  test('passes through without an Authorization header when no token is set', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: { ok: true } });
    const res = mockResponse();

    await handler({ method: 'GET', query: {}, socket: loopback }, res);

    const [, options] = axios.get.mock.calls[0];
    expect(options.headers).toEqual({});
    expect(options.params).toEqual({ days: 90, weeks: 12 });
    expect(res.statusCode).toBe(200);
  });

  test('uses an explicit upstream base when configured', async () => {
    process.env.VOQORA_API_BASE = 'http://localhost:4444/api/voqora';
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });

    await handler({ method: 'GET', query: {}, socket: loopback }, mockResponse());

    expect(axios.get.mock.calls[0][0]).toBe('http://localhost:4444/api/voqora/metrics');
  });

  test('clamps caller-controlled windows', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });

    await handler({ method: 'GET', query: { days: '99999', weeks: ['0'] }, socket: loopback }, mockResponse());

    expect(axios.get.mock.calls[0][1].params).toEqual({ days: 365, weeks: 1 });
  });

  test('relays upstream failures and status codes unchanged', async () => {
    axios.get.mockResolvedValueOnce({ status: 403, data: { error: { code: 'forbidden' } } });
    const res = mockResponse();

    await handler({ method: 'GET', query: {}, socket: loopback }, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { code: 'forbidden' } });
  });

  test('answers 502 when the website is unreachable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = mockResponse();

    await handler({ method: 'GET', query: {}, socket: loopback }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('upstream_unreachable');
    consoleError.mockRestore();
  });

  test('rejects non-GET methods without calling the website', async () => {
    const res = mockResponse();

    await handler({ method: 'POST', query: {}, socket: loopback }, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('marks responses private and non-sniffable', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const res = mockResponse();

    await handler({ method: 'GET', query: {}, socket: loopback }, res);

    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
  });

  describe('loopback guard', () => {
    test.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('serves %s', async (remoteAddress) => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { ok: true } });
      const res = mockResponse();

      await handler({ method: 'GET', query: {}, socket: { remoteAddress } }, res);

      expect(res.statusCode).toBe(200);
    });

    test.each(['192.168.1.20', '10.0.0.5', '203.0.113.9', '::ffff:192.168.1.20', 'fe80::1', undefined])(
      'refuses %s with 403 and never calls the website',
      async (remoteAddress) => {
        process.env.VOQORA_METRICS_TOKEN = 'secret-token';
        const res = mockResponse();

        await handler({ method: 'GET', query: {}, socket: { remoteAddress } }, res);

        expect(res.statusCode).toBe(403);
        expect(res.body.error.code).toBe('forbidden');
        expect(axios.get).not.toHaveBeenCalled();
        expect(JSON.stringify(res.body)).not.toContain('secret-token');
      },
    );

    test('refuses a request with no socket', async () => {
      const res = mockResponse();

      await handler({ method: 'GET', query: {} }, res);

      expect(res.statusCode).toBe(403);
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('ignores a spoofed x-forwarded-for header', async () => {
      const res = mockResponse();

      await handler({
        method: 'GET',
        query: {},
        headers: { 'x-forwarded-for': '127.0.0.1' },
        socket: { remoteAddress: '203.0.113.9' },
      }, res);

      expect(res.statusCode).toBe(403);
    });

    test('DASHBOARD_ALLOW_REMOTE=1 permits remote callers', async () => {
      process.env.DASHBOARD_ALLOW_REMOTE = '1';
      axios.get.mockResolvedValueOnce({ status: 200, data: {} });
      const res = mockResponse();

      await handler({ method: 'GET', query: {}, socket: { remoteAddress: '203.0.113.9' } }, res);

      expect(res.statusCode).toBe(200);
    });

    test.each(['0', 'true', ''])('DASHBOARD_ALLOW_REMOTE=%j does not open access', async (value) => {
      process.env.DASHBOARD_ALLOW_REMOTE = value;
      const res = mockResponse();

      await handler({ method: 'GET', query: {}, socket: { remoteAddress: '203.0.113.9' } }, res);

      expect(res.statusCode).toBe(403);
    });
  });
});
