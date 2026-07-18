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

## 2026-07-18 第一轮合成 E2E

### Cash 数据库回滚验收

- `scripts/cash-staging/verify-teacher-wage-batch.sql`：聚合成功、相同身份幂等、冲突 School batch 身份拒绝、聚合流水 update / delete guard 通过。
- `scripts/cash-staging/verify-teacher-wage-group-rejection.sql`：整组拒绝成功、相同理由幂等、分组不匹配全部零写入通过。
- `scripts/cash-staging/verify-fx-guard.sql`：FX 同步标记成功、相同身份幂等、冲突身份拒绝、CNY / JPY 双侧 update / delete guard 通过。
- 三组脚本均在事务中回滚；复核 request、batch、JPY、CNY 和 FX sync 残留均为 0。

### School API smoke

- staging 管理员登录与 `/auth/me` 通过，权限集可读。
- 学生、老师新增 / 修改 / 归档 / 恢复通过；重复学生编码返回冲突。
- 手动收入和手动支出新增 / 读取 / 作废通过；重复作废被拒绝。
- 手工账户入金新增 / 反转通过；重复反转被拒绝。
- 数据库复核最终状态为 student / teacher `active`、income / expense `voided`、account transaction `reversed`，相关目标共 14 条审计事件。

### School → Cash staging

- integration mode：`supabase`。
- 合成收入 JPY 2,200：School request `e4a4cb93-8496-4752-9b96-72d476c555ff`，Cash request `476a33a3-446c-4424-b43a-39054b72f921`。
- 合成支出 JPY 1,100：School request `42162605-a794-4202-bcfc-6eb9cbf3b285`，Cash request `6d9aeca6-8dd0-48ff-8ab5-ec724d26edb4`。
- 两端 request 均为 School `cash_requested` / Cash `pending`；事件 ID、业务引用、币种、金额和账户全部一致。
- 同一 School 记录重复提交、School 侧直接撤回、School 侧直接确认均被 API 拒绝，外部 Cash 结果所有权边界有效。

### 清理与回归

- 本轮所有 `STAGING-E2E-*` School、Cash、账户流水和相关审计记录已按引用链删除；后置盘点残留为 0。
- 临时 School staging 管理员密码 hash 已恢复为验收前值；临时密码未写入仓库或文档。
- `scripts/staging/cleanup-e2e.sql` 已在零残留状态再次执行，返回 `residual_rows = 0`。
- 本轮 staging 验收脚本校验和记录在 `docs/staging-e2e-20260718.sha256`。
- API tests：10 files / 45 tests passed；API build 和 Web build 通过，Web 仅保留已知大 chunk warning。

## 2026-07-18 第二轮真实 Cash callback E2E

### 保留验收身份

- 合成标记：`STAGING-E2E-CROSS-1784380703210`。
- JPY 2,200 income：School request `4d8063af-b404-4bef-a0a4-f99315fd8e4b`，Cash request `37de2a9c-ba0b-4f59-a98b-4e32fe831113`。
- income approve 生成唯一 Cash transaction `7a942033-8bd7-40f6-8804-a8e75bbdfcb9`。
- JPY 1,100 expense：School request `37937cc5-899f-45a7-bb02-36448117a68c`，Cash request `6212b91e-af6c-43f7-99a7-2b1fc86f5235`。

### 验收结果

- Cash income approve 成功，Cash request 为 `approved`，School request / income 均为 `cash_confirmed`；两端 transaction ID 完全一致且 Cash transaction 数为 1。
- Cash expense reject 成功，Cash request 为 `rejected`，School request / expense 为 `cash_rejected`；两端 transaction ID 均为空且 Cash transaction 数为 0。
- 两种 callback 首次回写均成功；相同 callback 重放返回幂等成功，没有新增 transaction 或结果审计事件。
- 对 approved 请求发送 rejected action、对 rejected 请求发送 approved action，均被 School 以冲突拒绝。
- 事件 ID、业务引用、金额和账户两端逐项一致；每条 School request 只有 1 条最终结果审计事件。
- 为自动验收临时轮换的 Cash staging 用户密码已恢复为原 encrypted password；School staging 管理员密码也已恢复。
- 本轮 approved / rejected 事实按验收证据保留，不进入只允许 pending 的 `cleanup-e2e.sql`。
- 用户已在 Cash staging “收支确认”页面人工确认 JPY 2,200 approved 与 JPY 1,100 rejected 两条事实可见。
- UI 验收完成后执行 `scripts/staging/cleanup-finalized-callback-e2e.sql`。脚本先核对 marker、两端 ID、状态、金额和唯一 transaction ID，首轮因文本 / UUID 类型比较不匹配而整体回滚；修正后事务成功并返回 `residual_rows = 0`。
- 后置全局盘点确认 students、teachers、income_records、expense_records、account_transactions 与 Cash external requests 中 `STAGING-E2E-*` 记录均为 0。

