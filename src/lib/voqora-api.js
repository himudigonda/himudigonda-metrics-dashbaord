import axios from 'axios';

// Aggregate-only Voqora product metrics. The browser never receives an email,
// anonymous install ID, document text, or individual event.
const BASE = process.env.NEXT_PUBLIC_VOQORA_API_BASE
  || 'https://himudigonda.me/api/voqora';

const EXPECTED_METRICS_CONTRACT_VERSION = '2026-07-30.1';

const requiredOverviewFields = [
  'voqora_reported_installations',
  'supersay_legacy_reported_installations',
  'portfolio_reported_installations',
  'opted_in_email_contacts',
  'download_clicks_total',
  'voqora_active_installations_today',
  'voqora_active_installations_7d',
  'voqora_generations_total',
  'voqora_audio_seconds_total',
  'migration_detected_total',
  'migration_completed_total',
  'legacy_app_removed_total',
];

function assertMetricsContract(data) {
  if (!data || typeof data !== 'object' || !data.overview || typeof data.overview !== 'object') {
    throw new Error('The Voqora metrics service returned an invalid response.');
  }

  if (data.metrics_contract_version !== EXPECTED_METRICS_CONTRACT_VERSION) {
    throw new Error(
      'The Voqora metrics service is using an older schema. Deploy the matching website and database migration before trusting this dashboard.',
    );
  }

  const missing = requiredOverviewFields.filter((field) => !(field in data.overview));
  if (missing.length) {
    throw new Error(
      'The Voqora metrics service is using an older schema. Deploy the matching website and database migration before trusting this dashboard.',
    );
  }

  for (const field of requiredOverviewFields) {
    if (!Number.isFinite(Number(data.overview[field]))) {
      throw new Error(`The Voqora metrics service returned an invalid ${field} value.`);
    }
  }

  return data;
}

export async function fetchAllVoqora(days = 90, weeks = 12) {
  const { data } = await axios.get(`${BASE}/metrics`, { params: { days, weeks } });
  return assertMetricsContract(data);
}
