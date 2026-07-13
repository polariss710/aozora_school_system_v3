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
- 现有 Cash project 不在 v2 稳定运营期强行合并。
- v3 开发阶段新增一个独立 Supabase project，作为 `v3 dev`。
- 等 v3 进入测试 / 上线准备阶段后，再细分 `v3 staging` 和 `v3 prod`。

费用估算按当前 Supabase billing 页面观察值记录：

```text
当前 3 个 project 合计       约 $35/月
```

进入测试 / 上线准备阶段后，如果新增 `v3 staging` 和 `v3 prod`，费用会继续上升；用户当前判断最终可接受约 `$55/月` 左右，并计划在 v3 开发完成后合并或下线旧的 Cash / v1 / v2 相关 DB，争取长期保留 2-3 个 project。

以上只是阶段性运营成本口径，实际以 Supabase billing 页面为准。

### V3 环境分层

v3 在架构上仍然需要 `dev` / `staging` / `prod` 三层环境。

但环境可以分阶段建立：

- 开发阶段：只新增一个 `v3 dev` cloud project，用于 schema 设计、后端 API 开发、数据迁移试验和破坏性测试。
- 测试阶段：新增 `v3 staging`，用于接近真实流程的验收和迁移演练。
- 上线阶段：新增 `v3 prod`，只保存真实业务数据。

逻辑上必须从一开始按三层环境设计，但不要求在开发第一天就创建三套云端 project。

### 现有 Cash / School project

现有 Cash project 与 School v1/v2 project 理论上可以合并，因为 Cash 数据量很小。

但短期不执行合并：

- 合并需要迁移 Cash 表、RPC、policy、key、前端配置和联动逻辑。
- v2 当前处于稳定运营阶段，不应为了节省一个 project 打扰现有系统。
- 合并省下的成本预计约 $10/月，低于稳定运营风险。

v3 迁移阶段可重新评估是否在 v3 新系统中将 School / Cash 放入同一个 Postgres project，并通过 schema、后端 module 或 API 边界区分。

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
4. staging 可按正式迁移边界导入受控真实数据副本；当前范围为业务月 `2026-07` 及以后、归属青空进学塾的数据。
5. 导入 staging 时必须脱敏或明确标记为副本。
6. prod 数据不得被 dev/staging 写入。
7. Cash 联动在 dev 中可以使用 mock cash。
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
