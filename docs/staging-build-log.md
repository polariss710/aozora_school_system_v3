# V3 staging 建设记录

更新日期：2026-07-20

## 当前阶段

- 普通教学受控 snapshot 已在 `v3-staging` 完成单事务初始演练并通过幂等、审计、0 Cash request 与 legacy actual link 复核；School schema 为 26 个 migrations。
- `legacy_v2_import` 普通教学课时已在 API 拒绝日常写操作，School 页面明确显示“历史导入 · 只读”，并支持只读查看对应迁移审计元数据，避免验收误改副本。

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
- 运营告警的接收设置、prod 切换窗口、负责人清单仍需在进入 prod 前确认。
- 当前已完成 staging 基础设施、schema、权限、seed、部署、健康检查、完整合成业务 E2E、工资聚合 / FX UI 人工验收、所有验收事实清理、最终数据库对账与无密钥运营探针。每小时 GitHub Actions workflow 已配置在 staging 分支，待进入默认分支后验证定时运行和通知接收；production 数据迁移演练仍未完成，因此不进入 `v3-prod` 建设。

## 2026-07-19 第四轮学费账单与收据 E2E

- 脚本：`scripts/staging/tuition-receipt-smoke.mjs`；清理：`scripts/staging/cleanup-tuition-receipt-e2e.sql`。
- preview fingerprint 冲突被拒绝；JPY 6,000 账单生成成功，重复生成返回 unchanged；收入生成重复调用幂等。
- Cash approve、School callback、callback replay 均通过；live receipt 读取正确，签发后 receipt snapshot 锁定，重复签发幂等且只有 1 条收据。
- 首次清理因 Cash external request 的 note 为空而安全回滚；改为沿 School income → cash_request → external request 引用链核对后清理，返回 `residual_rows = 0`。

## 2026-07-19 第五轮 CNY canonical approve E2E

- 脚本：`scripts/staging/cny-callback-smoke.mjs`；清理：`scripts/staging/cleanup-cny-callback-e2e.sql`。
- CNY 123.45 收入与 CNY 67.89 支出各生成一条 external Cash request；两笔均 approve 成功并生成唯一 CNY transaction。
- 两笔 School callback 首次回写成功；相同 callback 重放均幂等，收入与支出最终均为 `cash_confirmed`。
- Cash 密码恢复、一次性 School 管理员删除和 CNY 合成记录清理均已完成，清理返回 `residual_rows = 0`。

## 2026-07-19 第六轮老师工资真实聚合 callback E2E

- 脚本：`scripts/staging/wage-batch-callback-smoke.mjs`；独立对账：`scripts/staging/verify-wage-batch-e2e.sql`。
- 合成标记：`STAGING-E2E-WAGE-BATCH-1784390004`；只在 staging 预置同一老师 / 2099-05 的两条 canonical 工资 snapshot 与支出，业务归属分别为 Staging 工资业务 A / B，金额为 JPY 2,100 / 1,800。没有读取或导入 production 数据。
- 两条支出经正式 School API 提交到同一 Cash JPY 账户、同一付款日；Cash 正式 `home_approve_teacher_wage_request_batch` 聚合 approve 只生成一条 JPY 3,900 transaction。
- 聚合 approve 重放返回既有 batch / transaction；School `/api/cash/callbacks/request-batch-result` 首次创建一个 payment batch 与两条 item，重放幂等；Cash School-sync marker 首次写入、相同身份重放幂等，冲突 School batch 身份被拒绝。
- 两条 School cash request 与 expense 均为 `cash_confirmed`；独立 SQL 对账确认 Cash header / items / requests / transaction、School batch / items / expenses 和两条 critical audit 全部一致，并在回滚事务内确认聚合 Cash transaction mutation guard 生效。
- 保留身份：Cash batch `c9312d4f-4712-46b0-a08b-5081f3def62c`；Cash transaction `4d7e6083-2c28-43ce-8a03-01314d3ba4a9`；School batch `6e55688a-1d74-44f6-ab9a-18fab19f4ea4`；Cash requests `9680bd4c-ef9a-4347-aab5-416b39d9719e` / `c7ea787c-18e7-4433-b25d-a93694f9243c`。
- 临时 School 管理员已删除（后置盘点 0），Cash staging 密码已恢复原 encrypted password。业务证据为 Cash staging UI 人工验收而保留，确认前不清理。
- 后置回归：API 10 files / 45 tests、API build 与 Web build 均通过；Web 仅保留已知的大 chunk warning。

## 2026-07-19 第七轮 CNY→JPY FX 入站 E2E

