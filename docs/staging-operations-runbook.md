# V3 staging 运营检查与告警运行手册

更新日期：2026-07-19

## 目标

在不保存 API key、数据库密码或用户凭据的情况下，持续发现 staging API、数据库、前端部署、CORS 和环境串线问题，并给 Cash callback 恢复提供明确入口。

## 无密钥探针

执行：

```bash
node scripts/staging/operational-smoke.mjs
```

成功时输出 `ok=true`，并包含 `api`、`database`、`schoolFrontend`、`cashFrontend`、`cors` 五项结果；任一失败以非零状态退出。默认只访问三个 staging 域名。每个请求允许 90 秒；网络错误、超时或 HTTP 5xx 会在等待 10 秒后自动重试一次，以容纳 Render 免费实例冷启动。两次均失败时，日志会明确输出失败目标名称。

GitHub Actions 配置位于 `.github/workflows/staging-operational-monitor.yml`，每小时第 17 分钟执行一次，也支持 `workflow_dispatch` 手动运行。任务不读取 secrets，只使用仓库内脚本的 staging 默认 URL；失败会使 workflow 变红，并按 GitHub 账户与仓库通知设置发送 Actions 失败通知。

GitHub 的定时 workflow 只从仓库默认分支执行。当前配置先随 `codex/v3-staging` 提交；进入默认分支前属于“配置完成、定时未启用”，不得误记为已经无人值守运行。

如后续需要 5 分钟级监测，可另接外部 uptime 服务；同一可用性检查连续失败 2 次再升级告警，环境串线或 CORS 错误则立即处理。

## 告警分级

| 级别 | 条件 | 第一动作 |
| --- | --- | --- |
| P1 | database health 非 `ok`；staging 指向 dev/prod；service role / project ref 串线 | 停止所有 E2E 写入，保留日志，检查 Render env 与 Supabase project ref |
| P1 | Cash 已生成 transaction 但 School callback 未确认 | 不重做 Cash approve；使用原 Cash request / batch / FX 身份重放 callback |
| P2 | API health 连续两次失败 | 检查 Render deploy / runtime logs，确认最近 live commit，等待一次冷启动窗口后重试 |
| P2 | School 或 Cash 静态站失败 / 环境标签错误 | 停止人工验收，检查目标 branch、build env 与最新 live deploy |
| P2 | 允许 origin 缺失或 dev origin 被允许 | 停止跨系统页面操作，修正 API CORS 后重跑探针 |
| P3 | 单次 90 秒内恢复、CLI 临时认证失败 | 记录事件，串行重试；禁止并发反复登录触发 Supabase circuit breaker |

## 跨系统恢复原则

- Cash request 已 approved / rejected：只重放 `/api/cash/callbacks/request-result`，不得再次执行 approve / reject RPC。
- 工资 batch 已 approved：只重放 `/api/cash/callbacks/request-batch-result`，再用原 School batch ID 重放 Cash sync marker。
- FX School inbound 已创建：用原 CNY FX ID、corporate account 和 income IDs 重放；不得重建 FX pair 或 School account transaction。
- 状态不一致时先运行只读对账，禁止按月份、金额或状态模糊删除。
- 所有验收清理先在 rollback 事务试运行，再使用全身份匹配脚本正式执行。

## 每次发布检查

1. 确认 branch / commit 与候选一致。
2. 确认 Render deploy 为 live；失败邮件不等于现有 live 服务已下线。
3. 运行 `operational-smoke.mjs`。
4. 如涉及 schema，运行 migration status 与对应 Cash verify。
5. 如涉及 School ↔ Cash，运行受影响 E2E 和 `verify-final-reconciliation.sql`。
6. 保存 commit、时间、结果与已知 warning。

## 当前告警能力与待配置项

- Render deploy 失败邮件已实际到达项目账户，证明部署事件通知可用。
- School 前端登录后每 60 秒显示 API / DB health，但这不是无人值守外部告警。
- 仓库内无密钥探针已验收；GitHub Actions 每小时 workflow 已进入默认分支并启用，手动运行和首次定时运行重试均成功。
- GitHub Actions 的失败邮件 / Web 通知取决于 GitHub 账户和仓库通知设置；workflow 本身不保存或强制指定接收人。
- 未经用户确认，不新增付费监控服务、不指定新的邮件/Slack 接收人，也不写入外部平台。

2026-07-19 首次定时运行因单请求 90 秒超时发出失败邮件；服务逐项复核均为 HTTP 200，同一次 scheduled run 重试后 9 秒通过。失败邮件已证明通知接收有效，探针随后加入单请求冷启动重试和目标名称诊断。当前“运营告警”已标记为启用。
