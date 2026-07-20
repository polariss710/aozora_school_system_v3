# V3 production promotion 运行手册（草案）

更新日期：2026-07-19

## 边界

本文只定义未来从已验收候选进入 `v3-prod` 的执行与回滚顺序，不授权现在创建 project、读取 production、复制数据、修改现行 School/Cash 或切换域名。

现行 School V2 与 Cash production 在 V3 正式切换和观察期完成前继续独立运行。V3 prod 最终在一个独立 Supabase project 中共置 School 与 Cash schema，但业务权威、RLS、凭据和前端入口仍按系统分离。

## 进入条件

以下全部确认后才能开始：

1. 用户明确授权创建 `v3-prod` 和 production 数据只读盘点。
2. staging 合成验收、最终对账和外部告警配置完成。
3. School / Cash 提升 commit、migration、Cash bootstrap 和校验和冻结。
4. Supabase pooler 使用受信 CA / `verify-full`，不得沿用 staging 的 `sslmode=no-verify`。
5. V2→V3 字段 mapping、引用闭包、历史 UUID 保留、导入批次和原始快照 schema 完成代码审查。
6. Cash ledger 迁移有独立程序和对账报告，不由 School migration 顺带生成。
7. 负责人、切换窗口、冻结时间、告警接收人和回滚决策人明确。

在进入阶段 1 前，还必须以不含业务行、来源身份、凭据或 snapshot 的 manifest
运行 `scripts/migration/assess-cutover-readiness.mjs` 并取得全绿结果。该门禁
只核对执行准备度；它不会创建 `v3-prod`、读取 source、冻结写入或授权切换。

## 角色

| 角色 | 职责 | 当前状态 |
| --- | --- | --- |
| 业务负责人 | 接受迁移范围、已知限制与最终业务数字 | 待用户指定 |
| 发布执行人 | 创建环境、部署、切换入口 | 待指定 |
| School 数据核验人 | V2→V3 行数、金额、引用闭包与审计核验 | 待指定 |
| Cash 数据核验人 | ledger、request、transaction、batch、FX 对账 | 待指定 |
| 回滚决策人 | 根据触发条件决定停止或回滚 | 待用户指定 |

同一人可以承担多个角色，但执行人与最终数字核验人原则上应做双人复核。

## 阶段 0：候选冻结

- 记录 School / Cash commit、migration 清单、文件哈希、测试和 staging 报告。
- 冻结候选后只接受 blocker 修复；任何代码、schema 或 Cash SQL 变化都重新跑 staging。
- 记录现行 School/Cash production 的只读版本、入口与备份状态。

## 阶段 1：创建空 `v3-prod`

- 创建独立 Tokyo Supabase project；不复用 dev/staging Auth user、UUID 或 secret。
- 先做空目标 preflight，再安装 School migrations、Cash bootstrap / 增量结构与 prod 专用 seed。
- 配置独立 API、School、Cash Render 服务和域名；所有环境变量显式使用 prod 名称。
- 在无业务数据状态运行 schema、权限、CORS、环境串线和匿名权限检查。
- 此阶段不导入 production 数据，也不切换用户入口。

## 阶段 2：只读盘点与迁移快照

- 对现行 School V2 / Cash production 仅执行批准的只读查询。
- 普通教学按 `2026-07+` 的可完整映射业务事实和引用闭包；私塾打工按 `2025-12`～`2026-11` 完整结算年度。
- 生成不可变来源快照、行数、金额合计、UUID 清单、源文件 / 查询哈希和批次 ID。
- 普通教学 snapshot 必须附带逐链 exclusion manifest：依赖多维工资明细 / 调整或学生月结 adjustment / carryover 的链保持 V2 只读，附件不复制，legacy payment request 不迁入 V3 `cash_requests`。
- 禁止在盘点阶段修改 source、补造业务归属或重新生成历史身份。

## 阶段 3：staging 迁移演练

- 使用批准的脱敏副本或受控迁移 fixture 在 staging 演练。
- 执行 initial import → 引用闭包 → School/Cash 独立对账 → 重跑幂等 → 回滚 / 重建。
- 保存逐表行数、金额、孤儿、重复、状态和 Cash transaction 报告。
- 未通过时只修迁移程序并从空 staging 重建，不在 Dashboard 手工补数据。

## 阶段 4：prod 初始迁移

- 在仍未切换入口时执行带批次身份的 initial import。
- 每个模块完成后运行只读对账；任何 blocker 立即停止后续模块。
- Cash ledger 与 School 引用分阶段执行，禁止 School 迁移生成替代 Cash 流水。
- 初始迁移完成后保持 V3 prod 非运营入口，等待最终增量窗口。

## 阶段 5：最终冻结与增量

- 到达批准窗口后冻结 V2/Cash 相关写入，记录冻结时间和最后业务身份。
- 执行 final delta；再次核对行数、金额、UUID、request / transaction / batch / FX linkage。
- 运行 API/DB health、登录、核心只读页面和最小非资金 smoke。
- 业务负责人签署最终数字后，才允许切换 School / Cash 入口。

冻结清单必须明确：冻结的 V2 / Cash 写入范围、开始时间、最大可接受停写分钟、
最后业务身份、解除冻结条件与回滚决策人。任何字段缺失或门禁非全绿，都只能继续
维持现行 production 运营，不得以“先切换再补资料”的方式绕过。

## 阶段 6：单点切换与观察

- 一次只切一个明确入口；禁止长期双写。
- V2 保持只读历史查询，不立即删除旧 project。
- 切换后持续监控 API、DB、callback、登录、错误率和关键业务数字。
- 观察期内保留 source 快照、迁移日志、旧入口回切能力与全部备份。

## 回滚触发条件

任一条件出现即停止推进：

- 行数或金额对账不一致；
- UUID、Cash transaction、batch、FX identity 冲突或缺失；
- 存在跨环境 URL、project ref、Auth user 或 key；
- migration pending / failed / drift；
- API / DB health 连续失败；
- callback 重放产生重复资金事实；
- 权限负向检查失败；
- 业务负责人拒绝最终数字。

切换前优先废弃 / 重建目标批次或空 prod，不修改 source。切换后如必须回切，只切入口并恢复旧系统写入；保留 V3 prod 现场只读调查，禁止用模糊条件删除资金事实。

## 待用户确认

- 是否及何时授权 production 只读盘点；
- 是否允许使用脱敏 production 副本做 staging 迁移演练；
- `v3-prod` 创建时间与预算；
- 告警接收方式、负责人和升级链；
- 最终冻结 / 切换窗口及可接受停写时长；
- Cash pending cancel、FX 不支持部分分配等已知限制是否接受。

上述事项未确认前，本手册保持草案状态，不执行任何 production 操作。
