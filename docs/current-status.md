# Aozora School System V3 当前状态

更新日期：2026-07-21

## 当前开发状态

- V3 当前处于 dev 主链路实装与稳定测试阶段。
- 2026-07-22 已统一正式筛选页的“重置”契约：课时管理、学费账单、月度结算、收入记录与支出记录均以 draft / applied 分离实现；普通“重置”只恢复控件、提示后续查询，不刷新当前结果或 URL，只有“查询”才应用条件并同步 URL。没有真实筛选状态的演示页不再显示误导性的查询 / 重置筛选区；“回到本周”保留为已有定义的日期快捷导航，和普通重置明确区分。
- 2026-07-21 已登记并确认 V2 学生课时新口径，作为 V3 后续数据模型、月度应收、待补余额统计、教学运营首页与周课表设计基线：学生学费 / 月度应收只以正式预定课时为基础；实际完成、取消、补课和部分完成不自动退款或追加学费。取消和部分完成剩余时长形成归属原学生、原业务归属且可跨月保留的待补余额；补课 actual 按实际老师、科目、日期、时长进入老师工资。周课表为正式预定课时的只读排课 / 图片导出视图，不是独立事实来源。详见 `docs/project-rules.md` 与 `docs/aozora-school-v3-development-plan.md`。
- 2026-07-21 待补余额第一阶段已在 Staging 通过人工验收：课时管理 1–3 与“登记补课完成”均确认可用。补课实际完成会在同一事务中耗尽余额并把原预定课时同步为 `makeup_completed`；已补充迁移修复此前耗尽但仍显示待补的记录。Staging seed 也已改为只在首次创建管理员时写入密码，后续部署不会覆盖现有管理员密码。验收数据保留为明确标记的 `STAGING-TEST`，不属于历史导入或生产数据。
- 前端、NestJS API、Prisma schema 和 dev PostgreSQL 已建立，正式运营仍未切换到 V3。
- 学费账单已完成生成预览、来源明细、版本判断和来源指纹保护；2026-07-16 人工验收第 1～8 项已全部通过，包括学费账单月份动态筛选修复。
- School ↔ Cash 第一阶段服务端适配层已实装：环境隔离配置、Cash 可用账户只读、canonical income / expense pending request、approve/reject callback 验证、幂等 ID、失败复核和重试审计已进入 V3 API。
- V3 dev schema migration `20260716090000_add_cash_system_integration` 已执行成功。当前未配置真实 Cash dev 凭据时默认使用 dev-only mock；不将 mock 请求视为已完成外部 Cash 联动。
- V3 环境拓扑已确定为每个环境共置 School + Cash：当前 `v3-dev`，未来 `v3-staging`、`v3-prod`，峰值 Supabase project 数为 5，不另建三套 Cash project。
- 2026-07-17 已只向 `v3-dev` 安装 Cash dev 基础结构；2026-07-18 增量加入 FX School 同步锁、老师工资聚合付款和工资整组原子拒绝。当前合计 10 张 `home_*` 表、48 个函数、10 个 RLS policy，并在 CNY / JPY 流水表安装 FX、工资聚合两组同步后不可变 trigger；没有复制生产数据、`shop_*` 对象或生产 ACL，现行 School / Cash production project 均未修改。
- `v3-staging` Tokyo Supabase project 已建立并完成空库 schema 安装、staging 专用 Auth / seed、权限负向检查和三项 Render 部署；未导入生产数据。`v3-prod` 和正式生产数据迁移程序仍未建立或执行。

## School ↔ Cash 联动状态

### 已实装

