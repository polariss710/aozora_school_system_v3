# Aozora School System v3 项目规则

最后整理日期：2026-07-15

## 1. 项目定位

Aozora School System v3 是面向未来正式运营的重构版本，不是在 v2 上继续补丁式修改。

v2 的定位：

- 稳定运营系统。
- 真实业务数据和流程补充来源。
- 近期继续承担正式运营职责。
- 后续可作为只读历史查询和迁移参考。

v3 的定位：

- 面向正式运营的重构系统。
- 明确采用前后端分离，包含前端、后端和数据库三层。
- 明确采用厚后端 domain service 方案，主业务链、金额层、Cash 层的数据调度和业务编排放入 API / 后端。
- 前端、后端程序、数据库和 Cash 联动重新梳理。
- 保留真实运营需要的功能，删除或降级 legacy 链路。
- 在全面重构前，先沉淀业务边界、架构规则、环境规则和迁移原则。

## 2. 当前阶段工作规则

在 v3 工程初期内，默认规则如下：

1. 已确认的业务规则和技术边界应继续沉淀到 `docs/`，避免散落在聊天记录中。
2. 已进入前端 demo、后端 API、Prisma migration 和 dev DB seed 阶段，但仍以业务边界、数据边界和迁移原则为优先。
3. 每次讨论后的结论应沉淀到 `docs/`。
4. 涉及生产数据、Cash 联动、账户流水、工资、收入、支出的设计必须先写清楚流程和回滚/审计策略。
5. v2 继续作为稳定运营来源，不在 v3 中直接沿用所有历史页面和 legacy 表。
6. v3 中不迁移不再需要的过渡期功能。
7. v3 已初始化为 Git 仓库并推送到 GitHub；后续重要文档、代码、migration 和 seed 变更应单独提交。
8. V2 / V3 学生链路与财务边界的差异，以 `docs/v2-v3-student-finance-alignment.md` 为当前对照清单；未完成真实 Cash 接口合同前，不把 dev API 的 Cash request 当作已完成外部联动。
9. V3 prod 迁移范围与切换顺序以 `docs/v3-prod-migration-boundary.md` 为正式契约。

## 3. 代码修改规则

当前项目处于工程初期。

规则：

- 前端、后端、数据库 schema 和 seed 变更应围绕已确认的 v3.0 主链路和技术底座推进。
- 数据库结构变更优先通过 Prisma schema + Prisma migration 管理，不通过 Supabase Dashboard 手工绕过项目版本控制。
- v3 不创建 Supabase RPC、Edge Function 或其他平台侧业务逻辑，除非后续有明确架构决策。
- 后端 API 应表达业务动作和状态迁移，不把主链路写入降级为前端直接组合 CRUD。
- 前端正式接入前，后端应先整理字段级契约、错误提示口径、权限要求和状态机保护。
- 如果需要修改代码，必须先确认范围、目标、影响面和验证方式。
- 修改前必须先查看当前目录结构和相关文档。
- 修改后必须记录变更摘要和验证结果。

### 3.1 通用筛选交互契约

凡是筛选条件会影响列表、统计卡片、报表、导出或 API 查询的正式运营页面，均适用以下规则；它不仅限于带表格的页面：

- 修改筛选控件只改变待查询条件（draft），不得立刻改变列表、统计卡片、导出结果或发起新的查询。
- 只有用户点击“查询”（或明确命名为“应用筛选”的同等按钮）后，待查询条件才成为已应用条件（applied）；实际过滤和 API 请求只能读取已应用条件。
- “重置”“回到本周 / 本月”等明确操作可以同时重置并应用默认条件；不得把普通 `onChange` 当作查询动作。
- 新增或改造任何筛选页面时，必须复用现有 draft/applied 模式或等效公共实现，并在验证记录中覆盖：改选项后结果不变、点击查询后结果改变、重置操作的行为。
- 不得因页面是工作台、统计、日历、导出或详情聚合页而绕开此契约。

## 4. Git 与版本管理规则

项目目录已初始化为 Git 仓库，并已推送到 GitHub。

后续规则：

1. `.DS_Store`、`node_modules`、`dist`、`.env` 等本地、生成或敏感文件不应纳入版本控制。
2. 每次重要文档整理、代码变更、migration 或 seed 变更应单独提交。
3. 提交信息应说明业务含义，而不只是文件名。
4. 不提交数据库连接串、密码、Supabase key 或其他敏感配置。

## 5. v2 / v3 边界规则

v2 是稳定运营系统和数据补充来源。

v3 不默认完整复制 v2，而是按真实运营需要重建：

