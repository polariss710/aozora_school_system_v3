# Aozora School System v3 初始状态

记录日期：2026-06-25

最近整理日期：2026-07-15

## 1. 项目路径

```text
/Users/polariss710/Documents/aozora_school_system_v3
```

## 2. Git 状态

当前目录已初始化为 Git 仓库，并已推送到 GitHub：

```text
https://github.com/polariss710/aozora_school_system_v3
```

主分支：

```text
main
```

初始提交：

```text
fddb61f Initialize v3 demo framework and planning docs
```

前端 demo preview 环境：

```text
https://aozora-school-system-v3-demo.onrender.com/
```

## 3. 当前目录结构

当前项目已经从文档目录升级为 v3 monorepo 初始工程：

```text
.
├── apps
│   ├── api
│   └── web
├── docs
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

说明：

- `apps/web` 是 React + TypeScript + Vite 前端 demo。
- `apps/api` 是 NestJS + TypeScript 后端 skeleton。
- `.gitignore` 已排除 `.DS_Store`、`node_modules`、`dist`、`.env` 等本地或敏感文件。

## 4. 已有文档

### `docs/aozora-school-v3-development-plan.md`

内容定位：

- 作为 v3 立项阶段主讨论框架。
- 明确 v2 继续稳定运营并沉淀 v3 需求证据。
- 将 v3 讨论拆成技术底座和 v3.0 主链路两层。
- 记录当前技术栈暂定结论：React + TypeScript + Vite、NestJS + TypeScript、Prisma + PostgreSQL、Render + Supabase。
- 记录暂缓进入 v3.0 的扩展业务。
- 明确 v3 防膨胀原则和当前待讨论问题。

### `docs/environment-strategy.md`

内容定位：

- 总结 v2 中真实数据、测试数据和 Cash 联动测试混用的问题。
- 明确 v3 需要从设计阶段区分 `prod` / `staging` / `dev`。
- 规定生产环境只保存真实业务数据。
- 建议使用显式环境变量命名。
- 记录当前环境策略：Supabase organization 升级到 Pro，开发阶段新增一个 `v3 dev` project，测试 / 上线准备阶段再拆分 `v3 staging` 和 `v3 prod`。
- 记录 v3 不继续使用 Supabase RPC 承担复杂业务逻辑，业务权威层转移到后端 domain service。
- 明确测试数据、删除清理和生产修复原则。

### `docs/project-rules.md`

内容定位：

- 固化 v3 当前阶段项目规则。
- 明确 v2 / v3 边界。
- 记录数据范围、环境隔离、资金操作安全、文档工作方式和待决事项。

### `docs/initial-state.md`

内容定位：

- 记录当前项目路径、Git 状态、目录结构和初始文档状态。
- 作为 v3 初始化阶段的基线说明。

### `docs/v3-prod-migration-boundary.md`

内容定位：

- 作为 V2 → V3 prod 模块化迁移范围、引用闭包、历史身份、Cash 边界、验收和切换方式的正式契约。
- 明确普通教学因业务归属规则收口而采用 `2026-07+`，私塾打工作为无普通教学业务归属维度的独立系统迁移完整 2026 结算年度。

### `docs/current-status.md`

内容定位：

- 记录当前开发和 prod 数据移行状态。
- 明确区分已经确定的迁移政策和尚未执行的未来实施阶段。

## 5. v3 当前定位摘要

v3 已进入后端 API 第一轮主链路闭合阶段：前端 demo 主框架已确认并部署，后端已从 skeleton 推进到主业务 API 雏形，dev 数据库已接入并完成基础 schema / seed。

当前原则：

- v2 继续作为稳定运营和数据补充来源。
- v2 运营期预计继续覆盖 2-3 个月真实业务，用于沉淀 v3 需求证据。
- v3 已完成立项讨论、技术底座讨论、主链路边界整理和前端 demo 主框架确认。
- 前端 demo 已部署到 Render preview 环境，用于 UI / 页面结构 / 流程确认。
- 后端已建立 NestJS + Prisma API 工程，并已接入 Supabase v3 dev PostgreSQL。
- Prisma 已建立第一版 foundation schema 和 migration。
- dev DB 已执行基础 seed，包含角色、权限、业务归属和 School 侧账户；新业务运营归属统一为青空进学塾，个人名义仅保留历史数据。
- dev API 已补充 Render Web Service 蓝图 `render.yaml`，默认服务名为 `aozora-school-system-v3-api-dev`，并通过 `CORS_ORIGIN` 允许前端 demo 域名和本地 Vite 联调访问。
- 2026-07-07 已确认 dev API Web Service 部署成功，`https://aozora-school-system-v3-api-dev.onrender.com/api/health` 与 DB health 可用于前端联调。
- 前端 demo 已开始接真实 dev API：登录页会检查 API health，优先调用 `/api/auth/login`；登录成功后学生管理页和老师管理页可用 token 拉取真实列表，并可调用新增、基础信息编辑、归档和恢复动作；基础设置页可按类型标签页只读拉取业务归属、School 账户、科目和外部授课机构；收入和支出页可拉取真实列表、新增 / 作废手动记录并提交 Cash 请求；Cash 请求页可拉取真实请求队列，并允许 School 端撤回待确认请求；Cash 入站页可拉取真实列表并冲销已入账事件，入站请求由 Cash 端发起；账户流水页可只读拉取真实列表；报销管理页可拉取真实列表、读取可报销支出候选、从垫付支出生成报销并作废已完成报销。API 不可达时保留 demo fallback。
- 后端 Controller 路由数为 `154`，已覆盖认证、用户、权限、主数据、学生课时、学生月度结算、学费账单、学费收据快照、老师工资、勤务表导入、收入、支出、Cash 请求、Cash 入站、账户流水、报销、外部授课、审计、健康检查和版本信息。
- 已在 `apps/api/README.md` 建立第一版 API 契约索引，记录模块 endpoint、金额权威原则、状态机写入原则、Cash 入站联动和全新预定课时删除保护。
- 当前 API 仍以 dev 联调为目标，前端正式接入前还需要继续整理字段级 request / response、错误提示口径和列表 / 详情 / 抽屉展示字段。
- v3 初期数据库平台暂定 Supabase paid project；当前重点是快速搭建、快速迁移 v2 数据和验证主链路，而不是一开始采用更重的数据库托管平台。
- v3 技术线暂定为轻量化现代 JS / TS 路线：前端 React + Vite，后端 NestJS，数据访问层 Prisma，部署优先 Render。
- 任何涉及生产数据、Cash 联动、收入、支出、工资、账户流水的设计，都必须先明确环境、权限、审计和验证方式。
- v3.0 当前定位为技术底座 + 主链路 + 数据模型 + 数据迁移，不一次性包含报价、合同、CRM、通知、图片、文件生成等扩展业务。

