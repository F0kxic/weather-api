const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { db } = require('./utils/db');
const { handleAuthRoutes, json } = require('./routes/auth');
const { handleUserRoutes } = require('./routes/users');
const { handleCategoryRoutes } = require('./routes/categories');
const { handleEquipmentRoutes } = require('./routes/equipment');
const { handleRentalRoutes } = require('./routes/rentals');
const { authMiddleware } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

function serveStatic(req, res) {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(ROOT_DIR, pathname);
    const ext = path.extname(filePath).toLowerCase();
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' });
    fs.createReadStream(filePath).pipe(res);
    return true;
}

const server = http.createServer((req, res) => {
    const start = Date.now();
    const pathname = url.parse(req.url).pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
        res.end();
        return;
    }

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} ${res.statusCode} ${duration}ms`);
    });

    if (pathname.startsWith('/api/')) {
        if (pathname === '/api/stats' && req.method === 'GET') {
            const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
            const equipment = db.prepare('SELECT COUNT(*) AS c FROM equipment').get().c;
            const available = db.prepare("SELECT COUNT(*) AS c FROM equipment WHERE status = 'available'").get().c;
            const rented = db.prepare("SELECT COUNT(*) AS c FROM equipment WHERE status = 'rented'").get().c;
            const rentals = db.prepare('SELECT COUNT(*) AS c FROM rentals').get().c;
            const pending = db.prepare("SELECT COUNT(*) AS c FROM rentals WHERE status = 'pending'").get().c;
            json(res, 200, { users, equipment, available, rented, rentals, pending });
            return;
        }

        if (handleAuthRoutes(req, res)) return;

        if (pathname.startsWith('/api/users')) {
            authMiddleware('admin')(req, res, () => {
                if (handleUserRoutes(req, res)) return;
                json(res, 404, { error: { code: 'not_found', message: 'Endpoint не найден' } });
            });
            return;
        }

        if (pathname.startsWith('/api/categories')) {
            if (handleCategoryRoutes(req, res)) return;
            json(res, 404, { error: { code: 'not_found', message: 'Endpoint не найден' } });
            return;
        }

        if (pathname.startsWith('/api/equipment')) {
            if (req.method === 'GET' && (pathname === '/api/equipment' || /^\/api\/equipment\/[0-9]+$/.test(pathname))) {
                if (handleEquipmentRoutes(req, res)) return;
            }
            authMiddleware('admin')(req, res, () => {
                if (handleEquipmentRoutes(req, res)) return;
                json(res, 404, { error: { code: 'not_found', message: 'Endpoint не найден' } });
            });
            return;
        }

        if (pathname.startsWith('/api/rentals')) {
            authMiddleware()(req, res, () => {
                if (handleRentalRoutes(req, res)) return;
                json(res, 404, { error: { code: 'not_found', message: 'Endpoint не найден' } });
            });
            return;
        }

        json(res, 404, { error: { code: 'not_found', message: 'API endpoint не найден' } });
        return;
    }

    if (serveStatic(req, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`====================================`);
    console.log(` ООО Модуль — Аренда спецтехники`);
    console.log(`====================================`);
    console.log(` Listening: http://localhost:${PORT}`);
    console.log(` Press Ctrl+C to stop`);
    console.log(`====================================`);
});

process.on('SIGINT', () => {
    console.log('\n[SHUTDOWN] Закрытие сервера и базы данных...');
    server.close(() => { db.close(); console.log('[SHUTDOWN] Готово.'); process.exit(0); });
});

module.exports = server;