- 脚本：`scripts/staging/fx-inbound-smoke.mjs`；独立对账：`scripts/staging/verify-fx-inbound-e2e.sql`。
- 合成标记：`STAGING-E2E-FX-1784423188456`。一条 CNY 88.00 School 手工收入先经真实 Cash approve、School callback 和 replay 确认为来源候选；Cash 正式 `home_create_cny_to_jpy_fx` 生成 CNY `fx_out` `22223532-2609-439a-bb48-3b48b53f34e1` 与 JPY 1,800 `fx_in` `091daf51-6326-41b7-83a2-b40d17493da2`。
- School options 重新读取交易对并只返回同一 CNY 账户的 confirmed 收入和 active JPY corporate account；callback 创建 inbound event `aad7aa27-62f8-4220-9371-c71265a5f7b2` 与唯一 account transaction `76591bca-0529-4ae0-9a03-2309886877b2`，来源收入推进到 `account_transaction_created`。
- 首次运行在 Render 冷启动期间于 School 登录前超时，后置盘点确认临时用户、income 和 FX 均为 0；第二次业务创建成功，但脚本因 Prisma Decimal JSON 为字符串 `"88"` 而在类型严格断言处停止。修正数值化比较后沿原 FX / School 身份继续，未重建交易。
- 相同 School callback replay 幂等，冲突 corporate account 被 409 拒绝；Cash sync `cccba270-6779-44c6-88ad-2bbe4b09f618` 首次写入、相同身份重放幂等、冲突 School event 拒绝。独立 SQL 对账通过，并在 rollback 事务验证 CNY / JPY 两侧 update / delete 四种 guard。
- 业务证据曾保留等待 Cash staging UI 人工确认；`cleanup-finalized-fx-inbound-e2e.sql` 先在 rollback 事务中完成全链精确清理试运行。用户确认 UI 正常后正式清理并返回 0。

## 2026-07-19 第八轮私塾打工主链路 E2E

- 脚本：`scripts/staging/external-work-smoke.mjs`；清理：`scripts/staging/cleanup-external-work-e2e.sql`。
- 合成工作地点与 2099-07 一条 2 小时课时完成 planned→actual；课时工资 JPY 5,000、交通费 JPY 500、结算调整 -JPY 200，月结 preview / lock / export 总额为 JPY 5,300。
- 月结锁定后修改实际课时被拒绝；收入生成首次创建且 replay 返回同一 income，生成收入后 settlement revoke 被拒绝。
- JPY 5,300 收入完成真实 Cash approve、School callback 和 callback replay，最终 settlement 为 `income_created`，income 为 `cash_confirmed`。
- 全身份清理返回 `residual_rows = 0`；临时 School 管理员删除、Cash 密码恢复。没有读取或导入 production 数据。
- 后置盘点：临时管理员 0、首次超时 FX marker 0、私塾打工 marker 0；待 UI 确认的工资 batch 1、FX sync 1 保持完整。API 10 files / 45 tests、API build 与 Web build 均通过，Web 仅保留已知的大 chunk warning。

## 2026-07-19 第九轮 UI 收口、清理与最终对账

- 用户确认工资聚合与 FX 两项 Cash staging UI 均正常。
- 工资 `cleanup-finalized-wage-batch-e2e.sql` 正式执行返回 `residual_rows=0`。FX 清理首次连接遇到 Supabase CLI 临时认证失败，盘点确认工资已清、FX 完整保留；随后只重跑 FX 清理并返回 0。
- `inventory-e2e.sql` 确认 students、teachers、income、expense、School / external Cash requests 与 account transactions 的 `STAGING-E2E-*` 均为 0。
- `verify-final-reconciliation.sql` 23 项全部通过：19 migrations、10/48/10/4 Cash schema、4/3 staging Cash seed、0 临时账号、0 synthetic 残留、0 School/Cash orphan、0 状态错配、0 anon grants。
- `operational-smoke.mjs` 通过 API、DB、School bundle、Cash config、精确 CORS 与 dev/staging 防串线；Render 免费实例冷启动容忍设为 90 秒。
- 正式合成验收报告：`docs/staging-reconciliation-report.md`；运营手册：`docs/staging-operations-runbook.md`。
- 已形成只读 `docs/v3-prod-promotion-runbook.md` 草案，覆盖候选冻结、空 prod、只读盘点、staging 迁移演练、initial / final delta、单点切换与回滚触发条件；没有执行其中任何 production 操作。

## 2026-07-19 第十轮运营探针调度配置

- 新增 `.github/workflows/staging-operational-monitor.yml`，每小时第 17 分钟运行 `scripts/staging/operational-smoke.mjs`，并提供手动运行入口。
- workflow 使用 Node.js 22、只读仓库权限、8 分钟 job 超时和禁止并发取消；不配置 Supabase、Render 或用户 secrets。
- GitHub 定时 workflow 只从默认分支执行。当前先提交至 `codex/v3-staging`，进入默认分支前定时任务尚未启用；失败通知取决于 GitHub 账户与仓库通知设置。
- 用户确认后，`codex/v3-staging` 以 fast-forward 合入默认分支；workflow 手动运行通过。首次 scheduled run 的单个并行请求在 90 秒超时并发出失败邮件，逐项复核五个 staging 地址均为 HTTP 200，同一次 scheduled run 重试后 9 秒通过。
- 为降低 Render 冷启动误报，探针对网络错误、超时和 HTTP 5xx 加入 10 秒等待后的一次自动重试，并为 API、DB、School、Cash、bundle 与 CORS 请求输出独立目标名称。失败邮件接收已验证，持续告警标记为启用。

