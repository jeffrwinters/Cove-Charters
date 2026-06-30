export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const path = '/' + new URL(request.url).pathname.split('/').filter(Boolean).join('/').toLowerCase();

    try {
      if (request.method === 'GET' && (path === '/health' || path === '/api/v1/health')) return await health(env, cors);
      if (request.method === 'POST' && path === '/api/v1/admin/import-seed') {
        const auth = requireAdmin(request, env);
        if (auth) return json(auth.body, auth.status, cors);
        return await importSeed(env, cors);
      }
      if (path === '/api/v1/boats') return await boats(request, env, cors);
      if (path.match(/^\/api\/v1\/boats\/[^/]+\/captains$/)) return await boatCaptains(request, env, cors, path.split('/')[4]);
      if (path.startsWith('/api/v1/boats/')) return await boatById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/captains') return await captains(request, env, cors);
      if (path.startsWith('/api/v1/captains/')) return await captainById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/settings') return await settings(request, env, cors);
      if (path === '/api/v1/media') return await media(request, env, cors);
      if (path.startsWith('/api/v1/media/')) return await mediaById(request, env, cors, path.split('/').pop());
      if (path === '/api/v1/media/upload' || path === '/media/upload' || path === '/upload-media') return await uploadMedia(request, env, cors);
      return json({ error: 'Not found', path }, 404, cors);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500, cors);
    }
  }
};

async function health(env, cors) {
  requireDb(env);
  const result = await env.DB.prepare('SELECT 1 AS ok').first();
  return json({ ok: true, service: 'cove-api', version: '0.3.12', d1: result?.ok === 1, adminAuth: Boolean(env.ADMIN_TOKEN) }, 200, cors);
}

