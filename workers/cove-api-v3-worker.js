export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const path = '/' + new URL(request.url).pathname.split('/').filter(Boolean).join('/').toLowerCase();

    try {
      if (request.method === 'GET' && (path === '/health' || path === '/api/v1/health')) return await health(env, cors);
      if (request.method === 'POST' && path === '/api/v1/admin/import-seed') return await importSeed(env, cors);
      if (path === '/api/v1/boats') return await boats(request, env, cors);
      if (path.startsWith('/api/v1/boats/')) return await boatById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/settings') return await settings(request, env, cors);
      if (path === '/api/v1/media' || path === '/api/v1/media/upload' || path === '/media/upload' || path === '/upload-media') return await uploadMedia(request, env, cors);
      return json({ error: 'Not found', path }, 404, cors);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500, cors);
    }
  }
};

async function health(env, cors) {
  requireDb(env);
  const result = await env.DB.prepare('SELECT 1 AS ok').first();
  return json({ ok: true, service: 'cove-api', version: '0.3.3', d1: result?.ok === 1 }, 200, cors);
}

async function settings(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM settings ORDER BY key').all();
    return json(rows.results || [], 200, cors);
  }
  if (request.method === 'PUT') {
    const body = await request.json();
    await env.DB.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').bind(String(body.value), body.key).run();
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function boats(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM boats ORDER BY featured DESC, name ASC').all();
    return json((rows.results || []).map(outBoat), 200, cors);
  }
  if (request.method === 'POST') {
    const boat = await request.json();
    const id = boat.id || `boat_${crypto.randomUUID()}`;
    await upsertBoat(env, { ...boat, id });
    return json({ ok: true, id }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function boatById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM boats WHERE id = ?').bind(id).first();
    return row ? json(outBoat(row), 200, cors) : json({ error: 'Boat not found' }, 404, cors);
  }
  if (request.method === 'PUT') {
    const boat = await request.json();
    await upsertBoat(env, { ...boat, id });
    return json({ ok: true, id }, 200, cors);
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM boats WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }
  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function importSeed(env, cors) {
  requireDb(env);
  const seed = await readSeedJson(env);
  let imported = 0;

  for (const boat of seed) {
    await upsertBoat(env, boat);
    await env.DB.prepare('INSERT OR IGNORE INTO boat_pricing (id, boat_id, plan_name, duration_hours, base_fee) VALUES (?, ?, ?, ?, ?)')
      .bind(`price_${boat.id}_4h`, boat.id, '4 hour', 4, Number(boat.startingPrice || 0))
      .run();
    imported += 1;
  }

  return json({ ok: true, imported }, 200, cors);
}

async function upsertBoat(env, boat) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO boats (
      id, owner_id, slug, name, status, lifecycle_status, booking_enabled, featured,
      home_port, length_ft, capacity, bedrooms, bathrooms, make, model, boat_type,
      short_description, source_listing_url, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    boat.id, boat.ownerId || null, boat.slug, boat.name, boat.status || 'draft', boat.lifecycleStatus || 'draft', boat.bookingEnabled ? 1 : 0, boat.featured ? 1 : 0, boat.homePort || null, boat.lengthFt || null, boat.capacity || null, boat.bedrooms || 0, boat.bathrooms || 0, boat.make || null, boat.model || null, boat.type || null, boat.shortDescription || null, boat.sourceListingUrl || null
  ).run();
}

function outBoat(row) {
  return { id: row.id, ownerId: row.owner_id, slug: row.slug, name: row.name, status: row.status, lifecycleStatus: row.lifecycle_status, bookingEnabled: Boolean(row.booking_enabled), featured: Boolean(row.featured), homePort: row.home_port, lengthFt: row.length_ft, capacity: row.capacity, bedrooms: row.bedrooms, bathrooms: row.bathrooms, make: row.make, model: row.model, type: row.boat_type, shortDescription: row.short_description, sourceListingUrl: row.source_listing_url };
}

async function uploadMedia(request, env, cors) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'Missing file field' }, 400, cors);
  const entityType = cleanSegment(form.get('entityType') || 'misc');
  const entitySlug = cleanSegment(form.get('entitySlug') || 'unsorted');
  const mediaType = cleanSegment(form.get('mediaType') || 'photos');
  if (file.size > Number(env.MAX_UPLOAD_BYTES || 15728640)) return json({ error: 'File too large' }, 413, cors);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const path = `assets/${entityType}/${entitySlug}/${mediaType}/${stamp}-${cleanFilename(file.name || 'upload.bin')}`;
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT', headers: githubHeaders(env), body: JSON.stringify({ message: `Upload media: ${path}`, content: toBase64(await file.arrayBuffer()), branch: env.GITHUB_BRANCH || 'main' }) });
  if (!response.ok) throw new Error(await response.text());
  return json({ ok: true, path, url: `/${path}` }, 200, cors);
}

async function readSeedJson(env) {
  const urls = [
    `https://${env.GITHUB_OWNER}.github.io/${env.GITHUB_REPO}/data/boats.json`,
    `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || 'main'}/data/boats.json`
  ];
  let lastError = '';
  for (const url of urls) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) return await response.json();
    lastError = `${response.status} ${response.statusText} from ${url}`;
  }
  throw new Error(`Could not read seed boats.json: ${lastError}`);
}

function requireDb(env) { if (!env.DB) throw new Error('D1 binding DB is not configured'); }
function githubHeaders(env) { return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'cove-api' }; }
function corsHeaders(request, env) { const allowed = (env.ALLOWED_ORIGINS || 'https://jeffrwinters.github.io,https://covecharters.com,https://www.covecharters.com').split(',').map(item => item.trim()); const origin = request.headers.get('Origin') || ''; return { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }; }
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value, null, 2), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
function cleanSegment(value) { return String(value).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
function cleanFilename(value) { const parts = String(value).split('.'); const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'; return `${cleanSegment(parts.join('.') || 'upload')}.${ext}`; }
function toBase64(buffer) { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