- 保留核心业务链路。
- 删除调试型、过渡型、历史兼容型页面。
- 对历史数据提供只读查询或迁移参考，不强行纳入主链路。
- v2 中已经证明必要的确认、审计、资金安全规则，应在 v3 中重新设计成正式能力。

## 6. 数据范围规则

当前确认的 v3 数据范围：

- 不采用全系统统一日期截断；每个业务模块按业务月和审计链定义迁移范围，不用 `created_at` 判断业务范围。
- 普通教学业务以 `2026-07` 为正式运营起点，学生课时、学生月度结算、学费账单、老师工资等事实数据原则上只迁移业务月 / 结算月为 `2026-07` 及以后；该边界用于隔离普通教学业务归属规则收口前的历史多归属事实链。
- 私塾打工 / 外部授课是按工作单位和业务月结算的独立系统，不使用普通教学业务归属；按完整“2026 结算年度”迁移，范围固定为 `2025-12` 至 `2026-11`。
- 普通教学主数据按 `2026-07+` 事实引用闭包迁移；私塾打工只迁移工作单位、导入批次和收入 / Cash 审计链所需引用。
- 私塾打工必须迁移完整课时、结算明细、收入、联动事件和仍被引用的 legacy request 审计链，不能只迁移月度汇总。
- 不得因 `school_personal_cash_income_linkage_events` 的表名而给私塾打工历史记录推断、补造或改写普通教学业务归属。
- V2 已统一的 2026 年 7 月普通教学预定 / 实际课时迁入 V3 后，尚未在 V2 生成的月结、账单、工资、收入、支出和 Cash 链路优先由 V3 原生生成。
- V3 正式切换后停止 V2 对相同业务范围继续写入，不采用长期双写。
- 详细迁移范围、Cash 边界和验收口径以 `docs/v3-prod-migration-boundary.md` 为准。

任何例外迁移都必须提前记录：

- 迁移原因。
- 涉及表和字段。
- 数据时间范围。
- 是否脱敏。
- 是否影响 Cash / account transaction / linkage。
- 验证和回滚方案。

## 7. 环境隔离规则

v3 必须从设计阶段区分环境：

- `prod`：正式生产环境，只保存真实业务数据。
- `staging`：检测 / 验收环境，用于上线前流程验证。
- `dev`：开发环境，允许 reset / migrate / seed / 破坏性测试。

基本规则：

1. 测试数据不得写入 `prod`。
2. `prod` 不承担开发和联动测试职责。
3. `staging` 如导入真实数据副本，必须明确标记并尽可能脱敏。
4. `dev` 应支持一键初始化、一键 seed、一键清空。
5. School 和 Cash 联动必须按环境隔离。
6. 环境变量必须显式包含系统名和环境名，不使用模糊变量名。

推荐变量命名示例：

```text
SCHOOL_PROD_DB_URL
CASH_PROD_DB_URL
SCHOOL_STAGING_DB_URL
CASH_STAGING_DB_URL
SCHOOL_DEV_DB_URL
CASH_DEV_DB_URL
```

## 8. 平台选型原则

v3 不以免费额度为核心约束。

前端、后端、数据库、部署平台都可以接受合理付费。

当前技术栈暂定：

- 前端：React + TypeScript + Vite。
- 后端：NestJS + TypeScript，初期使用默认 Express adapter。
- 数据访问层：Prisma + PostgreSQL，migration 优先采用 Prisma migration。
- 数据库平台：Supabase paid project / PostgreSQL。
- 部署平台：初期优先 Render + Supabase；Cloud Run 作为未来升级候选。
- UI 组件：优先评估 shadcn/ui，备选 Ant Design、Mantine、MUI。
- Python 可作为辅助工具，用于数据迁移、一次性脚本、复杂文件处理等场景，不作为主后端前提。

平台选择的优先级应是：

- 稳定性。
- 可维护性。
- 环境隔离。
- 发布可靠性。
- 数据安全。
- 权限控制。
- 备份恢复。
- 日志监控。
- 运营效率。

免费额度不应排在以上因素之前。

因此，v3 不应为了免费而牺牲正式运营系统的架构质量。

后续评估以下内容时，可以把付费平台作为正常候选：

- 前端部署。
- 后端 API。
- 数据库。
- Cash 联动。
- `dev` / `staging` / `prod` 环境。

当前数据库 / 环境决策：

