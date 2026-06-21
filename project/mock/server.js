/**
 * ============================================================
 * FILE: mock/server.js
 * ============================================================
 * FEATURE: Mock Development Server
 *
 * PURPOSE:
 *   Lightweight Express-like mock server that serves HTMX partial
 *   HTML responses and mock JSON data. Simulates the FastAPI backend
 *   contract so the frontend can be developed and tested in isolation.
 *
 * ENDPOINTS:
 *   GET /api/loading/partial     → Returns loading page HTML partial
 *   GET /api/analysis/status     → Returns mock analysis status JSON
 *   GET /                        → Serves index.html
 *   GET /offline.html            → Serves offline fallback
 *   GET /assets/*                → Serves static assets
 *   GET /config/*                → Serves config files
 *   GET /pages/*                 → Serves page HTML files
 *   GET /partials/*              → Serves HTMX partials
 *
 * DEPENDENCIES:
 *   - Node.js v18+ (built-in http, fs, path modules — no npm install)
 *
 * USAGE:
 *   node mock/server.js
 *   → Server starts on http://localhost:8001
 *
 * PHASE: Frontend (Mock) — Replace with FastAPI in Phase 2
 * ============================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const ROOT = path.resolve(__dirname, '..');

/** Telegram Bot credentials for photo storage */
const TELEGRAM_BOT_TOKEN = '8987787750:AAHADzqwz95GaMKuhPOwB2CjtlLcCGDJ8No';
const TELEGRAM_CHAT_ID = '6265895260';

/** MIME type map for serving static files */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Reads a file from disk and serves it with correct MIME type.
 *
 * @param {http.ServerResponse} res
 * @param {string} filePath - Absolute path to the file
 * @param {number} [statusCode=200]
 */
function serveFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(statusCode, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

/**
 * Generates the loading page HTML partial dynamically.
 * This is what HTMX receives when it requests /api/loading/partial.
 *
 * @returns {string} HTML partial string
 */
function getLoadingPartial() {
  const partialPath = path.join(ROOT, 'partials', 'loading', 'loading-content.html');
  try {
    return fs.readFileSync(partialPath, 'utf-8');
  } catch {
    return '<p>Loading...</p>';
  }
}

/**
 * Returns mock analysis status JSON.
 * In Phase 2, this will be replaced by real FastAPI endpoint.
 *
 * @returns {Object} Mock status object
 */
function getAnalysisStatus() {
  const dataPath = path.join(__dirname, 'data', 'loading.json');
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    return data;
  } catch {
    return { progress: 0, status: 'idle', message: 'Waiting...', subtext: '' };
  }
}

/**
 * Generates the login page HTML partial dynamically.
 *
 * @returns {string} HTML partial string
 */
function getLoginPartial() {
  const partialPath = path.join(ROOT, 'partials', 'login', 'login-content.html');
  try {
    return fs.readFileSync(partialPath, 'utf-8');
  } catch {
    return '<p>Login form loading...</p>';
  }
}

/**
 * Returns mock login response JSON.
 *
 * @returns {Object} Mock login response
 */
function getLoginResponse() {
  const dataPath = path.join(__dirname, 'data', 'login.json');
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } catch {
    return { token: 'mock_token', user: { name: 'Demo' }, message: 'OK' };
  }
}

/**
 * Generates the scan page HTML partial dynamically.
 *
 * @returns {string} HTML partial string
 */
function getScanPartial() {
  const partialPath = path.join(ROOT, 'partials', 'scan', 'scan-content.html');
  try {
    return fs.readFileSync(partialPath, 'utf-8');
  } catch {
    return '<p>Skin type selector loading...</p>';
  }
}

/**
 * Generates the artikel page HTML partial dynamically.
 *
 * @returns {string} HTML partial string
 */
function getArtikelPartial() {
  const partialPath = path.join(ROOT, 'partials', 'artikel', 'artikel-content.html');
  try {
    return fs.readFileSync(partialPath, 'utf-8');
  } catch {
    return '<p>Artikel loading...</p>';
  }
}

