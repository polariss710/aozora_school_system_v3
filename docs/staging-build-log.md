# V3 staging 建设记录

更新日期：2026-07-18

## 当前阶段

- 建设分支：`codex/v3-staging`。
- School V3 基线：`main@2a0d73c`。
- Cash 提升候选：`codex/cash-dev-environment@47731f4522689fa686b153c7ba997adc92330465`，已通过远端只读查询核实。
- Supabase project：`aozora-school-v3-staging`，ref `bxnxdkbjlxkcqwzzeyds`，Tokyo `ap-northeast-1`，micro compute。
- Render：API、School 静态站和 Cash 静态站均已创建并上线。
- 现行 School V2 production、Cash production 和 `v3-dev` 均未修改；没有读取、导出或导入生产数据。

项目创建时曾因地域选择器误建一个 Mumbai 空 project；在任何 schema、Auth user 或数据写入前已永久删除。该空 project 不包含数据，也未作为任何部署环境使用。

## Supabase 安装结果

- School Prisma migrations：期望 19、已应用 19、pending 0、failed / drift 0。
- Cash preflight：安装前 `home_*` relation、function 和 policy 均为 0。
- Cash 安装后：10 张表、48 个函数、10 个 RLS policy、4 个同步 guard trigger。
- 权限负向检查：`anon` 表权限 0、`anon` 函数权限 0。
- staging Cash Auth user：1 个独立用户；未复用 dev / production UUID。
- 合成 Cash seed：4 个 `STAGING Cash` 账户，其中 3 个允许 School 请求。
- Supabase Auth Site URL 与 redirect allowlist 只配置 Cash staging 域名。

## Render 部署结果

- API：`https://aozora-school-system-v3-api-staging.onrender.com`，branch `codex/v3-staging`。
- School：`https://aozora-school-system-v3-staging.onrender.com`，branch `codex/v3-staging`。
- Cash：`https://aozora-cash-v3-staging.onrender.com`，branch `codex/cash-staging-environment`。
- API health：`/api/health` 返回 `status=ok`；`/api/health/db` 返回 `database.status=ok`。
- API 启动：东京 Session Pooler 可达，19 migrations 无 pending，seed 完成，Nest service live。
- CORS：School staging 与 Cash staging origin 获得精确 allow；dev origin 不返回 `Access-Control-Allow-Origin`。
- School bundle 只包含 staging API URL；缺失 `VITE_API_BASE_URL` 时改为当前 origin fail-closed，不再回退 dev。
- Cash bundle 使用 staging Supabase ref 与 staging School callback URL；构建时注入 staging publishable key，仓库不提交 key。

Render Free 的 IPv4 网络不能访问 Supabase IPv6 direct host，因此 deploy-time migration 使用 Session Pooler。Prisma `pg` adapter 对当前 pooler 证书链要求显式兼容配置；staging 的 `DATABASE_URL` 目前使用连接级 `sslmode=no-verify`，只影响该数据库连接，没有关闭全局 TLS。prod 建设前必须改为受信 CA / `verify-full`，此项是 prod blocker，不影响本轮空 staging 继续做合成 E2E。

## 冻结验证

- API tests：10 files / 45 tests passed。
- API build：通过。
- Web build：通过；保留现有 Vite 大 chunk warning，不作为本轮 staging 阻断项。
- Prisma migration：19 个。
- Cash 结构与验证 SQL：14 个 dev 冻结文件，另有 2 个 staging 专用 seed 文件。
- 文件校验和：`docs/staging-freeze-20260718.sha256`。

Dev 真实 E2E 身份沿用 `docs/current-status.md` 的已验收记录：

- FX 测试链：`DEV-SCHOOL-FX-20260718`。
- 老师工资聚合 Cash batch：`42a92327-23b1-42a0-b892-f1a0480872c3`。
- 老师工资聚合 Cash transaction：`8e219366-db11-4afc-a150-8e6df7d93ae7`。
- 老师工资聚合 School batch：`65be52d5-c7f6-4318-be73-a757c4cb9ae0`。
- 工资整组拒绝：`2026-12`，JPY 31,000，理由 `E2E atomic group rejection`，零 Cash transaction。

## 本轮 staging 边界

- 只安装版本化 School migrations、Cash `home_*` 结构和 staging 专用合成账户。
- 首轮只创建 `STAGING-E2E-*` 合成数据。
- 不复制 School 或 Cash production schema dump、ACL、Auth user 或业务数据。
- 不创建或写入 `v3-prod`。

## 已知限制与不进入项

- Cash pending request 没有 cancel 合同；真实外部请求不支持撤回。
- FX 入站不支持部分购汇分摊，只支持 CNY 精确合计匹配。
- 生产数据 mapping、迁移程序、Cash ledger 迁移和 prod 切换不进入本轮空 staging 建设。
- 运营告警、prod 切换窗口、负责人清单在 staging E2E 完成后形成。
- 当前完成的是 staging 基础设施、schema、权限、seed、部署和健康检查；完整合成业务 E2E 矩阵及对账报告尚未执行，因此 staging 尚未达到第 10 节完成标准。

## 环境防串线

- 非 dev API 启动必须提供 `SCHOOL_ENVIRONMENT_PROJECT_REF`，Cash URL、runtime DB URL 和 direct DB URL 必须包含同一 project ref。
- staging/prod 禁止 Cash mock。
- 可通过 `SCHOOL_FORBIDDEN_PROJECT_REFS`、`SCHOOL_FORBIDDEN_CASH_USER_IDS` 和 `SCHOOL_FORBIDDEN_ORIGIN_MARKERS` 拒绝已知其他环境身份。
- 启动日志只输出环境名，不输出 project ref、UUID、URL 或 key。
