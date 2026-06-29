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

/**
 * Verifies a Supabase JWT by calling the Supabase auth endpoint.
 * Also accepts SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY as valid Bearer tokens.
 * Returns the user object on success, throws an error object on failure.
 */
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Unauthorized: missing or invalid Authorization header' };
  }
  const token = authHeader.slice(7);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anonKey) {
    throw { status: 500, message: 'Auth configuration missing' };
  }

  // Allow anon key or service role key as bearer token (frontend fallback pattern)
  if (token === anonKey || token === serviceKey) {
    return { id: 'anon', aud: 'authenticated', role: 'authenticated' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  return new Promise((resolve, reject) => {
    const https = require('https');
    const url = new URL('/auth/v1/user', supabaseUrl);
    const request = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject({ status: 500, message: 'Invalid auth response' });
          }
        } else {
          reject({ status: 401, message: 'Invalid or expired token' });
        }
      });
    });
    request.on('error', (err) => {
      reject({ status: 500, message: 'Auth verification failed' });
    });
    request.on('timeout', () => {
      request.destroy();
      reject({ status: 500, message: 'Auth verification timeout' });
    });
    request.end();
  });
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
        try {
          await verifyAuthToken(req);
        } catch (e) {
          return serveJSON(res, { error: e.message }, e.status || 401);
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

      /* ── Telegram Photo Storage ── */
      case '/api/telegram/send-photo':
        if (req.method !== 'POST') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        try {
          await verifyAuthToken(req);
        } catch (e) {
          return serveJSON(res, { error: e.message }, e.status || 401);
        }
        return proxyToTelegramUpload(req, res);

      case '/api/telegram/photo':
        if (req.method !== 'GET') {
          return serveJSON(res, { error: 'Method not allowed' }, 405);
        }
        // No auth — called via <img src="..."> which cannot send custom headers
        return getTelegramPhoto(req, res, url);



      /* ── 404 ── */
      default:
        return serveJSON(res, { error: 'Not found' }, 404);
    }
  } catch (e) {
    return serveJSON(res, { error: 'Internal server error' }, 500);
  }
};

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
          'X-API-Key': process.env.ML_API_KEY || '',
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
 * Handles POST /api/telegram/send-photo
 * Accepts multipart/form-data with a "photo" field (base64 or raw),
 * uploads the image to Telegram Bot API,
 * and returns the file_id for later retrieval.
 */
async function proxyToTelegramUpload(req, res) {
  return new Promise((resolve) => {
    let bodyChunks = [];
    req.on('data', (chunk) => { bodyChunks.push(chunk); });
    req.on('end', async () => {
      try {
        const contentType = req.headers['content-type'] || '';
        let photoBuffer;

        if (contentType.includes('application/json')) {
          // JSON body with base64 photo
          const body = JSON.parse(Buffer.concat(bodyChunks).toString());
          if (!body.photo) {
            resolve(serveJSON(res, { error: 'Missing photo (base64)' }, 400));
            return;
          }
          const b64 = body.photo.replace(/^data:image\/\w+;base64,/, '');
          photoBuffer = Buffer.from(b64, 'base64');
        } else if (contentType.includes('multipart/form-data')) {
          // Multipart form — parse the boundary
          const boundary = contentType.split('boundary=')[1];
          if (!boundary) {
            resolve(serveJSON(res, { error: 'Missing boundary in multipart' }, 400));
            return;
          }
          const fullBody = Buffer.concat(bodyChunks);
          const parts = parseMultipart(fullBody, boundary);
          photoBuffer = parts.photo;
        } else {
          // Raw binary body
          photoBuffer = Buffer.concat(bodyChunks);
        }

        if (!photoBuffer || photoBuffer.length === 0) {
          resolve(serveJSON(res, { error: 'Empty photo data' }, 400));
          return;
        }

        // Get bot token from env
const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          const err = new Error('TELEGRAM_BOT_TOKEN not configured in .env');
          resolve(serveJSON(res, { error: 'TELEGRAM_BOT_TOKEN not configured in .env' }, 500));
          return;
        }

        // Get chat_id from env (gracefully handle if missing)
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!chatId) {
          resolve(serveJSON(res, { 
            error: 'TELEGRAM_CHAT_ID not configured in .env',
            hint: 'Add bot to a group and get chat_id from /getUpdates'
          }, 500));
          return;
        }

        // Build multipart/form-data manually
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const CRLF = '\r\n';
        
        const preBoundary = Buffer.from(`--${boundary}${CRLF}`);
        const postBoundary = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
        
        // chat_id field
        const chatIdField = Buffer.from(
          `Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}${chatId}${CRLF}`
        );
        
        // photo field
        const photoHeader = Buffer.from(
          `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="photo"; filename="photo.jpg"${CRLF}` +
          `Content-Type: image/jpeg${CRLF}${CRLF}`
        );
        
        const formData = Buffer.concat([
          preBoundary,
          chatIdField,
          photoHeader,
          photoBuffer,
          postBoundary
        ]);

        // Send to Telegram Bot API
        const https = require('https');
        const apiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        const urlObj = new URL(apiUrl);
        
        const proxyReq = https.request({
          hostname: urlObj.hostname,
          port: 443,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': formData.length,
          },
          timeout: 30000,
        }, (proxyRes) => {
          let responseData = '';
          proxyRes.on('data', (chunk) => { responseData += chunk; });
          proxyRes.on('end', () => {
            try {
              const result = JSON.parse(responseData);
              if (!result.ok) {
                console.error('[Telegram Upload] API error:', result);
                resolve(serveJSON(res, { 
                  error: 'Telegram API error', 
                  detail: result.description 
                }, 502));
                return;
              }
              
              // Extract the largest photo file_id (last element in photo array)
              const photos = result.result.photo || [];
              const largestPhoto = photos[photos.length - 1];
              const fileId = largestPhoto ? largestPhoto.file_id : null;
              
              if (!fileId) {
                resolve(serveJSON(res, { error: 'No file_id in response' }, 502));
                return;
              }
              
              console.log('[Telegram Upload] Success, file_id:', fileId);
              resolve(serveJSON(res, { ok: true, file_id: fileId }));
            } catch (err) {
              console.error('[Telegram Upload] Parse error:', err.message);
              resolve(serveJSON(res, { error: 'Invalid Telegram API response' }, 502));
            }
          });
        });
        
        proxyReq.on('error', (err) => {
          console.error('[Telegram Upload] Request error:', err.message);
          resolve(serveJSON(res, { error: 'Telegram API unavailable', detail: err.message }, 502));
        });
        
        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          console.error('[Telegram Upload] Timeout');
          resolve(serveJSON(res, { error: 'Telegram API timeout' }, 504));
        });
        
        proxyReq.write(formData);
        proxyReq.end();
      } catch (err) {
        console.error('[Telegram Upload] Error:', err.message);
        resolve(serveJSON(res, { error: 'Upload failed', detail: err.message }, 500));
      }
    });
    req.on('error', (err) => {
      console.error('[Telegram Upload] Request error:', err.message);
      resolve(serveJSON(res, { error: 'Invalid request' }, 400));
    });
  });
}