- 现行对端确认为 `home_account_book` Cash System，新业务只使用 `school_income_records / income_received` 和 `school_expense_records / expense_paid`。
- V3 只读取 Cash `is_active = true` 且 `allow_school_requests = true` 的账户，前端按请求币种选择，不再自由填写账户编码。
- V3 本地 `cash_request.id` 用作每次尝试的 `external_event_id`，幂等键为 `aozora-v3:cash-request:<uuid>`。
- Cash request ID、Cash transaction ID、账户 snapshot、预期收/付款日、确认时间、同步尝试和最近错误已分字段保存。
- Cash callback 只接收 Cash 登录 token，服务端会重新读取 Cash request，并校验用户、引用、类型、金额、币种、账户和 transaction ID 后才回写 School。
- 真实联动模式下，School 的手动 confirm/reject 和已提交撤回被禁止；Cash 状态只能通过经验证 callback 回写。
- 联动合同、字段、状态、环境和失败策略详见 `docs/cash-system-integration-contract.md`。
- `v3-dev` 已创建专用 Cash dev Auth 用户，并 seed 4 个 `DEV Cash` 账户，其中 3 个允许 School 请求。
- 2026-07-17 已完成 V3 → Cash dev 真实服务端 E2E：CNY 88 收入经 Cash approve 后生成唯一 transaction 并回写 School `cash_confirmed`；JPY 3000 支出经 Cash reject 后回写 `cash_rejected` 且未生成 transaction；重复 approved callback 返回幂等成功。
- Render dev API 已配置 `CASH_INTEGRATION_MODE=supabase`、`CASH_DEV_SUPABASE_URL`、`CASH_DEV_SERVICE_ROLE_KEY` 和 `CASH_DEV_USER_ID`，配置值未写入仓库；环境更新部署已成功变为 live。
- 独立 Cash dev 静态站点 `https://aozora-cash-v3-dev.onrender.com` 已创建，来源为 Cash 仓库隔离分支 `codex/cash-dev-environment`（commit `5d2e3ed`），指向 `v3-dev` Supabase 和 V3 `/api/cash/callbacks/request-result`；现有 Cash production 前端和本地未提交修改均未改动。
- Cash dev 前端人工 approve / reject 已完成：JPY 1234 收入在 Cash 生成流水并回写 School `cash_confirmed`，JPY 2345 支出在 Cash 拒绝且回写 School `cash_rejected`。人工测试同时发现成功回调缺少 `ok: true` 会被 Cash 前端误报为未知错误，现已补齐明确成功标记和回归测试。
- Cash dev 前端已增加已处理 School 请求的“重新回写 School”恢复操作（Cash commit `ad5bfb2`）及 60 秒 callback 超时保护（Cash commit `71bfe37`，版本 `20260717-cash-dev-v3-3`）。该操作只重放 callback，不执行 Cash approve / reject RPC；JPY 1234 approved 和 JPY 2345 rejected 均已人工重复回写并收到 V3 幂等成功，未改变 Cash 流水结果。
- 2026-07-18 用户已完成上述恢复操作人工验收：approved / rejected 均可重复回写，无未知错误；JPY 1234 保持唯一 Cash 流水，JPY 2345 保持无流水；School 状态与两端记录数量均正确。School → Cash 请求及结果恢复链路第一阶段验收完成。
- Cash → School 第二阶段已开始第一批后端实装：新增 Cash 登录 token 保护的 CNY→JPY FX 入站 options / callback，School 服务端使用 service role 重新读取并校验双向关联的 Cash `fx_out` / `fx_in` 交易对，不信任浏览器金额、日期、币种或 JPY transaction ID；只允许选择同一 CNY Cash 账户的已确认 School 收入，且所选收入 CNY 合计必须与购汇 CNY 金额完全一致。重复相同 payload 返回幂等成功，冲突 payload 拒绝覆盖。
- `v3-dev` 已安装 `home_school_fx_syncs`、authenticated 同步标记 RPC 和 CNY / JPY 双侧不可变 trigger；同步标记保存 School event 与 account transaction 身份，已同步 FX pair 不能普通编辑或删除。Cash dev 分支 commit `d0f337a` 已实现“回写 School 法人账户”对话框、候选读取、精确金额选择、失败重试与同步后只读显示，静态版本为 `20260718-cash-dev-v3-4`。
- 2026-07-18 Cash → School FX 真实 dev E2E 已通过：测试链 `DEV-SCHOOL-FX-20260718` 由 CNY 88.00 `fx_out` / JPY 1,800 `fx_in` 生成 School JPY 法人账户入站事件与唯一账户流水；关联收入推进到 `account_transaction_created`，Cash 页面显示“已回写 School · 只读”。数据库复核确认 Cash / School 双侧身份一致；同 payload 标记重试幂等、冲突身份被拒绝，CNY / JPY 两侧 update / delete 共四种操作均被 trigger 拦截并在测试事务中回滚。
- 老师工资聚合付款已完成第二层实装：School 仍按 `teacher_id + year_month + business_entity_id` 生成 canonical 工资支出和 Cash 请求；Cash 对同一老师、业务月、币种、账户和付款日期的多条待确认工资请求执行一次聚合 approve，只生成一条 Cash 流水，并保存批次头、逐条请求 / 支出映射和 School 回写身份。School 通过 Cash bearer token 保护的 `/api/cash/callbacks/request-batch-result` 重新读取并校验 Cash 批次、明细和唯一 transaction 后，在一个本地事务内确认全部请求与支出。
- 2026-07-18 真实 dev E2E 已通过：`勤务表跨业务测试老师 / 2026-11` 的个人名义 JPY 24,600 与青空进学塾 JPY 34,500 合计为 JPY 59,100；Cash 批次 `42a92327-23b1-42a0-b892-f1a0480872c3` 只生成 transaction `8e219366-db11-4afc-a150-8e6df7d93ae7` 一条，School 批次 `65be52d5-c7f6-4318-be73-a757c4cb9ae0` 含两条明细并将两笔支出均回写为 `cash_confirmed`。Cash 页面显示“School已同步 · 只读”；重复聚合 approve、重复同步标记均幂等，冲突同步身份被拒绝，聚合流水 update / delete guard 通过回滚事务验证。
- 工资分组条件已与数据库合同统一为老师、业务月、币种、Cash 账户和付款日期全部一致；单条请求不再显示聚合操作。`home_reject_teacher_wage_request_group` 在 Cash 数据库内锁定并原子拒绝整组请求，任何项目不匹配时全部零写入，且不生成 Cash transaction；Cash 成功后逐条回写 School，失败项保留原 rejected 身份并进入现有“重新回写 School”恢复入口。回滚验收已覆盖整组成功、相同理由幂等重试和不同付款日期零写入。
- 2026-07-18 Cash dev v3-6 真实整组拒绝 E2E 已通过：`勤务表跨业务测试老师 / 2026-12` 的个人名义 JPY 12,300 与青空进学塾 JPY 18,700 合计 JPY 31,000，在 Cash 页面一次操作后两条请求于同一时刻变为 `rejected`，拒绝理由均为 `E2E atomic group rejection`，并逐条回写 School 为 `cash_rejected`。两条 Cash `created_transaction_id` 与 School `external_cash_transaction_id` 均为空，关联 JPY / CNY Cash 流水数均为 0；随后单条“重新回写 School”返回相同结果幂等成功。
- School 新增只读 `/api/cash/payment-batches` 审计接口，Cash 请求页面把聚合批次与普通请求一并展示，可查看 School/Cash batch、transaction、逐条 request / expense、业务归属、金额和同步错误。API 路由已在 dev 部署并返回鉴权保护，前端构建通过；2026-07-18 用户已人工确认聚合付款记录、批次身份、合计、transaction、同步状态和明细展示均无问题。