- v3 数据量预计较小，初期重点是快速搭建、快速迁移 v2 数据、验证主链路，而不是追求最重的数据库托管平台。
- 数据库技术采用标准 PostgreSQL。
- v3 初期数据库平台暂定 Supabase paid project。
- 当前 Supabase organization 可从 Free 升级到 Pro。
- V3 每个环境只使用一个 Supabase project：`v3-dev`、未来的 `v3-staging`、未来的 `v3-prod` 分别共置 School 与对应环境 Cash。
- 2026-07-17 已在 `v3-dev` 安装仅含 `home_*` 的 Cash dev 结构；不复制 Cash production 数据，不包含同一旧 project 内的 `shop_*` 对象。
- 现有 Cash production project 与 School v1/v2 project 在正式切换前保持不变；峰值为 5 个 project，而不是为每个 Cash 环境另建 project。
- Cash 旧模块保留受控 RPC 是明确的兼容边界；School V3 新业务仍由 NestJS domain service 负责，不新增 School 业务 RPC。
- Cash CNY→JPY 汇兑一旦成功回写 School 法人账户，Cash 必须保存唯一同步标记并在数据库层锁定成对 FX 流水；普通编辑、删除或以新身份重建历史链均禁止，只允许基于原幂等身份补偿重试。
- 同一老师、业务月、币种、Cash 账户和付款日期的多条 canonical 工资支出可以在 Cash 聚合付款，但 School 支出粒度不得合并；Cash 必须保留批次头和逐条映射，只生成一条合计流水，并在 School 成功回写后以数据库 guard 锁定该流水。失败恢复只能重放原批次 callback，不得重复付款。
- v3 不继续使用 Supabase RPC 承担复杂业务逻辑。
- v3 的业务权威层是后端 domain service；数据库负责结构、约束、索引、事务一致性和必要防线。

当前部署决策：

- NestJS API 初期优先部署为 Render Web Service。
- React SPA 暂定部署为 Render Static Site；如后续前端方案需要，可评估 Vercel。
- GitHub Pages 不作为 v3 正式运营发布平台。
- Cloud Run 保留为未来更正式的平台升级候选，不作为 v3 初期优先方案。
- `dev` / `staging` / `prod` 的环境变量必须显式隔离。

## 9. 核心业务链路规则

v3 优先围绕以下业务链路设计。

核心数据模型原则：

- snapshot 是 v3 的正式一等实体。
- `tuition_bill_snapshot`、`settlement_snapshot`、`wage_snapshot` 等必须保存生成当时的依据、状态和后端确认金额。
- snapshot 不应依赖后续原始数据变化重新解释历史结果。
- 收入、支出、Cash、账户流水、审计都应关联对应 snapshot 或业务来源。
- 核心业务表主键使用 `uuid`，迁移数据保留 `legacy_table`、`legacy_id`、`legacy_version`、`legacy_snapshot`、`migrated_at`。
- `planned_lessons` 是学生学费和月度应收的唯一课时基础；`actual_lessons` 是老师工资和履约追踪基础，不能反向重算学生学费或月度应收。
- `tuition_bill_snapshots` 和 `student_monthly_settlements` 均按 `student_id + month` 生成，允许逐个学生锁定。
- `teacher_wage_snapshots` 和对应工资支出均按 `teacher_id + year_month + business_entity_id` 生成。
- `income_records` / `expense_records` 是 School 侧业务单据，Cash 交易由 `cash_requests` / `cash_events` 承接。

业务归属收口规则（2026-07-13）：

- V3 新业务统一归属 `aozora_school`（青空进学塾）。运行环境通过 `OPERATIONAL_BUSINESS_ENTITY_CODE` 指定运营归属，默认值为 `aozora_school`。
- `personal`（个人名义）转为历史归属，不再接受新学生、新预定课时、手动收支、外部授课收入或新工资规则。
- `personal` 可继续存在于 schema 和 dev 回归数据中；普通教学 V3 prod 不全量迁入 2026-07 收口前的历史个人名义事实。私塾打工不使用该业务归属维度，不能以私塾打工年度迁移为由带入历史普通教学归属链。
- 后端在新业务未传业务归属时自动补入运营归属；显式传入其他归属时拒绝写入。前端新增表单只读显示当前运营归属。
- 历史记录继续保留原 `business_entity_id`，列表、筛选、详情、审计和既有下游处理不得改写其归属。
- 工资快照与支出仍保留 `teacher_id + year_month + business_entity_id` 粒度，以兼容迁移期和历史双归属数据；新业务正常情况下只会产生青空进学塾归属记录。
- 运营归属不能被归档，其系统编码不能在基础设置中修改。

学生侧课时 / 结算链路：

```text
学生管理
-> 预定课时
-> 实际课时
-> 学生月度结算
-> 结转 / 老师工资依据
```

课时层规则：

