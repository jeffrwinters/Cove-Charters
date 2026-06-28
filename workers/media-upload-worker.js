export default {
  async fetch(request, env) {
    const allowedOrigins = [
      'https://jeffrwinters.github.io',
      'https://covecharters.com',
      'https://www.covecharters.com'
    ];

    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST required' }, 405, corsHeaders);
    }

    const url = new URL(request.url);

    if (url.pathname !== '/upload-media') {
      return json({ error: 'Not found' }, 404, corsHeaders);
    }

    try {
      const form = await request.formData();
      const file = form.get('file');
      const entityType = cleanSegment(form.get('entityType') || 'misc');
      const entitySlug = cleanSegment(form.get('entitySlug') || 'unsorted');
      const mediaType = cleanSegment(form.get('mediaType') || 'photos');

      if (!file || typeof file === 'string') {
        return json({ error: 'Missing file field' }, 400, corsHeaders);
      }

      const maxBytes = Number(env.MAX_UPLOAD_BYTES || 15728640);
      if (file.size > maxBytes) {
        return json({ error: `File too large. Max ${maxBytes} bytes.` }, 413, corsHeaders);
      }

      const safeName = cleanFilename(file.name || 'upload.bin');
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const path = `assets/${entityType}/${entitySlug}/${mediaType}/${stamp}-${safeName}`;

      const bytes = await file.arrayBuffer();
      const content = arrayBufferToBase64(bytes);

      const ghResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'cove-media-upload-worker'
        },
        body: JSON.stringify({
          message: `Upload media: ${path}`,
          content,
          branch: env.GITHUB_BRANCH || 'main'
        })
      });

      const ghText = await ghResponse.text();
      if (!ghResponse.ok) {
        return json({ error: 'GitHub upload failed', details: ghText }, ghResponse.status, corsHeaders);
      }

      return json({
        ok: true,
        path,
        url: `/${path}`,
        githubPagesUrl: `https://${env.GITHUB_OWNER}.github.io/${env.GITHUB_REPO}/${path}`
      }, 200, corsHeaders);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500, corsHeaders);
    }
  }
};

function json(value, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
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
