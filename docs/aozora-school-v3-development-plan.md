# Aozora School System v3 立项阶段开发讨论框架

最后整理日期：2026-07-03

## 1. 立项共识

v3 不是在 v2 上继续换皮或补丁式修改，而是基于 v2 真实运营经验，对前端、后端、数据模型和主业务链路做全面重构。

v2 当前定位：

- 稳定运营系统。
- 真实业务问题和 v3 需求证据来源。
- 未来 2-3 个月继续覆盖真实业务。
- 只做真实业务中发现的小修补，不做大规模重构。

v3 当前定位：

- 正式运营系统的重构准备阶段。
- 先确认基础架构和 v3.0 主链路边界。
- 不在立项阶段扩成完整功能清单。
- 不急于实现报价、合同、CRM、通知、图片、自动化工具等扩展能力。

## 2. 技术底座讨论

技术底座需要明确方向。当前已有部分底座形成暂定结论，后续进入实现阶段前仍可根据实际风险微调。

### 2.1 前端方案

当前暂定结论：

- 前端采用 `React + TypeScript + Vite`。
- v3 前端定位为运营后台 SPA，不优先采用 SSR / SEO 导向框架。
- 路由优先采用 `React Router`。
- API 请求、缓存和异步状态优先采用 `TanStack Query`。
- 表单优先采用 `React Hook Form + Zod`。
- 表格优先评估 `TanStack Table` 或 UI 组件库表格能力。
- UI 组件库优先评估 `shadcn/ui`，备选 `Ant Design`、`Mantine`、`MUI`。
- 图标优先采用 `lucide-react`。

判断重点：

- v3 前端不是静态页面堆叠，而是长期运营的业务系统界面。
- 页面应支持高频录入、筛选、核对、详情查看和审计追踪。
- UI 不应简单照搬 v2 页面，而应按真实运营顺序重组。
- React 路线与此前 Figma demo / Codex 分析路线更连贯，也更适合继续使用现代 JS / TS 轻量化技术栈。
- Next.js、Nuxt 等全栈 / SSR 框架暂不作为 v3 初期优先方案。
- Vue 3 技术上可行，但当前不作为优先路线。

后续待细化：

- 最终 UI 组件库选择。
- V3 信息架构和关键页面 Figma demo prompt。
- 页面级状态、表格筛选、详情页、审计入口和工作台布局规则。

### 2.2 后端方案

已确定：

- v3 明确采用前后端分离。
- v3 必须有明确的前端、后端和数据库三层。
- 后端不是临时脚本，也不是只在前端旁边补几个 RPC，而是承载 API / domain service / 业务规则的正式服务层。
- v3 采用厚后端 domain service 方案，而不是“薄 API + SQL / RPC 堆业务规则”的权宜模式。
- 后端主栈确定为 `NestJS + TypeScript`。
- NestJS 初期使用默认 Express adapter；未来如有明确性能或部署需求，可评估 Fastify adapter。
- v3 整体走轻量化现代 JS / TS 技术线，以降低前后端维护成本并承接厚后端业务结构。
- 数据访问层优先采用 `Prisma + PostgreSQL`。
- migration 优先采用 Prisma migration。
- Python 不是主后端必选项，可作为未来数据迁移、一次性脚本、复杂文件处理等辅助工具。
- 主业务链、金额层、Cash 层的数据调度和业务编排全部放进 API / 后端 domain service。
- DB / RPC 负责数据完整性、强约束、事务、必要原子操作和防绕过保护，不作为所有业务规则的主要堆放地。
- 后端 domain service 初步按业务能力拆分为 `LessonService`、`SettlementService`、`WageService`、`MoneyService`、`IncomeService`、`ExpenseService`、`CashService`、`AccountService`、`AuditService`。
- 暂时不需要 batch 批量处理、定时自动处理或自动化运营任务。

待讨论内容：

- API 层如何设计。
- 后端与数据库之间如何保持金额、状态机、权限、审计的一致性。
- 未来是否扩展支持定时任务、文件生成、通知等能力。

基本原则：

- 页面层不得直接承担核心写入规则。
- 涉及课时、结算、工资、收入、支出、账户流水、Cash 联动的核心规则，应由后端 domain service 负责，并由数据库约束提供最后防线。
- 前端负责展示、输入、状态提示和必要的二次确认。
- 后端负责业务规则、权限控制、审计、幂等、错误处理和外部联动。
- API 应按业务动作 / use case 设计，而不是让前端直接做 CRUD 或拼表操作。
- 前端调用业务动作，后端负责在 use case 中编排 domain service、事务、审计和外部联动。
- batch / 定时任务 / 自动处理不是 v3.0 当前必选范围，后续如需要再作为扩展能力设计。
- Prisma 负责数据访问、类型生成和 migration，不负责业务逻辑。
- 不把核心业务判断塞进 Prisma middleware、repository 或零散 SQL。
- 复杂统计、报表或 Prisma 难以表达的查询，允许后端使用 raw SQL，但必须集中管理、可测试、可审计。

NestJS 分层原则：

- `Controller`：接收请求、鉴权入口、参数校验、调用 use case。
- `Application service / use case`：编排业务流程、事务、审计、幂等和外部联动。
- `Domain service`：承载金额、状态机、生成、锁定、冲销、校验等业务规则。
- `Repository / data access`：通过 Prisma 访问 PostgreSQL，不承载业务决策。
- `Module`：按业务能力组织边界，避免所有逻辑堆入单一服务。

初步模块边界：

- `LessonService`：预定课时、实际课时、来源追踪。
- `SettlementService`：学生月度结算、锁定、差额、结转；不负责生成学生学费收入。
- `WageService`：老师工资月度结算、工资快照、手动调整、支出生成前的工资状态。
- `MoneyService`：金额计算、币种取舍、汇率、抹平、校验。
- `TuitionBillingService` / `StudentBillingService`：学生应收生成，读取正式预定课时和已确认结转，计算本月学费应收。
- `IncomeService`：收入记录、收入状态、承接学生应收生成结果、收款链路入口。
- `ExpenseService`：支出记录、支出状态、从老师工资或其他支出来源生成付款链路入口。
- `CashService`：Cash 请求、同步、状态回写。
- `AccountService`：账户、流水、收入支出影响。
- `AuditService`：审计日志、操作追踪、冲销记录。

以上模块边界作为 v3 厚后端的第一版拆分方向，后续可根据数据模型和 API 设计继续调整。

API / Use Case 设计原则：

- API 表达业务动作，而不是直接暴露表操作。
- 避免用通用 CRUD 承担主链路写入，例如让前端自行组合 `POST /income`、`PATCH /income/:id`、`DELETE /income/:id`。
- 主链路 API 应由后端 use case 负责校验权限、读取 snapshot、调用 MoneyService、写审计、处理幂等和事务。

v3.0 第一批 API 草案：

课时：

```text
POST /planned-lessons
POST /planned-lessons/batch-generate
POST /actual-lessons/log
POST /actual-lessons/:id/cancel
POST /makeup-lessons/:id/complete
```

学生学费 / 收入：

```text
POST /tuition-bills/generate
POST /tuition-bills/:id/generate-income
POST /income/:id/submit-cash
POST /income/:id/void
POST /income/:id/regenerate
```

学生月度结算：

```text
POST /student-settlements/preview
POST /student-settlements/lock
POST /student-settlements/:id/revoke
POST /student-settlements/:id/relock
POST /student-settlements/:id/export-pdf
```

老师工资 / 支出：

```text
POST /wage-snapshots/generate
POST /wage-snapshots/:id/export-adjustment-excel
POST /wage-snapshots/:id/import-adjustment-excel
POST /wage-snapshots/:id/generate-expense
POST /expenses/:id/submit-cash
POST /expenses/:id/void
```

Cash：

```text
POST /cash-requests/:id/retry
POST /cash-requests/:id/cancel
POST /cash-events/receive
```

账户：

```text
POST /account-transactions/manual
POST /account-transfers/internal
POST /account-transfers/fx-from-cash-event
```

说明：以上是业务动作粒度草案，不是最终 URL 规范。最终命名可随后端框架和路由规范调整，但前端不得绕过 use case 直接操作业务表。

### 2.3 平台方案

当前暂定结论：

- v3 初期部署优先采用 `Render + Supabase`。
- 后端 NestJS API 优先部署为 Render Web Service。
- 前端 React SPA 暂定部署为 Render Static Site；如后续前端方案需要，也可评估 Vercel。
- 数据库使用 Supabase paid project 托管 PostgreSQL。
- Google Cloud Run 作为未来更正式的平台升级候选，不作为 v3 初期优先方案。
- GitHub Pages 不作为 v3 正式运营发布平台。