/**
 * Generates the profile page HTML partial dynamically.
 *
 * @returns {string} HTML partial string
 */
function getProfilePartial() {
  const partialPath = path.join(ROOT, 'partials', 'profile', 'profile-content.html');
  try {
    return fs.readFileSync(partialPath, 'utf-8');
  } catch {
    return '<p>Profile loading...</p>';
  }
}

/**
 * Main request handler. Routes requests to appropriate handlers.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  /** Enable CORS for development */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  /** Dry-run parameter — return success without side effects */
  const dryRun = url.searchParams.get('dry_run') === 'true';
  if (dryRun) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', dry_run: true }));
    return;
  }

  /** Route matching */
  switch (true) {
    /** HTMX Partial — Loading screen content */
    case pathname === '/api/loading/partial':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getLoadingPartial());
      break;

    /** API — Analysis status (mock JSON) */
    case pathname === '/api/analysis/status':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getAnalysisStatus()));
      break;

    /** HTMX Partial — Login page content */
    case pathname === '/api/login/partial':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getLoginPartial());
      break;

    /** API — Login (mock JSON) */
    case pathname === '/api/auth/login' && req.method === 'POST':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getLoginResponse()));
      break;

    /** Proxy — Forward ML analysis requests to the local YOLO API */
    case pathname === '/api/ml/analyze' && req.method === 'POST':
      proxyToMLAPI(req, res);
      break;

    /** Proxy — Forward photo to Telegram Bot API for cloud storage */
    case pathname === '/api/telegram/send-photo' && req.method === 'POST':
      proxyToTelegram(req, res);
      break;

    /** Proxy — Serve Telegram photo by file_id (for <img> tags) */
    case pathname === '/api/telegram/photo' && req.method === 'GET':
      proxyTelegramPhoto(req, res);
      break;

    /** HTMX Partial — Scan page content */
    case pathname === '/api/scan/partial':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getScanPartial());
      break;

    /** HTMX Partial — Artikel page content */
    case pathname === '/api/artikel/partial':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getArtikelPartial());
      break;

    /** HTMX Partial — Community page content */
    case pathname === '/api/community/partial':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getCommunityPartial());
      break;

    /** HTMX Partial — Profile page content */
    case pathname === '/api/profile/partial':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getProfilePartial());
      break;

    /** Loading page — handles OAuth redirect with #access_token */
    case pathname === '/loading' || pathname === '/loading/':
      serveFile(res, path.join(ROOT, 'pages', 'loading', 'index.html'));
      break;

    /** Root — serve index.html */
    case pathname === '/':
      serveFile(res, path.join(ROOT, 'index.html'));
      break;

    /** Scan page— standalone page */
    case pathname === '/scan' || pathname === '/scan/':
      serveFile(res, path.join(ROOT, 'pages', 'scan', 'index.html'));
      break;
    /** Scan-page page — standalone page */
    case pathname === '/scan-page' || pathname === '/scan-page/':
      serveFile(res, path.join(ROOT, 'pages', 'scan-page', 'index.html'));
      break;
    /** Login page */
    case pathname === '/login' || pathname === '/login/':
      serveFile(res, path.join(ROOT, 'pages', 'login', 'index.html'));
      break;

    /** Home page */
    case pathname === '/home' || pathname === '/home/':
      serveFile(res, path.join(ROOT, 'pages', 'home', 'index.html'));
      break;

    /** Account page */
    case pathname === '/account' || pathname === '/account/':
      serveFile(res, path.join(ROOT, 'pages', 'account', 'index.html'));
      break;

    /** Community page */
    case pathname === '/community' || pathname === '/community/':
      serveFile(res, path.join(ROOT, 'pages', 'community', 'index.html'));
      break;

    /** Profile page */
    case pathname === '/profile' || pathname === '/profile/':
      serveFile(res, path.join(ROOT, 'pages', 'profile', 'index.html'));
      break;

    /** Profile Edit page */
    case pathname === '/profile/edit':
      serveFile(res, path.join(ROOT, 'pages', 'profile', 'edit-profile.html'));
      break;

    /** Artikel page */
    case pathname === '/artikel' || pathname === '/artikel/':
      serveFile(res, path.join(ROOT, 'pages', 'artikel', 'index.html'));
      break;

    /** Chatbot page */
    case pathname === '/chatbot' || pathname === '/chatbot/':
      serveFile(res, path.join(ROOT, 'pages', 'chatbot', 'index.html'));
      break;

    /** Manifest */
    case pathname === '/manifest.json':
      serveFile(res, path.join(ROOT, 'manifest.json'));
      break;

    /** Service Worker */
    case pathname === '/sw.js':
      serveFile(res, path.join(ROOT, 'sw.js'));
      break;

    /** Offline page */
    case pathname === '/offline.html':
      serveFile(res, path.join(ROOT, 'offline.html'));
      break;

    /** Static assets, config, pages, partials */
    case pathname.startsWith('/assets/') ||
         pathname.startsWith('/config/') ||
         pathname.startsWith('/pages/') ||
         pathname.startsWith('/partials/'):
      serveFile(res, path.join(ROOT, pathname));
      break;

    /** Chat — Send message */
    case pathname === '/api/chat/send' && req.method === 'POST':
      try {
        parseBody(req).then(body => {
          const { chat_id, text } = body;
          if (!text) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'text is required' }));
            return;
          }
          const sent = appendMessage(chat_id, text, 'sent');
          const reply = appendMessage(chat_id, 'Meehh…', 'received');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ sent, reply }));
        }).catch(() => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        });
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
      break;

    /** Chat — Get history */
    case pathname === '/api/chat/history':
      const chatQuery = url.searchParams.get('chat_id');
      const msgs = getMessages(chatQuery);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(msgs));
      break;

    /** Static assets, config, pages, partials, db-sementara */
    case pathname.startsWith('/assets/') ||
         pathname.startsWith('/config/') ||
         pathname.startsWith('/pages/') ||
         pathname.startsWith('/partials/') ||
         pathname.startsWith('/db-sementara/'):
      serveFile(res, path.join(ROOT, pathname));
      break;

    /** 404 fallback */
    default:
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Not Found</h1><p>The requested page does not exist.</p>');
  }
}