### 尚未完成

- Cash 现行合同没有 pending cancel，因此 V3 真实外部请求暂不支持撤回。
- Cash FX 入站当前仍不支持部分购汇分摊，只支持所选已确认 CNY 收入合计与 FX 转出金额完全相等；staging 真实 CNY→JPY FX 入站、重放、冲突、双侧 guard 和 Cash UI 人工验收已通过，验收事实已精确清理，prod 尚未开始。
- 老师工资聚合付款、聚合审计与整组拒绝已完成 dev 代码、数据库、Cash dev v3-6 浏览器和用户人工验收；staging 真实聚合 approve / callback / replay / School sync 和 Cash UI 人工验收已通过，验收事实已精确清理，prod 尚未开始。
- `v3-staging` 基础设施、凭据、callback URL、CORS 与空库 seed 已配置。基础 smoke、School 核心、学费账单 / 收据、JPY / CNY canonical callback、老师工资真实聚合 callback、FX 入站和私塾打工主链路均已通过自动与必要人工验收；所有 `STAGING-E2E-*` 事实已清理为 0，最终 23 项数据库对账与无密钥运营探针通过。每小时 GitHub Actions 探针已进入默认分支并启用，手动、定时重试和失败邮件接收均已验证。`v3-prod` 未创建，Cash ledger 生产迁移未开始。

