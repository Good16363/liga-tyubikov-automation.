// ЛИГА ТЮБИКОВ 3.6 — фоновый планировщик итогов.
// Cloudflare Worker secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Никогда не помещайте секреты в GitHub, Pages или исходники приложения.
const jsonHeaders = key => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json'
});

async function postRpc(base, headers, name, body = {}) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const output = await response.text();
  if (!response.ok) {
    throw Error(`Supabase RPC ${name}: HTTP ${response.status}: ${output.slice(0, 400)}`);
  }
  return output;
}

async function runLeague(env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw Error('Worker secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(base)) {
    throw Error('SUPABASE_URL must be a Supabase HTTPS project URL');
  }
  const headers = jsonHeaders(key);
  // RPC появится после SQL 3.3; вызывать только после миграции базы до 3.6.
  const finalizedWeeks = await postRpc(base, headers, 'tk_finalize_all_leagues');
  console.log('Finalized weekly snapshots:', finalizedWeeks);

  const r = await fetch(`${base}/rest/v1/tk_teams?select=id`, { headers });
  if (!r.ok) throw Error(`Supabase tk_teams: HTTP ${r.status}`);
  const teams = await r.json();
  if (!Array.isArray(teams)) throw Error('Invalid team response');
  let finalizedSeasons = 0;
  for (const team of teams) {
    if (typeof team.id !== 'string') continue;
    const value = await postRpc(base, headers, 'tk_finalize_seasons34', { p_team_id: team.id });
    finalizedSeasons += Number(value) || 0;
  }
  console.log('Teams checked:', teams.length, 'Seasons finalized:', finalizedSeasons);
}

export default {
  async fetch() {
    // Без публичного endpoint для ручного запуска, чтобы исключить злоупотребления.
    return new Response('ЛИГА ТЮБИКОВ: серверный планировщик доступен', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runLeague(env));
  }
};
