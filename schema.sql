-- home-repair D1 初始化 schema（由 scripts/gen-schema.mjs 自动生成，请勿手改）
-- 建表 + 基础种子 + 测试数据。
-- 全新库：        wrangler d1 execute home-repair-db --remote --file=schema.sql
-- 本地开发无需执行（_middleware 首访自动建表 + 基础种子）

CREATE TABLE IF NOT EXISTS masters ( id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar_key TEXT, bio TEXT, phone TEXT, city TEXT NOT NULL DEFAULT '上海', district TEXT, rating_avg REAL NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0, price_min_cents INTEGER, price_max_cents INTEGER, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')), sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')), updated_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')) );

CREATE INDEX IF NOT EXISTS idx_masters_status_sort ON masters(status, sort_order);

CREATE TABLE IF NOT EXISTS master_tags ( id INTEGER PRIMARY KEY AUTOINCREMENT, master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE, tag TEXT NOT NULL, UNIQUE(master_id, tag) );

CREATE INDEX IF NOT EXISTS idx_master_tags_tag ON master_tags(tag);

CREATE TABLE IF NOT EXISTS master_certificates ( id INTEGER PRIMARY KEY AUTOINCREMENT, master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE, cert_key TEXT NOT NULL, title TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')) );

CREATE INDEX IF NOT EXISTS idx_certs_master ON master_certificates(master_id, sort_order);

CREATE TABLE IF NOT EXISTS services ( id INTEGER PRIMARY KEY AUTOINCREMENT, master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL CHECK (duration_min > 0), price_cents INTEGER, category TEXT NOT NULL CHECK (category IN ('repair','cleaning','install','other')), subcategory TEXT, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')), updated_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')) );

CREATE INDEX IF NOT EXISTS idx_services_master ON services(master_id, sort_order, active);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category, active);

CREATE TABLE IF NOT EXISTS master_schedule ( id INTEGER PRIMARY KEY AUTOINCREMENT, master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE, weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes IN (30,60,90,120)), capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 5), active INTEGER NOT NULL DEFAULT 1, UNIQUE(master_id, weekday) );

CREATE TABLE IF NOT EXISTS bookings ( id INTEGER PRIMARY KEY AUTOINCREMENT, master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE, service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_address TEXT NOT NULL, scheduled_at TEXT NOT NULL, duration_min INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','done','cancelled','rejected')), note TEXT, customer_email TEXT, confirmed_at TEXT, done_at TEXT, cancelled_at TEXT, rejected_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')), updated_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')) );

CREATE INDEX IF NOT EXISTS idx_bookings_master_time_status ON bookings(master_id, scheduled_at, status);

CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(customer_phone);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS reviews ( id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE, master_id INTEGER NOT NULL REFERENCES masters(id) ON DELETE CASCADE, customer_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), content TEXT, hidden INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')) );

CREATE INDEX IF NOT EXISTS idx_reviews_master ON reviews(master_id, hidden, created_at);

CREATE TABLE IF NOT EXISTS admin_accounts ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'super' CHECK (role IN ('super','master')), master_id INTEGER REFERENCES masters(id) ON DELETE SET NULL, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')) );