### Cash staging 页面标识

- 页面真实登录和 pending 列表读取通过，但发现 staging 分支仍显示 `家庭账本 DEV / V3 开发环境`。
- Cash staging 分支 commit `4b9dba7` 已改为 `家庭账本 STAGING / V3 验收环境`，版本升为 `20260718-cash-staging-v3-2`；没有修改 Cash production `main` 工作树。
- Render Cash staging 静态站未自动触发部署；已于 2026-07-18 手动执行 `Deploy latest commit`，`4b9dba7` 显示为 `Live`。线上 HTML 复核通过：标题为 `家庭账本 STAGING`、环境为 `V3 验收环境`、静态资源版本为 `20260718-cash-staging-v3-2`。

## 2026-07-18 第三轮 School 核心主链路 E2E

- 脚本：`scripts/staging/school-core-smoke.mjs`；清理：`scripts/staging/cleanup-school-core-e2e.sql`。
- 合成标记：`STAGING-E2E-CORE-1784383653905`；使用 2099-02 合成数据，不含 production 数据。
- JPY 6,000 预定课时成功生成 1 条 1.5 小时实际课时；学生月结 preview 与 lock 均通过，锁定后同月新增课时被拒绝。
- JPY 2,000 / 小时工资规则计算出 base JPY 3,000；工资 preview、lock、交通费 500、教室费 200、手工调整 -100、总额 JPY 3,600、adjustment confirm 与 revoke 均通过。
- 工资 snapshot 锁定期间修改来源实际课时被拒绝。
- 一次性 staging 管理员只在进程内使用随机密码；前两次建号因数据库无 ID / 时间戳默认值而在单事务内完整回滚，第三次成功运行后该用户及角色已删除。
- 清理事务确认 settlement 与 wage snapshot 已 revoked 且未生成 income / expense 后删除引用链；独立后置盘点确认临时管理员及全部 `STAGING-E2E-CORE-*` 表均为 0。
- 更新后的验收脚本校验和全部通过；API 10 files / 45 tests、API build 与 Web build 通过，Web 仅保留已知大 chunk warning。

## 已知限制与不进入项

- Cash pending request 没有 cancel 合同；真实外部请求不支持撤回。
- FX 入站不支持部分购汇分摊，只支持 CNY 精确合计匹配。
- 生产数据 mapping、迁移程序、Cash ledger 迁移和 prod 切换不进入本轮空 staging 建设。
- 运营告警、prod 切换窗口、负责人清单在 staging E2E 完成后形成。
- 当前完成的是 staging 基础设施、schema、权限、seed、部署、健康检查、第一轮基础 / pending / 回滚型 E2E、第二轮 JPY income approve / expense reject / callback / 重放 / 冲突拒绝与对账，以及第三轮课程 / 学生月结 / 老师工资 snapshot 核心链路。学费账单 / 收据、工资 expense→Cash 真实聚合 callback、CNY canonical approve、FX 入站、私塾打工和完整对账报告尚未执行，因此 staging 尚未达到第 10 节完成标准。

## 环境防串线

- 非 dev API 启动必须提供 `SCHOOL_ENVIRONMENT_PROJECT_REF`，Cash URL、runtime DB URL 和 direct DB URL 必须包含同一 project ref。
- staging/prod 禁止 Cash mock。
- 可通过 `SCHOOL_FORBIDDEN_PROJECT_REFS`、`SCHOOL_FORBIDDEN_CASH_USER_IDS` 和 `SCHOOL_FORBIDDEN_ORIGIN_MARKERS` 拒绝已知其他环境身份。
- 启动日志只输出环境名，不输出 project ref、UUID、URL 或 key。
