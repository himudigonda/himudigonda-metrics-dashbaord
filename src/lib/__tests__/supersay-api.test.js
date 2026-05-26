/**
 * Tests for the dashboard's SuperSay API client.
 *
 * We mock axios at the module boundary so no real network calls fire.
 * The contract under test:
 *  - Each `getX()` hits the documented path.
 *  - Query params (days, weeks) are forwarded.
 *  - `fetchAllSupersay` parallelises the 5 fetches and returns them in
 *    the documented shape.
 *  - NEXT_PUBLIC_SUPERSAY_API_BASE override works.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';

async function freshClient() {
  // Re-import the module so the env override is picked up on each test.
  vi.resetModules();
  return await import('../supersay-api.js');
}

beforeEach(() => {
  axios.get.mockReset();
  delete process.env.NEXT_PUBLIC_SUPERSAY_API_BASE;
});

describe('individual fetchers', () => {
  test('getOverview hits /metrics/overview on the default base', async () => {
    axios.get.mockResolvedValueOnce({ data: { users_total: 5 } });
    const api = await freshClient();
    const r = await api.getOverview();
    expect(axios.get).toHaveBeenCalledWith(
      'https://www.himudigonda.me/api/supersay/metrics/overview'
    );
    expect(r).toEqual({ users_total: 5 });
  });

  test('getDaily forwards days param', async () => {
    axios.get.mockResolvedValueOnce({ data: { days: 30 } });
    const api = await freshClient();
    await api.getDaily(30);
    expect(axios.get).toHaveBeenCalledWith(
      'https://www.himudigonda.me/api/supersay/metrics/daily',
      { params: { days: 30 } }
    );
  });

  test('getDaily defaults to 90 days', async () => {
    axios.get.mockResolvedValueOnce({ data: {} });
    const api = await freshClient();
    await api.getDaily();
    expect(axios.get.mock.calls[0][1].params.days).toBe(90);
  });

  test('getVoices hits /metrics/voices', async () => {
    axios.get.mockResolvedValueOnce({ data: { voices: [] } });
    const api = await freshClient();
    await api.getVoices();
    expect(axios.get).toHaveBeenCalledWith(
      'https://www.himudigonda.me/api/supersay/metrics/voices'
    );
  });

  test('getRetention forwards weeks param', async () => {
    axios.get.mockResolvedValueOnce({ data: { cohorts: [] } });
    const api = await freshClient();
    await api.getRetention(8);
    expect(axios.get).toHaveBeenCalledWith(
      'https://www.himudigonda.me/api/supersay/metrics/retention',
      { params: { weeks: 8 } }
    );
  });

  test('getRetention defaults to 12 weeks', async () => {
    axios.get.mockResolvedValueOnce({ data: {} });
    const api = await freshClient();
    await api.getRetention();
    expect(axios.get.mock.calls[0][1].params.weeks).toBe(12);
  });

  test('getAudiobookFunnel hits /metrics/audiobook', async () => {
    axios.get.mockResolvedValueOnce({ data: { uploads: 0 } });
    const api = await freshClient();
    await api.getAudiobookFunnel();
    expect(axios.get).toHaveBeenCalledWith(
      'https://www.himudigonda.me/api/supersay/metrics/audiobook'
    );
  });
});

describe('env override', () => {
  test('NEXT_PUBLIC_SUPERSAY_API_BASE is honored', async () => {
    process.env.NEXT_PUBLIC_SUPERSAY_API_BASE = 'http://localhost:3000/api/supersay';
    axios.get.mockResolvedValueOnce({ data: {} });
    const api = await freshClient();
    await api.getOverview();
    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:3000/api/supersay/metrics/overview'
    );
  });
});

describe('fetchAllSupersay', () => {
  test('parallelises and returns documented shape', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('overview')) return { data: { users_total: 10 } };
      if (url.endsWith('daily')) return { data: { series: [] } };
      if (url.endsWith('voices')) return { data: { voices: [] } };
      if (url.endsWith('retention')) return { data: { cohorts: [] } };
      if (url.endsWith('audiobook')) return { data: { uploads: 0 } };
      throw new Error(`unexpected URL: ${url}`);
    });
    const api = await freshClient();
    const res = await api.fetchAllSupersay();
    expect(Object.keys(res).sort()).toEqual(
      ['audiobook', 'daily', 'overview', 'retention', 'voices']
    );
    expect(res.overview).toEqual({ users_total: 10 });
    expect(axios.get).toHaveBeenCalledTimes(5);
  });

  test('propagates errors from any of the 5 fetches', async () => {
    axios.get.mockImplementation((url) =>
      url.endsWith('retention')
        ? Promise.reject(new Error('retention 500'))
        : Promise.resolve({ data: {} })
    );
    const api = await freshClient();
    await expect(api.fetchAllSupersay()).rejects.toThrow('retention 500');
  });
});