## 2026-07-19 第十一轮历史迁移审计 schema

- 新增 migration `20260719170000_add_legacy_migration_audit` 与 `20260719173000_strengthen_historical_lesson_provenance`，School migration 总数由 19 提升为 21。
- schema 新增历史外部工作导入批次、课时批次 / 来源行、逐记录迁移审计和 legacy income linkage event；`historical_confirmed` 明确不创建正式 Cash request，也不得携带 Cash transaction 身份。
- 初次合成约束验收发现 PostgreSQL `CHECK` 的 `NULL` 结果会放行“有批次、无来源行”的记录；以第二个追加 migration 明确要求两个 provenance 字段同时存在且来源行大于 0，未修改已应用 migration 历史。
- 两个 migration 先在 `v3-dev` 应用；API 10 files / 45 tests、API build、Prisma validate / generate 均通过。回滚式合成验收通过，batch / income / workplace 残留均为 0。
- 同一组带校验和的 versioned migration 随后应用到 project ref `bxnxdkbjlxkcqwzzeyds` 对应的 `v3-staging`。执行前保护确认既有 19 个 migration 与 4 个 `STAGING Cash` 账户，未连接 dev 或 production。
- staging 回滚式合成验收覆盖 migrated / audit-only、historical-confirmed / synced linkage、重复来源、migrated 缺失 target、历史课时缺失 source row、历史确认误带 Cash transaction 和不生成 Cash request；最终残留为 0 / 0 / 0。
- 最终只读复核：21 个 applied migrations、2 个本轮 migration、3 张新表、1 条 provenance constraint、0 个 `anon` / `authenticated` grant、0 条合成批次残留。未读取或导入 production 行数据，现行 School / Cash production 未写入。

## 2026-07-19 第十二轮迁移计划合同

- 新增数据库无关的 `scripts/migration/plan-external-work-migration.mjs`，只读取本地 JSON snapshot 与精确 workplace map，不含数据库连接或写入能力。
- 固定迁移合同为 `2025-12` 至 `2026-11`；保留原 UUID，校验 planned / actual、settlement / detail、income / linkage 引用，并把 soft-deleted lesson 转为 audit-only。
- planned 已有 active actual 时映射为 `actual_created`；`historical_confirmed` income 映射为 `record_status=historical_confirmed / cash_status=not_requested`，不得生成 Cash request 或 Cash transaction。
- source snapshot、workplace mapping、每条 audit source row 与完整 migration plan 均生成稳定 SHA-256；相同输入重复计划结果完全相同。
- 纯合成 fixture 的 5 项合同测试通过：确定性与 0 Cash 写入、historical-confirmed 误带 Cash transaction 拒绝、缺失精确 workplace mapping 拒绝、synced Cash identity 原样保留但不生成 Cash 事实、重复 active actual 拒绝。fixture 不含 production 数据，也未连接任何数据库。

## 2026-07-19 第十三轮 rollback-only target apply

- 新增 `scripts/migration/verify-external-work-plan-apply.mjs`。它以 Prisma transaction 按 batch → planned / actual lesson → income → settlement → detail → linkage → audit 的依赖顺序写入完整计划，再逐表对账、确认 0 个 Cash request，最后主动抛出 rollback sentinel。
- 仅接受 `MIGRATION_TEST_ENV=dev|staging`，要求数据库 URL 包含显式 target project ref，并硬拒绝当前 Cash production 与 School V2 production project ref；工具不含持久 apply 入口。
- 为合成 fixture 自动创建的 workplace 也在同一 transaction 内，并以明确 rollback marker 复核零残留。
- v3-dev 验收通过：1 batch、2 lessons、1 settlement、1 detail、1 income、1 history-only linkage、8 audit；Cash request / transaction 均为 0，transaction rollback 后 batch / income / workplace residual 均为 0。没有读取或导入 production 行数据。

## 2026-07-19 第十四轮生产 snapshot 边界

- 用户授权 production 数据进入 staging 演练，但明确要求不影响现行 production；同时确认 School / Cash 当日仍有新增数据。
- 在 School production 与 Cash production 各执行一次 schema-only `information_schema.columns` 读取，确认 source 字段后冻结两个独立 snapshot SQL 合同；本次没有读取业务行或写入任何 production 对象。
- `export-v2-external-work-snapshot.sql` 和 `export-cash-ledger-snapshot.sql` 均为 `REPEATABLE READ, READ ONLY` transaction，设置 90 秒 statement timeout / 5 秒 lock timeout，只返回一个 versioned JSON value 并 rollback。
- 两个 production project 无法共享数据库 transaction，因此 snapshot 分别记录 `capturedAt`。迁移演练以各自 cutoff 为初始事实边界，再用 School legacy linkage 的 Cash transaction UUID 对账；正式切换另执行 final delta / freeze，不把持续写入中的 production 当作永久静态快照。
- snapshot JSON 仅允许保存在仓库外的受控加密位置，禁止 commit、Render 环境变量、前端 bundle 或日志输出。