/**
 * Parses a multipart/form-data body and extracts the photo field.
 * Returns { photo: Buffer, mimeType: string }
 */
function parseMultipart(body, boundary) {
  const result = { photo: null, mimeType: 'image/jpeg' };
  const parts = body.toString('binary').split('--' + boundary);
  for (const part of parts) {
    if (part.trim() === '' || part.trim() === '--') continue;

    // Split headers from body
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = part.substring(0, headerEnd);
    const content = part.substring(headerEnd + 4);

    // Check Content-Disposition for name="photo"
    if (headers.includes('name="photo"')) {
      // Extract content type if present
      const ctMatch = headers.match(/Content-Type:\s*(\S+)/i);
      if (ctMatch) result.mimeType = ctMatch[1];

      // Remove trailing \r\n before boundary
      const cleanContent = content.replace(/\r?\n--\s*$/, '');
      result.photo = Buffer.from(cleanContent, 'binary');
    }
  }
  return result;
}

/**
 * Handles GET /api/telegram/photo?file_id=xxx
 * Fetches the file path from Telegram Bot API and redirects to the file URL.
 */
async function getTelegramPhoto(req, res, url) {
  return new Promise((resolve) => {
    const fileId = url.searchParams.get('file_id');
    if (!fileId) {
      resolve(serveJSON(res, { error: 'Missing file_id parameter' }, 400));
      return;
    }

const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          const err = new Error('TELEGRAM_BOT_TOKEN not configured in .env');
          resolve(serveJSON(res, { error: 'TELEGRAM_BOT_TOKEN not configured in .env' }, 500));
      return;
    }

    const https = require('https');
    const apiUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const urlObj = new URL(apiUrl);

    const proxyReq = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'LICIN/1.0' },
      timeout: 10000,
    }, (proxyRes) => {
      let responseData = '';
      proxyRes.on('data', (chunk) => { responseData += chunk; });
      proxyRes.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (!result.ok) {
            console.error('[Telegram Photo] API error:', result);
            resolve(serveJSON(res, { error: 'Telegram API error', detail: result.description }, 502));
            return;
          }

          const filePath = result.result.file_path;
          if (!filePath) {
            resolve(serveJSON(res, { error: 'No file_path in response' }, 502));
            return;
          }

          // Redirect to the file URL
          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
          res.writeHead(302, { 'Location': fileUrl });
          res.end();
          resolve();
        } catch (err) {
          console.error('[Telegram Photo] Parse error:', err.message);
          resolve(serveJSON(res, { error: 'Invalid Telegram API response' }, 502));
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[Telegram Photo] Request error:', err.message);
      resolve(serveJSON(res, { error: 'Telegram API unavailable', detail: err.message }, 502));
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      console.error('[Telegram Photo] Timeout');
      resolve(serveJSON(res, { error: 'Telegram API timeout' }, 504));
    });

    proxyReq.end();
  });
}