CREATE TABLE IF NOT EXISTS admin_sessions ( token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now','+8 hours')), expires_at TEXT NOT NULL );

CREATE INDEX IF NOT EXISTS idx_admin_sessions_account ON admin_sessions(account_id, expires_at);

INSERT OR IGNORE INTO masters(code, name, bio, phone, city, district, price_min_cents, price_max_cents, status, sort_order) VALUES ('zhang-plumber', '张师傅', '二十年水电维修经验，持电工证，解决各类水电疑难杂症。', '13800000001', '上海', '浦东新区', 8000, 30000, 'active', 10), ('wang-cleaner', '王阿姨', '资深保洁员，擅长日常保洁、深度清洁、新房开荒。', '13800000002', '上海', '徐汇区', 2000, 15000, 'active', 20), ('li-installer', '李师傅', '专业家具家电安装，细心负责，工具齐全。', '13800000003', '上海', '静安区', 5000, 20000, 'active', 30), ('chen-electric', '陈师傅', '北京十年电工，精通电线路检修、水管维修与管道疏通。', '13800000004', '北京', '朝阳区', 9000, 25000, 'active', 40), ('zhao-clean', '赵阿姨', '北京资深保洁，日常/深度/开荒样样在行，干活利索。', '13800000005', '北京', '海淀区', 2200, 16000, 'active', 50), ('sun-install', '孙师傅', '广州家电家具安装师傅，卫浴灯具安装也拿手。', '13800000006', '广州', '天河区', 5500, 20000, 'active', 60);

INSERT OR IGNORE INTO master_tags(master_id, tag) VALUES (1, '水电维修'), (1, '家电维修'), (1, '管道疏通'), (2, '日常保洁'), (2, '深度保洁'), (2, '新房开荒'), (3, '家具安装'), (3, '家电安装'), (4, '水电维修'), (4, '电路检修'), (4, '管道疏通'), (5, '日常保洁'), (5, '深度保洁'), (5, '新房开荒'), (6, '家具安装'), (6, '家电安装'), (6, '卫浴安装');

INSERT OR IGNORE INTO services(master_id, name, description, duration_min, price_cents, category, subcategory, sort_order) VALUES (1, '水龙头维修/更换', '漏水、更换阀芯、整套换新', 60, 8000, 'repair', 'water', 10), (1, '电路检修', '跳闸、插座、开关检修', 90, 15000, 'repair', 'appliance', 20), (1, '下水管道疏通', '马桶/洗手池/地漏堵塞', 60, 12000, 'repair', 'pipe', 30), (2, '日常保洁(2小时)', '厨房+卫生间+地面基础保洁', 120, 2000, 'cleaning', 'daily', 10), (2, '深度保洁(4小时)', '全屋深度清洁含擦玻璃', 240, 4000, 'cleaning', 'deep', 20), (2, '新房开荒(6小时)', '装修后首次全屋开荒保洁', 360, 8000, 'cleaning', 'rough', 30), (3, '家具组装', '床/衣柜/书桌/餐桌组装', 120, 5000, 'install', 'furniture', 10), (3, '家电安装', '空调/洗衣机/热水器安装', 90, 6000, 'install', 'appliance', 20), (4, '电路检修', '跳闸、插座、线路老化检修', 90, 12000, 'repair', 'appliance', 10), (4, '水管维修', '漏水、水管更换、接口紧固', 60, 9000, 'repair', 'water', 20), (4, '马桶/管道疏通', '马桶/洗手池/地漏堵塞疏通', 60, 11000, 'repair', 'pipe', 30), (5, '日常保洁(2小时)', '厨房+卫生间+地面基础保洁', 120, 2200, 'cleaning', 'daily', 10), (5, '深度保洁(4小时)', '全屋深度清洁含擦玻璃', 240, 4200, 'cleaning', 'deep', 20), (5, '新房开荒(6小时)', '装修后首次全屋开荒保洁', 360, 8500, 'cleaning', 'rough', 30), (6, '家具组装', '床/衣柜/书桌/餐桌组装', 120, 5500, 'install', 'furniture', 10), (6, '家电安装', '空调/洗衣机/热水器安装', 90, 6500, 'install', 'appliance', 20), (6, '卫浴/灯具安装', '马桶/花洒/吸顶灯安装', 90, 6000, 'install', 'appliance', 30);

INSERT OR IGNORE INTO master_schedule(master_id, weekday, opens_at, closes_at, slot_minutes, capacity) VALUES (1, 0, '09:00', '18:00', 60, 1), (1, 1, '09:00', '18:00', 60, 1), (1, 2, '09:00', '18:00', 60, 1), (1, 3, '09:00', '18:00', 60, 1), (1, 4, '09:00', '18:00', 60, 1), (1, 5, '09:00', '18:00', 60, 1), (1, 6, '09:00', '18:00', 60, 1), (2, 0, '09:00', '18:00', 60, 1), (2, 1, '09:00', '18:00', 60, 1), (2, 2, '09:00', '18:00', 60, 1), (2, 3, '09:00', '18:00', 60, 1), (2, 4, '09:00', '18:00', 60, 1), (2, 5, '09:00', '18:00', 60, 1), (2, 6, '09:00', '18:00', 60, 1), (3, 0, '09:00', '18:00', 60, 1), (3, 1, '09:00', '18:00', 60, 1), (3, 2, '09:00', '18:00', 60, 1), (3, 3, '09:00', '18:00', 60, 1), (3, 4, '09:00', '18:00', 60, 1), (3, 5, '09:00', '18:00', 60, 1), (3, 6, '09:00', '18:00', 60, 1), (4, 0, '09:00', '18:00', 60, 1), (4, 1, '09:00', '18:00', 60, 1), (4, 2, '09:00', '18:00', 60, 1), (4, 3, '09:00', '18:00', 60, 1), (4, 4, '09:00', '18:00', 60, 1), (4, 5, '09:00', '18:00', 60, 1), (4, 6, '09:00', '18:00', 60, 1), (5, 0, '09:00', '18:00', 60, 1), (5, 1, '09:00', '18:00', 60, 1), (5, 2, '09:00', '18:00', 60, 1), (5, 3, '09:00', '18:00', 60, 1), (5, 4, '09:00', '18:00', 60, 1), (5, 5, '09:00', '18:00', 60, 1), (5, 6, '09:00', '18:00', 60, 1), (6, 0, '09:00', '18:00', 60, 1), (6, 1, '09:00', '18:00', 60, 1), (6, 2, '09:00', '18:00', 60, 1), (6, 3, '09:00', '18:00', 60, 1), (6, 4, '09:00', '18:00', 60, 1), (6, 5, '09:00', '18:00', 60, 1), (6, 6, '09:00', '18:00', 60, 1);

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at, note) VALUES (1, 1, '王先生', '13800001001', '上海市浦东新区锦绣路100号 3栋501', '2026-08-15 10:00', 60, 'done', '2026-08-14 20:00', '2026-08-15 10:50', '厨房水龙头漏水，麻烦尽快');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at) VALUES (1, 3, '刘女士', '13800001002', '上海市浦东新区花木路88弄12号', '2026-08-22 14:00', 60, 'done', '2026-08-21 19:00', '2026-08-22 14:40');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at) VALUES (2, 4, '陈先生', '13800001003', '上海市徐汇区肇嘉浜路200号 2单元', '2026-08-18 09:30', 120, 'done', '2026-08-17 21:00', '2026-08-18 11:40');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, note) VALUES (2, 5, '周女士', '13800001004', '上海市徐汇区漕溪北路300号', '2026-09-28 10:00', 240, 'confirmed', '2026-09-20 10:00', '新房刚装修完，需要全屋开荒');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at) VALUES (3, 7, '赵先生', '13800001005', '上海市静安区南京西路150号', '2026-08-20 15:00', 120, 'done', '2026-08-19 18:00', '2026-08-20 17:10');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note) VALUES (3, 8, '孙女士', '13800001006', '上海市静安区愚园路66号', '2026-10-05 11:00', 90, 'pending', '洗衣机想换位置重新安装');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at) VALUES (4, 9, '杨先生', '13800001007', '北京市朝阳区建国路88号 SOHO', '2026-09-05 10:00', 90, 'done', '2026-09-04 20:00', '2026-09-05 11:30');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at) VALUES (5, 12, '李女士', '13800001008', '北京市海淀区中关村大街19号', '2026-09-30 14:00', 120, 'confirmed', '2026-09-22 09:00');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at) VALUES (6, 15, '黄先生', '13800001009', '广州市天河区天河路200号', '2026-08-25 09:00', 120, 'done', '2026-08-24 19:00', '2026-08-25 11:05');

INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note) VALUES (6, 16, '吴女士', '13800001010', '广州市天河区体育西路50号', '2026-10-08 16:00', 90, 'pending', '新房空调需要安装');

INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content) VALUES (1, 1, '王先生', 5, '师傅很专业，半小时搞定漏水，价格透明，强烈推荐！');

INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content) VALUES (2, 1, '刘女士', 4, '疏通很干净，就是来得稍微晚了一点，整体满意。');

INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content) VALUES (3, 2, '陈先生', 5, '保洁特别细致，厨房锃亮，阿姨人也好。');

INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content) VALUES (5, 3, '赵先生', 5, '组装很稳，师傅话不多但特别靠谱。');

INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content) VALUES (7, 4, '杨先生', 4, '电路修好了，收费合理，报价前能再明确点就更好了。');

INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content) VALUES (9, 6, '黄先生', 5, '家具组装又快又好，严丝合缝，非常满意。');

UPDATE masters SET rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.master_id = masters.id AND r.hidden = 0), 0), rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.master_id = masters.id AND r.hidden = 0), updated_at = datetime('now','+8 hours');
