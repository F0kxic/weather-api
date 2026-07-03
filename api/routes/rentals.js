const { db } = require('../utils/db');
const { json } = require('./auth');

function parseBody(req, cb) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { cb(null, JSON.parse(body)); } catch (e) { cb(e); } });
}

function daysBetween(a, b) {
    const ms = new Date(b) - new Date(a);
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function handleRentalRoutes(req, res) {
    const url = req.url;
    const method = req.method;
    const userId = req.user ? req.user.id : null;
    const isAdmin = req.user && req.user.role === 'admin';

    // GET /api/rentals
    if (url === '/api/rentals' && method === 'GET') {
        let sql = `SELECT r.*, u.username, u.full_name, u.phone as user_phone, e.name as equipment_name, e.price_per_day, e.image_url, c.name as category_name
                   FROM rentals r
                   LEFT JOIN users u ON r.user_id = u.id
                   LEFT JOIN equipment e ON r.equipment_id = e.id
                   LEFT JOIN categories c ON e.category_id = c.id`;
        const params = [];
        if (!isAdmin) {
            sql += ' WHERE r.user_id = ?';
            params.push(userId);
        }
        sql += ' ORDER BY r.created_at DESC';
        const rows = db.prepare(sql).all(...params);
        json(res, 200, { items: rows });
        return true;
    }

    // POST /api/rentals
    if (url === '/api/rentals' && method === 'POST') {
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const { equipment_id, start_date, end_date, contact_phone, comment } = data;
            if (!equipment_id || !start_date || !end_date) return json(res, 422, { error: { code: 'validation_error', message: 'Техника, дата начала и окончания обязательны' } });
            const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(equipment_id);
            if (!eq) return json(res, 404, { error: { code: 'not_found', message: 'Техника не найдена' } });
            if (eq.status !== 'available') return json(res, 422, { error: { code: 'validation_error', message: 'Техника недоступна для аренды' } });
            const total_days = daysBetween(start_date, end_date);
            const total_price = total_days * eq.price_per_day;
            const now = new Date().toISOString();
            const result = db.prepare(
                'INSERT INTO rentals (user_id, equipment_id, start_date, end_date, total_days, total_price, status, contact_phone, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(userId, equipment_id, start_date, end_date, total_days, total_price, 'pending', contact_phone || null, comment || null, now, now);
            db.prepare("UPDATE equipment SET status = 'rented' WHERE id = ?").run(equipment_id);
            const row = db.prepare('SELECT * FROM rentals WHERE id = ?').get(result.lastInsertRowid);
            json(res, 201, { success: true, message: 'Заявка создана', rental: row });
        });
        return true;
    }

    // GET /api/rentals/:id
    const getMatch = url.match(/^\/api\/rentals\/([0-9]+)$/);
    if (getMatch && method === 'GET') {
        const id = parseInt(getMatch[1]);
        const row = db.prepare(`SELECT r.*, u.username, u.full_name, u.phone as user_phone, e.name as equipment_name, e.price_per_day, e.image_url, c.name as category_name
                                  FROM rentals r
                                  LEFT JOIN users u ON r.user_id = u.id
                                  LEFT JOIN equipment e ON r.equipment_id = e.id
                                  LEFT JOIN categories c ON e.category_id = c.id
                                  WHERE r.id = ?`).get(id);
        if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Заявка не найдена' } }), true;
        if (!isAdmin && row.user_id !== userId) return json(res, 403, { error: { code: 'forbidden', message: 'Нет доступа' } }), true;
        json(res, 200, row);
        return true;
    }

    // PUT /api/rentals/:id (admin full update)
    const putMatch = url.match(/^\/api\/rentals\/([0-9]+)$/);
    if (putMatch && method === 'PUT') {
        const id = parseInt(putMatch[1]);
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const row = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
            if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Заявка не найдена' } });
            const fields = [];
            const vals = [];
            ['start_date', 'end_date', 'total_days', 'total_price', 'status', 'contact_phone', 'comment'].forEach(f => {
                if (data[f] !== undefined) { fields.push(`${f} = ?`); vals.push(data[f]); }
            });
            if (fields.length === 0) return json(res, 422, { error: { code: 'validation_error', message: 'Нет данных для обновления' } });
            vals.push(new Date().toISOString(), id);
            db.prepare(`UPDATE rentals SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals);
            if (data.status === 'cancelled') {
                db.prepare("UPDATE equipment SET status = 'available' WHERE id = ?").run(row.equipment_id);
            }
            const updated = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
            json(res, 200, { success: true, rental: updated });
        });
        return true;
    }

    // PATCH /api/rentals/:id (admin partial status update)
    const patchMatch = url.match(/^\/api\/rentals\/([0-9]+)$/);
    if (patchMatch && method === 'PATCH') {
        const id = parseInt(patchMatch[1]);
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const row = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
            if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Заявка не найдена' } });
            const fields = [];
            const vals = [];
            if (data.status !== undefined) { fields.push('status = ?'); vals.push(data.status); }
            if (data.comment !== undefined) { fields.push('comment = ?'); vals.push(data.comment); }
            if (data.contact_phone !== undefined) { fields.push('contact_phone = ?'); vals.push(data.contact_phone); }
            if (fields.length === 0) return json(res, 422, { error: { code: 'validation_error', message: 'Нет данных для обновления' } });
            vals.push(new Date().toISOString(), id);
            db.prepare(`UPDATE rentals SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals);
            if (data.status === 'cancelled' || data.status === 'completed') {
                db.prepare("UPDATE equipment SET status = 'available' WHERE id = ?").run(row.equipment_id);
            }
            if (data.status === 'confirmed') {
                db.prepare("UPDATE equipment SET status = 'rented' WHERE id = ?").run(row.equipment_id);
            }
            const updated = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
            json(res, 200, { success: true, rental: updated });
        });
        return true;
    }

    // DELETE /api/rentals/:id
    const delMatch = url.match(/^\/api\/rentals\/([0-9]+)$/);
    if (delMatch && method === 'DELETE') {
        const id = parseInt(delMatch[1]);
        const row = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
        if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Заявка не найдена' } }), true;
        if (!isAdmin && row.user_id !== userId) return json(res, 403, { error: { code: 'forbidden', message: 'Нет доступа' } }), true;
        db.prepare('DELETE FROM rentals WHERE id = ?').run(id);
        db.prepare("UPDATE equipment SET status = 'available' WHERE id = ?").run(row.equipment_id);
        json(res, 200, { success: true, message: 'Заявка удалена' });
        return true;
    }

    return false;
}

module.exports = { handleRentalRoutes };
