# V3 staging 建设记录

更新日期：2026-07-19

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

## 环境防串线

- 非 dev API 启动必须提供 `SCHOOL_ENVIRONMENT_PROJECT_REF`，Cash URL、runtime DB URL 和 direct DB URL 必须包含同一 project ref。
- staging/prod 禁止 Cash mock。
- 可通过 `SCHOOL_FORBIDDEN_PROJECT_REFS`、`SCHOOL_FORBIDDEN_CASH_USER_IDS` 和 `SCHOOL_FORBIDDEN_ORIGIN_MARKERS` 拒绝已知其他环境身份。
- 启动日志只输出环境名，不输出 project ref、UUID、URL 或 key。
