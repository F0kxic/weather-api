const { db } = require('../utils/db');
const { json } = require('./auth');

function parseBody(req, cb) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try { cb(null, JSON.parse(body)); }
        catch (e) { cb(e); }
    });
}

function handleEquipmentRoutes(req, res) {
    const parsedUrl = require('url').parse(req.url, true);
    const url = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method;

    if (url === '/api/equipment' && method === 'GET') {
        let sql = 'SELECT e.*, c.name as category_name, c.icon as category_icon FROM equipment e LEFT JOIN categories c ON e.category_id = c.id';
        const params = [];
        const conditions = [];

        if (query.category) {
            conditions.push('e.category_id = ?');
            params.push(query.category);
        }
        if (query.search) {
            conditions.push('(e.name LIKE ? OR e.description LIKE ? OR e.specs LIKE ?)');
            const searchTerm = `%${query.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        if (query.status) {
            conditions.push('e.status = ?');
            params.push(query.status);
        }
        if (query.minPrice) {
            conditions.push('e.price_per_day >= ?');
            params.push(parseInt(query.minPrice));
        }
        if (query.maxPrice) {
            conditions.push('e.price_per_day <= ?');
            params.push(parseInt(query.maxPrice));
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        let orderBy = 'e.id';
        if (query.sortBy === 'price_asc') orderBy = 'e.price_per_day ASC';
        else if (query.sortBy === 'price_desc') orderBy = 'e.price_per_day DESC';
        else if (query.sortBy === 'name') orderBy = 'e.name ASC';
        sql += ` ORDER BY ${orderBy}`;

        const rows = db.prepare(sql).all(...params);
        json(res, 200, { items: rows });
        return true;
    }

    const getMatch = url.match(/^\/api\/equipment\/([0-9]+)$/);
    if (getMatch && method === 'GET') {
        const id = parseInt(getMatch[1]);
        const row = db.prepare('SELECT e.*, c.name as category_name FROM equipment e LEFT JOIN categories c ON e.category_id = c.id WHERE e.id = ?').get(id);
        if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Техника не найдена' } }), true;
        json(res, 200, row);
        return true;
    }

    if (url === '/api/equipment' && method === 'POST') {
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const { category_id, name, slug, description, specs, price_per_day, image_url, status } = data;
            if (!category_id || !name || !price_per_day) return json(res, 422, { error: { code: 'validation_error', message: 'Категория, название и цена обязательны' } });
            const now = new Date().toISOString();
            const result = db.prepare(
                'INSERT INTO equipment (category_id, name, slug, description, specs, price_per_day, image_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(category_id, name, slug || name.toLowerCase().replace(/\s+/g, '-'), description || null, specs || null, price_per_day, image_url || null, status || 'available', now);
            const row = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid);
            json(res, 201, { success: true, equipment: row });
        });
        return true;
    }

    const putMatch = url.match(/^\/api\/equipment\/([0-9]+)$/);
    if (putMatch && (method === 'PUT' || method === 'PATCH')) {
        const id = parseInt(putMatch[1]);
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const row = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
            if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Техника не найдена' } });
            const fields = [];
            const vals = [];
            ['category_id', 'name', 'slug', 'description', 'specs', 'price_per_day', 'image_url', 'status'].forEach(f => {
                if (data[f] !== undefined) { fields.push(`${f} = ?`); vals.push(data[f]); }
            });
            if (fields.length === 0) return json(res, 422, { error: { code: 'validation_error', message: 'Нет данных для обновления' } });
            vals.push(id);
            db.prepare(`UPDATE equipment SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
            const updated = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
            json(res, 200, { success: true, equipment: updated });
        });
        return true;
    }

    const delMatch = url.match(/^\/api\/equipment\/([0-9]+)$/);
    if (delMatch && method === 'DELETE') {
        const id = parseInt(delMatch[1]);
        const result = db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
        if (result.changes === 0) return json(res, 404, { error: { code: 'not_found', message: 'Техника не найдена' } }), true;
        json(res, 200, { success: true, message: 'Техника удалена' });
        return true;
    }

    return false;
}

module.exports = { handleEquipmentRoutes };