## 2026-07-19 第十五轮 School staging 持久导入器

- 新增 `scripts/migration/apply-external-work-plan.mjs`。它只读取仓库外、非 group/world readable 的 snapshot 与 mapping JSON；输出仅含 plan hash、状态和汇总数，不输出 production 行。
- 该入口只接受 `MIGRATION_TARGET_ENV=staging`、project ref `bxnxdkbjlxkcqwzzeyds`、URL 同 ref、字面 `--apply` 及 `MIGRATION_CONFIRM_STAGING_IMPORT=v3-staging`；当前 School V2 / Cash production ref 被硬拒绝，检查发生于任何数据库连接前。
- 目标 preflight 要求 21 个 School migration、4 个 `STAGING Cash` seed、精确 active workplace mapping，以及 synced linkage 的 staging Cash owner/account mapping。历史 account-name snapshot 不与当前 account name 比较，避免生产账户后续改名误伤历史事实。
- 导入按单 transaction 执行并逐表对账，保证 0 个新 Cash request。完整相同 audit plan 重跑返回 `already_applied`；部分 audit、source UUID 或字段冲突立即失败，不删除 staging 或 source 行。
- 合成合同测试新增 persistent target boundary 与 synced mapping 缺失拒绝；`pnpm test:migration` 为 10 项通过，API build 与 45 项 API 测试均通过。未连接、读取或写入任何 production 数据，持久导入器尚未执行。

## 2026-07-19 第十六轮 Cash ledger 迁移计划合同

- 新增 `scripts/migration/plan-cash-ledger-migration.mjs`，只读取本地 Cash snapshot 与 source owner → staging Auth user mapping；没有数据库连接、Auth 创建或写入能力。
- account、payment channel、fixed template/item、JPY/CNY transaction 与 external request 保留 source UUID。计划器只替换每条 ledger row 的 `user_id`，明确输出 `authUsersCopied=0`，因此不复制生产 Auth user、hash、session 或 key。
- target 写入前已能发现缺少 owner mapping、fixed item 的 account/template 断链、transaction 的 account/transfer/FX 双向断链及 external request 的 account/created transaction 断链。
- 合成合同测试新增确定性、owner mapping 缺失拒绝与 FX linkage 断链拒绝；`pnpm test:migration` 共 13 项通过。未读取或写入任何 production 数据，Cash persistent importer 尚未执行。

## 2026-07-19 第十七轮 Cash staging 持久导入器

- 新增 `scripts/migration/apply-cash-ledger-plan.mjs`，复用 School importer 的 `v3-staging` project ref、URL、字面 `--apply` 与双重确认保护；当前两套 production ref 在连接前即被拒绝。
- preflight 要求 staging 仍有 4 个专用 Cash seed、owner mapping 的每个目标 UUID 都已存在于 staging `auth.users`，并要求 snapshot 每张非空表的字段集合与 target 完全相同。
- 事务顺序为 account → channel/template/item → JPY/CNY transaction（暂空 FX link）→ external request → 恢复 FX 双向 link → 全行 JSON 对账。保留 source UUID，仅替换 `user_id`；不创建、复制或修改 source/staging Auth user。
- 任一已有 source UUID 若只存在部分、或完整行与计划不同即停止；只有全部行逐字段一致时才返回 `already_applied`。没有 delete / truncate / source 连接路径。
- `node --check`、`pnpm test:migration` 13 项、API build 和 45 项 API 测试均通过。尚未输入 production snapshot、未连接或写入任何 production 数据，staging persistent import 尚未执行。

## 2026-07-19 第十八轮受控 production snapshot 与 staging mapping

- 用户创建了仓库外、权限 `700` 的受控目录；两份 snapshot、三份 mapping 及两份 plan 都以 `600` 保存，均未进入 Git、Render 或前端。Dashboard 不支持 `psql` 的 `\set` 元命令，因此仅在 Dashboard 运行时移除该行；保留的 SQL 仍是 `REPEATABLE READ, READ ONLY` transaction 并 rollback。
- School V2 snapshot cutoff 为 `2026-07-19T09:18:49.543818+00:00`，SHA-256 为 `de9b5e63d1c50809b50a3a2243fc57f8dabe7a25b8ed85ea7e740fe5a25e9682`；Cash snapshot cutoff 为 `2026-07-19T09:20:17.713179+00:00`，SHA-256 为 `14a3c7ac80ca0fd66150614c571dc9ad1f434ea122ff25c98568567ca001e302`。
- 本地合同复核：School 3 batch / 572 source lessons / 22 settlement / 20 income / 20 linkage，Cash 7 account / 29 JPY / 58 CNY transaction / 33 request；8 条 synced School linkage 的 Cash transaction ID 全部存在于 Cash snapshot（缺失 0）。
- staging 原有 0 个 external workplace；两次缺少 `id` / `updated_at` 的 insert 均整体回滚为 0，随后只在 staging 创建 3 个 active `legacy-*` workplace，并生成精确 workplace mapping。Cash source owner 映射至既有 staging Cash seed Auth user；不复制任何 Auth user。
- School / Cash plan 均在本地生成：School plan hash `5183df5060c669cd39442f553485aec3da0119c1ca9ca79652ce897abe13080c`（557 target lessons、21 settlement、20 income、0 Cash request/transaction）；Cash plan hash `e82e79b46458fda41e0309b295ff9199e20606d66929cdf78d93f0d84a7ca93f`（7 account、87 transaction、33 request、0 Auth user copied）。
- School CLI 入口补齐可选第三个 Cash linkage mapping 参数；`pnpm test:migration` 13 项通过。生产项目只执行只读 snapshot；staging business facts 尚未导入，下一门槛是受控 staging database URL 以执行已有持久 importer。

