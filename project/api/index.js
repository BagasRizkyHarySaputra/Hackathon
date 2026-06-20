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

      /* ── 404 ── */
      default:
        return serveJSON(res, { error: 'Not found' }, 404);
    }
  } catch (e) {
    return serveJSON(res, { error: 'Internal server error' }, 500);
  }
};