/**
 * Proxies POST /api/ml/analyze requests to the local YOLO ML API.
 * This avoids mixed-content errors (HTTPS -> HTTP) by proxying through
 * the same-origin server.
 */
function proxyToMLAPI(req, res) {
  const bodyChunks = [];
  req.on('data', function (chunk) { bodyChunks.push(chunk); });
  req.on('end', function () {
    var body = Buffer.concat(bodyChunks);

    var options = {
      hostname: '127.0.0.1',
      port: 8002,
      path: '/analyze',
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'multipart/form-data',
        'Content-Length': body.length,
        'Accept': 'application/json',
      },
      timeout: 60000,
    };

    var proxyReq = http.request(options, function (proxyRes) {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', function (err) {
      console.error('[ML-API Proxy] Error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ML API unavailable', detail: err.message }));
    });

    proxyReq.on('timeout', function () {
      proxyReq.destroy();
      console.error('[ML-API Proxy] Timeout');
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ML API timeout' }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}

/**
 * Proxies POST /api/telegram/send-photo to Telegram Bot API.
 * Receives base64-encoded photo from browser, decodes it,
 * and sends it to Telegram as a photo for unlimited cloud storage.
 */
function proxyToTelegram(req, res) {
  const bodyChunks = [];
  req.on('data', function (chunk) { bodyChunks.push(chunk); });
  req.on('end', function () {
    var raw = Buffer.concat(bodyChunks).toString('utf-8');

    var payload;
    try { payload = JSON.parse(raw); }
    catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    if (!payload.photo) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing photo (base64)' }));
      return;
    }

    // Strip data URI prefix if present
    var b64 = payload.photo.replace(/^data:image\/\w+;base64,/, '');
    var photoBuf = Buffer.from(b64, 'base64');

    // Build multipart body for Telegram Bot API
    var boundary = '----TelegramBoundary' + Date.now();
    var parts = [];
    parts.push(Buffer.from('--' + boundary + '\r\n'));
    parts.push(Buffer.from('Content-Disposition: form-data; name="chat_id"\r\n\r\n'));
    parts.push(Buffer.from(TELEGRAM_CHAT_ID + '\r\n'));
    parts.push(Buffer.from('--' + boundary + '\r\n'));
    parts.push(Buffer.from('Content-Disposition: form-data; name="photo"; filename="scan.jpg"\r\n'));
    parts.push(Buffer.from('Content-Type: image/jpeg\r\n\r\n'));
    parts.push(photoBuf);
    parts.push(Buffer.from('\r\n--' + boundary + '--\r\n'));

    var multipartBody = Buffer.concat(parts);

    var options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot' + TELEGRAM_BOT_TOKEN + '/sendPhoto',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': multipartBody.length,
        'Accept': 'application/json',
      },
      timeout: 30000,
    };

    var tgReq = https.request(options, function (tgRes) {
      var tgBody = '';
      tgRes.on('data', function (d) { tgBody += d; });
      tgRes.on('end', function () {
        var tgData;
        try { tgData = JSON.parse(tgBody); }
        catch (e) { tgData = { ok: false, raw: tgBody }; }

        if (tgData.ok && tgData.result && tgData.result.photo) {
          // Extract largest photo file_id
          var photos = tgData.result.photo;
          var largest = photos[photos.length - 1];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            file_id: largest.file_id,
            file_unique_id: largest.file_unique_id,
            width: largest.width,
            height: largest.height,
            message_id: tgData.result.message_id,
          }));
        } else {
          console.error('[Telegram Proxy] Upload failed:', tgBody);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Telegram upload failed', detail: tgData.description || tgBody }));
        }
      });
    });

    tgReq.on('error', function (err) {
      console.error('[Telegram Proxy] Error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Telegram API unavailable', detail: err.message }));
    });

    tgReq.on('timeout', function () {
      tgReq.destroy();
      console.error('[Telegram Proxy] Timeout');
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Telegram API timeout' }));
    });

    tgReq.write(multipartBody);
    tgReq.end();
  });
}