async function settings(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM settings ORDER BY key').all();
    return json(rows.results || [], 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    await env.DB.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').bind(String(body.value), body.key).run();
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function boats(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT b.*,
        (SELECT base_fee FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS starting_price,
        (SELECT plan_name FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS price_unit,
        (SELECT GROUP_CONCAT(captain_id) FROM boat_captains WHERE boat_id = b.id AND status = 'approved') AS approved_captain_ids,
        (SELECT url FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_url,
        (SELECT title FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_title,
        (SELECT alt FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_alt
      FROM boats b
      ORDER BY featured DESC, name ASC
    `).all();
    return json((rows.results || []).map(outBoat), 200, cors);
  }
  if (request.method === 'POST') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
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
    const row = await env.DB.prepare(`
      SELECT b.*,
        (SELECT base_fee FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS starting_price,
        (SELECT plan_name FROM boat_pricing WHERE boat_id = b.id AND active = 1 ORDER BY duration_hours LIMIT 1) AS price_unit,
        (SELECT GROUP_CONCAT(captain_id) FROM boat_captains WHERE boat_id = b.id AND status = 'approved') AS approved_captain_ids,
        (SELECT url FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_url,
        (SELECT title FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_title,
        (SELECT alt FROM media WHERE entity_type = 'boat' AND entity_id = b.id AND media_type = 'photos' ORDER BY is_cover DESC, sort_order ASC, created_at ASC LIMIT 1) AS cover_photo_alt
      FROM boats b
      WHERE b.id = ? OR b.slug = ?
    `).bind(id, id).first();
    return row ? json(outBoat(row), 200, cors) : json({ error: 'Boat not found' }, 404, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const boat = await request.json();
    await upsertBoat(env, { ...boat, id });
    return json({ ok: true, id }, 200, cors);
  }
  if (request.method === 'DELETE') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
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
    await env.DB.prepare('INSERT OR REPLACE INTO boat_pricing (id, boat_id, plan_name, duration_hours, base_fee) VALUES (?, ?, ?, ?, ?)')
      .bind(`price_${boat.id}_4h`, boat.id, boat.priceUnit || '4 hour', 4, Number(boat.startingPrice || 0))
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
    boat.id,
    boat.ownerId || null,
    boat.slug,
    boat.name,
    boat.status || 'draft',
    boat.lifecycleStatus || 'draft',
    boat.bookingEnabled ? 1 : 0,
    boat.featured ? 1 : 0,
    boat.homePort || null,
    boat.lengthFt || null,
    boat.capacity || null,
    boat.bedrooms || 0,
    boat.bathrooms || 0,
    boat.make || null,
    boat.model || null,
    boat.type || null,
    boat.shortDescription || null,
    boat.sourceListingUrl || null
  ).run();

  if (boat.startingPrice !== undefined || boat.priceUnit) {
    await env.DB.prepare('INSERT OR REPLACE INTO boat_pricing (id, boat_id, plan_name, duration_hours, base_fee) VALUES (?, ?, ?, ?, ?)')
      .bind(`price_${boat.id}_4h`, boat.id, boat.priceUnit || '4 hour', 4, Number(boat.startingPrice || 0))
      .run();
  }
}

function outBoat(row) {
  const boat = {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    bookingEnabled: Boolean(row.booking_enabled),
    featured: Boolean(row.featured),
    homePort: row.home_port,
    lengthFt: row.length_ft,
    capacity: row.capacity,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    make: row.make,
    model: row.model,
    type: row.boat_type,
    shortDescription: row.short_description,
    sourceListingUrl: row.source_listing_url,
    startingPrice: row.starting_price || 0,
    priceUnit: row.price_unit || 'charter',
    detailUrl: `boat.html?boat=${encodeURIComponent(row.slug || row.id)}`,
    media: {
      photos: row.cover_photo_url ? [{
        url: row.cover_photo_url,
        title: row.cover_photo_title,
        alt: row.cover_photo_alt,
        isCover: true,
        sortOrder: 0
      }] : [],
      videos: []
    },
    coverPhoto: row.cover_photo_url ? {
      url: row.cover_photo_url,
      title: row.cover_photo_title,
      alt: row.cover_photo_alt
    } : null,
    approvedCaptainIds: row.approved_captain_ids ? String(row.approved_captain_ids).split(',').filter(Boolean) : []
  };
  return { ...boat, ...marketingFields(boat) };
}

async function captains(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM boat_captains bc WHERE bc.captain_id = c.id AND bc.status = 'approved') AS approved_boat_count
      FROM captains c
      ORDER BY status = 'active' DESC, name ASC
    `).all();
    return json((rows.results || []).map(outCaptain), 200, cors);
  }
  if (request.method === 'POST') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const captain = await request.json();
    const id = captain.id || `captain_${crypto.randomUUID()}`;
    await upsertCaptain(env, { ...captain, id });
    return json({ ok: true, id }, 201, cors);
  }
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function captainById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM boat_captains bc WHERE bc.captain_id = c.id AND bc.status = 'approved') AS approved_boat_count
      FROM captains c
      WHERE c.id = ?
    `).bind(id).first();
    return row ? json(outCaptain(row), 200, cors) : json({ error: 'Captain not found' }, 404, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const captain = await request.json();
    await upsertCaptain(env, { ...captain, id });
    return json({ ok: true, id }, 200, cors);
  }
  if (request.method === 'DELETE') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    await env.DB.prepare('DELETE FROM boat_captains WHERE captain_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM captains WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }
  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function boatCaptains(request, env, cors, boatId) {
  requireDb(env);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT c.*, bc.status AS approval_status, bc.notes AS approval_notes
      FROM captains c
      INNER JOIN boat_captains bc ON bc.captain_id = c.id
      WHERE bc.boat_id = ? AND bc.status = 'approved'
      ORDER BY c.name ASC
    `).bind(boatId).all();
    return json((rows.results || []).map(outCaptain), 200, cors);
  }
  if (request.method === 'PUT') {
    const auth = requireAdmin(request, env);
    if (auth) return json(auth.body, auth.status, cors);
    const body = await request.json();
    const captainIds = unique(Array.isArray(body.captainIds) ? body.captainIds.map(String) : []);
    await env.DB.prepare('DELETE FROM boat_captains WHERE boat_id = ?').bind(boatId).run();
    for (const captainId of captainIds) {
      await env.DB.prepare('INSERT OR REPLACE INTO boat_captains (boat_id, captain_id, status, notes) VALUES (?, ?, ?, ?)')
        .bind(boatId, captainId, 'approved', null)
        .run();
    }
    return json({ ok: true, boatId, captainIds }, 200, cors);
  }
  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function upsertCaptain(env, captain) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO captains (
      id, name, status, credential, email, phone, bio, home_port, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    captain.id,
    captain.name || 'New Captain',
    captain.status || 'draft',
    captain.credential || null,
    captain.email || null,
    captain.phone || null,
    captain.bio || null,
    captain.homePort || captain.home_port || null
  ).run();
}

function outCaptain(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    credential: row.credential,
    email: row.email,
    phone: row.phone,
    bio: row.bio,
    homePort: row.home_port,
    approvedBoatCount: Number(row.approved_boat_count || 0),
    approvalStatus: row.approval_status,
    approvalNotes: row.approval_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function marketingFields(boat) {
  const type = String(boat.type || '').toLowerCase();
  const capacity = Number(boat.capacity || 0);
  const bedrooms = Number(boat.bedrooms || 0);
  const bathrooms = Number(boat.bathrooms || 0);
  const vibe = [];
  const priorityTags = [];
  const amenities = ['Captain required'];

  if (capacity >= 7) {
    vibe.push('large-group');
    priorityTags.push('space');
    amenities.push('Large-group layout');
  } else {
    vibe.push('small');
    priorityTags.push('sport');
  }
  if (type.includes('sundancer') || type.includes('yacht') || type.includes('premium')) {
    vibe.push('premium');
    priorityTags.push('comfort');
    amenities.push('Premium seating');
  }
  if (type.includes('sport') || type.includes('runabout') || type.includes('bowrider')) {
    vibe.push('sport');
    amenities.push('Swim platform');
  }
  if (capacity >= 10 || boat.featured) vibe.push('party');
  if (bedrooms > 0) {
    vibe.push('family');
    amenities.push('Cabin');
  }
  if (bathrooms > 0) amenities.push('Restroom');
  if (Number(boat.startingPrice || 0) <= 1100) priorityTags.push('value');
  if (boat.featured) priorityTags.push('premium');

  return { vibe: unique(vibe), priorityTags: unique(priorityTags), amenities: unique(amenities) };
}

async function media(request, env, cors) {
  requireDb(env);
  if (request.method === 'GET') return await listMedia(request, env, cors);
  if (request.method === 'POST') return await uploadMedia(request, env, cors);
  return json({ error: 'GET or POST required' }, 405, cors);
}

async function listMedia(request, env, cors) {
  const url = new URL(request.url);
  const entityType = normalizeEntityType(url.searchParams.get('entityType') || url.searchParams.get('entity_type') || '');
  const entityId = url.searchParams.get('entityId') || url.searchParams.get('entity_id') || '';
  const mediaTypeParam = url.searchParams.get('mediaType') || url.searchParams.get('media_type') || '';
  const mediaType = mediaTypeParam ? normalizeMediaType(mediaTypeParam) : '';
  const clauses = [];
  const values = [];

  if (entityType) {
    clauses.push('entity_type = ?');
    values.push(entityType);
  }
  if (entityId) {
    clauses.push('entity_id = ?');
    values.push(entityId);
  }
  if (mediaType) {
    clauses.push('media_type = ?');
    values.push(mediaType);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  let rows = await env.DB.prepare(`SELECT * FROM media ${where} ORDER BY is_cover DESC, sort_order ASC, created_at ASC`).bind(...values).all();
  if ((!rows.results || rows.results.length === 0) && entityType === 'boat' && entityId) {
    await backfillBoatMediaFromAssets(env, entityId, mediaType);
    rows = await env.DB.prepare(`SELECT * FROM media ${where} ORDER BY is_cover DESC, sort_order ASC, created_at ASC`).bind(...values).all();
  }
  return json((rows.results || []).map(outMedia), 200, cors);
}

async function uploadMedia(request, env, cors) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);
  requireDb(env);
  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'Missing file field' }, 400, cors);

  const entityType = normalizeEntityType(form.get('entityType') || form.get('entity_type') || 'misc');
  const entityId = String(form.get('entityId') || form.get('entity_id') || form.get('entitySlug') || form.get('entity_slug') || 'unsorted');
  const entitySlug = cleanSegment(form.get('entitySlug') || form.get('entity_slug') || entityId);
  const mediaType = normalizeMediaType(form.get('mediaType') || form.get('media_type') || 'photos');
  if (file.size > Number(env.MAX_UPLOAD_BYTES || 15728640)) return json({ error: 'File too large' }, 413, cors);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const path = `assets/${cleanSegment(entityType)}s/${entitySlug}/${mediaType}/${stamp}-${cleanFilename(file.name || 'upload.bin')}`;
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT', headers: githubHeaders(env), body: JSON.stringify({ message: `Upload media: ${path}`, content: toBase64(await file.arrayBuffer()), branch: env.GITHUB_BRANCH || 'main' }) });
  const uploaded = await response.json();
  if (!response.ok) throw new Error(uploaded.message || JSON.stringify(uploaded));

  const mediaId = `media_${crypto.randomUUID()}`;
  const publicUrl = uploaded.content?.download_url || `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || 'main'}/${path}`;
  const title = String(form.get('title') || file.name || 'Uploaded media');
  const alt = String(form.get('alt') || title);
  const nextSort = await nextMediaSort(env, entityType, entityId, mediaType);
  const shouldCover = mediaType === 'photos' && (truthy(form.get('isCover') || form.get('is_cover')) || await hasNoCover(env, entityType, entityId));

  if (shouldCover) await clearCover(env, entityType, entityId);
  await env.DB.prepare(`
    INSERT INTO media (id, entity_type, entity_id, media_type, url, title, alt, sort_order, is_cover)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(mediaId, entityType, entityId, mediaType, publicUrl, title, alt, nextSort, shouldCover ? 1 : 0).run();

  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(mediaId).first();
  return json({ ok: true, path, url: publicUrl, media: outMedia(row) }, 200, cors);
}

async function mediaById(request, env, cors, id) {
  requireDb(env);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    return row ? json(outMedia(row), 200, cors) : json({ error: 'Media not found' }, 404, cors);
  }

  const auth = requireAdmin(request, env);
  if (auth) return json(auth.body, auth.status, cors);

  if (request.method === 'PUT') {
    const current = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Media not found' }, 404, cors);

    const body = await request.json();
    const next = {
      title: body.title ?? current.title,
      alt: body.alt ?? current.alt,
      sortOrder: body.sortOrder ?? body.sort_order ?? current.sort_order,
      isCover: body.isCover ?? body.is_cover ?? Boolean(current.is_cover)
    };

    if (truthy(next.isCover)) await clearCover(env, current.entity_type, current.entity_id);
    await env.DB.prepare('UPDATE media SET title = ?, alt = ?, sort_order = ?, is_cover = ? WHERE id = ?')
      .bind(String(next.title || ''), String(next.alt || ''), Number(next.sortOrder || 0), truthy(next.isCover) ? 1 : 0, id)
      .run();
    const updated = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    return json({ ok: true, media: outMedia(updated) }, 200, cors);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    return json({ ok: true, id }, 200, cors);
  }

  return json({ error: 'GET, PUT, or DELETE required' }, 405, cors);
}

async function nextMediaSort(env, entityType, entityId, mediaType) {
  const row = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM media WHERE entity_type = ? AND entity_id = ? AND media_type = ?').bind(entityType, entityId, mediaType).first();
  return Number(row?.next_sort || 0);
}

async function hasNoCover(env, entityType, entityId) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM media WHERE entity_type = ? AND entity_id = ? AND media_type = ? AND is_cover = 1').bind(entityType, entityId, 'photos').first();
  return Number(row?.count || 0) === 0;
}

async function clearCover(env, entityType, entityId) {
  await env.DB.prepare('UPDATE media SET is_cover = 0 WHERE entity_type = ? AND entity_id = ?').bind(entityType, entityId).run();
}

async function backfillBoatMediaFromAssets(env, boatId, requestedMediaType) {
  const boat = await env.DB.prepare('SELECT id, slug FROM boats WHERE id = ? OR slug = ?').bind(boatId, boatId).first();
  if (!boat?.slug) return;

  const mediaTypes = requestedMediaType ? [requestedMediaType] : ['photos', 'videos'];
  for (const mediaType of mediaTypes) {
    const files = await githubDirectory(env, `assets/boats/${boat.slug}/${mediaType}`);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const title = titleFromFilename(file.name);
      const isCover = mediaType === 'photos' && index === 0 && await hasNoCover(env, 'boat', boat.id);
      if (isCover) await clearCover(env, 'boat', boat.id);
      await env.DB.prepare(`
        INSERT INTO media (id, entity_type, entity_id, media_type, url, title, alt, sort_order, is_cover)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(`media_${crypto.randomUUID()}`, 'boat', boat.id, mediaType, file.download_url, title, title, index, isCover ? 1 : 0).run();
    }
  }
}

async function githubDirectory(env, path) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'cove-api' } });
  if (response.status === 404) return [];
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `GitHub read failed for ${path}`);
  return Array.isArray(data) ? data.filter(item => item.type === 'file') : [];
}

