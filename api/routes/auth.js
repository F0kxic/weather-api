const { db, generateId } = require('../utils/db');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function parseBody(req, cb) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { cb(null, JSON.parse(body)); } catch (e) { cb(e); } });
}

function handleAuthRoutes(req, res) {
    const url = req.url;
    const method = req.method;

    // POST /api/auth/register
    if (url === '/api/auth/register' && method === 'POST') {
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const { username, email, password, full_name, phone } = data;
            if (!username || !email || !password) return json(res, 422, { error: { code: 'validation_error', message: 'Логин, email и пароль обязательны' } });
            if (password.length < 6) return json(res, 422, { error: { code: 'validation_error', message: 'Пароль минимум 6 символов' } });
            if (!isValidEmail(email)) return json(res, 422, { error: { code: 'validation_error', message: 'Неверный формат email' } });
            if (db.prepare('SELECT * FROM users WHERE username = ?').get(username)) return json(res, 422, { error: { code: 'validation_error', message: 'Логин уже занят' } });
            const id = generateId();
            const now = new Date().toISOString();
            db.prepare('INSERT INTO users (id, username, email, password, full_name, phone, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(id, username, email, hashPassword(password), full_name || null, phone || null, 'client', now);
            json(res, 201, { success: true, message: 'Регистрация успешна', user: { id, username, email, role: 'client' } });
        });
        return true;
    }

    // POST /api/auth/login
    if (url === '/api/auth/login' && method === 'POST') {
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const { username, password } = data;
            if (!username || !password) return json(res, 422, { error: { code: 'validation_error', message: 'Логин и пароль обязательны' } });
            const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, hashPassword(password));
            if (!user) return json(res, 401, { error: { code: 'unauthorized', message: 'Неверный логин или пароль' } });
            const token = generateToken();
            db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);
            json(res, 200, { success: true, message: 'Вход выполнен', token, user: { id: user.id, username: user.username, email: user.email, role: user.role, full_name: user.full_name, phone: user.phone } });
        });
        return true;
    }

    // GET /api/auth/me
    if (url === '/api/auth/me' && method === 'GET') {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) return json(res, 401, { error: { code: 'unauthorized', message: 'Отсутствует токен' } });
        const token = authHeader.split(' ')[1];
        const user = db.prepare('SELECT id, username, email, role, full_name, phone, created_at FROM users WHERE token = ?').get(token);
        if (!user) return json(res, 401, { error: { code: 'unauthorized', message: 'Недействительный токен' } });
        json(res, 200, user);
        return true;
    }

    return false;
}

function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
    res.end(JSON.stringify(data));
}

module.exports = { handleAuthRoutes, hashPassword, json };