/**
 * Serves a Telegram photo by file_id.
 * Calls Telegram getFile API to get file_path, then proxies the actual image.
 * Used by <img> tags on the home page diary thumbs.
 */
function proxyTelegramPhoto(req, res) {
  var urlObj = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  var fileId = urlObj.searchParams.get('file_id');

  if (!fileId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing file_id' }));
    return;
  }

  // Step 1: get file_path from Telegram
  var getFileOpts = {
    hostname: 'api.telegram.org',
    port: 443,
    path: '/bot' + TELEGRAM_BOT_TOKEN + '/getFile?file_id=' + encodeURIComponent(fileId),
    method: 'GET',
    timeout: 10000,
  };

  https.get(getFileOpts, function (gfRes) {
    var body = '';
    gfRes.on('data', function (d) { body += d; });
    gfRes.on('end', function () {
      var data;
      try { data = JSON.parse(body); }
      catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Telegram getFile parse error' }));
        return;
      }

      if (!data.ok || !data.result || !data.result.file_path) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found', detail: data }));
        return;
      }

      // Step 2: proxy the actual image from Telegram file server
      var filePath = data.result.file_path;
      var fileOpts = {
        hostname: 'api.telegram.org',
        port: 443,
        path: '/file/bot' + TELEGRAM_BOT_TOKEN + '/' + filePath,
        method: 'GET',
        timeout: 15000,
      };

      https.get(fileOpts, function (fileRes) {
        res.writeHead(fileRes.statusCode, {
          'Content-Type': fileRes.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        });
        fileRes.pipe(res);
      }).on('error', function (err) {
        console.error('[Telegram Photo Proxy] Download error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Photo download failed', detail: err.message }));
      });
    });
  }).on('error', function (err) {
    console.error('[Telegram Photo Proxy] getFile error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Telegram getFile failed', detail: err.message }));
  });
}

/**
 * Parses JSON request body.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/**
 * Appends a message to the in-memory chat store and returns it.
 */