function outMedia(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    mediaType: row.media_type,
    url: row.url,
    title: row.title,
    alt: row.alt,
    sortOrder: row.sort_order,
    isCover: Boolean(row.is_cover),
    createdAt: row.created_at
  };
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

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return { status: 503, body: { error: 'ADMIN_TOKEN is not configured for protected write operations' } };
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  if (request.headers.get('Authorization') !== expected) return { status: 401, body: { error: 'Admin authorization required' } };
  return null;
}

function requireDb(env) { if (!env.DB) throw new Error('D1 binding DB is not configured'); }
function githubHeaders(env) { return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'cove-api' }; }
function corsHeaders(request, env) { const allowed = (env.ALLOWED_ORIGINS || 'https://jeffrwinters.github.io,https://covecharters.com,https://www.covecharters.com').split(',').map(item => item.trim()); const origin = request.headers.get('Origin') || ''; return { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers': 'Content-Type,Authorization' }; }
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value, null, 2), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
function cleanSegment(value) { return String(value).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
function cleanFilename(value) { const parts = String(value).split('.'); const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'; return `${cleanSegment(parts.join('.') || 'upload')}.${ext}`; }
function normalizeEntityType(value) { const clean = cleanSegment(value); return clean.endsWith('s') ? clean.slice(0, -1) : clean; }
function normalizeMediaType(value) { const clean = cleanSegment(value); if (clean === 'photo' || clean === 'image' || clean === 'images') return 'photos'; if (clean === 'video') return 'videos'; return clean || 'photos'; }
function truthy(value) { return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase()); }
function titleFromFilename(value) { return String(value || 'Media').replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function toBase64(buffer) { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
