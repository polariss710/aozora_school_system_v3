# V3 Staging 生产副本迁移边界

更新日期：2026-07-19

## 目标

本轮允许把受控的现行 School V2 / Cash production 数据副本导入
`v3-staging`，用于迁移演练和对账。它不是上线切换，也不是 production
双写、project clone 或备份替代方案。

现行 School V2 production 与 Cash production 仍持续写入，因此本轮副本是
带时间边界的初始 snapshot，而不是“永久与 production 相同”的镜像。

## 不可突破的边界

- source 只使用只读连接和 `REPEATABLE READ, READ ONLY` transaction；禁止
  DML、DDL、RPC、清理、Auth 改动、key 改动和前端指向修改。
- target 只能是 project ref `bxnxdkbjlxkcqwzzeyds` 的 `v3-staging`；写入
  程序必须同时验证 runtime env、URL project ref、已应用 migrations 和
  staging Cash seed。
- 明确拒绝现行 School V2 production ref `xlcdqvlfzspcxdoidsrr` 与 Cash
  production ref `ahtgiwdzocerkonrjmdo` 作为 target。
- 不复制 Auth user、密码 hash、service role、publishable key、Render secret、
  production ACL、浏览器 session 或前端环境变量。
- snapshot JSON 是 production data：只保存在仓库外的受控加密位置，不写入
  Git、文档、日志、前端 bundle、GitHub Actions artifact 或 Render 环境变量。
- School migration 不生成 Cash request 或 Cash transaction；Cash ledger 由
  独立程序迁移，保留原 transaction UUID，随后做 cross-project linkage
  对账。

## 持续写入下的迁移顺序

```text
T0: 记录本轮 migration run 身份和目标 staging preflight
    ↓
School V2: read-only repeatable-read snapshot → School JSON + SHA-256
Cash prod: read-only repeatable-read snapshot → Cash JSON + SHA-256
    ↓
snapshot 结构 / 行数 / 金额 / UUID linkage 对账
    ↓
仅向 v3-staging 写入受验证的 migration batch
    ↓
School ↔ Cash transaction UUID、金额、账户、状态对账
    ↓
保留 staging 演练证据；production 继续正常写入
```

School 与 Cash 是两个 production project，因此它们的 `capturedAt` 会不同。
这不是错误：每份 snapshot 都在自己的数据库中一致。跨系统对账只接受
School linkage 所引用、且出现在 Cash snapshot 中的 transaction UUID；若
存在缺失或金额 / 账户不一致，停止导入并重新拍摄 snapshot，不尝试补造数据。

## 初始 snapshot 与未来切换

本轮 staging 演练允许生产继续写入。它验证 schema、mapping、事务、审计与
对账，并不要求复制结束后 staging 立即包含 production 的新事实。

未来 V3 prod 切换时才使用：

1. 初始全量 snapshot；
2. 对账和问题修正；
3. 明确 freeze window；
4. final delta；
5. 单点切换与观察；
6. 满足条件后才评估旧系统只读化。

不在 staging 演练阶段冻结 School 或 Cash 的日常业务。

## 本轮执行门槛

在首次逐行导出前必须同时通过：

- source SQL 的静态只读合同测试；
- staging target preflight；
- snapshot 文件加密存储位置和访问权限确认；
- School private-tutoring plan 的 rollback-only target apply；
- Cash owner UUID → staging Cash user UUID 的显式一对一 mapping；
- staging 目标 workplace mapping 的显式一对一 mapping；
- import 后的行数、金额、hash、UUID 和 School↔Cash linkage 对账脚本。

任一失败即停止本批次。不得删除 source 数据，也不得按月份、金额或 status
批量清理 staging 来掩盖错误；只允许按迁移 batch 做受控回滚或重建 staging。