- 正式预定课时是学费收入基础。
- 正式预定课时也是学生月度应收基础；应收由原学生、原业务归属和预定时长 / 价格的正式快照决定。
- 实际课时、取消、补课和部分完成均不自动产生学生退款或追加学费；它们只改变履约、待补余额和老师工资的业务事实。
- 实际课时按实际执行的老师、科目、日期、时长进入老师工资结算。
- 签约前报价单属于独立业务，不直接进入主链路。
- 签约后的正式预定课时保留手动单条新增和批量生成预定课时。
- 全新预定课时允许物理删除，但必须由后端 API 判定；前端只能初筛和二次确认，不能绕过后端直接删除表数据。
- 允许物理删除的预定课时必须仍是全新 `scheduled` 状态、未生成实际课时、未进入补课 / 跨月补课派生链路、未被学生月度结算、老师工资、学费账单、收入记录或其他下游 snapshot / detail 引用。
- 一旦预定课时进入任何后续业务链路，应禁止物理删除，只允许走取消、补课登记、结算调整、冲销或其他业务状态修正。
- 删除全新预定课时时必须提交 `confirmDelete = true` 和 `expectedUpdatedAt`，由后端做并发保护和最终 guard。
- v3 取消预定课时 Excel 批量导入。
- v3 应尽可能降低 Excel 出现频率；工资交通费 / 教室费 Excel 导出 / 导入保留为 v3.0 主流程。
- 工资调整 Excel 是老师填写费用的受控输入文件，不是业务事实来源；系统只读取交通费、教室费，不从 Excel 回写课时明细、老师、学生、日期、工资规则等事实字段。
- 同一老师同一月份即使存在多个业务归属，也只导出一份勤务表 Excel；文件内课时记录按业务归属、日期、学生排序。导入时按隐藏的快照和明细映射，将交通费、教室费分别汇总回各业务归属工资快照，不改变工资快照与支出粒度。
- 学生月度结算锁定后，应支持导出 PDF。
- 周课表是正式预定课时的只读排课视图和图片导出来源，不是独立数据来源；课程应能从周课表直达正式预定课时的日期和时间编辑。
- 周课表图片功能需要保留，后续成为正式功能；暂定批量导出图片后由操作员手动发送。

月度结算课时状态规则：

- 当月预定课时全部处理完毕后，才可进入学生月度结算。
- 正常上课、取消、同月 / 跨月补课、部分完成的未履约时长均不改变原预定课时已形成的学生应收；取消课不得自动减少学生本月学费。
- 取消课和部分完成的剩余时长都形成“已收未履约”的待补课余额，余额可跨月保留。
- 后续补课完成不追加学生学费；只按补课实际执行的老师、科目、日期、时长进入补课月份老师工资。
- 学生月度结算的应收与结转必须基于正式预定课时和既有财务口径，不能用 actual date、当前老师、当前科目或补课完成月重新解释。

待补课余额与统计口径（2026-07-21 已确认，后续 V3 数据模型与页面必须遵守）：

- 待补余额是“已收未履约”的时长余额，不是退款、减免、当周待办或老师工作量。
- 余额来源为取消的正式预定课时，或部分完成后尚未履约的剩余时长；每笔来源必须冻结并保留原 `student_id`、原 `business_entity_id`、来源预定课时、来源时长和发生时间。
- V3 必须以可审计的来源 / 核销模型表达待补：来源余额可被一条或多条补课实际课时部分或全部核销，不能只用备注、当前 actual 或布尔状态推断。
- 补课 actual 可以更换老师、科目、日期、内容和时长；这些实际执行字段决定老师工资，不改变待补余额的原学生与原业务归属，也不改变原学生学费。
- 待补余额只按学生累计，并可按学生、原业务归属收窄。不得按当前月、当前周、补课老师或补课科目重定义、归零或重分组该余额。
- 教学运营首页必须提供周维度待处理指标：本周预定、已登记、待登记、取消、待补来源数、待补余额小时。其中前四项按正式预定课时的排课周统计；待补来源数与待补余额小时展示截至查询时点的累计余额，只允许学生 / 原业务归属范围收窄。
- 统计、导出和 API 必须分别暴露“预定应收课时”“实际履约时长”“待补来源时长”“已核销待补时长”“待补余额时长”，禁止用单一 completed / cancelled 数量混合代替。

学生学费收入链路：

```text
正式预定课时
        \
         -> tuition bill snapshot
        /
上月 locked carryover
-> pending income
-> Cash confirmation
-> 账户流水
```

规则：学生月度结算不负责直接生成学生学费收入记录；v3 学费收入应通过统一的 tuition bill snapshot 产生，该入口同时读取正式预定课时和上月 locked carryover。页面 / API 不传应收金额，前端只触发生成；金额权威必须在后端 domain service / DB。

收入层落地口径：

