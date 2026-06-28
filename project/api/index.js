/**
 * Vercel Serverless API — mirrors mock/server.js API endpoints
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ── In-memory chat store (resets on cold start, fine for mock) ── */
const chatStore = {};

/* ── Helpers ── */

function serveJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveHTML(res, html, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return null; }
}

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

/* ── Mock partial generators ── */

function partial(name) {
  return readFileSafe(path.join(ROOT, 'partials', name, name + '-content.html'))
    || '<p>' + name[0].toUpperCase() + name.slice(1) + ' loading...</p>';
}

function mockData(name) {
  return readJSON(path.join(ROOT, 'mock', 'data', name + '.json'));
}

function loadSeed(chatId) {
  const map = { general: 'community', chatbot: 'chatbot' };
  const key = map[chatId] || chatId;
  try {
    const seed = readJSON(path.join(ROOT, 'db-sementara', key + '.json'));
    const chat = seed[chatId] || seed[Object.keys(seed)[0]];
    return { chatType: key, chatId, messages: chat.messages || [] };
  } catch {
    return { chatType: 'community', chatId: 'general', messages: [] };
  }
}

/* ── Main handler ── */

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  try {
    switch (pathname) {

      /* ── HTMX Partials ── */
      case '/api/loading/partial':
        return serveHTML(res, partial('loading'));

      case '/api/login/partial':
        return serveHTML(res, partial('login'));

      case '/api/scan/partial':
        return serveHTML(res, partial('scan'));

      case '/api/artikel/partial':
        return serveHTML(res, partial('artikel'));

      case '/api/community/partial':
        return serveHTML(res, partial('community'));

      case '/api/profile/partial':
        return serveHTML(res, partial('profile'));

      /* ── Mock JSON API ── */
      case '/api/analysis/status':
        return serveJSON(res, mockData('loading') || { progress: 0, status: 'idle' });

      case '/api/auth/login':
        if (req.method !== 'POST') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        return serveJSON(res, mockData('login') || { token: 'mock_token', user: { name: 'Demo' }, message: 'OK' });

      /* ── ML API Proxy ── */
      case '/api/ml/analyze':
        if (req.method !== 'POST') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        return proxyToMLAPI(req, res);

      /* ── Chat API ── */
      case '/api/chat/send':
        if (req.method !== 'POST') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        try {
          const body = await parseBody(req);
          const { chat_id, text } = body;
          if (!text) return serveJSON(res, { error: 'text is required' }, 400);

          if (!chatStore[chat_id]) chatStore[chat_id] = [];
          const sent = { id: Date.now(), type: 'sent', text, timestamp: new Date().toISOString() };
          chatStore[chat_id].push(sent);

          const reply = { id: Date.now() + 1, type: 'received', text: 'Meehh…', timestamp: new Date().toISOString() };
          chatStore[chat_id].push(reply);

          return serveJSON(res, { sent, reply });
        } catch {
          return serveJSON(res, { error: 'Invalid JSON body' }, 400);
        }

      case '/api/chat/history':
        const chatId = url.searchParams.get('chat_id');
        if (chatStore[chatId] && chatStore[chatId].length > 0) {
          return serveJSON(res, { chatId, messages: chatStore[chatId] });
        }
        return serveJSON(res, loadSeed(chatId || 'general'));

      /* ── Telegram Photo Proxy ── */
      case '/api/telegram/send-photo':
        if (req.method !== 'POST') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        return proxyToTelegram(req, res);

      case '/api/telegram/photo':
        if (req.method !== 'GET') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        return proxyTelegramPhoto(req, res);

      /* ── 404 ── */
      default:
        return serveJSON(res, { error: 'Not found' }, 404);
    }
  } catch (e) {
    return serveJSON(res, { error: 'Internal server error' }, 500);
  }
};

/**
 * Proxies a base64 photo to Telegram Bot API for unlimited cloud storage.
 * Returns the largest photo file_id for storage reference.
 */