## V2 → V3 Prod 数据迁移状态

### 已确定迁移政策

- 不采用全系统统一日期截断，按业务模块定义迁移范围。
- 普通教学业务事实原则上迁移 `2026-07` 及以后；该月份是普通教学业务归属规则收口点，目的是避免把此前多业务归属历史链带入 V3 prod。
- 私塾打工是按工作单位和业务月结算的独立系统，不使用普通教学业务归属，因此迁移完整 2026 结算年度，即 `2025-12` 至 `2026-11`。
- 私塾打工范围以 `year_month` 为准，必须保留课时、结算、明细、收入、个人 Cash 联动事件和必要 legacy request 的完整审计链。
- 原 UUID、历史导入批次、原始行、snapshot、来源文件哈希和 Cash transaction ID 不得被重新生成或改写；不得给私塾打工历史记录补造业务归属。
- Cash DB 如继续复用，只迁移 School 引用；如 Cash 也迁库，另立 Cash ledger 迁移阶段。
- 正式切换采用“全量初始迁移 → 对账 → 最终增量 / 冻结 → 单点切换”，禁止长期双写。
- 普通教学中依赖多维工资明细 / 调整、学生月结 adjustment / carryover 的受影响历史链，保留在 V2 只读；支出附件不复制，legacy payment request 不迁入 V3 `cash_requests`。这些例外必须在未来 snapshot 的 exclusion manifest 中逐项记录，不能仅迁移汇总或由 V3 补造替代事实。

正式政策详见 `docs/v3-prod-migration-boundary.md`。

### 已完成的迁移准备

- 已完成 School V2 / Cash production aggregate-only 只读盘点和私塾打工逐字段 mapping；没有执行 production SQL 写入、RPC 或数据复制。
- V3 已增加历史导入批次、课时来源行、逐记录迁移审计和 legacy income linkage schema；`historical_confirmed` 与正式 Cash 请求分离。
- 两个 migration 已依次应用到 `v3-dev` 和 `v3-staging`。回滚式合成验收覆盖成功、幂等、缺失目标、缺失来源行和历史确认误带 Cash transaction 等边界，dev / staging 残留均为 0。
- 数据库无关的私塾打工迁移计划器已完成：固定 `2025-12` 至 `2026-11`、精确 workplace mapping、原 UUID、引用闭包、状态转换、逐行 / snapshot / plan SHA-256 和 0 Cash 写入均有合成测试；存在 synced Cash linkage 时强制要求 source Cash owner / account → staging identity 的显式映射。
- 新增 rollback-only target applier：仅接受 `dev` / `staging`、要求 URL 与 project ref 一致，并硬拒绝现行两套 production project。v3-dev 已完成全量合成 plan 的 transaction insert / reconciliation / forced rollback，残留为 0；该工具没有持久 apply 模式。
- 已按 production 实际字段冻结 School 私塾打工与 Cash ledger 的 source snapshot SQL 合同。二者均为 `REPEATABLE READ + READ ONLY`，返回单一 JSON snapshot 后 rollback；snapshot 只能保存在仓库外的受控加密位置。
- School staging 的持久导入器只接受 project ref `bxnxdkbjlxkcqwzzeyds`、显式 `--apply` 与双重 staging 确认，硬拒绝两套现行 production project；检查 22 migration / staging Cash seed / workplace / Cash owner-account 映射，在单 transaction 内写入并对账。相同完整审计计划只返回 `already_applied`，任何部分冲突均停止且不删除目标数据。
- Cash ledger 的确定性计划器只读取受控 JSON snapshot，保留 account / transaction UUID，只将每条 ledger row 的 source `user_id` 显式映射为 staging Auth user，绝不复制 `auth.users`。在接触 target 前校验账户、固定项目、跨账户转账、JPY↔CNY FX 双向关联与 external request 的 transaction 引用闭包。
- Cash staging 的持久导入器复用 School 的 v3-staging-only / 双重确认 / production-ref 拒绝边界，要求所有映射后的 staging Auth user 已存在，逐表字段合同完全一致；JPY/CNY FX 与 fixed-item transaction links 在同一 transaction 内先安全落行、再恢复链接并逐行 JSON 对账。完整一致重跑返回 `already_applied`，半批或不一致 UUID 直接拒绝。
- 2026-07-19 已生成并保存受控 School / Cash production read-only snapshot；两份各自有 cutoff、SHA-256、`600` 文件权限和独立 mapping。8 条 synced School linkage 全部命中 Cash snapshot。随后只向 `v3-staging` 导入经过 hash 验证的初始演练副本：School 3 batch / 557 target lesson / 21 settlement / 264 detail / 20 income / 20 linkage / 902 audit，Cash 7 account / 87 transaction / 33 request；不复制 Auth user，也不创建新的 School Cash request。
- 两套 importer 的复跑均返回 `already_applied`。数据库聚合复核确认 8 条 synced linkage 均能在 staging 找到正确的 Cash account owner 与对应 transaction，缺失为 0；production 仅执行只读 snapshot，没有写入、删除或冻结。
- 已提供 `scripts/migration/verify-staging-snapshot-rehearsal.mjs`，可在 staging 的 read-only transaction 中基于同一受控 snapshot / mapping 重建计划并复核计数、审计、0 School Cash request 与跨系统关联；本次返回 `verified`。
- 未创建或写入 `v3-prod`，也未执行 prod 切换。当前副本是带 cutoff 的初始演练；由于 production 仍持续写入，正式上线前仍需 final delta / freeze、全范围迁移与切换演练。

