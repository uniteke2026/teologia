const CONNECT_URL = 'https://mlnwcpbeqianfnymfvsh.supabase.co';
const CONNECT_KEY = 'sb_publishable_Tvl_uX7nVYksNf4D6BZR5g_b6tNnSan';
const CONNECT_ENDPOINT = CONNECT_URL + '/functions/v1/connect';
function connectRequest(action, data={}, token='') {
  const headers = {'Content-Type':'application/json','apikey':CONNECT_KEY};
  if(token) headers.Authorization='Bearer '+token;
  return fetch(CONNECT_ENDPOINT,{method:'POST',headers,body:JSON.stringify({...data,action})});
}

function normalizeCompanySite(value) {
  if (typeof value !== 'string') throw Error('Informe um endereço de site válido.');
  const raw = value.trim();
  if (!raw) return '';
  if (raw.length > 500 || /[\s\x00-\x1f\x7f\\]/u.test(raw)) throw Error('Informe um endereço de site válido.');
  let parsed;
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) throw Error();
    parsed = new URL(candidate);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname.includes('.') || parsed.href.length > 500) throw Error();
  } catch { throw Error('Informe um site válido, como https://suaempresa.com.br.'); }
  return parsed.href;
}
