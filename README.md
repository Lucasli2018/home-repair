# 家庭维修 / 家政预约

基于 Cloudflare Pages + Functions + D1 + R2 的家庭维修/家政预约应用。移动端优先，底部固定导航 + 左侧抽屉菜单。

## 技术栈

- **Cloudflare Pages** — 托管前端静态资源
- **Pages Functions** — 后端 API（`/api/*`）
- **D1** — 师傅/服务/订单/评价数据（**共享 dev 库**，本项目表统一带 `hr_` 前缀）
- **R2** — 师傅头像、证书图片

> 数据源：Cloudflare **共享 dev 库**（`database_name=dev`，`database_id=3c83aee3-4645-450b-b50b-6488750deeb4`），
> 多项目共用同一 D1 实例，本项目全部 9 张表以 `hr_` 前缀隔离（`hr_masters`/`hr_bookings`/…），互不冲突。

> 注意：`schema.sql` 由 `scripts/gen-schema.mjs` 自动生成（建表 DDL + 基础种子 + 测试数据）。
> 改表结构/种子请改 `functions/_shared/schema.js` 与 `functions/_shared/seed-test.js`，再跑 `node scripts/gen-schema.mjs` 重新生成，**勿手改 `schema.sql`**。
> `_middleware.js` 首访自动建表 + 基础种子同样引用 `schema.js`，保证单一数据源。

## 核心功能

- 服务分类（维修/保洁/安装/其他）
- 师傅列表（头像、标签、评分、价格区间、证书）
- 预约时间（按师傅排班生成可用时段，原子 INSERT 防并发）
- 评价系统（订单完成后评分 + 文字评价，聚合更新师傅评分）
- 后台管理（师傅/服务/排班/订单/评价 + R2 图片上传）

## 第一次部署

### 1. 安装 wrangler

```powershell
npm install -g wrangler
wrangler login
```

### 2. 创建 Cloudflare 资源

- **D1 数据库**：使用**共享 dev 库**（`database_id=3c83aee3-4645-450b-b50b-6488750deeb4`，多项目共用，无需再创建）
- **R2 存储桶**：`home-repair-images`（在 Dashboard 创建）

### 3. 配置 wrangler.toml

`wrangler.toml` 已绑定共享 dev 库（`database_name = "dev"`），一般无需改动：

```toml
[[d1_databases]]
binding = "DB"
database_name = "dev"
database_id = "3c83aee3-4645-450b-b50b-6488750deeb4"

[[r2_buckets]]
binding = "R2"
bucket_name = "home-repair-images"
```

### 4. 初始化生产数据库

把 `schema.sql`（建表 + 基础种子 + 测试数据）应用到共享 dev 库，二选一：

```powershell
# 方式一：REST API（读 Machine 级 CLOUDFLARE_API_TOKEN，自动自检表与行数）
node scripts/init-d1.mjs

# 方式二：wrangler
wrangler d1 execute dev --remote --file=schema.sql
```

### 5. 本地开发

```powershell
wrangler pages dev --port 8787 --persist-to ./.wrangler-dev
```

- 用户端：http://localhost:8787/
- 后台：http://localhost:8787/admin.html
- 默认管理员：`admin` / `admin123`（首访自动播种，请尽快改密码）

### 6. 部署到 Cloudflare Pages

```powershell
wrangler pages deploy . --project-name=home-repair
```

## 数据模型

共享 dev 库中本项目表统一带 `hr_` 前缀：

| 表 | 说明 |
|----|------|
| `hr_masters` | 师傅主表（code/name/avatar/bio/phone/rating/price） |
| `hr_master_tags` | 技能标签（水电维修/深度保洁…） |
| `hr_master_certificates` | 证书图片（R2 key + title） |
| `hr_services` | 服务项目（category: repair/cleaning/install/other） |
| `hr_master_schedule` | 每周排班（weekday + opens_at + closes_at + slot_minutes + capacity） |
| `hr_bookings` | 预约（含 customer_address 上门地址，status: pending→confirmed→done） |
| `hr_reviews` | 评价（一单一评，UNIQUE(booking_id)，1-5 星） |
| `hr_admin_accounts` | 平台管理员（role: super/master） |
| `hr_admin_sessions` | 24h 会话 token |

> 测试数据（`functions/_shared/seed-test.js` → `schema.sql`）：6 位师傅 / 17 项服务 / 42 条排班 /
> 16 条预约单（done 8、confirmed 3、pending 3、cancelled 1、rejected 1）/ 8 条评价。
> 改测试数据后重跑 `node scripts/gen-schema.mjs && node scripts/init-d1.mjs`。

## API 概览

### 公开接口
- `GET /api/categories` — 分类目录
- `GET /api/masters?category=&q=&city=` — 师傅列表（响应含可用城市 `cities`）
- `GET /api/masters/:code` — 师傅详情（含服务/证书/评价）
- `GET /api/services/:code?category=` — 师傅服务列表
- `GET /api/slots/:code?serviceId=&date=` — 可用时段
- `POST /api/bookings/:code` — 提交预约（原子 INSERT 防并发）
- `GET /api/my?phone=&status=` — 我的订单
- `POST /api/my/:id/cancel` — 取消订单
- `POST /api/my/:id/review` — 评价
- `GET /api/image/:key` — 公开读 R2 图片

### 管理接口（Bearer token）
- `POST /api/admin/auth` — 登录
- `GET/POST /api/admin/masters` + `GET/PUT/DELETE /api/admin/masters/:id`
- `GET/POST /api/admin/services` + `PUT/DELETE /api/admin/services/:id`
- `GET/POST /api/admin/schedule`
- `GET /api/admin/bookings` + `POST /api/admin/bookings/:id`（状态变更）
- `GET /api/admin/reviews` + `POST /api/admin/reviews/:id/hide`
- `POST /api/admin/upload` — 上传图片到 R2

## 预约流程

1. 用户浏览师傅 → 选服务 → 选时间（按排班生成时段）→ 填信息（姓名/手机/上门地址/备注）
2. 后端用 `INSERT ... WHERE NOT EXISTS` 原子 SQL 防并发冲突
3. 师傅在后台确认/拒绝 → 上门服务 → 标记完成
4. 用户评价（1-5 星 + 文字）→ 聚合更新师傅 rating_avg/rating_count

## 目录结构

```
home-repair/
├── wrangler.toml              # Cloudflare Pages 配置（D1 绑共享 dev 库）
├── schema.sql                 # D1 全量建表 + seed（hr_ 前缀，gen-schema.mjs 生成）
├── functions/                  # Pages Functions 后端
│   ├── _middleware.js          # CORS + 首访建表 + seed
│   ├── _shared/                # 共享工具（schema.js 单一数据源）
│   └── api/                    # API 路由
│       ├── categories.js
│       ├── masters/
│       ├── services/
│       ├── slots/
│       ├── bookings/
│       ├── my/
│       ├── image/
│       └── admin/              # 后台 API
├── scripts/
│   ├── gen-schema.mjs          # 由 _shared/schema.js + seed-test.js 生成 schema.sql
│   └── init-d1.mjs             # 把 schema.sql 应用到共享 dev 库（REST，含自检）
└── public/                     # 前端
    ├── index.html              # 用户端 SPA
    ├── admin.html              # 后台
    ├── css/                    # 5 层 CSS
    └── js/                     # core/ui/features
```