平台原则：

- v3 不以免费额度为核心约束。
- 前端、后端、数据库、部署平台都可以接受合理付费。
- 平台选择优先考虑稳定性、可维护性、环境隔离、发布可靠性、数据安全、权限控制、备份恢复、日志监控和运营效率。

特别记录：

- GitHub Pages 免费发布存在 queued / 延迟风险。
- 未来正式运营不应强依赖这种不稳定发布方式。
- 免费额度只能作为成本参考，不能成为牺牲正式运营架构质量的理由。
- v3 当前数据量预计较小，初期重点是快速搭建、快速迁移 v2 数据、验证主链路和建立可维护架构。
- 不为了“企业级平台感”提前引入过重的云平台复杂度。

部署分阶段策略：

- 开发阶段：本地开发为主；需要外部测试时部署一个 Render dev API 和前端预览环境。
- 测试阶段：新增 `v3 staging` DB、Render staging API、staging frontend，用于验收和迁移演练。
- 上线阶段：新增 `v3 prod` DB、Render prod API、prod frontend，只承载真实业务。
- `dev` / `staging` / `prod` 的环境变量必须显式隔离。

### 2.4 数据库方案

当前暂定结论：

- 数据库技术采用标准 PostgreSQL。
- v3 初期数据库平台采用 Supabase paid project。
- 当前 Supabase organization 计划从 Free 升级到 Pro。
- v2 现有 School project 不迁移、不改架构。
- 现有 Cash project 不在 v2 稳定运营期合并。
- v3 开发阶段新增一个独立 Supabase project，作为 `v3 dev`。
- 等 v3 进入测试 / 上线准备阶段后，再细分 `v3 staging` 和 `v3 prod`。
- Google Cloud SQL 等更重的正式托管 PostgreSQL 暂不作为初期优先方案，可作为未来迁移候选。

基本原则：

- `prod` / `staging` / `dev` 必须从设计阶段隔离。
- 逻辑环境必须从一开始按三层设计，但云端 project 可以分阶段创建。
- 生产环境只保存真实业务数据。
- 测试数据不得写入生产环境。
- 所有环境变量必须显式包含系统名和环境名。
- 数据库方案必须支持可靠备份、可追踪迁移和必要的恢复能力。

Supabase / 后端边界：

- v3 不继续沿用 v2 的 Supabase RPC 业务层模式。
- 前端只调用 v3 后端 API，不直接调用 Supabase 写业务数据。
- 后端优先通过 Prisma 访问 PostgreSQL。
- 核心业务逻辑放在后端 domain service，不放在 DB RPC。
- DB 负责表结构、约束、索引、外键、唯一性、基础事务一致性和必要数据库级防线。
- Supabase 在 v3 初期主要作为托管 PostgreSQL、Dashboard、备份和基础管理平台。
- 未来如迁移到 Cloud SQL / Neon / RDS，主要应是配置、权限和数据迁移问题，而不是重写业务系统。
- Prisma schema 和 migration 应进入 v3 工程体系，不依赖 Supabase Dashboard 手工维护结构。
- 复杂查询可在后端集中使用 raw SQL，但不得重新演变为 DB RPC 业务层。

当前费用估算：

- 当前 3 个 project 合计约 `$35/月`。
- 测试 / 上线准备阶段如增加 `v3 staging` 和 `v3 prod`，费用会继续上升；用户当前判断最终可接受约 `$55/月` 左右。
- v3 开发完成后，计划合并或下线旧的 Cash / v1 / v2 相关 DB，长期争取保留 2-3 个 project。
- 实际金额以 Supabase billing 页面为准。

### 2.5 认证与权限

v1 到 v2 没有正式登录界面，也没有权限控制。v3 作为正式运营系统，必须补齐登录、角色和权限控制。

登录入口原则：

- v3 必须有正式登录画面，不能继续沿用 v1 / v2 无登录入口的运营方式。
- 登录画面应是后台系统入口，不做营销页或复杂说明页。
- 登录后根据用户角色进入授权范围。
- 前端登录状态只负责界面进入和展示，真实认证、session、角色权限和关键操作校验必须由后端负责。
- 退出登录、session 过期、未授权访问应有明确处理。

初版角色模型：

- 全局管理员：拥有全部业务和系统管理权限。
- 财务负责人：预计 1-2 人，负责资金流相关操作，到提交 Cash 确认为止。
- 普通业务人员：负责学生管理、课时管理等日常业务操作。
- 销售 / 签约前角色：未来可负责报价单生成、合同生成等签约前功能。

当前明确由系统管理员处理：

- Cash 发起。
- Cash 确认。
- 业务归属设置。
- 账户设置。
- 利润分析读取。

暂未完全确定的权限：

- 老师管理。
- 科目管理。
- 其他基础资料维护。

权限需要覆盖：

- 谁能编辑课时。
- 谁能锁定结算。
- 谁能生成收入。
- 谁能生成支出。
- 谁能提交 Cash。
- 谁能冲销记录。
- 谁能查看财务。
- 谁能查看集中审计中心。

权限设计不一定在 v3.0 做到复杂，但登录、角色、关键操作权限和审计记录必须从一开始预留。

说明：

- 细致角色分工主要在未来私塾人员扩充后发挥作用。
- 短期内可以先建立权限模型和角色能力边界，但不一定马上有具体人员分别操作。

## 3. v3.0 主链路

v3.0 的目标不是一次性实现所有扩展业务，而是重建稳定、可维护、可迁移的主业务系统。

### 3.1 核心数据模型

v3.0 核心数据模型按五层拆分：

```text
基础资料层
课时事实层
结算 / snapshot 层
财务 / Cash / 账户层
系统 / 权限 / 审计层
```

重要原则：

- snapshot 是 v3 的正式一等实体。
- `tuition_bill_snapshot`、`settlement_snapshot`、`wage_snapshot` 等生成后，应保存当时的依据、状态和后端确认金额。
- snapshot 不应依赖后续原始数据变化重新解释历史结果。
- 收入、支出、Cash、账户流水、审计都应关联对应 snapshot 或业务来源。
- 正式业务数据必须区分可变事实 records、锁定快照 snapshots、财务单据 records、资金事件 events、账户流水 transactions。
- 学生学费账单、学生月度结算、老师工资、外部授课结算都必须有 snapshot / lock-time detail。
- 金额字段使用后端 MoneyService 的权威口径，DB 层使用 decimal / numeric，不使用前端 JS number 结果作为业务金额。

通用建模规则：

- 核心业务表主键使用 `uuid`。
- DB 表名用 snake_case 复数；Prisma model 用 PascalCase。
- 大部分业务表保留 `created_at`、`updated_at`、`created_by`、`updated_by`、`status`、`memo`。
- 迁移数据保留 `legacy_table`、`legacy_id`、`legacy_version`、`legacy_snapshot`、`migrated_at`。
- 正式业务数据保留 `source_type`、`source_id`、必要的 `source_label` 或 `source_batch_id`。
- 主状态优先使用 `status`，避免散乱的 `is_locked`、`is_paid`、`is_synced` 等 boolean 承担主流程语义。
- 已锁定、已生成收入 / 支出、已提交 Cash、已生成账户流水的数据不得物理删除，后续只能通过 `void`、`reverse`、`supersede`、`relock` 等专门动作处理。

基础资料层：

- `students`
- `teachers`
- `subjects`
- `business_entities`
- `accounts`
- `external_workplaces`

说明：

- `accounts` 只保留 School 侧长期账户：公司法人账户、吴垫付账户、包垫付账户。
- Cash 账户不在 School 侧作为长期账户展示，只在生成 Cash 请求时选择。
- `external_workplaces` 用于承接私塾打工 / 外部授课机构，避免只依赖自由文本。

课时事实层：

- `planned_lessons`
- `actual_lessons`
- `makeup_lesson_links`
- `lesson_generation_batches`

规则：

- `planned_lessons` 是学生学费生成基础。
- `actual_lessons` 是学生月度结算和老师工资基础。
- `planned_lessons` 不承载复杂执行状态；请假、补课、跨月补课主要由 `actual_lessons` 和 `makeup_lesson_links` 表达。
- v3 不设置 `moved` 状态；普通未锁定改课直接编辑，已进入下游后的替代关系用 `superseded` / `replaced_by_id` 表达。
- `planned_lessons` 状态建议保留 `scheduled`、`cancelled`、`voided`、`superseded`。
- `makeup_lesson_links` 连接原请假课时和补课课时，支持当月补课和跨月补课，避免用备注解释补课关系。
- 大型批量生成、迁移或未来课程计划转正式课时，应通过 `lesson_generation_batches` 记录生成批次。