- tuition bill snapshot 是学生学费收入的业务快照。
- 同一学生同一业务月份可以保留多个账单历史版本，但只能有一个当前有效的 `generated` / `income_created` 版本；版本通过 `version` 和 `replaces_id` 关联。
- 账单基础课时或 locked carryover 发生变化时，旧账单标记为 `superseded` 或 `voided`，重新生成新账单；不能原地覆盖已产生的业务快照。
- 学费收入作废时，原收入和原账单保留关联及审计信息；新账单/新收入必须绑定新版本。
- pending income 是进入 Cash 前的收入单据状态。
- Cash confirmation 后进入账户流水，并触发更强编辑保护。
- 主学费应收不能由前端手工决定金额。
- 用户不能手动输入最终 CNY 到账金额；提交 Cash 时只能使用实时汇率、手动输入汇率，或选择使用通知金额，最终金额由后端按 tuition bill snapshot、汇率、币种、结转规则计算 / 确认。
- 保留低频补充学费收入能力：手动新增收入、选择 Cash 账户、Cash 联动，用于月底临时加课导致月度结算课时费赤字的场景；该能力不替代 tuition bill snapshot 主链路，必须经过后端校验和审计。

学费收据 / 領収書口径：

- 收据是 Cash 已确认收入的派生凭证，不是独立手填业务单据。
- 第一阶段一张收据只绑定一条已 Cash 确认收入记录；后续可扩展为一张收据绑定多笔收款。
- 收据入口必须来自收入记录列表或收入详情，不能提供自由填写金额的独立入口。
- 未 Cash 确认、已作废 / 已冲销、无学生归属、非学费类收入，默认不允许生成学费收据。
- 收据金额必须来自后端确认的实际收款金额，例如 confirmed amount / actual received amount，不允许前端根据 JPY、汇率、结转金额重新计算。
- 前端只允许传 `income_record_id` 以及语言、打印格式、备注文本等展示选项；前端不得传最终收据金额作为业务事实。
- 收据日期默认使用 Cash 确认收款日期，不使用 PDF 生成日期作为收款事实。
- 收据项目默认来自收入分类，例如“学费”；收据对象默认来自收入记录绑定的学生。
- 收据描述可包含业务归属月，例如“2026年7月 学费”。
- 后端必须校验 income record 存在、状态允许、未作废、来源 / 分类允许开具收据、学生归属存在、确认金额存在、当前用户有权限查看 / 生成该收入的收据。
- 阶段 1 可重复生成 PDF，但内容必须始终来自同一条已确认收入记录；阶段 2 如引入 `receipt_records`，生成后内容以 snapshot 为准，避免学生名称或收入备注变化影响旧收据。
- 未来如果支持部分付款，收据应基于实际 Cash 收款金额开具，不基于账单应收金额开具；账单应收与实际收款必须通过核销 / 分配关系连接。

V2 实际落地补充：

- V2 最终采用轻量主链路入口方案，不做完整 receipt records 台账。
- V2 已移除 Beta 侧边栏中的自由“領収書生成”入口；收据页面仍保留，但不能作为手动入口直接使用。
- V2 只能从收入记录一览或收入详情进入收据页面，跳转参数为 `income_record_id`。
- V2 收据页只读取该 `income_record_id` 对应的已确认收入和 Cash linkage；金额使用 Cash 确认后的实际到账金额和币种。
- V2 前端不允许手动输入或修改收据金额。
- V2 不创建 `receipt_records` 表，不保存收据编号，不记录开具历史，不做作废 / 重开。
- V2 显示“生成收据”按钮的条件：`income.status = received`、`income.income_category = tuition` 或 `source_type = student_tuition_bill`、存在 `student_id`、存在最新 Cash income linkage event、`sync_status = synced`、`payment_amount > 0`、`payment_currency` 存在。
- V3 可以继承 V2 的核心限制：收据只能从已 Cash 确认收入生成，不能自由手填金额；但不能把 V2 的无落库收据视图当成最终模型。
- V3 正式管理收据时，应新增 `receipt_records` / `receipt_issues` 等表，保存生成时快照：`student_name`、`amount`、`currency`、`item_name`、`issued_at`、source income ids、cash transaction ids、`receipt_no`、voided / reissued 状态等。

老师侧：

```text
老师管理
-> 实际课时
-> 老师工资快照 teacher + month + business entity
-> 手动调整
-> expense record teacher + month + business entity
-> Cash confirmation
-> 账户流水
```