## 6. 当前未做事项

当前仍未执行以下动作：

- 未全面连接真实后端 API 到前端；当前完成 health / auth / students / teachers / settings 第一轮接入，完成 income / expenses 列表、手动新增、手动作废和 Cash 请求提交接入，完成 cash requests 队列和 School 端撤回接入，完成 cash inbound events 列表和冲销入站动作接入，完成 account transactions 只读列表接入，并完成 reimbursements 列表、候选支出、新增和作废接入。
- 未导入或迁移 v2 数据。
- 未读取或修改 v2 项目。
- 未执行任何生产数据操作。
- 未建立 staging / prod Supabase project。
- 未建立正式迁移脚本和迁移校验报告。
- 已确认 V3 prod 采用模块化迁移范围：普通教学因业务归属规则收口而原则上承接 `2026-07+`；私塾打工不使用普通教学业务归属，承接完整 2026 结算年度 `2025-12` 至 `2026-11`；正式边界记录在 `docs/v3-prod-migration-boundary.md`，执行状态记录在 `docs/current-status.md`。

已完成：

- Git 初始化和 GitHub 推送。
- Render 前端 demo preview 部署。
- Render dev API Web Service 部署并验证健康检查。
- `apps/web` 前端 demo 主框架。
- `apps/api` NestJS 后端 API 工程。
- `GET /api/health` 和 `GET /api/version`。
- Render dev API 蓝图和部署说明：
  - `render.yaml`
  - `apps/api/README.md`
  - `CORS_ORIGIN` 环境变量支持。