学生学费 / 结算层：

- `tuition_bill_snapshots`
- `tuition_bill_snapshot_items`
- `student_monthly_settlements`
- `student_monthly_settlement_details`
- `student_settlement_adjustments`

规则：

- `tuition_bill_snapshots` 按 `student_id + billing_month` 生成。
- `student_monthly_settlements` 按 `student_id + year_month` 生成。
- 学费账单和学生月度结算都允许逐个学生生成、锁定、撤销和重锁。
- 每个学生每个月只能有一个当前有效账单 / 当前有效结算，但历史版本必须保留。
- 学费账单来源是当月正式 `planned_lessons` + 上月 locked carryover。
- 学生月度结算来源是 `actual_lessons` + 已确认收入 / 到账 + carryover。
- 学费收入不是从学生月度结算生成；学生月度结算只影响差额、结转和后续账单。

老师工资 / 支出层：

- `teacher_wage_snapshots`
- `teacher_wage_snapshot_details`
- `teacher_wage_adjustments`
- `expense_records`

规则：

- `teacher_wage_snapshots` 按 `teacher_id + year_month + business_entity_id` 生成。
- 工资支出 `expense_records` 也按 `teacher_id + year_month + business_entity_id` 生成。
- 同一老师同一月份如存在多个业务归属，School 侧生成多条工资快照和多条支出记录。
- v3 School 侧不建立 `teacher_wage_payments` / `teacher_wage_payment_items` 作为工资聚合层。
- Cash 端负责按老师 / 月份 / 币种做聚合确认，并逐条回写 School 对应支出记录和 Cash 状态。
- 勤务表导出可按 `teacher_id + year_month` 聚合所有业务归属的工资快照明细生成一份文件，但不改变 School 侧支出记录粒度。

外部授课 / 私塾打工层：

- `external_work_planned_lessons`
- `external_work_actual_lessons`
- `external_work_monthly_settlements`
- `external_work_settlement_details`

规则：

- 外部授课是独立外部机构授课收入链路，不是学生课时，也不是老师工资。
- 外部授课不连接 `students`，不连接普通 `planned_lessons` / `actual_lessons`，不进入老师工资，不写支出。
- 外部授课月度结算按 `year_month + workplace_id` 生成并锁定。
- 锁定时生成 detail snapshot，导出和后续审计读取 snapshot，不重新读取可变 lesson。
- 外部授课收入通过统一 `income_records` 进入 Cash，`source_type = external_work` 或兼容 `part_time_work`。

财务 / Cash / 账户层：

- `income_records`
- `expense_records`
- `cash_requests`
- `cash_events`
- `account_transactions`
- `internal_transfers`
- `fx_settlements`
- `reimbursement_records`（轻量、低频）

规则：

- `income_records` 和 `expense_records` 是 School 侧业务单据，不是 Cash 交易流水。
- 学费收入、手动补充学费收入、外部授课收入、普通收入统一进入 `income_records`。
- 老师工资、普通支出、报销相关支出统一进入 `expense_records`。
- 普通法人账户支出可以从 `expense_records` 直接生成 `account_transactions`，不走 Cash。
- 学费收入、外部授课收入、老师工资支出必须通过 canonical income / expense 进入 Cash。
- Cash 不直接写 School DB，必须通过 School API 回写 `cash_events`。
- `account_transactions` 只记录已确认账户流水，不解释业务来源；业务意义由 income / expense / transfer / FX source 承接。

系统 / 权限 / 审计层：

- `users`
- `roles`
- `permissions`
- `user_roles`
- `audit_events`
- `file_exports`
- `file_imports`

初版角色：

- `admin`
- `finance`
- `business`
- `sales`

这些模型应先明确主键、状态、来源、锁定规则、审计字段和跨表关系，再进入页面设计。

### 3.2 主链路状态机

v3.0 主链路状态机必须统一表达以下问题：

- 哪些状态可编辑。
- 哪些状态只读。
- 哪些状态锁定。
- 哪些状态允许冲销。
- `locked` / `income created` / `synced cash` / `has transaction` 后的编辑保护。
- 查看详情是只读行为，不应因为锁定而消失。

基本原则：

- 锁定不等于隐藏。
- 只读查看必须长期保留。
- 进入资金链路后的数据不能被普通编辑绕过。
- 冲销、撤回、重建都必须有明确状态、权限和审计记录。

通用状态语义：

```text
preview
-> locked
-> income_or_expense_created
-> cash_requested
-> cash_confirmed
-> account_transaction_created
```

异常 / 修正状态：

```text
revoked
voided
superseded
reversed
cash_rejected
needs_manual_review
```

统一规则：

- `preview` 原则上不落库，只由后端返回预览结果。
- `locked` 表示正式快照已生成，不能通过普通编辑修改其计算依据。
- `income_or_expense_created` 后，上游 snapshot 进入更强保护。
- `cash_requested` 后，School 侧 income / expense 不能普通编辑。
- `cash_confirmed` 后，不能普通撤销，只能走冲销、反向记录或修正事件。
- `account_transaction_created` 后，账户流水不能删除，只能生成反向流水。
- `voided` 表示业务单据作废，但记录保留。
- `reversed` 表示通过反向记录冲销。
- `superseded` 表示被新版本替代，必须保留 `replaces_id` / `replaced_by_id` 或等价映射。
- 同一业务对象同一月份只能有一个当前有效版本，历史版本必须保留。

### 3.3 撤销 / 作废 / 重算机制

v3 必须为主链路建立统一的撤销、作废、重算机制。

核心原则：

- 不允许通过普通编辑直接改写已锁定、已生成下游记录、已提交 Cash、已生成账户流水的业务事实。
- 撤销、作废、重算必须走专门动作。
- 专门动作必须有权限控制、二次确认、原因记录、审计记录。
- 已进入资金链路后的错误修正，应优先通过作废、冲销、反向流水、重新生成等方式处理，而不是原地修改。
- 查看详情是只读行为，不能因为记录被锁定或作废而消失。

当前已确认的核心场景：

1. 学生月度结算：锁定、撤销、重新锁定。
2. 老师工资结算：wage snapshot 生成、撤销、重新生成。
3. 工资快照生成支出记录后的撤销。
4. 收入 / 支出生成后：作废、重新生成。
5. 提交 Cash 的请求被拒绝后：撤销、重新生成。

需要补充覆盖的场景：

- tuition bill snapshot 生成后，如果预定课时或上月结转发现问题，应作废旧 snapshot 并重新生成，不能直接改旧 snapshot。
- pending income / pending expense 作废后，应保留原记录和来源映射。
- Cash confirmed 后，原则上不能简单撤销；如需纠正，应通过反向记录、冲销记录或新的资金事件处理。
- account transaction 生成后，不能删除流水；如需纠正，应生成反向流水并关联原流水。
- FX / 资金归集事件如果回写错误，应保留原 Cash event，并在 School 侧生成修正记录。

状态语义：

```text
preview
-> locked
-> income_or_expense_created
-> cash_requested
-> cash_rejected / cash_confirmed
-> account_transaction_created
-> voided / reversed / superseded
```

说明：

- `preview` 原则上不落库。
- 不同模块可以使用适合自身的状态名，但语义必须统一。
- `voided` 表示原业务单据作废。
- `reversed` 表示通过反向记录冲销。
- `superseded` 表示被新生成版本替代。
- 所有替代关系必须保留 `replaces_id` / `replaced_by_id` 或等价映射。

### 3.4 LessonService / 课时层原则

核心模型：

- 正式预定课时 = 学费收入基础。
- 实际课时 = 学生月度结算 + 老师工资基础。

v2 中预定课时是主链路基础，具有重要性和唯一性。v3 继续保留这个核心模型。

课时层必须区分：

- 正式预定课时。
- 计划草稿。
- 报价课时。
- 导入候选数据。

正式预定课时是事实系统的一部分；草稿、报价、候选数据不得默认等同于正式课时。

预定课时来源：

- 签约前报价单属于独立业务，不直接进入主链路。
- 签约后的正式预定课时生成，当前保留：
  - 手动单条新增。
  - 批量生成预定课时。
- v2 支持 Excel 批量导入预定课时，但 v3 取消该功能。
- v3 应通过报价单生成、合同生成、批量课时生成等系统能力，尽可能替代手工制作和导入 Excel。

正式预定课时的日期显示规则：

