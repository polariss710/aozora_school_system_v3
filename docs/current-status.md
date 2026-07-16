# Aozora School System V3 当前状态

更新日期：2026-07-17

## 当前开发状态

- V3 当前处于 dev 主链路实装与稳定测试阶段。
- 前端、NestJS API、Prisma schema 和 dev PostgreSQL 已建立，正式运营仍未切换到 V3。
- 学费账单已完成生成预览、来源明细、版本判断和来源指纹保护；2026-07-16 人工验收第 1～8 项已全部通过，包括学费账单月份动态筛选修复。
- School ↔ Cash 第一阶段服务端适配层已实装：环境隔离配置、Cash 可用账户只读、canonical income / expense pending request、approve/reject callback 验证、幂等 ID、失败复核和重试审计已进入 V3 API。
- V3 dev schema migration `20260716090000_add_cash_system_integration` 已执行成功。当前未配置真实 Cash dev 凭据时默认使用 dev-only mock；不将 mock 请求视为已完成外部 Cash 联动。
- V3 环境拓扑已确定为每个环境共置 School + Cash：当前 `v3-dev`，未来 `v3-staging`、`v3-prod`，峰值 Supabase project 数为 5，不另建三套 Cash project。
- 2026-07-17 已只向 `v3-dev` 安装 Cash dev 结构：7 张 `home_*` 表、42 个函数、7 个 RLS policy；没有复制生产数据、`shop_*` 对象或生产 ACL，现行 School / Cash production project 均未修改。
- staging / prod 数据库和正式迁移程序尚未建立或执行。

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

### 尚未完成

- Cash dev 前端实际登录后的人工 approve / reject 动作验收尚未执行；服务端 approve / reject 与 callback E2E 已通过。
- 已准备两条仅用于前端人工验收的 pending 请求：`DEV-UI-CASH-APPROVE-20260717 收入`（Cash request `17f392d2-bc30-419f-99e1-fd7a8eab2995`）应确认并生成 JPY 1234 流水；`DEV-UI-CASH-REJECT-20260717 支出`（Cash request `aa1c4bb0-d8d7-487c-ad76-1864f724a1f0`）应拒绝且不生成 JPY 2345 流水。
- Cash 现行合同没有 pending cancel，因此 V3 真实外部请求暂不支持撤回。
- `v3-staging` / `v3-prod` 尚未创建；Cash ledger 迁移、凭据、callback URL、CORS 来源和运营告警尚未配置。

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
