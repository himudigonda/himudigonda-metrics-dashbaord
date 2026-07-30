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
      metrics_contract_version: '2026-07-30.1',
      overview: {
        voqora_reported_installations: 5,
        supersay_legacy_reported_installations: 1,
        portfolio_reported_installations: 6,
        opted_in_email_contacts: 2,
        download_clicks_total: 7,
        voqora_active_installations_today: 3,
        voqora_active_installations_7d: 4,
        voqora_generations_total: 9,
        voqora_audio_seconds_total: 10,
        migration_detected_total: 0,
        migration_completed_total: 0,
        legacy_app_removed_total: 0,
      },
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
    axios.get.mockResolvedValueOnce({ data: {
      metrics_contract_version: '2026-07-30.1',
      overview: {
        voqora_reported_installations: 0,
        supersay_legacy_reported_installations: 0,
        portfolio_reported_installations: 0,
        opted_in_email_contacts: 0,
        download_clicks_total: 0,
        voqora_active_installations_today: 0,
        voqora_active_installations_7d: 0,
        voqora_generations_total: 0,
        voqora_audio_seconds_total: 0,
        migration_detected_total: 0,
        migration_completed_total: 0,
        legacy_app_removed_total: 0,
      },
    } });
    const api = await freshClient();
    await api.fetchAllVoqora(30, 8);
    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:3000/api/voqora/metrics',
      { params: { days: 30, weeks: 8 } },
    );
  });

  test('fails clearly instead of displaying incompatible live metrics as zeros', async () => {
    axios.get.mockResolvedValueOnce({ data: {
      overview: { voqora_installations: 4 },
    } });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('older schema');
  });

  test('fails when the response advertises a different metrics contract', async () => {
    axios.get.mockResolvedValueOnce({ data: {
      metrics_contract_version: '2026-07-29.1',
      overview: {},
    } });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('older schema');
  });
});