- 预定课时用于学费计费和课程规划，不等同于实际上课日。
- 预定课时默认不指定具体上课日和上课时间。
- 预定课时的日期字段应显示为该周周一日期 + `周`，例如 `7.6周`、`7.13周`。
- 同一课程同一周多次时，仍使用同一个周锚点，并通过该课程自己的连续回数区分，例如 `7.6周 / 第1回`、`7.6周 / 第2回`。
- 回数按课程独立累计，不同课程之间不共享回数。
- 该显示规则必须在课时管理、学费账单来源明细、报价、课程计划、PDF 输出等涉及预定课时的场景中保持一致。
- 实际课时才显示真实上课日期和时间，例如 `2026/07/08 18:00-20:00`。

实际课时：

- 实际课时来自正式预定课时的执行结果或必要的手动补录。
- 实际课时进入学生月度结算。
- 实际课时进入老师工资结算。
- 学生月度结算锁定后，应支持导出 PDF 文件。

月度结算前的课时处理状态：

一个月结束后，当月预定课时全部处理完毕后，才可进入学生月度结算。

当前课时处理状态包括：

1. 正常上课：记录实际课时。
2. 规定上课时间请假，状态改为待补课，并在同一个月内标记补课完成。
3. 取消：整节课不进行课时计算。
4. 规定上课时间请假，状态改为待补课，但无法在本月完成补课，进入跨月补课登记，在后续月份通过登记跨月补课完成功能完成登记。

对学生本月课时费的影响：

- 状态 1、2、4 不影响学生本月课时费。
- 状态 3 会减少学生本月课时费。
- 状态 4 虽然本月未完成上课，但课时费不退；后续老师登记补课完成后，只影响补课月份老师工资，不影响当前月或补课月的学生课时费。

课时状态机确认：

`planned_lessons.status` 建议保留：

```text
scheduled
cancelled
voided
superseded
```

含义：

- `scheduled`：正式预定课时，参与学费账单生成。
- `cancelled`：取消课时，不计学生本月课时费。
- `voided`：作废，通常用于录入错误、迁移错误或重复数据。
- `superseded`：被新版本替代，保留历史关系。

`actual_lessons` 不使用一个巨大状态字段承载所有含义，而拆分为：

```text
attendance_status
makeup_scope
student_fee_effect
teacher_wage_effect
```

建议取值：

```text
attendance_status = completed / cancelled / leave_makeup_pending / makeup_completed / voided / superseded
makeup_scope = none / same_month / cross_month
student_fee_effect = normal / waived / no_extra_charge
teacher_wage_effect = count / not_count / deferred
```

补课关系由 `makeup_lesson_links` 承接：

```text
status = pending / completed / cancelled / voided
makeup_type = same_month / cross_month
```

跨月补课核心口径：

- 学生费用归属原预定课时月份。
- 老师工资归属补课完成月份。
- 原请假课：学生费用正常计入原预定月份，老师工资不计或 deferred。
- 补课完成课：学生费用不再计，老师工资计入补课完成月份。
- 补课完成课使用 `student_fee_effect = no_extra_charge`、`teacher_wage_effect = count`。
- `SettlementService` 不能简单用 `actual_date` 判断学生费用月份，必须识别原预定课时月份和补课关系。
- `WageService` 以补课完成的 actual lesson 月份计入老师工资。

月度结算作用：

- 学生月度结算基于当月处理完毕的课时状态计算本月实际课时费。
- 课时费在月度结算时进行余额调整。
- 月度结算生成结算金额和结转金额。
- 结转金额进入下月学费生成逻辑。

Excel 使用原则：

- v3 应尽可能降低 Excel 出现频率。
- 目前必须保留的 Excel 场景是老师工资结算：生成工资快照后，导出 Excel 文件供老师填写交通费、教室费。
- 工资交通费 / 教室费 Excel 导出 / 导入保留为 v3.0 主流程。
- 该 Excel 不是业务事实来源，而是老师填写费用的受控输入文件。
- 预定课时不再通过 Excel 批量导入作为正式主流程。
- 其他场景如无明确必要，不应继续引入 Excel 文件。

周课表图片：

- v2 Beta 中的周课表图片功能需要保留。
- 后续应成为正式功能。
- 暂定形态为批量导出图片，由操作员手动发送。
- 周课表图片只读正式预定课时，不应反向修改课时事实。

### 3.5 学生收入与月度结算边界

学生收入链路和学生月度结算链路必须分开设计。

当前确认：

- 学生月度结算不负责生成学生学费收入记录。
- 学生月度结算只负责本月实际课时费、差额、结转等结算结果。
- 月度结算结果会影响结转金额，并影响老师工资相关计算。
- 每月学生学费收入主要根据该月正式预定课时产生，同时必须受到已确认结转金额影响。
- 结转金额不应通过技术手段强行归零；如果存在大额差额，应通过正常结转进入后续学生应收。
- v2 已补齐学生学费生成链路，基准 commit：`3c87de6` / `v10.3.47`。
- v3 应按同一业务模型实现：由学生应收生成入口统一读取正式预定课时和上月已锁定结转，而不是从月度结算直接生成收入。
- 收入生成入口应保持唯一，避免 `LessonService` 和 `SettlementService` 两边都能直接写收入。

v2 基准口径：

- 学费应收不再由前端或手工收入直接决定。
- School DB / RPC 生成 student tuition bill：
  - `billing_month` 的正式 planned 课时费生成 JPY 应收金额。
  - 上月 locked student settlement 的 `carryover_amount_cny` 作为 CNY 结转冻结。
- 从 tuition bill 生成 pending `school_income_records`，`source_type = student_tuition_bill`。
- 提交 Cash 时：
  - School 原始收入金额仍是 JPY 应收。
  - 若实际到账为 CNY，DB / RPC 按 JPY 应收 * 汇率 + 冻结 CNY 结转，再按 round / ceil / floor 取整。
  - 用户可以使用实时汇率，也可以手动输入汇率；系统按 JPY * 汇率计算 CNY 金额。
- 页面 / API 不传应收金额，前端只触发生成；金额权威在 DB / RPC。

v3 建议模型：

```text
student planned lessons
+ previous locked carryover
-> tuition bill snapshot
-> pending income
-> Cash confirmation
```

v3 服务协作建议：

```text
正式预定课时
-> LessonService
              \
               -> TuitionBillingService / StudentBillingService
              /
上月 locked carryover
-> SettlementService
-> MoneyService
-> tuition bill snapshot
-> IncomeService pending income
-> CashService
-> AccountService
```

说明：v2 的金额权威在 School DB / RPC；v3 采用厚后端后，应由后端 domain service / DB 共同承担同一权威模型，前端仍然只触发生成、展示结果和提交用户显式输入。

实际课时与月度结算链路：

```text
实际课时登录
-> LessonService
-> SettlementService
-> MoneyService
-> 结转 / 老师工资依据
```

学生学费账单状态机：

```text
preview
-> locked tuition_bill_snapshot
-> income_created
-> voided / superseded
```

规则：

- 学费账单 preview 不落库，只由后端返回预览结果。
- 用户确认生成时，直接写入 locked `tuition_bill_snapshot`。
- `tuition_bill_snapshot` 按 `student_id + billing_month` 生成。
- `locked` 后冻结 planned lessons 和上月 locked carryover。
- `income_created` 后不能直接修改账单；如发现基础课时或结转错误，应作废 / 替代旧账单后重新生成。
- 对应 income 已提交 Cash 后，上游账单不能普通作废，只能走冲销、反向记录或下期调整。

学生月度结算状态机：

```text
preview
-> locked student_monthly_settlement
-> revoked / superseded / voided
```

规则：

- 学生月度结算 preview 不落库。
- 用户确认锁定时，直接写入 locked `student_monthly_settlement`。
- `student_monthly_settlement` 按 `student_id + year_month` 生成。
- 只有 locked settlement 的 `carryover_amount_cny` 能进入下月 tuition bill。
- 同一学生同一月份只能有一个当前有效 locked settlement。
- 撤销后重新锁定必须生成新版本，不覆盖旧记录。
- 如果下月 tuition bill 已引用上月 carryover，不能直接 revoke 上月 settlement，必须先处理下游 bill / income。
- 如果相关收入已经 Cash confirmed，不能通过简单 relock 消掉事实，只能通过后续结转、冲销或修正流程处理。

老师工资与支出链路：

```text
老师工资结算
-> WageService
-> ExpenseService
-> MoneyService
-> CashService
-> AccountService
```

### 3.6 收入层业务链路

v3 收入层业务链路可以按以下模型落实。

学生学费收入主链路：

```text
student planned lessons
+ previous locked carryover
-> tuition bill snapshot
-> pending income
-> Cash confirmation
-> account transaction
```

服务职责：

