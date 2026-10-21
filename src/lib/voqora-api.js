import axios from 'axios';

// Aggregate-only Voqora product metrics. The browser never receives an email,
// anonymous install ID, document text, or individual event. It also never
// receives the metrics token: requests go through the server-side /api/metrics
// proxy, which attaches it.
const ENDPOINT = '/api/metrics';

const EXPECTED_METRICS_CONTRACT_VERSION = '2026-10-20.3';

const OLDER_SCHEMA_MESSAGE = 'The Voqora metrics service is using an older schema. Deploy the matching website and database migration before trusting this dashboard.';

const requiredOverviewFields = [
  'voqora_reported_installations',
  'opted_in_email_contacts',
  'download_clicks_total',
  'voqora_active_installations_today',
  'voqora_active_installations_7d',
  'voqora_generations_total',
  'voqora_audio_seconds_total',
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const toNullableNumber = (value) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));
const toList = (value) => (Array.isArray(value) ? value.filter(isObject) : []);

const listSection = (section, key, mapRow) => {
  if (!isObject(section)) return null;
  return { ...section, [key]: toList(section[key]).map(mapRow) };
};

const normalizers = {
  engines: (section) => listSection(section, 'engines', (row) => ({
    engine: String(row.engine ?? 'unknown'),
    generations: toNumber(row.generations),
    audio_seconds: toNumber(row.audio_seconds),
    first_audio_ms_p50: toNullableNumber(row.first_audio_ms_p50),
    first_audio_ms_p90: toNullableNumber(row.first_audio_ms_p90),
    failures: toNumber(row.failures),
    failure_rate: toNullableNumber(row.failure_rate),
  })),
  sources: (section) => {
    const normalized = listSection(section, 'sources', (row) => ({
      source: String(row.source ?? 'unknown'),
      generations: toNumber(row.generations),
      distinct_actors: toNumber(row.distinct_actors),
    }));
    if (normalized) normalized.total = normalized.sources.reduce((sum, row) => sum + row.generations, 0);
    return normalized;
  },
  dictation: (section) => listSection(section, 'series', (row) => ({
    date: String(row.date ?? ''),
    sessions: toNumber(row.sessions),
    words: toNumber(row.words),
    audio_seconds: toNumber(row.audio_seconds),
    distinct_actors: toNumber(row.distinct_actors),
    pasted: toNumber(row.pasted),
    copied: toNumber(row.copied),
    copied_needs_accessibility: toNumber(row.copied_needs_accessibility),
    copied_app_changed: toNumber(row.copied_app_changed),
    cancelled: toNumber(row.cancelled),
    empty: toNumber(row.empty),
  })),
  ai: (section) => {
    const normalized = listSection(section, 'tools', (row) => ({
      tool: String(row.tool ?? 'unknown'),
      provider: String(row.provider ?? 'unknown'),
      requests: toNumber(row.requests),
      ok_rate: toNullableNumber(row.ok_rate),
      p50_latency_ms: toNullableNumber(row.p50_latency_ms),
    }));
    if (normalized) normalized.total_requests = normalized.tools.reduce((sum, row) => sum + row.requests, 0);
    return normalized;
  },
  adoption: (section) => listSection(section, 'features', (row) => ({
    feature: String(row.feature ?? 'unknown'),
    actors_7d: toNumber(row.actors_7d),
    actors_30d: toNumber(row.actors_30d),
    share_of_active_30d: toNullableNumber(row.share_of_active_30d),
  })),
  creation: (section) => (isObject(section)
    ? {
      audiobooks_generated: toNumber(section.audiobooks_generated),
      audiobooks_finished: toNumber(section.audiobooks_finished),
      chapters: toNumber(section.chapters),
      audio_hours: toNumber(section.audio_hours),
      podcast_scripts: toNumber(section.podcast_scripts),
      podcast_renders: toNumber(section.podcast_renders),
    }
    : null),
  relay: (section) => listSection(section, 'clients', (row) => ({
    client: String(row.client ?? 'unknown'),
    requests: toNumber(row.requests),
    distinct_actors: toNumber(row.distinct_actors),
  })),
  versions: (section) => listSection(section, 'versions', (row) => ({
    app_version: String(row.app_version ?? 'unknown'),
    distinct_actors: toNumber(row.distinct_actors),
  })),
  daily_usage: (section) => listSection(section, 'series', (row) => ({
    date: String(row.date ?? ''),
    distinct_actors: toNumber(row.distinct_actors),
    avg_listen_minutes: toNumber(row.avg_listen_minutes),
    avg_dictation_words: toNumber(row.avg_dictation_words),
    avg_active_minutes: toNumber(row.avg_active_minutes),
  })),
};

function normalizeMetrics(data) {
  const normalized = { ...data };
  for (const [section, normalize] of Object.entries(normalizers)) {
    normalized[section] = normalize(data[section]);
  }
  normalized.degraded = Array.isArray(data.degraded) ? data.degraded.filter((name) => typeof name === 'string') : [];
  return normalized;
}

function assertMetricsContract(data) {
  if (!data || typeof data !== 'object' || !data.overview || typeof data.overview !== 'object') {
    throw new Error('The Voqora metrics service returned an invalid response.');
  }

  if (data.metrics_contract_version !== EXPECTED_METRICS_CONTRACT_VERSION) {
    throw new Error(OLDER_SCHEMA_MESSAGE);
  }

  const missing = requiredOverviewFields.filter((field) => !(field in data.overview));
  if (missing.length) {
    throw new Error(OLDER_SCHEMA_MESSAGE);
  }

  for (const field of requiredOverviewFields) {
    if (!Number.isFinite(Number(data.overview[field]))) {
      throw new Error(`The Voqora metrics service returned an invalid ${field} value.`);
    }
  }

  return normalizeMetrics(data);
}

export async function fetchAllVoqora(days = 90, weeks = 12) {
  try {
    const { data } = await axios.get(ENDPOINT, { params: { days, weeks } });
    return assertMetricsContract(data);
  } catch (error) {
    const code = error?.response?.data?.error?.code;
    if (code === 'metrics_schema_mismatch') {
      throw new Error(OLDER_SCHEMA_MESSAGE);
    }
    if (code === 'forbidden' || error?.response?.status === 403) {
      throw new Error('The Voqora metrics service rejected the dashboard token. Set VOQORA_METRICS_TOKEN to match the website.');
    }
    throw error;
  }
}
