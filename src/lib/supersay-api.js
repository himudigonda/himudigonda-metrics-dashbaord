import axios from 'axios';

// Dashboard reads from himudigonda.me's /api/supersay/metrics/* endpoints.
// All endpoints are public, cacheable, never expose PII (the server-side
// migration's RLS keeps the user list out of `anon` reads).

const BASE = process.env.NEXT_PUBLIC_SUPERSAY_API_BASE
  || 'https://www.himudigonda.me/api/supersay';

export async function getOverview() {
  const { data } = await axios.get(`${BASE}/metrics/overview`);
  return data;
}

export async function getDaily(days = 90) {
  const { data } = await axios.get(`${BASE}/metrics/daily`, { params: { days } });
  return data;
}

export async function getVoices() {
  const { data } = await axios.get(`${BASE}/metrics/voices`);
  return data;
}

export async function getRetention(weeks = 12) {
  const { data } = await axios.get(`${BASE}/metrics/retention`, { params: { weeks } });
  return data;
}

export async function getAudiobookFunnel() {
  const { data } = await axios.get(`${BASE}/metrics/audiobook`);
  return data;
}

// Combined fetch helper for the dashboard page.
export async function fetchAllSupersay() {
  const [overview, daily, voices, retention, audiobook] = await Promise.all([
    getOverview(),
    getDaily(90),
    getVoices(),
    getRetention(12),
    getAudiobookFunnel(),
  ]);
  return { overview, daily, voices, retention, audiobook };
}