- `LessonService` 提供 `billing_month` 内正式 planned 课时事实。
- `SettlementService` 提供上月 locked student settlement 的 CNY carryover。
- `TuitionBillingService` / `StudentBillingService` 生成 tuition bill snapshot。
- `MoneyService` 统一处理 JPY 应收、CNY 结转、通知金额 preview、实时 / 手动汇率、round / ceil / floor 和 Cash 请求金额确认。
- `IncomeService` 从 tuition bill snapshot 生成 pending income，并维护收入记录状态。
- `CashService` 负责 Cash confirmation / Cash request / Cash 状态回写。
- `AccountService` 负责 Cash 确认后的账户流水。
- `AuditService` 记录生成、确认、冲销、Cash 同步等操作。

关键规则：

- 主学费应收不能由前端手工决定金额。
- 页面 / API 不传应收金额，只触发生成，或提交汇率、取舍方式、是否使用通知金额等用户选择。
- tuition bill snapshot 是学费收入的业务快照，必须保存生成依据和后端确认金额。
- pending income 是进入 Cash 前的收入单据状态。
- Cash confirmation 后，收入记录与账户流水进入更强保护状态。
- 用户不能手动输入最终 CNY 到账金额；如果选择 CNY 提交 Cash，只能使用实时汇率、手动输入汇率，或选择使用通知金额。
- 最终提交 Cash 的 CNY 金额必须由后端 MoneyService 根据 tuition bill snapshot、汇率、币种规则和结转规则计算 / 确认。
- 学生月度结算不直接生成收入，但其 locked carryover 会影响后续 tuition bill snapshot。

学费金额口径：

- 学费准确账单金额是混合币种结构：`planned_amount_jpy + carryover_amount_cny`。
- CNY 结转金额不反算回 JPY。
- `tuition_bill_snapshot` 保存准确账单构成：JPY 预定课时费和 CNY 结转金额。
- 通知金额是 preview / display value，默认不落库。
- 通知金额计算口径为：`notice_amount_cny = planned_amount_jpy * notice_exchange_rate + carryover_amount_cny`。
- 只有当提交 Cash 时选择“使用通知金额”，通知金额才成为正式业务数据，写入 income / cash request 的请求金额口径。
- 提交 Cash 请求的金额才是最终确定的业务金额。

V2 v10.3.52 对照结论：

- V2 在 `v10.3.52` / commit `5a9c6a1` 中补齐了学费账单通知金额逻辑。
- V2 的 `billing_amount_cny` / `billing_exchange_rate` 落库是稳定运营修补方案，因为 v2 没有独立后端 preview 层。
- V3 继承 V2 的业务口径，但不继承通知金额必须落库的实现方式。
- V3 的通知金额默认由后端计算后展示，不写入 tuition bill snapshot。
- V2 Cash 提交阶段允许 `actualReceivedAmount` 作为用户显式输入金额；V3 默认不允许手动输入最终 CNY 金额，只允许使用实时汇率、手动输入汇率，或选择使用通知金额。
- V2 的手动实际到账金额、已落库通知金额、缺失通知金额的历史记录，迁移到 V3 时应作为 legacy / audit 信息处理，不反向重算或回填。
- V2 在 `v10.3.47` 之前没有通知金额字段；迁移时应标记 `notice_amount_missing` / `notice_exchange_rate_missing`，不要用当前汇率回填历史通知金额。

低频补充学费收入：

- v3 需要保留 v2 当前已实施的手动新增收入 + 选择 Cash 账户 + Cash 联动能力，作为学费收入主链路的补充。
- 典型场景：学生月初已经按预定课时生成的学费支付，但月底临时增加课时。
- 操作路径：在预定课时中手动新增预定课时并生成实际课时，月度结算中出现课时费赤字，再手动新增补充收入记录并与 Cash 联动，使月度结算费用持平。
- 该能力预计低频，但需要保留。
- 低频补充收入不替代 tuition bill snapshot 主链路。
- 手动新增补充收入必须经过后端 domain service 校验、Cash 联动和审计记录。

### 3.7 老师工资 / 支出层业务链路

v3 老师工资和工资支出链路可以按以下模型落实。

老师工资主链路：

```text
actual student lessons
-> teacher monthly wage settlement
-> wage snapshot
-> manual adjustment
-> pending expense
-> Cash confirmation
-> account transaction
```

School 侧业务粒度：

```text
teacher_id + year_month + business_entity_id
-> teacher_wage_snapshot
-> expense_record
-> cash_request
```

同一老师同一月份如果存在多个业务归属，School 侧生成多条工资快照和多条支出记录。v3 School 侧不做工资聚合，不建立 `teacher_wage_payments` / `teacher_wage_payment_items` 作为工资支付聚合层。

Cash 侧确认粒度：

```text
teacher_id + year_month + currency
-> Cash 端聚合展示 / 一键确认
-> 逐条回写 School expense_record / cash_request
```

Cash 端可以按老师、月份、币种聚合展示待确认工资请求，并提供一键确认 / 一键拒绝能力；该聚合只属于 Cash 确认体验，不改变 School 侧工资快照和支出记录的业务粒度。

服务职责：

- `LessonService` 提供已确认的实际课时事实。
- `WageService` 根据实际课时生成老师工资月度结算和 wage snapshot。
- `MoneyService` 统一处理工资金额、交通费、教室费、调整金额和取舍规则。
- `ExpenseService` 从已确认的 wage snapshot / manual adjustment 生成 pending expense，并维护支出记录状态。
- `CashService` 负责 Cash request / Cash confirmation / Cash 状态回写。
- `AccountService` 负责 Cash 确认后的账户流水。
- `AuditService` 记录工资快照生成、手动调整、支出生成、Cash 同步、冲销等操作。

关键规则：

- 老师工资来源应保持单一，不从收入、学费应收或其他非工资来源推导。
- 工资基础来自实际课时。
- 生成 wage snapshot 后，系统导出老师工资调整 Excel，供老师核对课时明细并填写交通费、教室费。
- 老师返回文件后，系统导入时只读取交通费、教室费字段。
- Excel 中的课时明细、老师、学生、日期、工资规则、课时事实等字段不应被回写。
- 如果 Excel 文件结构被改乱，系统应拒绝导入。
- 老师专属网页链接填写可以作为未来过渡方案，但不作为 v3.0 主流程。
- 手动调整发生在生成 wage snapshot 之后、生成 pending expense 之前。
- 手动调整对象包括交通费、教室费、结算课时。
- 结算课时调整不是修改学生课时事实，而是决定某节实际课时是否计入老师工资。
- 需要支持“学生课时费正常计算，但该节课不计入老师工资”的场景，例如模拟考试。
- 未来业务流程可能通过把此类课时的任课老师改为管理员本人来减少人工调整，但系统层面仍应保留结算课时是否计入老师工资的调整能力。
- wage snapshot 是工资支出的业务快照，必须保存实际课时依据、工资规则、手动调整项、结算课时计薪口径和后端确认金额。
- pending expense 是进入 Cash 前的工资支出单据状态。
- 生成支出记录后，工资快照与支出记录之间必须有明确映射。
- 工资快照与支出记录的粒度均为 `teacher_id + year_month + business_entity_id`。
- 同一老师同月多个业务归属的工资请求由 Cash 端聚合确认，School 端不提前合并为一条工资支出。
- 勤务表导出可以按 `teacher_id + year_month` 汇总该老师所有业务归属的上课记录生成一份文件，但导出聚合不改变支出记录粒度。
- Cash confirmation 后，支出记录与账户流水进入更强保护状态。
- 页面 / API 不传最终工资或支出金额，只触发生成或提交用户显式调整项；最终金额由后端 domain service / DB 确认。

老师工资状态机：

```text
preview
-> locked teacher_wage_snapshot
-> worklog_exported
-> adjustment_imported
-> adjustment_confirmed
-> expense_created
-> revoked / superseded / voided
```

规则：

- 工资快照未生成时，不允许导出勤务表、不允许导入勤务表、不允许生成支出记录。
- 工资快照生成后，允许导出勤务表、手动调整结算课时；如确认没有交通费 / 教室费，也允许跳过 Excel 导入直接确认调整。
- 勤务表已导出后，才允许导入老师回传文件。
- 勤务表导入后，后端只读取交通费和教室费，写回工资快照调整项，并重新计算工资金额。
- 调整确认前，不允许生成支出记录。
- 调整确认后，允许生成支出记录。
- 支出记录生成后，工资快照进入只读保护，不允许再次导入勤务表覆盖金额，不允许普通编辑调整项。
- 如果支出记录生成后发现错误，应先作废 / 撤销 pending expense，再回到工资快照修正流程；已进入 Cash confirmed 的支出只能按冲销 / 修正规则处理。
- 该流程 guard 必须由 `WageService` / 后端 domain service 执行，前端按钮禁用只作为体验提示。