规则：老师工资来源应保持单一，基础来自实际课时。手动调整发生在 wage snapshot 之后、pending expense 之前，调整对象包括交通费、教室费、结算课时；结算课时调整用于决定某节实际课时是否计入老师工资，不修改学生课时事实。工资快照与支出记录粒度均为 `teacher_id + year_month + business_entity_id`。同一老师同月多个业务归属会在 School 侧生成多条工资快照和多条支出记录；v3 School 侧不做工资聚合，不建立 `teacher_wage_payments` / `teacher_wage_payment_items`。Cash 端负责按老师 / 月份 / 币种聚合确认，并逐条回写 School 对应支出记录。Cash confirmation 后进入账户流水并触发更强编辑保护。

V2 v10.3.67 补充的老师工资生成粒度：工资快照业务唯一粒度应视为 `teacher_id + business_entity_id + settlement_month`，不能把“老师已存在某月工资”作为 `teacher + month` 全局 blocker。生成工资时应支持可选 `business_entity_id` scope；传入 `business_entity_id` 时，候选 actual / makeup_completed 课时、既有工资快照 blocker、既有工资明细 blocker、学生月度结算 locked 校验、工资规则匹配、汇总插入、明细插入都必须限定在该业务归属。未传 `business_entity_id` 时，保持批量行为，同一老师同月可按不同业务归属生成多个 wage snapshot。支付 / 支出 / Cash 链路仍发生在工资快照之后，工资生成动作本身不创建支出、Cash request 或账户流水。

V2 v10.3.66 补充的 teacher_wage rejected Cash 回退口径：当老师工资支出已经提交 Cash，但 Cash 侧 reject 且没有生成 Cash transaction 时，School 端允许将该 teacher_wage expense 标记为 cancelled / voided，并保留 rejected Cash request metadata 作为审计。该历史支出不再作为 active canonical teacher_wage expense 阻塞工资快照撤销或重新生成。Cash approved / synced / paid、Cash pending，或已经存在 `cash_transaction_id` 的工资支出，不能直接作废，必须走冲销 / 修正规则。

财务侧：

```text
收入记录
支出记录
报销管理
利润分析
```

普通支出 / 报销 / 普通收入：

- 场地租金、ChatGPT 等固定费用通常由公司法人账户直接支付，不需要进入 Cash 联动。
- 普通法人账户支出建议走 `ExpenseService -> MoneyService -> AccountService`。
- 报销模块保留但预计低频；链路为手动增加支出、选择垫付账户、生成支出、垫付账户余额变负、报销、法人账户余额减少、垫付账户归零。
- 报销必须先增加原始支出，原始支出影响利润；报销动作本身是资金补偿，不重复影响利润。
- 普通收入通过 `IncomeService` 管理，是否走 Cash 取决于收款账户。

Cash / 账户层边界：

- Cash 层承接除公司法人账户以外的收入和支出。
- `income_records` 和 `expense_records` 是 School 侧业务单据，不是 Cash 交易流水。
- 学生学费收入、外部授课收入、老师工资支出必须走 Cash 层。
- School 端长期保留账户只包括公司法人账户、吴垫付账户、包垫付账户。
- Cash 账户不在 School 端长期显示，只在生成 Cash 请求时作为可选项出现。
- AccountService 只负责账户和账户流水，不解释业务来源。
- 直接使用公司法人账户支付的普通收入 / 支出，只需要在 School 系统内部记录，不一定与 Cash 联动。
- Cash 端可以聚合同一对象的多条 School 请求提升确认效率，但聚合不改变 School 侧 income / expense 的业务单据粒度。
- 报销链路是新增支出、选择垫付账户、再由法人账户向垫付账户报销；模块保留，但预计使用频率较低。
- 人民币学费经 Cash 收款后，如购汇成日元并进入公司法人账户，应记录为账户内部调拨 / 资金归集，不是新增收入。
- Cash 可以向 School API 发送已确认资金事件；School API 负责校验并生成法人账户入金 / 内部调拨记录。Cash 不直接写 School DB。
- CashService 需要同时支持 School -> Cash 请求流和 Cash -> School 已确认资金事件流。
- School -> Cash 状态包括 `not_requested`、`cash_requested`、`cash_confirmed`、`account_transaction_created`，异常状态包括 `cash_rejected`、`cash_cancelled`、`cash_failed`、`needs_manual_review`。
- Cash -> School inbound event 必须由 School API 校验来源、幂等、金额、币种、关联业务后，才能生成 School 侧记录。
- Cash 确认金额和 School 预期金额不一致时，不应自动落账，应进入人工复核。

前端展示原则：

- V3 正式运营页面不得默认显示系统内部信息，例如英文字段名、内部流向说明、账户 ID、source type、linkage ID、RPC / API 名称、调试状态。
- 系统内部信息应进入审计日志、开发调试工具或管理员折叠详情，不应污染日常业务页面。
- V3 页面职责应比 v2 更窄，按真实运营任务拆分页面；目标是页面职责变窄、业务流转变顺。
- 前端方案确认后，需要准备详细 Figma prompt，让 Figma 生成 V3 大致 demo 供确认。

