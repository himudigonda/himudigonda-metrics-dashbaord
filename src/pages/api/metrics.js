import axios from 'axios';

const DEFAULT_BASE = 'https://himudigonda.me/api/voqora';
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const isAllowedCaller = (req) => (
  process.env.DASHBOARD_ALLOW_REMOTE === '1' || LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress)
);

const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!isAllowedCaller(req)) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Metrics are available from this machine only.' } });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use GET.' } });
  }

  const base = process.env.VOQORA_API_BASE || DEFAULT_BASE;
  const token = process.env.VOQORA_METRICS_TOKEN;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const params = {
    days: boundedInteger(req.query?.days, 90, 1, 365),
    weeks: boundedInteger(req.query?.weeks, 12, 1, 52),
  };

  try {
    const upstream = await axios.get(`${base}/metrics`, {
      params,
      headers,
      timeout: 20000,
      validateStatus: () => true,
    });
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    console.error('Metrics proxy failed:', error?.message || error);
    return res.status(502).json({ error: { code: 'upstream_unreachable', message: 'Could not reach the metrics service.' } });
  }
}