允许跳过 Excel 的分支：

```text
locked teacher_wage_snapshot
-> adjustment_confirmed
-> expense_created
```

- 工资 preview 不落库。
- 用户确认生成时，写入 locked `teacher_wage_snapshot`。
- `teacher_wage_snapshot` 粒度为 `teacher_id + year_month + business_entity_id`。
- `expense_created` 后，工资快照不能普通 revoke。
- 撤销 / 重锁必须保留历史版本，不覆盖旧快照。

工资调整状态建议使用独立 `adjustment_status`，不塞进主状态：

```text
none
exported
imported
manual_adjusted
confirmed
```

规则：

- Excel 导出 / 导入只服务于交通费、教室费。
- 结算课时调整在系统内手动处理。
- 每次导入或手动调整后，后端必须重新计算并确认工资金额。
- 只有调整确认后，才允许生成 `expense_record`。

工资支出 `expense_record` 使用三类状态：

```text
record_status = pending / voided / superseded / reversed
cash_status = not_required / not_requested / requested / confirmed / rejected / cancelled / failed / needs_manual_review
account_status = not_created / created / reversed
```

下游保护：

- `teacher_wage_snapshot.locked` 后，相关 actual lessons 不能普通编辑影响工资。
- `expense_created` 后，工资快照不能普通撤销。
- `cash_requested` 后，支出记录进入编辑保护。
- `cash_confirmed` 后，支出记录不能普通 void，只能 reverse / correction。
- `account_transaction_created` 后，流水不能删除，只能反向流水。
- Cash 端聚合同一老师同月多条工资支出确认时，School 侧必须逐条保存回写和映射，例如 `cash_group_key`、`cash_request_id`、`cash_transaction_id`、`cash_confirmed_at`、确认金额和币种。

### 3.8 普通支出 / 报销 / 普通收入

普通法人账户支出：

- 场地租金、ChatGPT 等固定费用通常由公司法人账户直接支付。
- 此类支出不需要进入 Cash 联动。
- 建议链路：

```text
manual expense
-> ExpenseService
-> MoneyService
-> AccountService corporate account transaction
```

报销支出：

- 报销模块保留，但预计是低频操作。
- 报销存在的原因是法人账户申请下来之前，场地费、广告费等费用可能由个人或合伙人先垫付，再由法人账户报销。
- 当前大部分费用已由法人账户直接支付，因此报销频率会很低。
- 为应对偶然情况，v3 保留报销链路。

报销建议链路：

```text
手动增加支出
-> 选择垫付账户
-> 生成支出
-> 垫付账户余额变负
-> 报销
-> 法人账户余额减少
-> 垫付账户归零
```

关键规则：

- 报销必须先增加原始支出。
- 原始支出影响利润。
- 报销动作本身是法人账户向垫付账户的资金补偿，不应重复影响利润。
- 低频阶段可由 `ExpenseService` 承接，不急于拆独立 `ReimbursementService`。

普通收入：

- 非学费的普通收入也应通过 `IncomeService` 管理。
- 是否走 Cash 取决于收款账户。
- 如果直接进入公司法人账户，可以不走 Cash 联动，只在 School 内部生成收入记录和账户流水。

### 3.9 Cash / 账户层业务边界

Cash 层本质上承接除公司法人账户以外的收入和支出。

基础口径：

- `income_records` 和 `expense_records` 是 School 侧业务单据，不是 Cash 交易流水。
- Cash 交易和确认事件由 `cash_requests` / `cash_events` 承接。
- 一条 School 业务单据可以进入 Cash 请求；Cash 端可以为了确认效率聚合同一对象的多条请求。
- Cash 端聚合不改变 School 侧 income / expense 的业务单据粒度。
- Cash 确认后必须逐条回写对应 School income / expense 的 Cash 状态和确认结果。

必须走 Cash 层的典型业务：

- 学生学费收入。
- 老师工资支出。
- 外部授课 / 私塾打工收入。

不一定走 Cash 层的业务：

- 直接使用公司法人账户支付的普通收入 / 支出，只需要在 School 系统内部记录账户流水和业务单据，不需要与 Cash 联动。
- 公司法人账户支出频率较低，当前主要包括每月场地租金、ChatGPT 等固定支出。

报销支出链路：

```text
新增支出
-> 选择垫付账户
-> 法人账户向垫付账户报销
-> 账户流水
```

当前判断：

- 报销模块保留。
- 报销使用频率预计较低。
- 报销只在特殊情况下先行垫付后再报销。

人民币学费收款后的购汇 / 法人账户入金：

```text
学费收入
-> Cash 收款确认
-> Cash 人民币余额
-> Cash 侧购汇支出
-> 日元资金进入公司法人账户
-> School 记录账户内部调拨 / 资金归集
```

关键规则：

- 人民币学费通过 Cash 收款确认后，学费收入业务事实已经成立。
- 后续人民币购汇成日元并存入公司法人账户，不是新增收入。
- 该动作更像账户内部调拨 / 资金归集 / FX settlement to corporate account。
- Cash 可以向 School API 发送已确认的资金事件。
- School 后端 API 接收事件后，应生成公司法人账户入金 / 内部调拨 / 资金归集记录。
- Cash 不应直接写 School DB。
- Cash 事件不应被当成“新增学费收入请求”，避免收入重复计算。
- School 侧记录必须关联原 Cash transaction / FX transaction 和相关学费收入来源。

CashService 状态机：

School -> Cash 请求流：

```text
not_requested
-> cash_requested
-> cash_confirmed
-> account_transaction_created
```

异常分支：

```text
cash_rejected
cash_cancelled
cash_failed
needs_manual_review
```

Cash -> School 已确认资金事件流：

```text
cash_event_received
-> cash_event_validated
-> school_record_created
-> account_transaction_created
```

适用场景：

- Cash 侧购汇完成后，向 School 发送法人账户入金 / 内部调拨事件。
- Cash 侧已经确认的其他资金事件，需要 School 生成对应内部记录。

状态规则：

- 收入和支出共用同一套 Cash 状态机，但方向不同：income = in，expense = out。
- `cash_requested` 后，School 侧 income / expense 进入编辑保护。
- `cash_rejected` 后，可以撤销请求并重新生成 Cash request。
- `cash_confirmed` 后，不允许普通撤销，只能走冲销 / 反向记录 / 修正事件。
- `account_transaction_created` 后，账户流水不能删除。
- Cash 回写 School 必须带 `cash_request_id` / `cash_transaction_id` / 幂等 key。
- Cash 确认金额和 School 预期金额不一致时，不应自动落账，应进入 `needs_manual_review`。
- Cash -> School 的 inbound event 必须由 School API 校验来源、幂等、金额、币种、关联业务，再生成 School 侧记录。
- Cash 不直接写 School DB。
- 老师工资等多条 School expense 在 Cash 侧聚合确认时，School 必须保留每条 expense 与 Cash 聚合确认结果的映射，不能只保存聚合后的总额。

建议事件模型：

```text
Cash FX conversion confirmed
-> Cash sends event to School API
-> School validates cash event
-> School creates corporate account transaction / internal transfer record
-> Link back to original Cash transaction(s)
```

建议字段：

- `cash_fx_transaction_id`
- `source_currency = CNY`
- `source_amount_cny`
- `target_currency = JPY`
- `target_amount_jpy`
- `fx_rate`
- `fee_amount`
- `corporate_account_id`
- `linked_tuition_income_ids`
- `confirmed_at`
- `created_by_system = cash`
- `status`

AccountService 边界：

- School 端长期保留的账户只包括：
  - 公司法人账户。
  - 吴垫付账户。
  - 包垫付账户。
- Cash 账户不在 School 端长期显示。
- Cash 账户只在生成 Cash 请求时作为可选项出现。
- `AccountService` 只负责账户和账户流水，不负责解释业务来源。
- 收入、支出、工资、报销、Cash、购汇等业务含义，应由对应 domain service 决定。
- `AccountService` 接收已确认的业务结果并生成账户流水。
- 账户流水应保存来源类型和来源 ID，但前端不应默认暴露内部字段。

### 3.10 外部授课 / 私塾打工状态机

外部授课 / 私塾打工模块保持 v2 当前短链路，不混入学生课时、老师工资或 School 账户流水。

外部授课模块内主链路：

```text
external_work_planned_lesson
-> external_work_actual_lesson
-> wage preview
-> settlement locked
-> Excel export
-> income_record created
```

后续财务链路：

```text
income_record created
-> income record module submits cash request
-> cash rejected / cash confirmed
```

