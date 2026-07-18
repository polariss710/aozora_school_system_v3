# V3 Staging 建设与验收清单

更新日期：2026-07-18

## 1. 当前结论

- `v3-staging` 基础设施已于 2026-07-18 创建：独立 Tokyo Supabase project、School API、School 静态站和 Cash 静态站均已上线。
- schema、权限、staging Auth / seed、部署健康与 CORS 边界已通过。2026-07-18 已完成第一轮 School API、School → Cash pending、Cash 工资聚合 / 原子拒绝 / FX guard 合成验收和清理；完整课程、结算、工资生成、Cash approve / callback 与 FX 入站矩阵仍未执行，因此本文第 10 节完成标准仍未通过。
- 不得把 dev key、dev Auth user、dev 测试数据或 dev callback 身份复制到 staging。
- `v3-staging` 继续采用同环境共置 School + Cash 的一个 Supabase project；School 业务权威仍在 NestJS domain service，Cash 仍通过 `home_*`、RLS 和受控 RPC 边界运行。
- staging 创建前的 dev 主链路、异常恢复和迁移脚本冻结证据已记录；后续候选变化仍必须重新冻结和重跑本清单。

## 2. 创建前冻结点

创建 staging 前必须记录并冻结：

- School V3 `main` commit；
- Cash `codex/cash-dev-environment` 中准备提升的 commit；
- Prisma migration 清单及校验和；
- `scripts/cash-dev/` bootstrap、增量扩展与 verify 脚本校验和；
- dev 已通过的 API 测试数、前后端 build 结果和真实 E2E 批次身份；
- 已知限制、尚未完成项和明确不进入本次 staging 的功能。

冻结点之后如有代码、migration 或 Cash SQL 变化，必须重新生成部署候选并重跑本清单，不得沿用旧验收记录。

## 3. Supabase staging project

1. 创建独立 `v3-staging` Supabase project，地域、PostgreSQL 主版本和基础扩展与 `v3-dev` 对齐。
2. 记录 project ref、Direct DB URL、pooler URL、Supabase URL、publishable key 和 service role；凭据只进入密码管理器和部署平台 secret，不写入 Git 或文档。
3. 建立 staging 专用 School 管理员 Auth user 与 Cash Auth user；不得复用 dev UUID 作为环境身份假设。
4. 开启与未来 prod 相同级别的备份、日志保留和访问限制；确认 staging 不接受生产前端来源。
5. 在任何 schema 写入前运行目标盘点，确认没有意外 `school_*`、`home_*`、`shop_*` 或业务数据残留。

## 4. Schema 安装顺序

严格按以下顺序执行并保存日志：

1. School Prisma migration 全量应用到空 staging schema。
2. 运行 Prisma migration status，确认无 pending、failed 或 drift。
3. 对空 `home_*` 目标运行 Cash target preflight。
4. 运行 Cash bootstrap；bootstrap 必须在非空 `home_*` 目标上拒绝执行。
5. 运行 Cash 基础 verify、FX School sync verify、老师工资聚合 verify。
6. 创建 staging Cash Auth user 后 seed staging 专用 Cash 账户，并执行 seed verify。
7. 运行表、函数、policy、trigger 数量检查以及 `anon` / `authenticated` 权限负向检查。

任何一步失败都停止；不得通过 Dashboard 手工补对象后继续，也不得跳过失败 migration。

## 5. Render staging 部署

需要独立创建：

- School staging API Web Service；
- School staging Static Site；
- Cash staging Static Site。

三者必须使用 staging 专用域名和环境变量。至少核对：

- `SCHOOL_RUNTIME_ENV=staging`；
- `CASH_INTEGRATION_MODE=supabase`；
- `CASH_STAGING_SUPABASE_URL`；
- `CASH_STAGING_SERVICE_ROLE_KEY`；
- `CASH_STAGING_USER_ID`；
- School 前端 API base URL；
- Cash 前端 Supabase URL、publishable key；
- Cash → School 单笔 callback、聚合 callback、FX inbound callback URL；
- School API 与 Supabase Auth 的 CORS / redirect allowlist。

启动时必须输出环境名但不得输出 key。staging 服务发现 dev/prod URL、project ref 或用户 UUID 时应停止验收。

## 6. Staging 数据范围

首次 staging 演练分两层：

### 6.1 合成验收数据

- 先只使用明确 `STAGING-E2E-*` 标记的合成学生、老师、课时、工资、收支和 Cash 流水。
- 跑通后按完整引用链清理或执行环境 reset；不得只删 School 或只删 Cash。

### 6.2 迁移演练副本

- 普通教学事实按 `2026-07+` 范围导入；主数据按引用闭包导入。
- 私塾打工按完整 2026 结算年度 `2025-12` 至 `2026-11` 导入，并保留完整审计链。
- 如使用真实数据副本，必须记录来源快照、脱敏方式、导入批次、行数和哈希。
- Cash ledger 迁移若进入本轮，必须使用独立 Cash ledger 迁移程序和对账报告；不得由 School 数据迁移顺带生成 Cash 流水。