function appendMessage(chatId, text, type) {
  if (!chatStore[chatId]) {
    chatStore[chatId] = [];
  }
  const msg = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type,
    text,
    timestamp: new Date().toISOString()
  };
  chatStore[chatId].push(msg);
  return msg;
}

/**
 * Returns messages for a chat, with seed data fallback.
 */
function getMessages(chatId) {
  if (chatStore[chatId] && chatStore[chatId].length > 0) {
    return { chatId, messages: chatStore[chatId] };
  }
  return loadSeedMessages(chatId);
}

/**
 * Loads seed messages from db-sementara JSON files.
 */
function loadSeedMessages(chatId) {
  const map = { general: 'community', chatbot: 'chatbot' };
  const key = map[chatId] || chatId;
  try {
    const seedPath = path.join(ROOT, 'db-sementara', `${key}.json`);
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const chat = seed[chatId] || seed[Object.keys(seed)[0]];
    return {
      chatType: key,
      chatId: chatId,
      messages: chat.messages || []
    };
  } catch {
    return { chatType: 'community', chatId: 'general', messages: [] };
  }
}

/** In-memory chat message store */
const chatStore = {};

/** ── SSL Certificates (mkcert) ── */
const SSL_KEY_PATH = path.join(__dirname, '..', 'localhost+3-key.pem');
const SSL_CERT_PATH = path.join(__dirname, '..', 'localhost+3.pem');

let sslOptions = null;
try {
  sslOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
  };
  console.log('[INFO] SSL certificates loaded.');
} catch (e) {
  console.log('[WARN] SSL certificates not found. HTTPS unavailable:', e.message);
}

/** Start the mock server(s) */
let httpsUrl = '';
let httpUrl = '';

if (sslOptions) {
  /** HTTPS server (main) */
  const server = https.createServer(sslOptions, handleRequest);
  server.listen(PORT, '0.0.0.0', () => {
    httpsUrl = `https://0.0.0.0:${PORT}`;
    printBanner();
  });

  /** HTTP server on port 8000 (alternative — avoids mixed-content block for ML API) */
  const httpServer = http.createServer(handleRequest);
  httpServer.listen(8000, '0.0.0.0', () => {
    httpUrl = `http://0.0.0.0:8000 (same content, no mixed-content block)`;
  });
} else {
  /** Fallback: plain HTTP (no SSL certs) */
  const server = http.createServer(handleRequest);
  server.listen(PORT, '0.0.0.0', () => {
    httpsUrl = `http://0.0.0.0:${PORT} (no SSL — camera may not work on mobile)`;
    printBanner();
  });
}

function printBanner() {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║  SkinGlow Mock Server                            ║
  ║  HTTPS:  https://localhost:${PORT}                  ║
  ║  Network: https://192.168.1.8:${PORT}               ║
  ║  HTTP:   ${httpUrl || '(no HTTP redirect)'}  ║
  ║  Mock Mode:  ENABLED                             ║
  ║                                                  ║
  ║  Endpoints:                                      ║
  ║    GET /                       → Loading (root)     ║
  ║    GET /loading                → Loading Page       ║
  ║    GET /scan                   → Scan Page         ║
  ║    GET /login                  → Login Page        ║
  ║    GET /home                   → Home Page         ║
  ║    GET /account                → Account Page      ║
  ║    GET /community              → Community         ║
  ║    GET /profile                → Profile           ║
  ║    GET /artikel                → Artikel           ║
  ║    GET /chatbot                → Chatbot           ║
  ║                                                  ║
  ║    GET /api/loading/partial    → Loading HTML      ║
  ║    GET /api/analysis/status    → Status JSON       ║
  ║    GET /api/login/partial      → Login HTML        ║
  ║    GET /api/scan/partial       → Scan HTML         ║
  ║    GET /api/artikel/partial    → Artikel HTML      ║
  ║    GET /api/community/partial  → Community HTML    ║
  ║    GET /api/profile/partial    → Profile HTML      ║
  ║    Any path + ?dry_run=true    → 200 OK            ║
  ╚══════════════════════════════════════════════════╝
  `);
}