修正链路：

```text
settlement locked
-> revoke
-> relock

income_record created
-> void
-> regenerate income_record

cash rejected
-> regenerate cash request

cash confirmed
-> read-only
```

状态和保护规则：

- `settlement locked` 前，外部授课 planned / actual lesson 允许按权限编辑、删除和重新生成实际课时。
- `settlement locked` 后，不能新增该 `year_month + workplace` 下的预定课时。
- `settlement locked` 后，不能编辑或删除已有 external planned / actual lesson。
- 锁定后仍然可以查看课时详情。
- 生成 `income_record` 后，external planned / actual lesson 仍然只能查看详情。
- `income_record` 未 Cash confirmed 前，可以撤销收入记录并重新生成。
- 收入请求未确认前，允许撤销 settlement lock / 重新 lock。
- Cash 拒绝后，可以重新生成 Cash request。
- 如果要修改课时或结算，必须先撤销未确认的收入请求，再撤销 settlement lock。
- Cash confirmed 后，整条外部授课链路只读。
- Cash confirmed 后，planned / actual / settlement / income_record 都不能普通编辑或撤销。
- 如未来需要修正 Cash confirmed 后的外部授课收入，只能设计冲销 / 反向记录 / correction 流程，不能直接改原记录。

页面边界：

- `打工课时` 页面采用和学生课时管理相似的 planned / actual 左右配对视图。
- 外部授课课时配对比学生课时更宽松，锁定前允许编辑、删除和生成实际课时。
- `打工结算` 页面到生成 `income_record` 为止，不直接提交 Cash。
- Cash 提交、拒绝后重试、确认回写属于 `收入记录` / `支出记录` 财务模块职责。
- `Cash 入站` 只处理 Cash 端主动发起的资金归集 / 法人账户入账事件，不作为收入或支出提交 Cash 的主入口。

账户边界：

- 外部授课收入确认后不生成 School `account_transaction`。
- 外部授课收入不影响 School 法人账户、吴垫付账户、包垫付账户余额。
- 外部授课收入只影响 Cash 端支付宝余额。
- 对应 `income_records` 需要标记：

```text
source_type = external_work / part_time_work
cash_required = true
school_account_effect = none
account_status = not_required
```

### 3.11 数据来源追踪

每条正式业务数据应能追踪来源。

来源类型至少需要考虑：

- 手动新增。
- 计划生成。
- 报价转化。
- 系统生成。

说明：

- v3 原则上减少 Excel 作为正式数据入口。
- 预定课时取消 Excel 批量导入。
- 老师工资快照后的 Excel 导出用于老师填写交通费、教室费，属于工资调整辅助流程，不作为预定课时来源。

来源追踪应服务于：

- 问题排查。
- 重复数据识别。
- 迁移校验。
- 审计记录。
- 未来自动化生成的安全边界。

### 3.12 金额与业务结果权威层

规则标题：

金额与业务结果权威层规则。

优先级：

P0 / 最高级别架构原则。

该规则属于 v3 主链路金额口径和业务事实基础规则，不应推迟到后期功能阶段。

核心原则：

前端不得决定、推导、round 或计算任何会被保存、进入后端写入 API、进入 DB、进入结算锁定、进入 Cash 请求、进入收入 / 支出 / 流水 / 工资 / 结转链路的业务事实。

包括但不限于：

- 金额。
- CNY / JPY 取舍。
- 汇率换算后的金额。
- 学生结算差额。
- 抹平差额金额。
- 本月结转。
- 老师工资。
- 课时费。
- 交通费 / 教室费合计。
- 锁定快照总额。
- Cash request amount。
- 收入 / 支出实际到账或支付的派生值。

这些值必须由后端服务层 / DB / RPC / domain service 统一计算、round、校验并返回。

前端只负责：

1. 展示后端结果。
2. 收集用户显式输入。
3. 展示不落库的 preview。
4. 调用后端 API。

如果 UI 需要“建议值”，例如“抹平差额”“理论到账金额”“自动换算金额”“建议工资金额”，也必须由后端返回，不能由前端自己计算后作为保存值提交。

MoneyService 已确认规则：

- School 端所有 JPY 金额都是整数。
- School 业务金额以 JPY 为基准；CNY 是提交 Cash、通知学生或结转时的表达币种。
- CNY 金额统一保留 2 位小数。
- 不设置 `rounding_unit`，不区分按元取整 / 按分取整；所有 CNY Cash 请求金额都落到 0.01 CNY。
- 汇率可以保留高于 2 位的小数精度，但折算后的 CNY 金额必须落到 2 位。
- 提交 Cash 选择 CNY 时，由后端按 `source_amount_jpy * exchange_rate` 计算 CNY 金额。
- 用户可以使用实时汇率，也可以手动输入汇率。
- 用户不能手动输入最终 CNY 金额。
- `conversion_method` 支持 `round`、`ceil`、`floor`，均作用到 CNY 小数点后 2 位。
- 金额计算必须使用 decimal library / 后端 MoneyService，不得使用 JS `Math.round` / `toFixed` 生成业务金额。
- v2 中个别学生使用固定汇率属于历史特殊数据，v3 不作为默认金额口径继承；迁移时可作为 legacy 信息保留。

建议字段：

```text
source_amount_jpy        // integer
exchange_rate            // live or manual
exchange_rate_source     // live / manual / notice
conversion_method        // round / ceil / floor
calculated_amount_cny    // backend calculated, 2 decimals
requested_amount_cny     // amount sent to Cash, backend confirmed
```

学费混合币种规则：

- 学费准确账单金额不是单一币种，而是 `planned_amount_jpy + carryover_amount_cny`。
- `carryover_amount_cny` 始终保存为 CNY，不反算回 JPY。
- `tuition_bill_snapshot` 保存准确账单构成：`planned_amount_jpy` 和 `carryover_amount_cny`。
- 通知金额是 preview / display value，默认不落库。
- 通知金额由后端计算后展示给前端：

```text
notice_planned_amount_cny = planned_amount_jpy * notice_exchange_rate
notice_amount_cny = notice_planned_amount_cny + carryover_amount_cny
```

- 只有当提交 Cash 并选择使用通知金额时，通知金额才成为正式业务数据。
- 如果提交 Cash 时选择重新按汇率计算，则以提交 Cash 时的实时 / 手动汇率和取舍方式生成 `requested_amount_cny`。
- 提交 Cash 请求的金额才是最终确定的业务金额。
- 预览类金额默认不落库，避免数据库被临时计算结果污染。

v3 需要为金额规则建立统一 domain service / money calculation layer，并写测试覆盖：

- CNY 2 位小数。
- JPY 0 位小数。
- `x.xxx5` 边界值。
- 负数 half rounding。
- 抹平差额。
- 跨币种换算。
- 锁定快照金额。
- 前端提交值与后端计算值不一致时的拒绝策略。

背景：

v2 在学生月度结算差额调整中发现 0.01 CNY 级别问题。

系统差额显示为 CNY 3.63，但“抹平差额”默认调整金额为 -CNY 3.62，导致抹平后仍剩 0.01。

根因是后端返回的原始差额可能是 3.625 这类多位小数，前端显示使用 `Intl.NumberFormat` 显示为 3.63，而输入框默认值用 JS `Math.round(-3.625 * 100) / 100` 得到 -3.62。JS 对负数 `.5` 的 round 行为与金额业务预期不一致。

v2 修复方向：

在 School DB / RPC 层统一将学生月度结算 CNY 输出金额 round 到 2 位。

涉及 summary / preview / draft adjustment：

- `planned_fee_cny`
- `planned_total_cny`
- `actual_fee_cny`
- `received_cny`
- `received_equivalent_cny`
- `final_due_cny`
- `adjustment_amount_cny`
- `locked_carryover_cny`

补充细化规则：

1. 所有业务金额的计算、汇率折算、取舍、抹平、结转，必须在 DB 或后端服务层统一完成。
2. 前端只能显示金额和提交用户输入，不得自行决定业务金额口径。
3. 前端不得用 JS `Math.round` / `toFixed` 等方式生成会进入业务链路的最终金额。
4. JPY、CNY 等不同币种必须有明确小数位规则：
   - JPY：0 位。
   - CNY：2 位。
   - 汇率：另行定义精度，但折算后的业务金额必须落到币种金额精度。
5. 正数、负数、抵消、抹平差额必须使用同一套取舍规则。
6. 结算、收入、支出、工资、Cash、账户流水、结转字段必须吃同一套后端金额口径。
7. v3 数据模型或 API 返回中应区分：
   - 原始计算依据。
   - 后端确认后的业务金额。
8. 业务链路只能使用后端确认后的业务金额。