外部授课：

```text
external work planned lesson
-> external work actual lesson
-> monthly settlement by year_month + workplace
-> lock settlement with detail snapshot
-> income_record source_type = external_work / part_time_work
-> Cash confirmation
```

规则：外部授课 / 私塾打工是独立外部机构授课收入链路，不是学生课时，也不是老师工资。它不连接 students，不连接普通 planned / actual lessons，不进入 teacher wage，不写 expense。锁定后导出和收入生成读取 settlement detail snapshot，不重新解释可变 lesson。收入侧统一通过 canonical `income_records` 进入 Cash。

状态机确认：

- preview 原则上不落库，用户确认生成 / 锁定时才写入正式 snapshot。
- `tuition_bill_snapshots` 生成即 locked，随后可生成 `income_record`。
- `student_monthly_settlements` 锁定即 locked，只有 locked settlement 的 carryover 可进入下月 tuition bill。
- 学生账单、学生结算、工资快照的撤销 / 重锁必须保留历史版本，不覆盖旧记录。
- `planned_lessons.status` 使用 `scheduled`、`cancelled`、`voided`、`superseded`。
- `actual_lessons` 使用 `attendance_status`、`makeup_scope`、`student_fee_effect`、`teacher_wage_effect` 拆分业务含义。
- 跨月补课中，学生费用归属原预定课时月份，老师工资归属补课完成月份。
- 补课完成课使用 `student_fee_effect = no_extra_charge`、`teacher_wage_effect = count`。
- 老师工资 preview 不落库，lock 时生成 `teacher_wage_snapshot`。
- 老师工资调整通过 `adjustment_status` 和 adjustment records 管理，Excel 只读取交通费、教室费。
- `income_records` / `expense_records` 使用 `record_status`、`cash_status`、`account_status` 拆分业务单据、Cash 和账户状态。
- 外部授课 income Cash confirmed 后整条链路只读；确认前可撤销 income、撤销 settlement lock 并重新生成。
- 外部授课收入确认后不生成 School `account_transaction`，不影响 School 端账户余额，只影响 Cash 端支付宝余额。

## 10. 降级或不保留模块

暂定 v3 不再作为独立主模块重做：

- 老师工资支付。
- legacy payment request 管理。
- 2026 年 6 月及以前旧审计页面。
- v2 中仅为过渡期存在的调试型页面。

可降级为系统管理或只读审计入口：

- Cash linkage 调试信息。
- 旧账户流水引用。
- 历史兼容字段。

## 11. 资金操作安全规则

凡涉及以下对象的写入、确认、撤销或联动请求，都必须视为高风险操作：

- 收入。
- 支出。
- 老师工资。
- 报销。
- Cash 请求。
- 账户流水。
- 月度结算。

前端必须提供二次确认，确认内容至少包含：

- 金额。
- 对象。
- 月份或日期。
- 业务归属。
- 操作后果。

后台必须负责：

- 业务规则判断。
- 权限控制。
- 数据写入。
- Cash 请求。
- 审计日志。
- 错误处理。
- 幂等与重复提交防护。
- API 应按业务动作 / use case 设计，前端调用业务动作，不直接操作业务表或拼接 CRUD 流程。

撤销 / 作废 / 重算规则：

- 已锁定、已生成下游记录、已提交 Cash、已生成账户流水的业务事实，不允许通过普通编辑直接改写。
- 撤销、作废、重算必须走专门动作，并包含权限控制、二次确认、原因记录、审计记录。
- 已进入资金链路后的错误修正，应优先通过作废、冲销、反向流水、重新生成等方式处理。
- 学生月度结算支持锁定、撤销、重新锁定。
- 老师工资结算支持 wage snapshot 生成、撤销、重新生成。
- 工资快照生成支出记录后，撤销必须处理 wage snapshot 与 pending expense 的映射。
- 工资快照撤销必须检查 active canonical teacher_wage expense；存在 active expense 时拒绝撤销。`cancelled` / `voided` 历史工资支出不阻塞撤销或重新生成。
- teacher_wage expense 如处于 Cash rejected 且无 transaction 状态，可作废 School 侧支出并保留 rejected request metadata；Cash pending、Cash approved / synced / paid 或已有 `cash_transaction_id` 时不能直接作废。
- 收入 / 支出生成后，应支持作废和重新生成。
- Cash 请求被拒绝后，应支持撤销和重新生成。
- Cash confirmed 或 account transaction created 后，不应简单删除或原地修改，应通过反向记录或修正记录处理。