## 2026-07-19 第十九轮 production snapshot 初始副本演练

- 仅使用仓库外、`700` 目录中的 `600` snapshot / mapping / staging connection 文件。两个 source snapshot 保持各自 `REPEATABLE READ + READ ONLY` cutoff；未连接、写入、冻结、清理或修改任一 production project。
- Cash 初次持久导入因 fixed month item 的 transaction link 早于 transaction insert 而触发外键约束，transaction 全量回滚，未留下部分 Cash 数据。随后把 importer 修正为先插入 fixed item 的空 link，待 JPY/CNY transaction 全部落库后在同一 transaction 恢复 fixed-item 与 FX links；计划器也新增 fixed-item JPY/CNY link 闭包校验。
- 修正后 Cash staging import 返回 `applied`：7 account、3 payment channel、25 fixed template、53 fixed month item、29 JPY transaction、58 CNY transaction、33 external request；`authUsersCopied=0`。School staging import 返回 `applied`：3 batch、557 lesson、21 settlement、264 detail、20 income、20 linkage、902 migration audit，并保持 `cashRequests=0` / `cashTransactions=0`。
- 两套 importer 的第二次执行均返回 `already_applied`。staging 只读聚合核对确认 School 21 migrations、3 个 legacy workplace、所有上述计数准确；Cash 为 4 个 staging seed 加 7 个迁入 account。8 条 synced linkage 全部存在正确 staging Cash account owner 与对应 JPY/CNY transaction，缺失为 0。
- 新增 `scripts/migration/verify-staging-snapshot-rehearsal.mjs` 作为可重复只读验收入口。它同样要求 staging project ref / URL / 双重确认，且在 read-only transaction 中从受控 snapshot / mapping 重建两个 plan，验证所有 source UUID 计数、902 条 audit、0 条本次 School Cash request 以及 8 条 synced linkage 的 account owner / transaction；首次复核已返回 `verified`。
- 本次是按 snapshot cutoff 的初始副本演练，不等同 production cutover。production 持续写入，正式上线前仍需 final delta / freeze、普通教学范围迁移与独立切换演练；`v3-prod` 未创建或写入。

## 2026-07-19 第二十轮普通教学迁移发现合同

- 新增 `scripts/migration/v2-core-teaching-readonly-inventory.sql`。该合同以 `REPEATABLE READ + READ ONLY` transaction 返回普通教学 `2026-07+` 候选事实、引用闭包、收入 / 支出和 legacy payment 审计的表存在性、字段字典与外键字典；明确 `containsBusinessRows=false`，最后 rollback。
- 对应静态合同测试禁止 DML / DDL。该文件的用途是让下一步字段 mapping 建立在当前实际 schema 上，而非凭历史代码猜测。
- 用户授权后已在 School V2 production Dashboard 执行该查询。执行结果为 17 / 17 候选表存在、403 个字段、36 条外键；没有返回业务行。查询在 `REPEATABLE READ + READ ONLY` transaction 后 rollback，未读取 / 复制 / 写入业务数据，也未冻结或修改 production。
- 字段级映射和阻断项已记录到 `docs/v2-v3-core-teaching-migration-mapping.md`。当前明确禁止建立普通教学 source snapshot 或 persistent importer，直到多维工资、月结 adjustment / carryover、附件和 legacy payment request 的无损承载决策完成。

## 2026-07-19 第二十一轮普通教学 aggregate-only 范围基线