- 前端 demo 第一轮真实 API 接入：
  - `apps/web/src/app/api.ts`
  - API health / DB health / version 探针。
  - 登录页调用 `/api/auth/login`，API 不可达时进入 demo fallback。
  - 学生管理页登录真实 API 后调用 `/api/students`。
  - 学生管理页已接 `POST /api/students`、`PATCH /api/students/:id`、`POST /api/students/:id/archive`、`POST /api/students/:id/restore`。
  - 老师管理页登录真实 API 后调用 `/api/teachers`。
  - 老师管理页已接 `POST /api/teachers`、`PATCH /api/teachers/:id`、`POST /api/teachers/:id/archive`、`POST /api/teachers/:id/restore`。
  - 基础设置页已接 `/api/settings/business-entities`、`/api/settings/accounts`、`/api/settings/subjects`、`/api/settings/external-workplaces`，并按类型标签页展示只读列表。
  - 收入记录、支出记录页已接 `/api/income`、`/api/expenses` 列表，`/api/income/manual`、`/api/expenses/manual` 手动新增，`/api/income/:id/void`、`/api/expenses/:id/void` 手动作废，以及 `/api/cash/requests/income/:incomeRecordId`、`/api/cash/requests/expense/:expenseRecordId` 提交 Cash 请求；Cash 请求页已接 `/api/cash/requests` 队列和 `/api/cash/requests/:id/withdraw` 撤回动作；Cash 入站页已接 `/api/cash-inbound/events` 列表和 `/api/cash-inbound/events/:id/reject` 冲销入站动作，School 前端不发起 Cash 入站请求；账户流水页已接 `/api/accounts/transactions` 只读列表。
- `MoneyService` 初版金额取舍测试骨架。
- Supabase `aozora-school-v3-dev` project。
- Prisma foundation migration。
- 第一轮主业务 API：
  - 认证、用户、角色详情和权限。
  - 业务归属、学生、科目、老师、外部授课机构、账户、金额规则等主数据 / 基础设置。
  - 学生预定课时 / 实际课时，包括前端手动单条新增、批量生成、全新预定课时删除、取消、恢复、补课、跨月补课和学生结算锁定保护。
  - 学生月度结算，包括预览、锁定、撤销和导出 payload。
  - 学费账单，包括生成前权威预览、预定课时 / 上月结转来源明细、版本判断、生成、生成收入、导出 payload 和作废。
  - 老师工资，包括工资规则、预览、锁定、调整、勤务表导出、交通费 / 教室费导入、确认调整和撤销。
  - 收入、支出、Cash 请求、Cash 回写和 Cash 入站。
  - 学费收据阶段 1 / 2：已确认学费收入权威预览、浏览器打印、`receipt_records` 快照台账、编号、开具审计、历史查看和重新打印。
  - School 侧账户流水、账户内部调拨、报销生成 / 完成 / 作废。
  - 外部授课预定 / 实际课时、月度结算、导出 payload 和收入生成。
  - 审计事件列表和详情查询。
- 第一批后端测试：
  - 学费账单预览权威来源、locked carryover、无来源阻断、下游收入阻断和来源字段变更版本判断。
  - MoneyService 金额取舍、半分值、负数 rounding、汇率折算和 mismatch 拒绝。
  - PasswordService 密码 hash / verify。
  - CashInboundService Cash 入站创建 / 冲销时对关联收入 `cash_confirmed` 与 `account_transaction_created` 的状态闭环。
- 基础 seed：
  - 4 个角色：系统管理员、财务负责人、业务人员、销售人员。
  - 21 个权限。
  - 2 个业务归属：青空进学塾为唯一新业务运营归属；个人名义已归档，仅用于历史关系和审计。
  - 3 个 School 侧账户：法人账户、吴垫付账户、包垫付账户。

## 7. 建议下一步

建议后续按以下顺序推进：

1. 继续补充稳定测试：Cash 请求、收入 / 支出 / 账户流水一致性、学生课时删除 guard、工资快照生成支出。
2. 细化字段级 API 契约：request / response、错误信息、权限要求、列表 / 详情 / 抽屉展示字段。
3. 前端以 students / teachers / settings / finance manual records / cash requests / cash inbound / reimbursements 为样板，继续把账户流水写入和更多财务复核动作逐步接入真实 dev API。
4. 设计 v2 数据迁移脚本和校验报告；真实数据只进入未来 prod，不进入 dev / staging。
