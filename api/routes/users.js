const { db } = require('../utils/db');
const { hashPassword, json } = require('./auth');

function parseBody(req, cb) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { cb(null, JSON.parse(body)); } catch (e) { cb(e); } });
}

function handleUserRoutes(req, res) {
    const url = req.url;
    const method = req.method;

    if (url === '/api/users' && method === 'GET') {
        const rows = db.prepare('SELECT id, username, email, full_name, phone, role, created_at FROM users').all();
        json(res, 200, { items: rows });
        return true;
    }

    const getMatch = url.match(/^\/api\/users\/([^\/]+)$/);
    if (getMatch && method === 'GET') {
        const row = db.prepare('SELECT id, username, email, full_name, phone, role, created_at FROM users WHERE id = ?').get(getMatch[1]);
        if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Пользователь не найден' } }), true;
        json(res, 200, row);
        return true;
    }

    const putMatch = url.match(/^\/api\/users\/([^\/]+)$/);
    if (putMatch && (method === 'PUT' || method === 'PATCH')) {
        const userId = putMatch[1];
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Пользователь не найден' } });

            const fields = [];
            const vals = [];

            if (data.email !== undefined) { fields.push('email = ?'); vals.push(data.email); }
            if (data.role !== undefined) { fields.push('role = ?'); vals.push(data.role); }
            if (data.full_name !== undefined) { fields.push('full_name = ?'); vals.push(data.full_name); }
            if (data.phone !== undefined) { fields.push('phone = ?'); vals.push(data.phone); }
            if (data.password) { fields.push('password = ?'); vals.push(hashPassword(data.password)); }

            if (fields.length === 0) return json(res, 422, { error: { code: 'validation_error', message: 'Нет данных для обновления' } });

            vals.push(userId);
            db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);

            const updated = db.prepare('SELECT id, username, email, full_name, phone, role, created_at FROM users WHERE id = ?').get(userId);
            json(res, 200, { success: true, user: updated });
        });
        return true;
    }

    const delMatch = url.match(/^\/api\/users\/([^\/]+)$/);
    if (delMatch && method === 'DELETE') {
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(delMatch[1]);
        if (result.changes === 0) return json(res, 404, { error: { code: 'not_found', message: 'Пользователь не найден' } }), true;
        json(res, 200, { success: true, message: 'Пользователь удалён' });
        return true;
    }

    return false;
}

module.exports = { handleUserRoutes };
