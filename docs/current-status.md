# Aozora School System V3 当前状态

更新日期：2026-07-18

## 当前开发状态

- V3 当前处于 dev 主链路实装与稳定测试阶段。
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
- Cash FX 入站当前仍不支持部分购汇分摊，只支持所选已确认 CNY 收入合计与 FX 转出金额完全相等；staging / prod 复制前还需分别执行环境级迁移与 E2E。
- 老师工资聚合付款、聚合审计与整组拒绝已完成 dev 代码、数据库、Cash dev v3-6 浏览器和用户人工验收。staging / prod 仍需分别应用 School migration、Cash 增量 SQL、环境凭据与真实 E2E。
- `v3-staging` 基础设施、凭据、callback URL、CORS 与空库 seed 已配置；完整合成业务 E2E、对账、失败恢复演练和运营告警尚未完成。`v3-prod` 未创建，Cash ledger 生产迁移未开始。

## V2 → V3 Prod 数据迁移状态

### 已确定迁移政策

- 不采用全系统统一日期截断，按业务模块定义迁移范围。
- 普通教学业务事实原则上迁移 `2026-07` 及以后；该月份是普通教学业务归属规则收口点，目的是避免把此前多业务归属历史链带入 V3 prod。
- 私塾打工是按工作单位和业务月结算的独立系统，不使用普通教学业务归属，因此迁移完整 2026 结算年度，即 `2025-12` 至 `2026-11`。
- 私塾打工范围以 `year_month` 为准，必须保留课时、结算、明细、收入、个人 Cash 联动事件和必要 legacy request 的完整审计链。
- 原 UUID、历史导入批次、原始行、snapshot、来源文件哈希和 Cash transaction ID 不得被重新生成或改写；不得给私塾打工历史记录补造业务归属。
- Cash DB 如继续复用，只迁移 School 引用；如 Cash 也迁库，另立 Cash ledger 迁移阶段。
- 正式切换采用“全量初始迁移 → 对账 → 最终增量 / 冻结 → 单点切换”，禁止长期双写。

正式政策详见 `docs/v3-prod-migration-boundary.md`。

### 尚未执行

- 未运行任何迁移 SQL、RPC 或数据复制程序。
- 未写入 V2、V3 dev、staging、prod 或 Cash 数据库。
- 未创建正式迁移批次或修改生产数据。
- 未执行 V2 只读盘点、逐字段 mapping、staging 演练或 prod 切换。
- 未补充 V3 承载历史导入批次、原始行快照、来源文件哈希和个人 Cash linkage 身份所需的 schema。

下一阶段开始前，需要先完成只读盘点、schema / mapping 设计、Cash 拓扑确认、迁移与回滚程序设计，再进入 staging 演练。

## Staging 准备状态

- `docs/staging-readiness-checklist.md` 已确定 staging 的冻结点、schema 安装顺序、Render 配置、数据范围、E2E 矩阵、对账、失败恢复和完成标准。
- `aozora-school-v3-staging` 已在 Tokyo 创建；School 19 个 migrations 和 Cash 10 表 / 48 函数 / 10 policies / 4 guards 已安装并验证，4 个合成 Cash 账户已 seed，未导入 production 数据。
- School staging API、School staging 静态站与 Cash staging 静态站均已 live；API 和数据库 health 为 ok，CORS 只允许两个 staging 前端，School bundle 不再包含 dev 回退 URL。
- 完整合成业务 E2E 矩阵、跨系统批次身份、对账报告和清理 / reset 证据尚未完成；在这些项目通过前 staging 不算完成，也不得进入 `v3-prod` 建设。
