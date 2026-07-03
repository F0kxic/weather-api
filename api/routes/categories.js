const { db } = require('../utils/db');
const { json } = require('./auth');

function parseBody(req, cb) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { cb(null, JSON.parse(body)); } catch (e) { cb(e); } });
}

function handleCategoryRoutes(req, res) {
    const url = req.url;
    const method = req.method;

    if (url === '/api/categories' && method === 'GET') {
        const rows = db.prepare('SELECT * FROM categories ORDER BY id').all();
        json(res, 200, { items: rows });
        return true;
    }

    const getMatch = url.match(/^\/api\/categories\/([0-9]+)$/);
    if (getMatch && method === 'GET') {
        const id = parseInt(getMatch[1]);
        const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Категория не найдена' } }), true;
        json(res, 200, row);
        return true;
    }

    if (url === '/api/categories' && method === 'POST') {
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const { name, slug, description, icon } = data;
            if (!name || !slug) return json(res, 422, { error: { code: 'validation_error', message: 'Название и slug обязательны' } });

            const existing = db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
            if (existing) return json(res, 422, { error: { code: 'validation_error', message: 'Категория с таким slug уже существует' } });

            const result = db.prepare(
                'INSERT INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)'
            ).run(name, slug, description || null, icon || null);
            const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
            json(res, 201, { success: true, category: row });
        });
        return true;
    }

    const putMatch = url.match(/^\/api\/categories\/([0-9]+)$/);
    if (putMatch && (method === 'PUT' || method === 'PATCH')) {
        const id = parseInt(putMatch[1]);
        parseBody(req, (err, data) => {
            if (err) return json(res, 400, { error: { code: 'bad_request', message: 'Неверный JSON' } });
            const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
            if (!row) return json(res, 404, { error: { code: 'not_found', message: 'Категория не найдена' } });

            const fields = [];
            const vals = [];
            ['name', 'slug', 'description', 'icon'].forEach(f => {
                if (data[f] !== undefined) { fields.push(`${f} = ?`); vals.push(data[f]); }
            });

            if (fields.length === 0) return json(res, 422, { error: { code: 'validation_error', message: 'Нет данных для обновления' } });

            if (data.slug && data.slug !== row.slug) {
                const existing = db.prepare('SELECT * FROM categories WHERE slug = ? AND id != ?').get(data.slug, id);
                if (existing) return json(res, 422, { error: { code: 'validation_error', message: 'Категория с таким slug уже существует' } });
            }

            vals.push(id);
            db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
            const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
            json(res, 200, { success: true, category: updated });
        });
        return true;
    }

    const delMatch = url.match(/^\/api\/categories\/([0-9]+)$/);
    if (delMatch && method === 'DELETE') {
        const id = parseInt(delMatch[1]);
        const equipmentCount = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE category_id = ?').get(id).c;
        if (equipmentCount > 0) {
            return json(res, 422, { error: { code: 'validation_error', message: `Невозможно удалить категорию. К ней привязано ${equipmentCount} единиц техники.` } }), true;
        }
        const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        if (result.changes === 0) return json(res, 404, { error: { code: 'not_found', message: 'Категория не найдена' } }), true;
        json(res, 200, { success: true, message: 'Категория удалена' });
        return true;
    }

    return false;
}

module.exports = { handleCategoryRoutes };