- 新增 `scripts/migration/v2-core-teaching-aggregate-inventory.sql` 与静态合同测试。该查询从 `2026-07` 起只返回按业务月 / 状态 / 币种的汇总、无身份引用闭包与关键孤儿计数；其 transaction 为 `REPEATABLE READ + READ ONLY`，最后 rollback，禁止 DML / DDL 与业务行输出。
- 用户授权后已在 School V2 production Dashboard 执行。结果当前仅含课时、学生账单、收入与支出四个有范围内事实的聚合 section；学生月结、工资 locks / details / adjustments、结转、附件与 payment request 均为 0。引用闭包为 2 个业务归属、6 名学生、8 名老师、7 个科目，未返回任何 UUID、姓名或业务行。
- `wage detail → lesson`、`wage adjustment → lock`、`attachment → expense`、`carryover → settlement` 四项孤儿检查均为 0。production 没有写入、复制、冻结或数据清理；该结果只作为普通教学迁移设计基线，不授权 source snapshot 或 staging import。
- 随后把初始演练窗口收紧为 `2026-07` 至 `2026-12`，并增加 actual → planned 的无身份关联汇总。25 条范围内 actual 均连接到 source planned，缺失为 0；完成、补课完成与取消可确定映射至 V3 预定 / 实际状态。production 另有 3 条业务月 `2099` 的远期收入汇总；它们明确排除在本次范围外，没有被复制、删除、修改或作为业务行读取，待独立异常处置。

## 2026-07-19 第二十二轮普通教学迁移审计承载

- 新增 School Prisma migration `20260719193000_add_core_teaching_migration_audit`：创建 `core_teaching_migration_batches`，并给通用 `migration_record_audits` 增加可选的 `core_teaching_batch_id`。两类 batch 互斥；现有私塾打工 audit 继续使用原 `import_batch_id`，没有迁移、改写或删除既有事实。
- 批次表强制 source SHA-256、`YYYY-MM` 范围、非空来源键 / 文件名 / 程序版本，并撤销 `anon` / `authenticated` 的全部权限。它只承载未来普通教学 snapshot 的 hash、范围、汇总元数据和逐行 audit 归属，不创建业务记录、Cash request 或 Cash transaction。
- 本地 Prisma format / validate 与 16 项 migration 合同测试通过。迁移已只部署到 `v3-staging`；只读验收确认已完成 migration 为 22、batch 表和 audit 字段存在、浏览器角色 grant 为 0。现行 School / Cash production 未连接、未写入。

## 2026-07-19 第二十三轮历史已确认支出状态

- 初始普通教学窗口内存在历史已支付支出，但若没有 V3 Cash request / transaction 身份，不能标记为 `cash_confirmed`，更不能重建付款。为此新增 `ExpenseRecordStatus.historical_confirmed`，与既有收入历史状态保持相同语义：仅用于受控历史导入与审计。
- 既有服务只允许 `pending` 支出进入编辑、报销、账户交易或作废路径，因此该新状态默认无法进入任何会创建或改写 Cash 事实的操作；没有新增生产连接、Cash request 或 Cash transaction 行为。
- `20260719194500_add_historical_confirmed_expense_status` 已仅部署至 `v3-staging`。只读事务验收确认已完成 migration 为 23，且 PostgreSQL 枚举值存在；School / Cash production 未连接、未读取、未写入。

## 2026-07-19 第二十四轮普通教学 aggregate 自动门禁

- 新增 `assess-core-teaching-aggregate-readiness.mjs`。它只接受既有 aggregate-only JSON，不连接数据库、不包含或输出业务行；固定检查初始演练窗口、只读来源元数据、未支持 dependent fact、关键引用孤儿和 actual → planned 状态组合。
- 任一工资明细 / 调整、结转、附件、payment request 或异常课时关联非零即输出 blocker，禁止进入受限 source snapshot 准备。范围外未来事实仅以无身份计数显式报告，不会混入窗口。
- 合成合同覆盖全绿、工资调整拒绝与 actual 缺少 planned 来源拒绝；`pnpm test:migration` 共 19 项通过。该工具只允许推进到行级 snapshot 合同设计，不能授权 persistent importer、Cash 创建或 production cutover。

## 2026-07-19 第二十五轮 staging 财务历史状态页面

- V3 Web 的收入 / 支出真实 API 列表现在识别 `historical_confirmed`。该状态显示为“历史已确认”，以独立统计指标呈现；抽屉详情说明其只保留来源确认事实，不创建或提交 Cash 请求。
- 因为历史状态不满足既有 pending-only 操作条件，页面保持只读，不提供提交 Cash、作废、报销或创建账户交易的入口。既有初始 staging 演练中的 historical-confirmed 收入将不再被误示为“待提交 Cash”。
- 全部页面的 API 描述移除硬编码 `dev` 文案，改为当前环境 API；`pnpm --dir apps/web build` 通过。此项仅修改前端与文档，没有连接或变更 production 数据。

## 2026-07-20 第二十六轮历史迁移审计页面

- 新增鉴权且要求 `audit.read` 的只读 `GET /audit/migration-records` 接口，严格按当前目标表和目标记录 ID 返回迁移审计元数据。
- 返回字段仅含来源系统 / 表、迁移批次、期间、行号、SHA-256、程序版本与迁移时间；Prisma select 明确不包含 `sourceSnapshot`，因此该接口不会向页面返回生产来源业务行。
- staging 财务历史记录抽屉新增“查看迁移审计”。历史确认记录继续没有 Cash 提交、作废、报销或账户交易入口；页面弹窗说明只显示审计元数据。
- `pnpm --dir apps/api build`、45 项 API 测试、`pnpm --dir apps/web build` 及 19 项迁移合同测试均通过。此轮没有数据库 schema 或数据写入，也没有连接或修改 production。

