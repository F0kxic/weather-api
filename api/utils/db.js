/**
 * ООО Модуль — SQLite Engine
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'modul.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
let db;

try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
} catch (err) {
    console.error('[FATAL] SQLite:', err.message);
    process.exit(1);
}

const initSchema = db.transaction(() => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            phone TEXT,
            role TEXT NOT NULL DEFAULT 'client',
            token TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            icon TEXT
        );
        CREATE TABLE IF NOT EXISTS equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            specs TEXT,
            price_per_day INTEGER NOT NULL,
            image_url TEXT,
            status TEXT NOT NULL DEFAULT 'available',
            created_at TEXT NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS rentals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            equipment_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            total_days INTEGER NOT NULL,
            total_price INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            contact_phone TEXT,
            comment TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
        CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);
        CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
        CREATE INDEX IF NOT EXISTS idx_rentals_user ON rentals(user_id);
        CREATE INDEX IF NOT EXISTS idx_rentals_equipment ON rentals(equipment_id);
        CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
    `);
});

initSchema();

function seed() {
    const u = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    if (u > 0) return;

    const crypto = require('crypto');
    const hash = (p) => crypto.createHash('sha256').update(p).digest('hex');
    const now = new Date().toISOString();
    const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

    db.prepare(`INSERT INTO users (id, username, email, password, full_name, phone, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(genId(), 'admin', 'admin@modul.ru', hash('adminpassword'), 'Администратор', '+79000000000', 'admin', now);

    const cats = [
        ['Экскаваторы', 'ekskavatory', 'Гусеничные и колесные экскаваторы', '🚜'],
        ['Краны', 'krany', 'Автокраны и башенные краны', '🏗'],
        ['Погрузчики', 'pogruzchiki', 'Фронтальные и телескопические', '⛏'],
        ['Бульдозеры', 'buldozery', 'Гусеничные бульдозеры любой мощности', '🛡']
    ];
    const insertCat = db.prepare('INSERT INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)');
    for (const c of cats) insertCat.run(...c);

    const equip = [
        [1, 'Экскаватор CAT 320', 'cat-320', 'Гусеничный экскаватор 20 тонн, ковш 1.2 м³', 'Двигатель C7.1, 154 кВт, глубина копания 6.7 м', 15000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=CAT+320', 'available'],
        [1, 'Экскаватор Hyundai R220', 'hyundai-r220', 'Колесный экскаватор с максимальной маневренностью', 'Двигатель Cummins, 129 кВт, скорость 38 км/ч', 14000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=Hyundai+R220', 'available'],
        [2, 'Автокран КС-55713', 'avtokran-ks55713', 'Кран 25 тонн на шасси КамАЗ', 'Вылет стрелы 21 м, грузоподъёмность 25 т', 18000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=KS-55713', 'available'],
        [2, 'Башенный кран Potain', 'potain', 'Башенный кран для высотного строительства', 'Высота подъёма 60 м, груз 6 т', 25000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=Potain', 'available'],
        [3, 'Погрузчик SDLG LG936L', 'sdlg-lg936l', 'Фронтальный погрузчик 3 тонны', 'Ковш 1.8 м³, высота выгрузки 2.9 м', 12000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=SDLG+LG936L', 'available'],
        [3, 'Телескопический JCB 531-70', 'jcb-531-70', 'Телескопический погрузчик с вылетом 7 м', 'Груз 3.1 т, высота 7 м, 4x4', 16000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=JCB+531-70', 'available'],
        [4, 'Бульдозер Shantui SD16', 'shantui-sd16', 'Гусеничный бульдозер 17 тонн', 'Отвал 3.5 м, мощность 120 кВт', 13000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=Shantui+SD16', 'available'],
        [4, 'Бульдозер CAT D6', 'cat-d6', 'Тяжелый бульдозер для карьеров', 'Отвал 4.2 м, мощность 160 кВт, GPS', 20000, 'https://via.placeholder.com/400x250/f5a623/1a1a1a?text=CAT+D6', 'available']
    ];
    const insertEq = db.prepare(
        'INSERT INTO equipment (category_id, name, slug, description, specs, price_per_day, image_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const e of equip) insertEq.run(...e, now);

    console.log('[DB] Seed data inserted');
}

seed();

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

module.exports = { db, generateId };