普通教学的 mapping / final delta / freeze 已进入受控准备阶段。2026-07-19 已在用户授权下对 School V2 production 执行核心教学只读结构盘点：`REPEATABLE READ, READ ONLY`、仅 `information_schema`、随后 rollback；17 / 17 候选源表存在，共 403 个字段、36 条外键，未返回 business row，也没有写入或冻结 production。逐表目标去向和已批准的 V2 只读例外见 `docs/v2-v3-core-teaching-migration-mapping.md`：多维工资规则 / 明细调整、学生结转调整、附件和 legacy payment request 不再要求为旧记录补建 V3 模型，但未来 snapshot / importer 必须附带 exclusion manifest，并只导入可完整映射的事实。新增 database-free `assess-cutover-readiness.mjs`，只有 staging 验收、普通教学演练、production 授权、空目标、负责人、冻结窗口和已知限制接受全部登记后才会给出 Go；它不包含业务行或凭据，也不能读取或改写 production。production 当前仍在写入，因此每次 snapshot 都按自身 `capturedAt` 作为初始批次边界；未来上线另走 final delta / freeze，不把今天的持续写入当作静态旧数据。

2026-07-20 已仅向 `v3-staging` 应用两项 reference legacy identity migration：`business_entities`、`students`、`teachers` 与 `subjects` 均具备成对的 `legacy_table` / `legacy_id`、非空配对约束和复合唯一索引，支持未来普通教学按来源身份而非名称对账。每项迁移均先完成 staging 聚合预检（无半成对数据），随后结构只读复核与 Prisma migration history 均通过，staging migration 数为 25；没有导入业务行，也没有连接或修改 production。

紧接着已执行初始 `2026-07` 至 `2026-12` 普通教学 aggregate-only 盘点：只有课时、账单、收入、支出出现范围内汇总；月结、工资锁定 / 明细 / 调整、结转、附件和 payment request 均为零。引用闭包和四项关键孤儿检查已通过，未返回身份或业务行。该基线不构成 source snapshot 或导入授权；下一步仍须建立受控 snapshot 合同、exclusion manifest 和 staging-only importer。

初始普通教学演练窗口现固定为 `2026-07` 至 `2026-12`，避免把生产库内 3 条业务月 `2099` 的远期收入异常误导入；这些记录没有被查看为业务行、没有被复制、删除或修改，并留待独立处置。范围内 25 条 actual 课时均能解析到 planned 来源，缺失为 0；该课时拆分规则已记录到普通教学 mapping。