## 2026-07-20 第二十七轮 final delta / freeze Go/No-Go 门禁

- 新增 `assess-cutover-readiness.mjs` 及合成合同测试。它只读取 metadata-only manifest，明确拒绝业务行；不连接 School、Cash、Supabase 或 Render，不能创建 `v3-prod`、冻结 source 或切换入口。
- 门禁要求 staging 验收、私塾打工与 Cash ledger 演练、普通教学 mapping / snapshot / importer / rehearsal、production 授权和空目标、双人核验角色、有限冻结窗口及两项已知限制接受全部完备。任一缺失均列为 blocker。
- 当前普通教学无损建模与 production 决策仍未完成，因此此门禁的预期结果为不可进入 production 准备；它把这一状态变成可复核的技术防线，而不是以文档措辞掩盖未决事项。没有 production 连接或写入。

## 2026-07-20 第二十八轮普通教学主数据来源身份

- 普通教学迁移审查确认通用 `migration_record_audits` 已能以 `audit_only` 承载 legacy payment request 的原始 snapshot 与来源身份，因此不建立或复用 V3 `cash_requests`。payment request 的具体 source type / reissue / Cash transaction 对账仍是后续逐行 mapping 门禁。
- 新增 `20260720123000_add_reference_data_legacy_identity`：仅在 `business_entities` 与 `subjects` 增加可空但成对非空、复合唯一的 `legacy_table` / `legacy_id`。它让未来普通教学引用闭包以原来源身份核验，不使用名称匹配或备注拼接。
- migration 仅应用到 `v3-staging`；只读结构复核确认四个字段、两个索引与两个 check constraint 均存在，Prisma history 为 24 个已完成 migrations。没有导入业务行、没有 Cash request / transaction 写入，也没有连接或修改现行 production。
- `prisma format` / `validate`、API build 与 24 项迁移合同测试通过。

## 2026-07-20 第二十九轮普通教学来源身份约束补齐

- staging 聚合预检确认 `students` / `teachers` 都没有半成对的 legacy source identity，随后新增 `20260720130000_constrain_reference_legacy_identity` 的配对 check constraint 与复合唯一索引。
- 现在 `business_entities`、`students`、`teachers` 与 `subjects` 均以相同规则保存未来受控 mapping 的来源表 / ID；该规则禁止只有来源表或只有来源 ID 的不完整映射，也禁止同一来源身份映射到两条主数据。
- migration 仅应用到 `v3-staging`；只读复核确认两个 index、两个 check constraint 与 Prisma history 存在，staging migration 数为 25。没有业务行、Cash request / transaction 或 production 连接写入。
- `prisma format` / `validate`、API build 与 24 项迁移合同测试通过。

## 2026-07-20 第三十轮普通教学 V2 只读历史例外政策

- 用户确认不保留四类复杂旧记录的 V3 副本：多维工资明细 / 调整、学生月结 adjustment / carryover、支出附件与 legacy payment request。受影响工资或月结下游链整体保留在 V2 只读；附件不复制但其他可完整映射的支出主记录仍可作为无附件历史事实；legacy payment request 不创建或复用 V3 `cash_requests`。
- `assess-core-teaching-aggregate-readiness.mjs` 升级至 readiness contract v2，输出 `v2_readonly_retention_v1` 与按 dependent fact 汇总的 exclusion。此类计数不再作为模型缺口 blocker；关键引用孤儿和异常 actual → planned 状态仍会阻止 snapshot 准备。
- 普通教学 mapping、staging checklist、prod boundary/runbook 同步要求未来受控 snapshot 携带逐链 exclusion manifest。尚未读取新的 production 业务行、建立普通教学 snapshot 或执行 staging 导入；现行 School / Cash production 未连接、未写入或修改。

## 2026-07-20 第三十一轮普通教学受控快照与 staging 准备门禁

- 新增 `validate-core-teaching-snapshot.mjs`：只读取 future core-teaching snapshot 与独立 exclusion manifest，校验固定 `2026-07`～`2026-12` 范围、read-only source metadata、source UUID / 主数据引用闭包、planned → actual 关联，以及 snapshot / aggregate inventory 的 SHA-256 绑定。
- `v2_readonly_retention_v1` 要求每一个发现的工资明细 / 调整、月结 adjustment / carryover、附件或 legacy payment request omission candidate 精确匹配一条 manifest；缺失、重复、处理方式不符、受影响链不符或 snapshot hash 不符均被拒绝。工具只输出 hash 和计数，不输出业务行。
- 新增 `prepare-core-teaching-staging-import.mjs`：复用 explicit v3-staging project ref、production ref 拒绝与双重确认，并要求 snapshot / manifest / aggregate 文件全部位于仓库外且权限为 `600` 或更严。它只返回 `prepared_not_applied`，没有数据库客户端、DML、Cash request 或 Cash transaction 路径。
- 7 项新增合同测试及完整 `pnpm test:migration` 共 31 项通过。没有执行 source SQL、读取新的 production 业务行、连接 staging 数据库或写入 School / Cash。

