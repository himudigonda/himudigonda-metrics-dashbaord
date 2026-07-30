import axios from 'axios';

// Aggregate-only Voqora product metrics. The browser never receives an email,
// anonymous install ID, document text, or individual event.
const BASE = process.env.NEXT_PUBLIC_VOQORA_API_BASE
  || 'https://himudigonda.me/api/voqora';

export async function fetchAllVoqora(days = 90, weeks = 12) {
  const { data } = await axios.get(`${BASE}/metrics`, { params: { days, weeks } });
  return data;
}
