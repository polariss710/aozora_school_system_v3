# Aozora School System v3 环境隔离与测试数据管理原则

## 背景

v2 开发过程中，真实业务数据、测试数据、Cash 联动测试数据混在同一套生产数据库中，导致后续经常需要定向删除：

- 测试收入进入 School income / Cash rejected。
- 测试支出生成 School account transactions。
- 测试工资支出挂到 locked wage snapshot。
- 删除前必须逐条追查 School / Cash / transaction / linkage 关联。

这说明生产库不应该承担开发和联动测试职责。

## v3 基本原则

v3 必须从设计阶段区分：

- `prod`：正式生产环境。
- `staging`：检测 / 验收环境。
- `dev`：开发环境。

规则：

1. `prod` 只保存真实业务数据，不允许手动造测试数据。
2. `staging` 用于上线前完整流程验证，可以导入真实数据副本。
3. `dev` 用于开发和破坏性测试，应能独立 reset / migrate / seed。
4. Cash 联动必须按环境隔离：
   - School prod -> Cash prod
   - School staging -> Cash staging
   - School dev -> Cash dev 或 mock cash
5. 测试数据不得写入 `prod`。
6. `prod` 中如确需修复数据，必须走白名单 SQL、前置校验、后置校验。
7. 不能再用模糊环境变量，例如旧 `SUPABASE_DB_URL`。
8. 所有环境变量必须显式带环境和系统名。

## 推荐环境变量命名

DB 连接示例：

```text
SCHOOL_PROD_DB_URL
CASH_PROD_DB_URL
SCHOOL_STAGING_DB_URL
CASH_STAGING_DB_URL
SCHOOL_DEV_DB_URL
CASH_DEV_DB_URL
```

Supabase API 示例：

```text
SCHOOL_PROD_SUPABASE_URL
SCHOOL_PROD_SERVICE_ROLE_KEY
CASH_PROD_SUPABASE_URL
CASH_PROD_SERVICE_ROLE_KEY
```

前端也必须区分：

```text
SCHOOL_FRONTEND_ENV=prod | staging | dev
```

## Supabase project 与环境策略

当前 v2 仍在 Supabase free plan 下运行，现有两个 project：

- Cash 系统 project。
- School 系统 project，承载 v1 / v2 数据。

v3 数据量预计较小，数据库托管平台当前不以高性能、高可用和复杂监控为第一优先级。

当前更重要的是：

- 快速完成 v3 搭建。
- 快速迁移和校验 v2 数据。
- 保持标准 PostgreSQL，确保未来可迁移。
- 避免继续把复杂业务逻辑写进 Supabase RPC。
- 建立清晰的后端 API / domain service 边界。

因此，v3 初期数据库平台暂定为 Supabase paid project，而不是一开始采用 Google Cloud SQL 等更重的平台。

## 当前确定策略

### Supabase 付费计划

当前倾向：

- 将当前 Supabase organization 从 Free 升级到 Pro。
- v2 现有 School project 不迁移、不改架构。
- 现有 Cash project 不在 v2 稳定运营期修改或迁出，继续承担现行生产职责。
- V3 的每个环境在同一个 Supabase project 内共置 School 与 Cash：`v3-dev`、未来的 `v3-staging`、未来的 `v3-prod` 各一个 project。
- School 继续由 NestJS / Prisma 管理；Cash 使用 `home_*` 表、policy 和受控 RPC 边界。两者共库不等于混合业务权威或共享生产凭据。
- 2026-07-17 已将无生产数据的 Cash dev 结构安装到现有 `v3-dev`；现行 Cash production project 未修改。

费用估算按当前 Supabase billing 页面观察值记录：

```text
当前 3 个 project 合计       约 $35/月
```

进入测试 / 上线准备阶段后新增 `v3-staging` 和 `v3-prod`，峰值 project 数为 5 个：现行 School、现行 Cash、`v3-dev`、`v3-staging`、`v3-prod`。不会再为 Cash dev / staging / prod 各创建独立 project。V3 正式切换并完成观察期后，再评估把旧 School / Cash project 转只读、归档或下线，长期目标保留 3 个 V3 环境 project。

以上只是阶段性运营成本口径，实际以 Supabase billing 页面为准。

### V3 环境分层

v3 在架构上仍然需要 `dev` / `staging` / `prod` 三层环境。

但环境可以分阶段建立：

