-- ============================================================
-- ООО "Модуль" — Логическая и физическая модель базы данных
-- СУБД: SQLite3 (кроссплатформенная)
-- ============================================================

-- Логическая модель (сущности и связи):
--
-- users (1) ───< rentals >─── (1) equipment
-- categories (1) ───< equipment
--
-- users:       id PK, username UK, email, password, full_name, phone, role, token, created_at
-- categories:  id PK, name, slug UK, description, icon
-- equipment:   id PK, category_id FK, name, slug, description, specs, price_per_day, image_url, status, created_at
-- rentals:     id PK, user_id FK, equipment_id FK, start_date, end_date, total_days, total_price,
--              status, contact_phone, comment, created_at, updated_at

-- ============================================================
-- Физическая модель
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    password    TEXT NOT NULL,
    full_name   TEXT,
    phone       TEXT,
    role        TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client','admin')),
    token       TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);

-- Таблица категорий спецтехники
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    description TEXT,
    icon        TEXT
);

-- Таблица техники
CREATE TABLE IF NOT EXISTS equipment (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    specs           TEXT,
    price_per_day   INTEGER NOT NULL,
    image_url       TEXT,
    status          TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','rented','maintenance')),
    created_at      TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status   ON equipment(status);

-- Таблица заявок на аренду
CREATE TABLE IF NOT EXISTS rentals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL,
    equipment_id    INTEGER NOT NULL,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    total_days      INTEGER NOT NULL,
    total_price     INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
    contact_phone   TEXT,
    comment         TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT,
    FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rentals_user      ON rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_equipment ON rentals(equipment_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status    ON rentals(status);