## 7. 必过 E2E 矩阵

### 2026-07-18 第一轮执行结果

- School API 登录与权限读取通过；学生、老师新增 / 修改 / 归档 / 恢复通过，重复学生编码被拒绝。
- 手动收入、手动支出完成新增 / 读取 / 作废，重复作废被拒绝；手工账户流水完成新增 / 反转，重复反转被拒绝。相关目标共生成 14 条审计事件。
- School → Cash staging 真实 Supabase 模式通过：JPY 2,200 收入和 JPY 1,100 支出各生成一条 Cash pending request；两端事件 ID、业务引用、币种、金额和账户逐项一致。
- 同一 School 记录重复提交、School 侧直接撤回和直接确认真实 Cash 请求均被拒绝。
- Cash staging 回滚事务通过老师工资聚合成功 / 幂等 / 冲突身份 / transaction guard、工资整组原子拒绝成功 / 幂等 / 不匹配零写入、FX 同步成功 / 幂等 / 冲突身份 / 双侧 guard。
- 本轮 `STAGING-E2E-*` School / Cash 合成记录已按完整引用链清理，残留行数为 0；临时 School 管理员测试密码已恢复。
- 可重复脚本位于 `scripts/staging/` 与 `scripts/cash-staging/`。

以上只是第一轮基础与跨系统提交验收，不替代下列完整矩阵。

### School 主链路

- 预定课时 → 实际课时 → 学生月度结算；
- 学费账单 → 收入记录 → Cash 确认 → 收据；
- 老师工资预览 → 勤务表调整 → 支出记录 → Cash；
- 私塾打工课时 → 月度结算 → 收入与 Cash 引用；
- 手动收入、手动支出、报销和账户流水；
- 作废、撤销、冲销、并发版本保护和审计事件。

### School ↔ Cash

- JPY / CNY canonical income approve；
- JPY / CNY canonical expense approve；
- 单笔 reject 不生成 Cash transaction；
- Cash 已处理但 School callback 失败后的原身份重试；
- 同老师、月份、币种、账户、付款日期的工资聚合只生成一条 Cash transaction；
- 工资整组原子拒绝全部成功或全部零写入；
- 聚合 callback 重试幂等，冲突 School batch 身份被拒绝；
- CNY→JPY FX 入站金额精确匹配、重复回写幂等、冲突身份拒绝；
- 已同步 FX pair 和工资聚合 transaction 的 update / delete guard。

## 8. 对账与负向检查

- 每条 School confirmed income / expense 都能追溯 Cash request；approved 必须有唯一 transaction，rejected 必须没有 transaction。
- 聚合工资的 item 金额合计等于 batch 与 transaction，总明细数与两端一致。
- Cash transaction ID、School batch ID、Cash batch ID 在各自唯一约束内有效。
- 重放 callback、页面刷新和服务重启不得新增 transaction 或 batch。
- `anon` 不能调用写 RPC；authenticated 不能直接写 batch / sync marker 表；School 浏览器拿不到 service role。
- staging 前端不能访问 dev/prod project，dev/prod 前端也不能访问 staging project。
- prod 前必须为 Supabase pooler 配置受信 CA / `verify-full`；staging 当前连接级 `sslmode=no-verify` 不得原样提升到 prod。

## 9. 失败与回滚

- schema 安装失败：废弃该 staging 数据库状态，修正 migration / bootstrap 后从空目标重建，不做未版本化手工修补。
- Cash 已生成 transaction、School 未回写：保留 Cash 事实，只重放原 callback。
- School 已入站、Cash marker 未写：重放原 School payload并完成 Cash marker，不重建 School 流水。
- 迁移对账失败：保留导入日志，停止切换，按迁移批次执行受控回滚或重建 staging。
- 凭据误配：立即撤销受影响 key / session，停止相关服务并重新跑环境边界检查。

## 10. Staging 完成标准

同时满足以下条件才可进入 prod 建设：

- 所有 migration / bootstrap / verify 可从空 staging 重复执行；
- 必过 E2E 矩阵全部通过，并保存 School / Cash / transaction / batch 身份；
- 合成数据和迁移副本均有完整对账报告；
- 没有 dev/prod 凭据、URL、Auth 身份或测试数据串入 staging；
- 已知限制获得明确接受，阻断问题为零；
- 形成 prod 运行手册、切换窗口、冻结规则、回滚触发条件和负责人清单。

完成标准通过前，不创建或写入 `v3-prod`。

截至 2026-07-18，第一轮合成 smoke 与回滚型 Cash 验收已通过，但课程 / 月结 / 学费收据 / 工资生成 / 私塾打工、真实 Cash approve / reject callback、callback 恢复和完整对账报告仍待执行；本节仍为未通过。
