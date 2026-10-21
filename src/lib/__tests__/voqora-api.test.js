import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';

async function freshClient() {
  vi.resetModules();
  return import('../voqora-api.js');
}

beforeEach(() => {
  axios.get.mockReset();
});

const overview = () => ({
  voqora_reported_installations: 5,
  opted_in_email_contacts: 2,
  download_clicks_total: 7,
  voqora_active_installations_today: 3,
  voqora_active_installations_7d: 4,
  voqora_generations_total: 9,
  voqora_audio_seconds_total: 10,
});

describe('Voqora metrics client', () => {
  test('loads the complete aggregate dashboard payload from the Voqora endpoint', async () => {
    const payload = {
      metrics_contract_version: '2026-10-20.3',
      overview: {
        voqora_reported_installations: 5,
        opted_in_email_contacts: 2,
        download_clicks_total: 7,
        voqora_active_installations_today: 3,
        voqora_active_installations_7d: 4,
        voqora_generations_total: 9,
        voqora_audio_seconds_total: 10,
      },
      daily: { series: [] },
    };
    axios.get.mockResolvedValueOnce({ data: payload });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).resolves.toMatchObject(payload);
    expect(axios.get).toHaveBeenCalledWith(
      '/api/metrics',
      { params: { days: 90, weeks: 12 } },
    );
  });

  test('requests the same-origin proxy with the requested windows', async () => {
    axios.get.mockResolvedValueOnce({ data: {
      metrics_contract_version: '2026-10-20.3',
      overview: {
        voqora_reported_installations: 0,
        opted_in_email_contacts: 0,
        download_clicks_total: 0,
        voqora_active_installations_today: 0,
        voqora_active_installations_7d: 0,
        voqora_generations_total: 0,
        voqora_audio_seconds_total: 0,
      },
    } });
    const api = await freshClient();
    await api.fetchAllVoqora(30, 8);
    expect(axios.get).toHaveBeenCalledWith(
      '/api/metrics',
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
      metrics_contract_version: '2026-07-30.2',
      overview: {},
    } });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('older schema');
  });

  test('turns an API schema-mismatch response into the same clear dashboard block', async () => {
    axios.get.mockRejectedValueOnce({
      response: { data: { error: { code: 'metrics_schema_mismatch' } } },
    });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('older schema');
  });

  test('turns a 403 into an actionable token message', async () => {
    axios.get.mockRejectedValueOnce({
      response: { status: 403, data: { error: { code: 'forbidden' } } },
    });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('VOQORA_METRICS_TOKEN');
  });

  test('rethrows unrelated transport errors', async () => {
    axios.get.mockRejectedValueOnce(new Error('network down'));
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('network down');
  });

  test('rejects an overview value that is not numeric', async () => {
    axios.get.mockResolvedValueOnce({ data: { metrics_contract_version: '2026-10-20.3', overview: { ...overview(), voqora_generations_total: 'many' } } });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('invalid voqora_generations_total');
  });

  test('rejects a response with no overview', async () => {
    axios.get.mockResolvedValueOnce({ data: { metrics_contract_version: '2026-10-20.3' } });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('invalid response');
  });

  test('rejects the previous contract version', async () => {
    axios.get.mockResolvedValueOnce({ data: { metrics_contract_version: '2026-07-30.2', overview: overview() } });
    const api = await freshClient();
    await expect(api.fetchAllVoqora()).rejects.toThrow('older schema');
  });

  test('treats absent v3 sections as null with an empty degraded list', async () => {
    axios.get.mockResolvedValueOnce({ data: { metrics_contract_version: '2026-10-20.3', overview: overview() } });
    const api = await freshClient();
    const metrics = await api.fetchAllVoqora();
    for (const section of ['engines', 'sources', 'dictation', 'ai', 'adoption', 'creation', 'relay', 'versions', 'daily_usage']) {
      expect(metrics[section]).toBeNull();
    }
    expect(metrics.degraded).toEqual([]);
  });

  test('keeps null sections and the degraded list reported by the website', async () => {
    axios.get.mockResolvedValueOnce({ data: {
      metrics_contract_version: '2026-10-20.3',
      overview: overview(),
      engines: null,
      creation: null,
      degraded: ['engines', 'creation', 7],
    } });
    const api = await freshClient();
    const metrics = await api.fetchAllVoqora();
    expect(metrics.engines).toBeNull();
    expect(metrics.creation).toBeNull();
    expect(metrics.degraded).toEqual(['engines', 'creation']);
  });

  test('parses populated v3 sections and coerces malformed values defensively', async () => {
    axios.get.mockResolvedValueOnce({ data: {
      metrics_contract_version: '2026-10-20.3',
      overview: overview(),
      engines: { engines: [
        { engine: 'kokoro', generations: '10', audio_seconds: 99, first_audio_ms_p50: 210, first_audio_ms_p90: null, failures: 1, failure_rate: '9.1' },
        'garbage',
        { generations: 'NaN' },
      ] },
      sources: { sources: [{ source: 'selection', generations: 6, distinct_actors: 2 }, { source: 'clipboard', generations: 4, distinct_actors: 1 }] },
      dictation: { days: 90, series: [{ date: '2026-10-19', sessions: 3, words: 120, pasted: 2, copied: 1 }] },
      ai: { tools: [{ tool: 'summarize', provider: 'ollama', requests: 5, ok_rate: 80, p50_latency_ms: 1500 }, { tool: 'ask', provider: 'openai', requests: 1 }] },
      adoption: { features: [{ feature: 'generation', actors_7d: 2, actors_30d: 3, share_of_active_30d: 100 }] },
      creation: { audiobooks_generated: 2, audiobooks_finished: '1', chapters: 20, audio_hours: 3.5, podcast_scripts: 4, podcast_renders: 3 },
      relay: { clients: [{ client: 'cursor', requests: 7, distinct_actors: 1 }] },
      versions: { versions: [{ app_version: '2.1.0', distinct_actors: 3 }] },
      daily_usage: { days: 90, series: [{ date: '2026-10-19', distinct_actors: 2, avg_listen_minutes: 12.5, avg_dictation_words: 80, avg_active_minutes: 30 }] },
      degraded: [],
    } });
    const api = await freshClient();
    const metrics = await api.fetchAllVoqora();
    expect(metrics.engines.engines).toEqual([
      { engine: 'kokoro', generations: 10, audio_seconds: 99, first_audio_ms_p50: 210, first_audio_ms_p90: null, failures: 1, failure_rate: 9.1 },
      { engine: 'unknown', generations: 0, audio_seconds: 0, first_audio_ms_p50: null, first_audio_ms_p90: null, failures: 0, failure_rate: null },
    ]);
    expect(metrics.sources.total).toBe(10);
    expect(metrics.dictation.series[0]).toMatchObject({ date: '2026-10-19', words: 120, pasted: 2, empty: 0 });
    expect(metrics.ai.total_requests).toBe(6);
    expect(metrics.ai.tools[1]).toMatchObject({ ok_rate: null, p50_latency_ms: null });
    expect(metrics.adoption.features[0].share_of_active_30d).toBe(100);
    expect(metrics.creation.audiobooks_finished).toBe(1);
    expect(metrics.relay.clients[0].client).toBe('cursor');
    expect(metrics.versions.versions[0].app_version).toBe('2.1.0');
    expect(metrics.daily_usage.series[0].avg_active_minutes).toBe(30);
  });

  test('turns a section whose list is missing into an empty list, not a crash', async () => {
    axios.get.mockResolvedValueOnce({ data: {
      metrics_contract_version: '2026-10-20.3',
      overview: overview(),
      engines: {},
      ai: { tools: 'nope' },
      creation: 'broken',
    } });
    const api = await freshClient();
    const metrics = await api.fetchAllVoqora();
    expect(metrics.engines.engines).toEqual([]);
    expect(metrics.ai).toMatchObject({ tools: [], total_requests: 0 });
    expect(metrics.creation).toBeNull();
  });
});