- 开发阶段：使用一个 `v3-dev` cloud project，共置 School dev 与 Cash dev，用于 schema 设计、后端 API 开发、数据迁移试验和破坏性测试。
- 测试阶段：新增一个 `v3-staging`，共置 School staging 与 Cash staging，用于接近真实流程的验收和迁移演练。
- 上线阶段：新增一个 `v3-prod`，共置 School prod 与 Cash prod，只保存真实业务数据。

逻辑上必须从一开始按三层环境设计，但不要求在开发第一天就创建三套云端 project。

### 现有 Cash / School project

现有 Cash production project 与 School v1/v2 production project 在 V3 切换前继续分离，禁止为了开发测试修改其 schema、key 或前端指向。

V3 已确定采用“同环境共 project”拓扑：

| V3 环境 | Supabase project | School 数据 | Cash 数据 |
| --- | --- | --- | --- |
| dev | `v3-dev` | 测试数据 | Cash dev 测试数据 |
| staging | `v3-staging` | 验收 / 迁移演练数据 | Cash staging 验收数据 |
| prod | `v3-prod` | 正式数据 | 正式 Cash ledger |

共置边界：

- Cash 继续使用 `home_*` 命名、RLS 和 Cash 专用 RPC；School 不直接写 Cash 表，只通过后端适配层调用合同。
- Cash 前端使用目标环境的 Supabase URL、anon key 和 Auth session；School API 单独保管目标环境 service role。
- dev 只复制 Cash 结构，不复制现行 Cash production 数据。
- staging / prod 的 Cash 数据迁移、ledger 对账和切换必须另立执行阶段，不能用 dev bootstrap 代替。
- `scripts/cash-dev/` 的 bootstrap 只允许安装到空的 `home_*` 目标，且不包含 `shop_*`、生产数据或生产 ACL。

### Supabase RPC 边界

v3 不继续沿用 v2 的 Supabase RPC 业务层模式。

原则：

- 前端只调用 v3 后端 API。
- 后端通过标准 SQL / query builder / ORM 访问 PostgreSQL。
- 复杂业务逻辑放在后端 domain service。
- 数据库负责表结构、约束、索引、外键、唯一性、基础事务一致性和必要防线。
- 不在 DB 端建立复杂的结算、工资、收入、支出、Cash 状态流转等业务 RPC。

说明：

- v3 的正式业务权威层是后端 domain service，不是 Supabase RPC。
- Supabase 在 v3 初期主要承担托管 PostgreSQL、Dashboard、备份和基础管理平台角色。
- 未来如迁移到 Cloud SQL / Neon / RDS，应主要是配置、权限和数据迁移问题，而不是业务系统重写。

## v3 必须支持的开发能力

v3 项目应支持：

1. 一键初始化 dev DB。
2. 一键导入 seed data。
3. 一键清空 dev 测试数据。
4. staging 可按正式迁移边界导入受控真实数据副本；普通教学因业务归属规则收口而原则上为 `2026-07` 及以后，私塾打工作为独立且无普通教学业务归属维度的系统迁移完整 2026 结算年度 `2025-12` 至 `2026-11`。
5. 导入 staging 时必须脱敏或明确标记为副本。
6. prod 数据不得被 dev/staging 写入。
7. Cash 联动在 dev 中可使用 mock；真实 E2E 使用同一 `v3-dev` project 内的 Cash dev 模块。
8. 所有写入测试必须先经过 dev，再经过 staging，最后才允许进入 prod。

## 删除和清理原则

prod 中禁止随意清理测试数据，因为理论上 prod 不应产生测试数据。

如果 prod 中确实出现误入测试数据，必须按以下流程：

1. 只读盘点。
2. 查明 School / Cash / transaction / linkage 关联。
3. 分类：可删 / 需确认 / 禁止删除。
4. 用户确认白名单。
5. 执行前置校验。
6. 白名单删除。
7. 后置校验。
8. 记录清理报告。

严禁：

- 按 status 批量删除。
- 按月份批量删除。
- 按金额批量删除。
- 未确认 transaction 就删除。
- 只删 Cash 不删 School linkage。
- 只删主表不查流水。

## 结论

v3 的核心原则是：

- 生产环境只做生产。
- 检测环境验证真实流程。
- 开发环境允许破坏和重置。

不能再让 prod 同时承担生产、测试、开发三种职责。
