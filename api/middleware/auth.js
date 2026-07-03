const { db } = require('../utils/db');

function authMiddleware(requiredRole = null) {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 'unauthorized', message: 'Отсутствует или неверный Bearer токен' } }));
            return;
        }
        const token = authHeader.split(' ')[1];
        const row = db.prepare('SELECT * FROM users WHERE token = ?').get(token);
        if (!row) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 'unauthorized', message: 'Недействительный токен' } }));
            return;
        }
        if (requiredRole && row.role !== requiredRole) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 'forbidden', message: 'Недостаточно прав' } }));
            return;
        }
        req.user = row;
        next();
    };
}

module.exports = { authMiddleware };