所有涉及金额的 RPC / API 应有测试覆盖，尤其是：

- `x.xxx5` 半分值。
- 负数半分值。
- 正负抵消后为 0。
- 汇率折算后跨币种取舍。
- 抹平差额后必须为 0.00。

### 3.13 AuditService / 审计层

v3 应建立统一 `AuditService` 和集中审计中心。

审计展示分两层：

- 业务详情页局部审计：显示当前记录相关的生成、修改、锁定、Cash 回写、冲销等历史。
- 集中审计中心：作为系统管理页面，集中查询全部关键操作。

集中审计中心建议支持筛选：

- 操作时间。
- 操作人。
- 模块。
- 动作类型。
- 业务对象类型。
- 业务对象 ID / 编号。
- 学生。
- 老师。
- 月份。
- 金额相关。
- Cash 相关。
- 账户相关。
- 高风险操作。

必须审计的典型操作：

- 课时新增、编辑、取消、补课完成、跨月补课登记。
- 学生月度结算 preview、lock、冲销、重算。
- tuition bill snapshot 生成、pending income 生成、Cash confirmation。
- wage snapshot 生成、手动调整、pending expense 生成。
- Cash request、confirmation、rejected、cancelled、retry。
- 账户流水生成、冲销、内部调拨 / 资金归集。
- 登录、权限变更、关键角色操作。

审计记录建议包含：

- `actor`
- `action`
- `target_type`
- `target_id`
- `before_snapshot`
- `after_snapshot`
- `reason`
- `source`
- `request_id` / `idempotency_key`
- `created_at`

权限原则：

- 普通业务人员不一定能查看集中审计中心。
- 全局管理员可以查看全部审计。
- 财务负责人可以查看资金相关审计。
- 技术字段和内部 request id 可以放在管理员折叠详情中，不应默认污染业务页面。

### 3.14 基础设置原则

基础设置采用同一设置页框架，但不同设置类型不应共用同一个编辑表单。

建议第一层设置类型：

- 业务归属。
- School 长期账户。
- 角色权限。
- 金额规则。
- 科目等基础字典。

设计原则：

- 每类设置使用专用 dialog / drawer 表单，避免把字段不同的对象塞进一个通用设置弹窗。
- 业务归属、账户、角色权限是可维护设置，但必须有权限控制和审计记录。
- 金额规则属于 P0 架构原则，初期应以只读展示为主，不作为普通前端配置随意修改。
- 金额规则的实际执行权威仍在后端 `MoneyService` / domain service，不在前端设置页。

### 3.15 数据迁移

v3 迁移需要先明确：

- v2 哪些数据迁移到 v3。
- 哪些数据只作为历史归档。
- 迁移后如何校验。
- 如何保证结算、收入、Cash 链路一致。

当前确认：

- v3 主业务数据迁移范围确认为 v2 中 2026 年 5 月开始的数据。
- 2026 年 4 月以前旧数据不迁移到 v3 主链路。
- 旧 `school_payment_requests` 不作为 v3 主业务数据迁移。
- 更早历史数据可保留在 v2 只读系统中查询。

说明：

- 2026 年 5 月以后数据进入 v3 迁移演练和校验范围。
- 2026 年 4 月以前数据作为历史归档 / 查询参考，不作为 v3 正式主链路数据。
- 如未来确需迁移 2026 年 4 月以前的个别数据，必须作为例外单独记录迁移原因、范围、校验方式和回滚方式。

### 3.15 UI 工作流

v3 UI 不应简单照搬 v2 页面。

重组原则：

- 按真实运营顺序组织页面。
- 主链路页面优先稳定、清晰、可审计。
- 高频操作应减少跳转和重复录入。
- 资金相关操作必须有清晰二次确认。
- 锁定后的详情查看应保留为只读入口。
- V3 作为正式运营系统，不应在前端默认显示系统内部信息。
- 系统内部信息包括但不限于英文字段名、内部流向说明、账户 ID、source type、linkage ID、RPC / API 名称、调试状态、系统生成标识。
- 这些信息可以进入审计日志、开发调试工具或管理员折叠详情，但不应作为业务页面的默认展示内容。
- V3 不是从 0 验证业务流程，主业务流程已经在 v2 运营中沉淀；前端应展示操作员需要判断和执行的业务信息，而不是暴露底层实现细节。
- V3 单个页面承载的功能应比 v2 更少，按真实运营任务拆分页面。
- 页面职责变窄，业务流转变顺。
- 主页面负责列表、筛选、状态和入口；详情页负责查看和少量安全操作；高风险动作走专门 use case 和二次确认。
- 工作台应聚合“下一步该做什么”，例如待处理课时、待锁定结算、待生成账单、待处理 Cash、待导入工资调整 Excel、异常 / 人工复核事项。
- 前端方案确认后，应给 Figma 一份详细 prompt，让 Figma 生成一份 V3 信息架构和关键页面 demo，用于确认整体操作体验。

## 4. 暂缓进入 v3.0 的扩展业务

以下功能未来可能很重要，但不应挤进 v3.0 主链路重建。

### 4.1 报价单生成

当前定位：

- v2 Beta 中作为独立签约前工具。
- 不写 DB。
- 不进入主链路。
- 未来可能进入正式功能。

归档说明：

- 之前记录过报价周期、周一锚点、跨月归属、按月和课程展示、回数累计、对外字段、内部单价/汇率等细节。
- 这些细节暂时归档为签约前工具规则，不作为 v3.0 主链路设计重点。

### 4.2 合同生成

当前定位：

- v2 Beta 中作为独立签约前工具。
- 不写 DB。
- 不进入主链路。
- 未来可能进入正式功能。

### 4.3 学生跟踪 / 招生 CRM

当前定位：

- 未来可与报价、合同一起形成签约前功能区。
- 不属于 v3.0 主链路。

### 4.4 报价课时进入预定课时

当前不确定方案。

真正需求是减少长期预定课时的手工 Excel 制作和导入。

当前方向：

- v3 取消预定课时 Excel 批量导入。
- 系统应通过长期预定课时生成器、课程计划草稿、报价 / 合同后续转化等能力替代 Excel。

未来更合理的方向可能是：

- 长期预定课时生成器。
- 课程计划草稿 -> 正式预定课时生成。

报价可以作为数据来源之一，但不应直接绕过主链路保护。

任何自动生成正式课时的功能都应后置，并加入：

- 预览。
- 确认。
- 去重。
- 冲突检查。
- 来源追踪。

### 4.5 周课表图片

当前定位：

- v2 Beta 中是运营交付工具。
- 只读正式预定课时。
- v3 需要保留，并后续成为正式功能。
- 暂定支持批量导出图片，由操作员手动发送。
- 未来更适合归入学生 / 课时相关功能区，而不是签约前功能区。

## 5. v3 防膨胀原则

v3 的原则不是一次性做完所有功能，而是分层推进。

建议阶段：

- v3.0：技术底座 + 主链路 + 数据模型 + 数据迁移。
- v3.1：签约前功能，如报价、合同、学生跟踪。
- v3.2：长期课程计划 / 批量生成预定课时。
- v3.3：通知、图片、文件生成、自动化运营工具。

核心原则：

- 先把事实系统做好，再让草稿系统靠近它。
- 正式业务事实、草稿、报价、计划、预测必须分层。
- 自动生成正式数据的功能应最后做。
- 主链路之外的功能默认不得直接写入主链路。

## 6. 已精简或归档的内容

本次整理将旧文档中的以下内容做了压缩：

- 报价模块的细节规则：从主文档中的详细实现讨论压缩为“暂缓进入 v3.0”的归档说明。
- 老师工资支付独立页面判断：保留结论，即 v3 不重做独立支付页面，工资支付归入“老师工资 -> 支出记录 -> Cash 支付确认”主链路。
- 旧 `school_payment_requests`：保留结论，即不作为 v3 主业务数据迁移。
- 技术栈讨论：从零散待讨论项整理为前端、后端、平台、数据库、认证权限五类底座问题。
- 免费额度讨论：保留原则，即付费平台是正常候选，免费额度不作为核心约束。

## 7. 当前待讨论问题

下一阶段建议优先讨论：

1. P0 金额与业务结果权威层如何落到 domain service / money calculation layer。
2. 核心数据模型字段细化、唯一约束、版本规则和 snapshot detail 字段。
3. 厚后端方案下各 domain service 的接口和协作关系如何设计。
4. V2 到 V3 的迁移校验方式和演练流程。
5. V3 测试策略，特别是金额、状态机、迁移校验和 Cash mock。
6. V3 demo 页面清单、菜单结构和 Figma prompt。
