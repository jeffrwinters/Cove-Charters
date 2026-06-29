export default {
  async fetch(request, env) {
    const cors = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (request.method === 'GET' && path === '/health') {
        return json({ ok: true, service: 'cove-api', version: '0.1.0' }, 200, cors);
      }

      if (request.method === 'POST' && (path === '/media/upload' || path === '/upload-media')) {
        return handleMediaUpload(request, env, cors);
      }

      if (path === '/boats') {
        return handleJsonResource(request, env, cors, 'data/boats.json', 'boats');
      }

      if (path === '/captains') {
        return handleJsonResource(request, env, cors, 'data/captains.json', 'captains');
      }

      if (path === '/bookings') {
        return notImplemented('bookings', cors);
      }

      if (path === '/agreements') {
        return notImplemented('agreements', cors);
      }

      if (path === '/payments/webhook') {
        return notImplemented('payments webhook', cors);
      }

      if (path === '/availability') {
        return notImplemented('availability', cors);
      }

      return json({ error: 'Not found', path }, 404, cors);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500, cors);
    }
  }
};

async function handleMediaUpload(request, env, cors) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, cors);

  const form = await request.formData();
  const file = form.get('file');
  const entityType = cleanSegment(form.get('entityType') || 'misc');
  const entitySlug = cleanSegment(form.get('entitySlug') || 'unsorted');
  const mediaType = cleanSegment(form.get('mediaType') || 'photos');

  if (!file || typeof file === 'string') {
    return json({ error: 'Missing file field' }, 400, cors);
  }

  const maxBytes = Number(env.MAX_UPLOAD_BYTES || 15728640);
  if (file.size > maxBytes) {
    return json({ error: `File too large. Max ${maxBytes} bytes.` }, 413, cors);
  }

  const safeName = cleanFilename(file.name || 'upload.bin');
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const path = `assets/${entityType}/${entitySlug}/${mediaType}/${stamp}-${safeName}`;
  const content = arrayBufferToBase64(await file.arrayBuffer());

  await putGithubContent(env, path, content, `Upload media: ${path}`);

  return json({
    ok: true,
    path,
    url: `/${path}`,
    githubPagesUrl: `https://${env.GITHUB_OWNER}.github.io/${env.GITHUB_REPO}/${path}`
  }, 200, cors);
}

async function handleJsonResource(request, env, cors, repoPath, resourceName) {
  if (request.method === 'GET') {
    const result = await getGithubContent(env, repoPath);
    return json(result.content, 200, cors);
  }

  if (request.method === 'PUT') {
    const payload = await request.json();
    const content = Array.isArray(payload) ? payload : payload[resourceName];
    if (!Array.isArray(content)) {
      return json({ error: `${resourceName} payload must be an array` }, 400, cors);
    }

    const existing = await getGithubContent(env, repoPath, true);
    await putGithubContent(
      env,
      repoPath,
      btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2) + '\n'))),
      `Update ${resourceName}`,
      existing.sha
    );

    return json({ ok: true, resource: resourceName, count: content.length }, 200, cors);
  }

  return json({ error: 'GET or PUT required' }, 405, cors);
}

async function getGithubContent(env, path, includeSha = false) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || 'main'}`, {
    headers: githubHeaders(env)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub read failed for ${path}: ${data.message || response.status}`);

  const decoded = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
  return includeSha ? { content: decoded, sha: data.sha } : { content: decoded };
}

async function putGithubContent(env, path, content, message, sha) {
  const body = { message, content, branch: env.GITHUB_BRANCH || 'main' };
  if (sha) body.sha = sha;

  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: githubHeaders(env),
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub write failed for ${path}: ${text}`);
  return text;
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'cove-api-worker'
  };
}

function notImplemented(resource, cors) {
  return json({ ok: false, resource, status: 'planned', message: `${resource} endpoint is reserved for the Cove API roadmap.` }, 501, cors);
}

function buildCorsHeaders(request, env) {
  const configured = (env.ALLOWED_ORIGINS || 'https://jeffrwinters.github.io,https://covecharters.com,https://www.covecharters.com')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': configured.includes(origin) ? origin : configured[0],
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
}

function json(value, status = 200, cors = {}) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function normalizePath(path) {
  return ('/' + path.split('/').filter(Boolean).join('/')).toLowerCase();
}

function cleanSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function cleanFilename(value) {
  const parts = String(value).split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  const name = cleanSegment(parts.join('.') || 'upload');
  return `${name}.${ext}`;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
