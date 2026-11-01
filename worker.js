// ЛИГА ТЮБИКОВ 3.4: Ежедневно 03:00 UTC (=08:00 Екатеринбург).
// Только secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// НИКОГДА не публиковать этот ключ в Cloudflare Pages.
export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(runLeague(env)); },
  async fetch() { return new Response('League 3.4 scheduler: configured', {status:200}); }
};
async function runLeague(env) {
  const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),key=env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base||!key) throw Error('Set both private Worker secrets');
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const post=async (name,args={})=>{
    const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args)});
    const txt=await r.text();if(!r.ok)throw Error(`${name}: HTTP ${r.status}: ${txt.slice(0,300)}`);return txt;
  };
  console.log('Weekly snapshots:',await post('tk_finalize_all_leagues'));
  // Snapshot INSERT triggers create exactly one TUBIK NEWS item for each closed week.
  const r=await fetch(`${base}/rest/v1/tk_teams?select=id`,{headers});
  if(!r.ok)throw Error('Teams query: '+r.status);
  for(const team of await r.json()) {
    console.log('Season cups for team:',team.id,await post('tk_finalize_seasons34',{p_team_id:team.id}));
  }
}