认证、权限、审计规则：

- v3 必须补齐登录、角色和权限控制。
- 初版角色包括全局管理员、财务负责人、普通业务人员，并预留销售 / 签约前角色。
- 普通业务人员负责学生管理、课时管理等日常业务操作。
- 财务负责人负责资金流相关操作，到提交 Cash 确认为止。
- 全局管理员拥有全部业务和系统管理权限。
- 当前明确由系统管理员处理 Cash 发起、Cash 确认、业务归属设置、账户设置、利润分析读取。
- 老师管理、科目管理等基础资料维护权限暂不定死。
- 销售 / 签约前角色未来可负责报价单生成、合同生成。
- v3 应提供集中审计中心，同时在业务详情页保留局部审计记录。
- 集中审计中心用于按操作人、时间、模块、业务对象、金额、Cash、账户、高风险操作等条件查询。
- 审计信息默认不污染日常业务页面，内部字段应放在管理员折叠详情或系统管理入口。

P0 金额与业务结果权威层规则：

- 前端不得决定、推导、round 或计算任何会被保存、进入后端写入 API、进入 DB、进入结算锁定、进入 Cash 请求、进入收入 / 支出 / 流水 / 工资 / 结转链路的业务事实。
- 金额、币种取舍、汇率换算后金额、学生结算差额、抹平差额、本月结转、老师工资、课时费、交通费 / 教室费合计、锁定快照总额、Cash request amount、收入 / 支出实际到账或支付的派生值，都必须由后端服务层 / DB / RPC / domain service 统一计算、round、校验并返回。
- 前端只能展示后端结果、收集用户显式输入、展示不落库 preview、调用后端 API。
- UI 需要的“建议值”，例如抹平差额、理论到账金额、自动换算金额、建议工资金额，也必须由后端返回，不能由前端自己计算后作为保存值提交。
- School 端所有 JPY 金额都是整数；CNY 金额统一保留 2 位小数。
- 提交 Cash 选择 CNY 时，后端按 `source_amount_jpy * exchange_rate` 计算 CNY 金额。
- 用户可以使用实时汇率或手动输入汇率，但不能手动输入最终 CNY 金额。
- `conversion_method = round / ceil / floor`，均作用到 CNY 小数点后 2 位。
- 不设置按元 / 按分的取整单位，所有 CNY Cash 请求金额都落到 0.01 CNY。
- 学费准确账单金额是 `planned_amount_jpy + carryover_amount_cny` 的混合币种结构；CNY 结转不反算回 JPY。
- 通知金额属于 preview / display value，默认不落库；只有提交 Cash 并选择使用通知金额时，才成为正式业务数据。
- 提交 Cash 请求的金额才是最终确定的业务金额。
- V2 `v10.3.52` / commit `5a9c6a1` 的 `billing_amount_cny` 落库和 Cash 提交 `actualReceivedAmount` 是 v2 稳定运营实现 / 历史兼容，v3 只继承业务口径，不继承默认落库方式。
- V2 早期缺少通知金额字段的数据迁移到 v3 时应标记 legacy，不用当前汇率回填历史通知金额。
- v3 必须建立统一 domain service / money calculation layer，并覆盖 CNY 2 位、JPY 0 位、`x.xxx5`、负数 half rounding、抹平差额、跨币种换算、锁定快照金额、前端提交值与后端计算值不一致时的拒绝策略。

## 12. 文档规则

`docs/` 是 v3 准备期的主要工作区。

建议文档分工：

- `aozora-school-v3-development-plan.md`：整体开发准备和方向。
- `environment-strategy.md`：环境隔离和测试数据原则。
- `project-rules.md`：项目规则和边界约定。
- `initial-state.md`：项目初始状态盘点。

文档整理原则：

- 能整合进现有主文档的内容，不随意新开文件。
- 业务讨论和模块规则优先整理进 `aozora-school-v3-development-plan.md`。
- 环境、测试数据、生产安全相关内容优先整理进 `environment-strategy.md`。
- 项目级约定、工作方式、边界规则优先整理进 `project-rules.md`。
- 只有当内容已经形成独立长期主题，且放入主文档会明显影响阅读时，才新增独立文档。

新增文档时应优先说明：

- 背景。
- 当前结论。
- 暂定规则。
- 待决问题。
- 后续动作。

## 13. 待决事项

以下事项暂不急于定案：

- 各 domain service 的接口和协作关系。
- 最终 UI 组件库。
- staging / prod 共置 project 内 Cash ledger 的迁移、对账、密钥轮换和单点切换执行方案。
- 权限模型。
- 审计日志模型。
- 备份和恢复策略。
- v2 到 v3 的数据迁移工具。
