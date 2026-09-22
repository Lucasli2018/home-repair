// 共享 schema：建表 DDL + 基础种子（师傅/标签/服务/排班）
// 单一数据源：_middleware.js 首访自动建表 + 本地开发种子 引用本模块；
// scripts/gen-schema.mjs 也引用本模块生成 schema.sql（远程 D1 初始化脚本）。
// 修改表结构或基础种子请只改这里，避免与 schema.sql / middleware 漂移。

// ============ 建表 DDL（每条一条语句）============
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS masters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    avatar_key      TEXT,
    bio             TEXT,
    phone           TEXT,
    city            TEXT NOT NULL DEFAULT '上海',
    district        TEXT,
    rating_avg      REAL NOT NULL DEFAULT 0,
    rating_count    INTEGER NOT NULL DEFAULT 0,
    price_min_cents INTEGER,
    price_max_cents INTEGER,
    status          TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','paused')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_masters_status_sort ON masters(status, sort_order)`,

  `CREATE TABLE IF NOT EXISTS master_tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    tag       TEXT NOT NULL,
    UNIQUE(master_id, tag)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_master_tags_tag ON master_tags(tag)`,

  `CREATE TABLE IF NOT EXISTS master_certificates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id  INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    cert_key   TEXT NOT NULL,
    title      TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_certs_master ON master_certificates(master_id, sort_order)`,

  `CREATE TABLE IF NOT EXISTS services (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id    INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    duration_min INTEGER NOT NULL CHECK (duration_min > 0),
    price_cents  INTEGER,
    category     TEXT NOT NULL CHECK (category IN ('repair','cleaning','install','other')),
    subcategory  TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_services_master ON services(master_id, sort_order, active)`,
  `CREATE INDEX IF NOT EXISTS idx_services_category ON services(category, active)`,

  `CREATE TABLE IF NOT EXISTS master_schedule (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id    INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    weekday      INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    opens_at     TEXT NOT NULL,
    closes_at    TEXT NOT NULL,
    slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes IN (30,60,90,120)),
    capacity     INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 5),
    active       INTEGER NOT NULL DEFAULT 1,
    UNIQUE(master_id, weekday)
  )`,

  `CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id       INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    service_id      INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    customer_name   TEXT NOT NULL,
    customer_phone  TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    scheduled_at    TEXT NOT NULL,
    duration_min    INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','confirmed','done','cancelled','rejected')),
    note            TEXT,
    customer_email  TEXT,
    confirmed_at    TEXT,
    done_at         TEXT,
    cancelled_at    TEXT,
    rejected_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_master_time_status
    ON bookings(master_id, scheduled_at, status)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(customer_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,

  `CREATE TABLE IF NOT EXISTS reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id    INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    master_id     INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content       TEXT,
    hidden        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_master ON reviews(master_id, hidden, created_at)`,

  `CREATE TABLE IF NOT EXISTS admin_accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    pass_hash     TEXT NOT NULL,
    pass_salt     TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'super'
      CHECK (role IN ('super','master')),
    master_id     INTEGER REFERENCES masters(id) ON DELETE SET NULL,
    last_login_at TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
  )`,

  `CREATE TABLE IF NOT EXISTS admin_sessions (
    token       TEXT PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
    expires_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_sessions_account ON admin_sessions(account_id, expires_at)`,
];

// ============ 基础种子（师傅 + 标签 + 服务 + 排班）============
// 注意：ids 由插入顺序决定（masters 1..N，services 1..M），
// 测试数据（seed-test.js）依赖这里的 id 顺序，改动插入顺序需同步更新测试数据。
export const BASE_SEED_STATEMENTS = [
  `INSERT OR IGNORE INTO masters(code, name, bio, phone, city, district, price_min_cents, price_max_cents, status, sort_order) VALUES
    ('zhang-plumber', '张师傅', '二十年水电维修经验，持电工证，解决各类水电疑难杂症。', '13800000001', '上海', '浦东新区', 8000,  30000, 'active', 10),
    ('wang-cleaner', '王阿姨', '资深保洁员，擅长日常保洁、深度清洁、新房开荒。', '13800000002', '上海', '徐汇区',   2000, 15000, 'active', 20),
    ('li-installer', '李师傅', '专业家具家电安装，细心负责，工具齐全。',           '13800000003', '上海', '静安区',  5000, 20000, 'active', 30),
    ('chen-electric', '陈师傅', '北京十年电工，精通电线路检修、水管维修与管道疏通。', '13800000004', '北京', '朝阳区',  9000, 25000, 'active', 40),
    ('zhao-clean', '赵阿姨', '北京资深保洁，日常/深度/开荒样样在行，干活利索。',     '13800000005', '北京', '海淀区',  2200, 16000, 'active', 50),
    ('sun-install', '孙师傅', '广州家电家具安装师傅，卫浴灯具安装也拿手。',         '13800000006', '广州', '天河区',  5500, 20000, 'active', 60)`,
  `INSERT OR IGNORE INTO master_tags(master_id, tag) VALUES
    (1, '水电维修'), (1, '家电维修'), (1, '管道疏通'),
    (2, '日常保洁'), (2, '深度保洁'), (2, '新房开荒'),
    (3, '家具安装'), (3, '家电安装'),
    (4, '水电维修'), (4, '电路检修'), (4, '管道疏通'),
    (5, '日常保洁'), (5, '深度保洁'), (5, '新房开荒'),
    (6, '家具安装'), (6, '家电安装'), (6, '卫浴安装')`,
  `INSERT OR IGNORE INTO services(master_id, name, description, duration_min, price_cents, category, subcategory, sort_order) VALUES
    (1, '水龙头维修/更换', '漏水、更换阀芯、整套换新', 60,  8000, 'repair', 'water', 10),
    (1, '电路检修',       '跳闸、插座、开关检修',     90, 15000, 'repair', 'appliance', 20),
    (1, '下水管道疏通',   '马桶/洗手池/地漏堵塞',     60, 12000, 'repair', 'pipe', 30),
    (2, '日常保洁(2小时)', '厨房+卫生间+地面基础保洁', 120, 2000, 'cleaning', 'daily', 10),
    (2, '深度保洁(4小时)', '全屋深度清洁含擦玻璃',     240, 4000, 'cleaning', 'deep', 20),
    (2, '新房开荒(6小时)', '装修后首次全屋开荒保洁',   360, 8000, 'cleaning', 'rough', 30),
    (3, '家具组装',       '床/衣柜/书桌/餐桌组装',     120, 5000, 'install', 'furniture', 10),
    (3, '家电安装',       '空调/洗衣机/热水器安装',   90, 6000, 'install', 'appliance', 20),
    (4, '电路检修',       '跳闸、插座、线路老化检修', 90, 12000, 'repair', 'appliance', 10),
    (4, '水管维修',       '漏水、水管更换、接口紧固', 60, 9000,  'repair', 'water', 20),
    (4, '马桶/管道疏通',  '马桶/洗手池/地漏堵塞疏通', 60, 11000, 'repair', 'pipe', 30),
    (5, '日常保洁(2小时)', '厨房+卫生间+地面基础保洁', 120, 2200, 'cleaning', 'daily', 10),
    (5, '深度保洁(4小时)', '全屋深度清洁含擦玻璃',     240, 4200, 'cleaning', 'deep', 20),
    (5, '新房开荒(6小时)', '装修后首次全屋开荒保洁',   360, 8500, 'cleaning', 'rough', 30),
    (6, '家具组装',       '床/衣柜/书桌/餐桌组装',     120, 5500, 'install', 'furniture', 10),
    (6, '家电安装',       '空调/洗衣机/热水器安装',     90, 6500, 'install', 'appliance', 20),
    (6, '卫浴/灯具安装',  '马桶/花洒/吸顶灯安装',       90, 6000, 'install', 'appliance', 30)`,
  `INSERT OR IGNORE INTO master_schedule(master_id, weekday, opens_at, closes_at, slot_minutes, capacity) VALUES
    (1, 0, '09:00', '18:00', 60, 1), (1, 1, '09:00', '18:00', 60, 1),
    (1, 2, '09:00', '18:00', 60, 1), (1, 3, '09:00', '18:00', 60, 1),
    (1, 4, '09:00', '18:00', 60, 1), (1, 5, '09:00', '18:00', 60, 1),
    (1, 6, '09:00', '18:00', 60, 1),
    (2, 0, '09:00', '18:00', 60, 1), (2, 1, '09:00', '18:00', 60, 1),
    (2, 2, '09:00', '18:00', 60, 1), (2, 3, '09:00', '18:00', 60, 1),
    (2, 4, '09:00', '18:00', 60, 1), (2, 5, '09:00', '18:00', 60, 1),
    (2, 6, '09:00', '18:00', 60, 1),
    (3, 0, '09:00', '18:00', 60, 1), (3, 1, '09:00', '18:00', 60, 1),
    (3, 2, '09:00', '18:00', 60, 1), (3, 3, '09:00', '18:00', 60, 1),
    (3, 4, '09:00', '18:00', 60, 1), (3, 5, '09:00', '18:00', 60, 1),
    (3, 6, '09:00', '18:00', 60, 1),
    (4, 0, '09:00', '18:00', 60, 1), (4, 1, '09:00', '18:00', 60, 1),
    (4, 2, '09:00', '18:00', 60, 1), (4, 3, '09:00', '18:00', 60, 1),
    (4, 4, '09:00', '18:00', 60, 1), (4, 5, '09:00', '18:00', 60, 1),
    (4, 6, '09:00', '18:00', 60, 1),
    (5, 0, '09:00', '18:00', 60, 1), (5, 1, '09:00', '18:00', 60, 1),
    (5, 2, '09:00', '18:00', 60, 1), (5, 3, '09:00', '18:00', 60, 1),
    (5, 4, '09:00', '18:00', 60, 1), (5, 5, '09:00', '18:00', 60, 1),
    (5, 6, '09:00', '18:00', 60, 1),
    (6, 0, '09:00', '18:00', 60, 1), (6, 1, '09:00', '18:00', 60, 1),
    (6, 2, '09:00', '18:00', 60, 1), (6, 3, '09:00', '18:00', 60, 1),
    (6, 4, '09:00', '18:00', 60, 1), (6, 5, '09:00', '18:00', 60, 1),
    (6, 6, '09:00', '18:00', 60, 1)`,
];