为避免把当前范围内的历史已支付支出伪造为新的 V3 Cash 操作，V3 增加 `ExpenseRecordStatus.historical_confirmed`。该状态与既有收入历史状态一致：不含 Cash identity、不能再进入编辑 / 报销 / 创建账户交易路径；只用于受控历史导入及审计。

V3 Web 的收入 / 支出页已同步识别 `historical_confirmed`：列表状态显示为“历史已确认”，统计单列该状态，详情明确该记录只读且不创建 Cash 请求；页面不再硬编码为 dev API，以当前部署环境 API 为准。

历史已确认的收入 / 支出详情现提供“查看迁移审计”入口。该只读接口按当前目标表与记录 ID 查询，返回来源类别、批次键 / 期间、行号、SHA-256、程序版本和迁移时间；选择字段明确排除原始来源快照及业务行内容。

普通教学 aggregate-only 结果现由本地门禁工具复核：关键孤儿和异常 actual→planned 组合会阻止下一步受限快照准备；用户批准不迁入的四类旧依赖会以 `v2_readonly_retention_v1` exclusion 输出，未来必须逐链保留在 V2 只读。范围外的远期计数会被显式报告但不会进入窗口。该工具不连接数据库、不读取或输出业务行。

普通教学已具备受控 snapshot / exclusion manifest 合同与 staging-only importer：快照以 aggregate-only inventory SHA-256 固定来源范围，保留 eligible 主数据 / 课时 / 月结 / 账单 / 收支的来源 UUID 与引用闭包；每条省略链必须与独立 V2 只读 manifest 精确一致。准备命令只接受仓库外 `600` 文件、显式 v3-staging target 与双重确认；持久导入同样硬拒绝 production ref，并以单事务、逐表对账、0 Cash request 执行。

2026-07-20 用户授权后，普通教学 source-side 合同已在 School V2 production 以 `REPEATABLE READ + READ ONLY` 执行，并显式 rollback：受控快照、aggregate-only inventory 与 exclusion manifest 均仅存放在仓库外 `600` 私有文件中。为避免把每次执行的 `capturedAt` 当成业务变化，导出前后采用仅忽略该时间戳的业务一致性指纹；本轮前后完全一致，原始 aggregate SHA-256 仍精确绑定在快照中。`prepare-core-teaching-staging-import.mjs` 已返回 `prepared_not_applied`，尚未创建 V3 业务行、Cash request 或 Cash transaction。生产 School / Cash 没有写入、删除或冻结。

随后该快照已由 staging-only 单事务 importer 应用于 `v3-staging`：2 个业务归属、6 名学生、8 名老师、7 个科目、212 条计划课时、29 条实际课时、8 张账单、8 条收入、1 条支出和 281 条迁移审计。所有历史收入 / 支出均为 `historical_confirmed`、不创建 Cash request / transaction；幂等重跑返回 `already_applied`，只读复核的关联 Cash request 为 0。V2 有一组计划课时关联两条 completed actual，V3 以新增的只读 `legacy_planned_lesson_id` 保存额外历史链接，既不改变现行一对一运营关联，也不丢失来源关系。现行 production 未写入、删除或冻结。

已导入的普通教学计划 / 实际课时以 `legacy_v2_import` 标记，服务端拒绝更新、取消、恢复、删除、补课操作或生成新的实际课时；Staging 页面显示“历史导入 · 只读”，并可打开只含批次、哈希与时间元数据的迁移审计。这确保验收浏览不会改写受控副本，且日常运营课时不受影响。

2026-07-19 用户授权后已完成 School V2 / Cash production aggregate-only 只读盘点，并以受控、逐行 snapshot 在 staging 完成初始演练；production 未写入。私塾打工范围确认 3 个历史 batch、167 组历史 planned/actual、22 个 settlement、20 条 canonical income/linkage；12 条为 historical-confirmed，8 条 synced Cash transaction 已在 Cash production 全部解析。Cash production 为 7 个 account、58 条 CNY transaction、29 条 JPY transaction、53 条 fixed item 和 33 条 external request，引用孤儿为 0。完整无身份报告见 `docs/prod-readonly-inventory-20260719.md`。对应历史 batch、record audit、history-only linkage 和历史状态 schema 已在 dev / staging 通过合成验收；本次 staging 导入后的完整计数、关联和幂等复核已通过。

