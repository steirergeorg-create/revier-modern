// ── eigenevier[at] Mein Revier — Cloudflare Worker ──

const COOKIE_NAME = 'revier_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API Routes
    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/api/logout') {
      return handleLogout();
    }
    if (url.pathname === '/api/me') {
      return handleMe(request, env);
    }
    if (url.pathname === '/api/data') {
      return handleData(request, env);
    }
    if (url.pathname === '/api/admin/user' && request.method === 'POST') {
      return handleCreateUser(request, env);
    }

    // Statische Assets
    return env.ASSETS.fetch(request);
  }
};

// ── Login ──
async function handleLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return jsonError('E-Mail und Passwort erforderlich.', 400);
    }

    const userKey = `user:${email.toLowerCase().trim()}`;
    const user = await env.REVIER_KV.get(userKey, 'json');

    if (!user) return jsonError('Ungültige Anmeldedaten.', 401);

    const hash = await sha256(password + (env.SALT || 'revier2026'));
    if (hash !== user.passwordHash) return jsonError('Ungültige Anmeldedaten.', 401);

    const token = await createToken(email.toLowerCase().trim(), env);

    return new Response(JSON.stringify({ ok: true, name: user.name }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`
      }
    });
  } catch (e) {
    return jsonError('Serverfehler.', 500);
  }
}

// ── Logout ──
function handleLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; Max-Age=0`
    }
  });
}

// ── Aktueller Benutzer ──
async function handleMe(request, env) {
  const email = await getSessionEmail(request, env);
  if (!email) return jsonError('Nicht angemeldet.', 401);

  const user = await env.REVIER_KV.get(`user:${email}`, 'json');
  if (!user) return jsonError('Benutzer nicht gefunden.', 404);

  return jsonOk({
    name: user.name,
    email,
    project: user.project,
    top: user.top,
    unit: user.unit
  });
}

// ── Projektdaten ──
async function handleData(request, env) {
  const email = await getSessionEmail(request, env);
  if (!email) return jsonError('Nicht angemeldet.', 401);

  const user = await env.REVIER_KV.get(`user:${email}`, 'json');
  if (!user) return jsonError('Benutzer nicht gefunden.', 404);

  const project = await env.REVIER_KV.get(`project:${user.project}`, 'json');
  if (!project) return jsonError('Projekt nicht gefunden.', 404);

  return jsonOk({ user, project });
}

// ── Benutzer anlegen (Admin) ──
async function handleCreateUser(request, env) {
  // Einfacher Admin-Schlüssel-Schutz
  const adminKey = request.headers.get('X-Admin-Key');
  if (adminKey !== env.ADMIN_KEY) return jsonError('Nicht autorisiert.', 403);

  const { email, password, name, project, top, unit } = await request.json();
  const hash = await sha256(password + (env.SALT || 'revier2026'));

  await env.REVIER_KV.put(`user:${email.toLowerCase()}`, JSON.stringify({
    name,
    passwordHash: hash,
    project,
    top,
    unit,
    createdAt: new Date().toISOString()
  }));

  return jsonOk({ ok: true, message: `Benutzer ${email} angelegt.` });
}

// ── Hilfsfunktionen ──
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createToken(email, env) {
  const secret = env.SESSION_SECRET || 'revier-session-secret-2026';
  const payload = btoa(JSON.stringify({ email, exp: Date.now() + COOKIE_MAX_AGE * 1000 }));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifyToken(token, env) {
  try {
    const secret = env.SESSION_SECRET || 'revier-session-secret-2026';
    const [payload, sig] = token.split('.');
    const expectedSig = await hmacSign(payload, secret);
    if (sig !== expectedSig) return null;
    const data = JSON.parse(atob(payload));
    if (data.exp < Date.now()) return null;
    return data.email;
  } catch {
    return null;
  }
}

async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

async function getSessionEmail(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  return verifyToken(token, env);
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