async function proxyToTelegram(req, res) {
  const body = await parseBody(req);

  if (!body.photo) {
    return serveJSON(res, { error: 'Missing photo (base64)' }, 400);
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8987787750:AAHADzqwz95GaMKuhPOwB2CjtlLcCGDJ8No';
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6265895260';

  // Strip data URI prefix
  const b64 = body.photo.replace(/^data:image\/\w+;base64,/, '');
  const photoBuf = Buffer.from(b64, 'base64');

  // Build multipart body
  const boundary = '----TelegramBoundary' + Date.now();
  const parts = [];
  parts.push(Buffer.from('--' + boundary + '\r\n'));
  parts.push(Buffer.from('Content-Disposition: form-data; name="chat_id"\r\n\r\n'));
  parts.push(Buffer.from(TELEGRAM_CHAT_ID + '\r\n'));
  parts.push(Buffer.from('--' + boundary + '\r\n'));
  parts.push(Buffer.from('Content-Disposition: form-data; name="photo"; filename="scan.jpg"\r\n'));
  parts.push(Buffer.from('Content-Type: image/jpeg\r\n\r\n'));
  parts.push(photoBuf);
  parts.push(Buffer.from('\r\n--' + boundary + '--\r\n'));

  const multipartBody = Buffer.concat(parts);

  return new Promise((resolve) => {
    const https = require('https');
    const tgReq = https.request({
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
    }, (tgRes) => {
      let tgBody = '';
      tgRes.on('data', (d) => { tgBody += d; });
      tgRes.on('end', () => {
        let tgData;
        try { tgData = JSON.parse(tgBody); }
        catch (e) { tgData = { ok: false, raw: tgBody }; }

        if (tgData.ok && tgData.result && tgData.result.photo) {
          const photos = tgData.result.photo;
          const largest = photos[photos.length - 1];
          resolve(serveJSON(res, {
            ok: true,
            file_id: largest.file_id,
            file_unique_id: largest.file_unique_id,
            width: largest.width,
            height: largest.height,
            message_id: tgData.result.message_id,
          }));
        } else {
          console.error('[Telegram Proxy] Upload failed:', tgBody);
          resolve(serveJSON(res, {
            error: 'Telegram upload failed',
            detail: tgData.description || tgBody,
          }, 502));
        }
      });
    });

    tgReq.on('error', (err) => {
      console.error('[Telegram Proxy] Error:', err.message);
      resolve(serveJSON(res, { error: 'Telegram API unavailable', detail: err.message }, 502));
    });

    tgReq.on('timeout', () => {
      tgReq.destroy();
      console.error('[Telegram Proxy] Timeout');
      resolve(serveJSON(res, { error: 'Telegram API timeout' }, 504));
    });

    tgReq.write(multipartBody);
    tgReq.end();
  });
}

/**
 * Proxies POST /api/ml/analyze requests to the Hugging Face ML API.
 * Avoids CORS issues by proxying through the same-origin serverless function.
 */
async function proxyToMLAPI(req, res) {
  return new Promise((resolve) => {
    const https = require('https');
    const bodyChunks = [];
    
    req.on('data', (chunk) => { bodyChunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(bodyChunks);
      
      const proxyReq = https.request({
        hostname: 'de13ugg1ng-licin-ml-api.hf.space',
        port: 443,
        path: '/analyze',
        method: 'POST',
        family: 4,  // Force IPv4 to avoid IPv6 timeout issues
        headers: {
          'Content-Type': req.headers['content-type'] || 'multipart/form-data',
          'Content-Length': body.length,
          'Accept': 'application/json',
        },
        timeout: 60000,
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
        proxyRes.on('end', () => resolve());
      });
      
      proxyReq.on('error', (err) => {
        console.error('[ML-API Proxy] Error:', err.message);
        resolve(serveJSON(res, { error: 'ML API unavailable', detail: err.message }, 502));
      });
      
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        console.error('[ML-API Proxy] Timeout');
        resolve(serveJSON(res, { error: 'ML API timeout' }, 504));
      });
      
      proxyReq.write(body);
      proxyReq.end();
    });
    
    req.on('error', (err) => {
      console.error('[ML-API Proxy] Request error:', err.message);
      resolve(serveJSON(res, { error: 'Invalid request' }, 400));
    });
  });
}

/**
 * Serves a Telegram photo by file_id via the getFile API.
 * Proxies the image so the bot token stays server-side.
 */
async function proxyTelegramPhoto(req, res) {
  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  const fileId = url.searchParams.get('file_id');

  if (!fileId) {
    return serveJSON(res, { error: 'Missing file_id' }, 400);
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8987787750:AAHADzqwz95GaMKuhPOwB2CjtlLcCGDJ8No';

  return new Promise((resolve) => {
    const https = require('https');

    // Step 1: get file_path
    https.get({
      hostname: 'api.telegram.org',
      port: 443,
      path: '/bot' + TELEGRAM_BOT_TOKEN + '/getFile?file_id=' + encodeURIComponent(fileId),
      timeout: 10000,
    }, (gfRes) => {
      let body = '';
      gfRes.on('data', (d) => { body += d; });
      gfRes.on('end', () => {
        let data;
        try { data = JSON.parse(body); }
        catch (e) {
          resolve(serveJSON(res, { error: 'Telegram getFile parse error' }, 502));
          return;
        }

        if (!data.ok || !data.result || !data.result.file_path) {
          resolve(serveJSON(res, { error: 'File not found' }, 404));
          return;
        }

        // Step 2: proxy the image
        const filePath = data.result.file_path;
        https.get({
          hostname: 'api.telegram.org',
          port: 443,
          path: '/file/bot' + TELEGRAM_BOT_TOKEN + '/' + filePath,
          timeout: 15000,
        }, (fileRes) => {
          res.writeHead(fileRes.statusCode, {
            'Content-Type': fileRes.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          });
          fileRes.pipe(res);
        }).on('error', (err) => {
          console.error('[Telegram Photo Proxy] Download error:', err.message);
          resolve(serveJSON(res, { error: 'Photo download failed' }, 502));
        });
      });
    }).on('error', (err) => {
      console.error('[Telegram Photo Proxy] getFile error:', err.message);
      resolve(serveJSON(res, { error: 'Telegram getFile failed' }, 502));
    });
  });
}
