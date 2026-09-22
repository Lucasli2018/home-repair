// 测试数据（演示用）：预约单 + 评价，末尾重算师傅评分
// 仅用于远程 D1 初始化（gen-schema.mjs 合并进 schema.sql），不在本地开发自动播种。
// id 依赖 functions/_shared/schema.js 的插入顺序：masters 1..6、services 1..17。
// 预约单按本文件插入顺序得到 booking_id 1..N，评价据此引用 booking_id。

export const TEST_DATA_STATEMENTS = [
  // ---- 预约单 ----
  // 已完成（上海·张师傅）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at, note)
   VALUES (1, 1, '王先生', '13800001001', '上海市浦东新区锦绣路100号 3栋501', '2026-08-15 10:00', 60, 'done',
           '2026-08-14 20:00', '2026-08-15 10:50', '厨房水龙头漏水，麻烦尽快')`,
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (1, 3, '刘女士', '13800001002', '上海市浦东新区花木路88弄12号', '2026-08-22 14:00', 60, 'done',
           '2026-08-21 19:00', '2026-08-22 14:40')`,
  // 已完成（上海·王阿姨）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (2, 4, '陈先生', '13800001003', '上海市徐汇区肇嘉浜路200号 2单元', '2026-08-18 09:30', 120, 'done',
           '2026-08-17 21:00', '2026-08-18 11:40')`,
  // 已确认（未来，上海·王阿姨）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, note)
   VALUES (2, 5, '周女士', '13800001004', '上海市徐汇区漕溪北路300号', '2026-09-28 10:00', 240, 'confirmed',
           '2026-09-20 10:00', '新房刚装修完，需要全屋开荒')`,
  // 已完成（上海·李师傅）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (3, 7, '赵先生', '13800001005', '上海市静安区南京西路150号', '2026-08-20 15:00', 120, 'done',
           '2026-08-19 18:00', '2026-08-20 17:10')`,
  // 待确认（未来，上海·李师傅）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note)
   VALUES (3, 8, '孙女士', '13800001006', '上海市静安区愚园路66号', '2026-10-05 11:00', 90, 'pending', '洗衣机想换位置重新安装')`,
  // 已完成（北京·陈师傅）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (4, 9, '杨先生', '13800001007', '北京市朝阳区建国路88号 SOHO', '2026-09-05 10:00', 90, 'done',
           '2026-09-04 20:00', '2026-09-05 11:30')`,
  // 已确认（未来，北京·赵阿姨）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at)
   VALUES (5, 12, '李女士', '13800001008', '北京市海淀区中关村大街19号', '2026-09-30 14:00', 120, 'confirmed',
           '2026-09-22 09:00')`,
  // 已完成（广州·孙师傅）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (6, 15, '黄先生', '13800001009', '广州市天河区天河路200号', '2026-08-25 09:00', 120, 'done',
           '2026-08-24 19:00', '2026-08-25 11:05')`,
  // 待确认（未来，广州·孙师傅）
  `INSERT OR IGNORE INTO bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note)
   VALUES (6, 16, '吴女士', '13800001010', '广州市天河区体育西路50号', '2026-10-08 16:00', 90, 'pending', '新房空调需要安装')`,

  // ---- 评价（仅已完成订单）----
  `INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (1, 1, '王先生', 5, '师傅很专业，半小时搞定漏水，价格透明，强烈推荐！')`,
  `INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (2, 1, '刘女士', 4, '疏通很干净，就是来得稍微晚了一点，整体满意。')`,
  `INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (3, 2, '陈先生', 5, '保洁特别细致，厨房锃亮，阿姨人也好。')`,
  `INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (5, 3, '赵先生', 5, '组装很稳，师傅话不多但特别靠谱。')`,
  `INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (7, 4, '杨先生', 4, '电路修好了，收费合理，报价前能再明确点就更好了。')`,
  `INSERT OR IGNORE INTO reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (9, 6, '黄先生', 5, '家具组装又快又好，严丝合缝，非常满意。')`,

  // ---- 重算师傅评分（与 review.js 聚合逻辑一致）----
  `UPDATE masters SET
     rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.master_id = masters.id AND r.hidden = 0), 0),
     rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.master_id = masters.id AND r.hidden = 0),
     updated_at = datetime('now','+8 hours')`,
];
