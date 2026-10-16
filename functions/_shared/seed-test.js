// 测试数据（演示用）：预约单 + 评价，末尾重算师傅评分
// 仅用于远程 D1 初始化（gen-schema.mjs 合并进 schema.sql），不在本地开发自动播种。
// id 依赖 functions/_shared/schema.js 的插入顺序：masters 1..6、services 1..17。
// 预约单按本文件插入顺序得到 booking_id 1..N，评价据此引用 booking_id。

export const TEST_DATA_STATEMENTS = [
  // ---- 预约单 ----
  // 已完成（上海·张师傅）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at, note)
   VALUES (1, 1, '王先生', '13800001001', '上海市浦东新区锦绣路100号 3栋501', '2026-08-15 10:00', 60, 'done',
           '2026-08-14 20:00', '2026-08-15 10:50', '厨房水龙头漏水，麻烦尽快')`,
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (1, 3, '刘女士', '13800001002', '上海市浦东新区花木路88弄12号', '2026-08-22 14:00', 60, 'done',
           '2026-08-21 19:00', '2026-08-22 14:40')`,
  // 已完成（上海·王阿姨）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (2, 4, '陈先生', '13800001003', '上海市徐汇区肇嘉浜路200号 2单元', '2026-08-18 09:30', 120, 'done',
           '2026-08-17 21:00', '2026-08-18 11:40')`,
  // 已确认（未来，上海·王阿姨）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, note)
   VALUES (2, 5, '周女士', '13800001004', '上海市徐汇区漕溪北路300号', '2026-09-28 10:00', 240, 'confirmed',
           '2026-09-20 10:00', '新房刚装修完，需要全屋开荒')`,
  // 已完成（上海·李师傅）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (3, 7, '赵先生', '13800001005', '上海市静安区南京西路150号', '2026-08-20 15:00', 120, 'done',
           '2026-08-19 18:00', '2026-08-20 17:10')`,
  // 待确认（未来，上海·李师傅）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note)
   VALUES (3, 8, '孙女士', '13800001006', '上海市静安区愚园路66号', '2026-10-05 11:00', 90, 'pending', '洗衣机想换位置重新安装')`,
  // 已完成（北京·陈师傅）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (4, 9, '杨先生', '13800001007', '北京市朝阳区建国路88号 SOHO', '2026-09-05 10:00', 90, 'done',
           '2026-09-04 20:00', '2026-09-05 11:30')`,
  // 已确认（未来，北京·赵阿姨）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at)
   VALUES (5, 12, '李女士', '13800001008', '北京市海淀区中关村大街19号', '2026-09-30 14:00', 120, 'confirmed',
           '2026-09-22 09:00')`,
  // 已完成（广州·孙师傅）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at)
   VALUES (6, 15, '黄先生', '13800001009', '广州市天河区天河路200号', '2026-08-25 09:00', 120, 'done',
           '2026-08-24 19:00', '2026-08-25 11:05')`,
  // 待确认（未来，广州·孙师傅）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note)
   VALUES (6, 16, '吴女士', '13800001010', '广州市天河区体育西路50号', '2026-10-08 16:00', 90, 'pending', '新房空调需要安装')`,
  // 已完成（上海·张师傅，电路检修）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at, note)
   VALUES (1, 2, '郑先生', '13800001011', '上海市浦东新区浦东南路500号 8楼', '2026-10-12 15:00', 90, 'done',
           '2026-10-11 18:00', '2026-10-12 16:20', '书房插座突然没电，怀疑跳闸')`,
  // 已确认（未来，上海·王阿姨，深度保洁）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, note)
   VALUES (2, 6, '冯女士', '13800001012', '上海市徐汇区田林路66弄3号', '2026-10-28 09:00', 360, 'confirmed',
           '2026-10-15 10:00', '年底大扫除，厨房油污重点处理')`,
  // 待确认（未来，北京·陈师傅，水管维修）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, note)
   VALUES (4, 10, '褚先生', '13800001013', '北京市朝阳区三里屯路19号 太古里北区', '2026-11-02 14:00', 60, 'pending', '阳台水管接口渗水')`,
  // 已取消（广州·孙师傅，卫浴安装）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, cancelled_at, note)
   VALUES (6, 17, '卫女士', '13800001014', '广州市天河区珠江新城华夏路10号', '2026-10-14 10:30', 90, 'cancelled',
           '2026-10-13 09:00', '2026-10-13 21:30', '临时出差，改期再约')`,
  // 已完成（北京·赵阿姨，新房开荒）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, confirmed_at, done_at, note)
   VALUES (5, 13, '蒋先生', '13800001015', '北京市海淀区知春路63号', '2026-10-12 13:00', 240, 'done',
           '2026-10-10 16:00', '2026-10-12 17:10', '家具刚进场，先做一轮开荒')`,
  // 已拒绝（上海·李师傅，家具组装）
  `INSERT OR IGNORE INTO hr_bookings(master_id, service_id, customer_name, customer_phone, customer_address, scheduled_at, duration_min, status, rejected_at, note)
   VALUES (3, 7, '沈女士', '13800001016', '上海市静安区延平路121号', '2026-11-05 16:00', 120, 'rejected',
           '2026-11-01 10:00', '当天已约满，建议约周末')`,

  // ---- 评价（仅已完成订单）----
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (1, 1, '王先生', 5, '师傅很专业，半小时搞定漏水，价格透明，强烈推荐！')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (2, 1, '刘女士', 4, '疏通很干净，就是来得稍微晚了一点，整体满意。')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (3, 2, '陈先生', 5, '保洁特别细致，厨房锃亮，阿姨人也好。')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (5, 3, '赵先生', 5, '组装很稳，师傅话不多但特别靠谱。')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (7, 4, '杨先生', 4, '电路修好了，收费合理，报价前能再明确点就更好了。')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (9, 6, '黄先生', 5, '家具组装又快又好，严丝合缝，非常满意。')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (11, 1, '郑先生', 5, '跳闸问题一眼看穿，顺手帮我换了老旧插座，专业！')`,
  `INSERT OR IGNORE INTO hr_reviews(booking_id, master_id, customer_name, rating, content)
   VALUES (15, 5, '蒋先生', 4, '开荒很彻底，玻璃和窗轨都干净了，工期略长但值。')`,

  // ---- 重算师傅评分（与 review.js 聚合逻辑一致）----
  `UPDATE hr_masters SET
     rating_avg = COALESCE((SELECT AVG(rating) FROM hr_reviews r WHERE r.master_id = hr_masters.id AND r.hidden = 0), 0),
     rating_count = (SELECT COUNT(*) FROM hr_reviews r WHERE r.master_id = hr_masters.id AND r.hidden = 0),
     updated_at = datetime('now','+8 hours')`,
];
