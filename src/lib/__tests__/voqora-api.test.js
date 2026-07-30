import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';

async function freshClient() {
  vi.resetModules();
  return import('../voqora-api.js');
}

beforeEach(() => {
  axios.get.mockReset();
  delete process.env.NEXT_PUBLIC_VOQORA_API_BASE;
});

describe('Voqora metrics client', () => {
  test('loads the complete aggregate dashboard payload from the Voqora endpoint', async () => {
    const payload = {
      overview: { voqora_installations: 5, supersay_legacy_installations: 1 },
      daily: { series: [] },
    };
    axios.get.mockResolvedValueOnce({ data: payload });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).resolves.toEqual(payload);
    expect(axios.get).toHaveBeenCalledWith(
      'https://himudigonda.me/api/voqora/metrics',
      { params: { days: 90, weeks: 12 } },
    );
  });

  test('honours an explicit Voqora API base and requested windows', async () => {
    process.env.NEXT_PUBLIC_VOQORA_API_BASE = 'http://localhost:3000/api/voqora';
    axios.get.mockResolvedValueOnce({ data: {} });
    const api = await freshClient();
    await api.fetchAllVoqora(30, 8);
    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:3000/api/voqora/metrics',
      { params: { days: 30, weeks: 8 } },
    );
  });
});