## 2026-07-20 第三十二轮普通教学 source-side 导出合同与闭包防线

- 新增 `export-v2-core-teaching-snapshot.sql`，只作为未来受授权的 source-side 模板。它是 `REPEATABLE READ + READ ONLY + ROLLBACK` 单 JSON 查询，要求调用者传入 source key / filename、SQL SHA-256 与 aggregate inventory SHA-256；没有 DML、DDL、RPC、文件写入或 V3 target 连接。
- 查询只输出 eligible 主数据、课时、无调整/结转月结、未受排除链影响的账单/收入、无附件/非受影响工资支出；工资明细/调整、学生 adjustment/carryover、附件及 legacy payment request 改为独立 omission candidates。manifest 会随后用这些候选固定整链的 V2 只读处理。
- 增加“排除链不得同时进入 eligible snapshot”校验；范围前 planned 课时只在被范围内 actual 课时引用时可带入，并标为 reference closure。未标记的范围前或任何范围后的 planned 事实都会被拒绝。
- 新增 source SQL 静态测试和闭包测试后，完整 `pnpm test:migration` 共 35 项通过。该 SQL 没有在 School V2 production 执行；没有读取新的生产业务行、连接 staging 数据库或写入任一环境。

## 2026-07-20 第三十三轮普通教学受控 source snapshot 与准备验收

- 用户已授权对 School V2 production 读取普通教学业务行；source-side SQL 在 `REPEATABLE READ + READ ONLY` transaction 中执行，结果复制到仓库外 `600` 私有快照后显式 `ROLLBACK`。没有生产 DML、RPC、删除、冻结或 Cash 操作。
- 因 aggregate-only 合同的 `sourceSnapshot.capturedAt` 每次执行都会变化，新增 `assess-core-teaching-aggregate-consistency.mjs`：它只为夹心核验计算业务一致性指纹并忽略该一个 volatile 字段，原始 aggregate SHA-256 仍不可替换地写入 snapshot。两轮导出前后指纹相同，快照可继续使用。
- 新增 `create-core-teaching-exclusion-manifest.mjs`，只能从仓库外且权限为 `600` 的快照生成同样私有的 manifest；所有 candidate 必须采用固定 `v2_readonly_retention_v1` handling。当前快照生成的 manifest 为零条 exclusion，但政策与校验仍强制存在。
- 以快照、manifest 和精确 aggregate inventory 执行 `prepare-core-teaching-staging-import.mjs`，返回 `prepared_not_applied`；该工具没有数据库客户端或写入路径。`pnpm test:migration` 共 39 项通过。普通教学 staging persistent importer 及业务行导入尚未执行。

## 2026-07-20 第三十四轮普通教学 staging importer 演练

- 新增确定性 `plan-core-teaching-migration.mjs` 和 staging-only `apply-core-teaching-plan.mjs`。执行器要求 staging project ref、既有 `v3-staging` 确认、额外 `core-teaching-staging` 确认、私有输入文件与精确 aggregate SHA-256；在连接目标前拒绝两套现行 production ref。
- 初次 staging 演练发现两个真实结构差异，均因单事务而零残留回滚：现有 staging 代码与 V2 source code 同名、同一 planned 关联两条 V2 actual、以及同一学生同月多张 V2 账单但 source 无 V3 version。历史导入统一使用 `V2-` code namespace；新增 migration `20260720153000_add_legacy_actual_lesson_link`，额外 actual 使用只读 legacy foreign key；账单按稳定 source UUID 分配 V3 version，不虚构 replacement 关系，原始关系保留于审计。
- migration 仅部署到 v3-staging，Prisma history 为 26。最终单事务写入 2 business entities、6 students、8 teachers、7 subjects、212 planned、29 actual、8 bills、8 incomes、1 expense 与 281 audits；0 settlement、0 exclusion、0 Cash request、0 Cash transaction。历史收入 / 支出均为 `historical_confirmed`。
- 幂等重跑返回 `already_applied`。随后只读 transaction 复核 batch=1、audits=281、legacy actual links=1、关联 Cash request=0。`pnpm -C apps/api exec prisma validate` 与 `pnpm test:migration` 共 44 项通过；没有连接、写入、删除或冻结 School V2 / Cash production。

## 环境防串线

- 非 dev API 启动必须提供 `SCHOOL_ENVIRONMENT_PROJECT_REF`，Cash URL、runtime DB URL 和 direct DB URL 必须包含同一 project ref。
- staging/prod 禁止 Cash mock。
- 可通过 `SCHOOL_FORBIDDEN_PROJECT_REFS`、`SCHOOL_FORBIDDEN_CASH_USER_IDS` 和 `SCHOOL_FORBIDDEN_ORIGIN_MARKERS` 拒绝已知其他环境身份。
- 启动日志只输出环境名，不输出 project ref、UUID、URL 或 key。
