# V3 staging 合成验收与最终对账报告

更新日期：2026-07-19

## 结论

`aozora-school-v3-staging` 的空库建设、合成业务 E2E、School ↔ Cash 双向联动、人工 UI 验收和验收数据清理均已通过。最终数据库对账 23 项全部为 `passed=true`，无 `STAGING-E2E-*` 业务残留、跨系统孤儿引用或状态错配。

本报告只证明空 staging 与合成数据验收完成。根据用户边界，本轮没有读取、复制或导入 School/Cash production 数据，因此不构成 V2→V3 生产数据迁移演练报告，也不授权创建或写入 `v3-prod`。

## 环境与冻结点

- Supabase：`aozora-school-v3-staging`，ref `bxnxdkbjlxkcqwzzeyds`，Tokyo。
- School V3 基线：`main@2a0d73c`；staging 建设分支：`codex/v3-staging`。
- Cash 提升基线：`codex/cash-dev-environment@47731f4522689fa686b153c7ba997adc92330465`。
- API：`https://aozora-school-system-v3-api-staging.onrender.com`。
- School：`https://aozora-school-system-v3-staging.onrender.com`。
- Cash：`https://aozora-cash-v3-staging.onrender.com`。
- 现行 School V2 production、Cash production 和 `v3-dev` 均未修改。

## 已通过业务矩阵

1. 基础 API：登录、权限、学生 / 老师生命周期、重复编码、手动收支作废、账户流水反转与审计。
2. School → Cash pending：JPY income / expense、两端引用一致、重复提交与 School 越权确认 / 撤回拒绝。
3. JPY canonical：income approve、expense reject、callback / replay、相反 action 冲突与人工 UI。
4. School 核心：预定→实际、学生月结锁定、工资 preview / lock / adjustment / confirm / revoke 与来源 guard。
5. 学费与收据：fingerprint guard、bill / income 幂等、Cash approve、live / issued receipt immutability。
6. CNY canonical：CNY income / expense approve、callback 与 replay。
7. 老师工资聚合：JPY 2,100 + 1,800 只生成一条 JPY 3,900 Cash transaction；批次 callback / sync 重放、冲突保护、transaction guard 与人工 UI。
8. CNY→JPY FX：CNY 88.00 → JPY 1,800；School inbound / account transaction、callback / sync 重放、冲突保护、双侧四种 guard 与人工 UI。
9. 私塾打工：planned→actual、JPY 5,300 月结 preview / lock / export、锁后保护、收入幂等和 Cash approve / callback / replay。
10. Cash 回滚矩阵：工资聚合、工资整组原子拒绝、FX sync / guard 均在回滚事务内通过。

逐轮 marker、School / Cash request、transaction、batch、event 与清理记录见 `docs/staging-build-log.md`。

## 最终数据库对账

可重复脚本：`scripts/staging/verify-final-reconciliation.sql`。

| 检查组 | 结果 |
| --- | --- |
| School migrations | 21 / 21 applied |
| Cash schema | 10 tables / 48 functions / 10 RLS policies / 4 distinct guards |
| Cash staging seed | 4 accounts / 3 allow School requests |
| 临时管理员 | 0 |
| synthetic students / teachers / income / expense / workplaces | 全部 0 |
| School / external Cash synthetic requests | 全部 0 |
| School / Cash payment batches、FX sync | 全部 0 |
| School→Cash / Cash→School orphan | 全部 0 |
| confirmed / rejected 状态错配 | 0 |
| anon `home_*` table / function grants | 全部 0 |

人工确认后的工资与 FX 证据分别由 `cleanup-finalized-wage-batch-e2e.sql`、`cleanup-finalized-fx-inbound-e2e.sql` 精确清理；两份脚本均先通过 rollback 试运行，再执行正式事务并返回 `residual_rows=0`。

## 运行面验收

`scripts/staging/operational-smoke.mjs` 在 2026-07-19 通过：

- API health `ok`；
- database health `ok`；
- School bundle 只含 staging API，不含 dev API；
- Cash 页面只含 staging project ref 与 staging callback；
- 只允许 School / Cash 两个 staging origin，dev origin 无 allow-origin；
- Render 免费实例采用 90 秒冷启动容忍窗口。

API 回归为 10 files / 45 tests；API build 与 Web build 通过。Web 仅保留已知的大 chunk warning。

## 未覆盖与阻断项

- 未执行 production 数据副本、脱敏副本或 V2→V3 mapping 演练；这是用户明确禁止导入生产数据后的范围结果。
- 未创建 `v3-prod`，未执行 Cash ledger 生产迁移。
- Supabase pooler 目前为 staging 使用连接级 `sslmode=no-verify`；prod 必须改为受信 CA / `verify-full`。
- Cash pending cancel 尚无合同；FX 不支持部分分配。
- 仓库内运营探针已完成，但外部持续调度、告警接收人和升级链仍需确认后配置。

因此，合成 staging 应用验收通过；进入 production 数据迁移演练或 `v3-prod` 建设仍被上述边界阻断。
