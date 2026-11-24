const CONNECT_URL = 'https://mlnwcpbeqianfnymfvsh.supabase.co';
const CONNECT_KEY = 'sb_publishable_Tvl_uX7nVYksNf4D6BZR5g_b6tNnSan';
const CONNECT_ENDPOINT = CONNECT_URL + '/functions/v1/connect';
function connectRequest(action, data={}, token='') {
  const headers = {'Content-Type':'application/json','apikey':CONNECT_KEY};
  if(token) headers.Authorization='Bearer '+token;
  return fetch(CONNECT_ENDPOINT,{method:'POST',headers,body:JSON.stringify({...data,action})});
}