## Staging 准备状态

- `docs/staging-readiness-checklist.md` 已确定 staging 的冻结点、schema 安装顺序、Render 配置、数据范围、E2E 矩阵、对账、失败恢复和完成标准。
- `aozora-school-v3-staging` 已在 Tokyo 创建；School 26 个 migrations 和 Cash 10 表 / 48 函数 / 10 policies / 4 guards 已安装并验证，4 个合成 Cash 账户已 seed。其后已完成受控 School 私塾打工、Cash ledger 与普通教学 production snapshot 的初始副本演练；production 未写入。
- School staging API、School staging 静态站与 Cash staging 静态站均已 live；API 和数据库 health 为 ok，CORS 只允许两个 staging 前端，School bundle 不再包含 dev 回退 URL。Cash staging 已部署 `4b9dba7`，线上页面显示 `家庭账本 STAGING / V3 验收环境`，静态资源版本为 `20260718-cash-staging-v3-2`。
- 第一轮 API / pending / Cash 回滚型 E2E 与第二轮 JPY approve / reject / callback / 幂等恢复证据已记录于 `docs/staging-build-log.md`；剩余完整矩阵与全量对账通过前 staging 不算完成，也不得进入 `v3-prod` 建设。
- 第二轮 JPY 2,200 approved 与 JPY 1,100 rejected 已完成人工 Cash staging UI 验收；随后使用全身份匹配的事务脚本清理，School / Cash / 唯一 Cash transaction / 相关审计均已删除，全部 `STAGING-E2E-*` 盘点为 0。
- 第三轮 School 核心链路已通过：预定课时生成实际课时、学生月结锁定、锁定后新增课时拒绝、老师工资预览 / 锁定 / 手工调整 / 确认 / 撤销，以及工资锁定后的实际课时修改拒绝。一次性 staging 管理员与 `STAGING-E2E-CORE-*` 数据均已清理为 0。
- 第四轮学费账单 / 收据已通过：preview fingerprint 冲突保护、账单生成与 unchanged replay、收入生成、JPY 6,000 Cash approve/callback、callback replay、live receipt 与 immutable issued receipt 均通过；随后清理为 0。
- 第五轮 CNY canonical approve 已通过：CNY 123.45 收入与 CNY 67.89 支出均完成 Cash approve、School callback 和 replay 幂等，两个 School 记录均为 cash_confirmed；随后清理为 0。
- 第六轮老师工资真实聚合已通过自动与人工验收：同一老师 / 2099-05 / 同一 JPY 账户和付款日期的两条工资支出 JPY 2,100 与 JPY 1,800，经 Cash 正式聚合 RPC 只生成一条 JPY 3,900 流水；Cash approve replay、School batch callback replay、School sync marker replay 均幂等，冲突 School batch 身份被拒绝。用户确认 Cash UI 的合计、唯一流水与 School 同步只读状态正常后，使用全身份匹配脚本清理为 0。
- 第七轮 CNY→JPY FX 入站已通过自动与人工验收：一条 CNY 88.00 confirmed School 收入经 Cash 正式购汇生成双向关联的 CNY `fx_out` / JPY 1,800 `fx_in`，School 生成唯一法人账户入金与 inbound event；callback replay 与 Cash sync marker replay 幂等，冲突 payload / identity 被拒绝，CNY / JPY update / delete 四种 guard 均通过。用户确认 Cash UI 的关联与 School 同步只读状态正常后，使用全身份匹配脚本清理为 0。
- 第八轮私塾打工主链路已通过：外部工作地点、JPY 5,000 预定→实际课时、交通费 500、调整 -200、JPY 5,300 月结 preview / lock / export、锁定后课时修改拒绝、收入生成幂等、生成收入后撤销拒绝，以及真实 Cash approve / callback / replay 全部通过；随后精确清理为 0。
