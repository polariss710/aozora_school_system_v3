# V2 School / Cash production 只读迁移盘点

盘点日期：2026-07-19

## 执行边界

- 用户明确授权对现行 School V2 production 与 Cash production 执行只读聚合盘点。
- School project 与 Cash project 均通过 Supabase project 名称和 ref 双重核对；未连接 dev/staging 作为来源。
- 正式脚本以 `begin transaction read only` 开始并以 `rollback` 结束；补充查询均为单条 aggregate-only `SELECT`。
- 没有执行 INSERT、UPDATE、DELETE、DDL、RPC 或导出。
- 报告不保存 UUID、姓名、账户名、文件名、备注或逐行业务数据。
- 现行 production School/Cash 未修改，production 数据未导入 staging/dev。

## School V2 私塾打工范围

业务范围：`2025-12` 至 `2026-11`。

### 历史导入与课时

| 项目 | 结果 |
| --- | ---: |
| 历史导入 batch | 3 |
| batch 预期 lesson | 167 |
| active planned | 286 |
| active actual | 271 |
| 其中带历史 batch 身份的 planned / actual | 167 / 167 |
| soft-deleted planned / actual | 13 / 2 |
| actual 缺少 planned | 0 |
| 重复 active actual group | 0 |
| settlement detail 引用 soft-deleted actual | 0 |
| active actual 引用 soft-deleted planned | 0 |

结论：15 条 soft-deleted lesson 不进入 V3 运营事实，原 UUID、关系、时间和 row snapshot 进入 migration audit。167 条历史导入配对与 batch 预期一致。

### 结算、Income 与 linkage

| 项目 | 结果 |
| --- | ---: |
| settlement | 22 |
| `income_request_created` | 21 |
| `locked` | 1 |
| canonical income | 20 |
| canonical income JPY | 1,897,990 |
| `historical_confirmed` linkage | 12 |
| `synced` linkage | 8 |
| synced Cash transaction | 8 |
| linkage / detail / settlement 孤儿或重复幂等键 | 0 |

20 条 canonical income 的 V2 `source_type` 全部为 `part_time_work`，迁移时受控转换为 V3 `external_work`。

两个无 canonical income 的 settlement：

- JPY 137,920：当前为 locked，保持 locked 迁移。
- JPY 7,800：存在 1 条已 soft-delete、从未提交 Cash 的 legacy pending request；迁移为 locked，同时把旧 request 保存为 history-only audit，不生成 income 或 Cash request。

### School ↔ Cash transaction 交叉核对

- 8 个 synced transaction 全部在 Cash production `home_cny_transactions` 解析。
- CNY 金额、Cash account 和 income 方向 8/8 一致，合计 CNY 36,276.77。
- JPY transaction UUID 碰撞为 0。
- 5 条为 external contract transaction，带 School reference；3 条为旧式既存 Cash 交易，仅通过 School linkage event 保存 transaction ID。迁移必须保留这一历史差异，不给旧交易补造 external metadata。

## Cash production ledger

### Schema

- 7 张 `home_*` 表：accounts、CNY/JPY transactions、external requests、fixed month items、fixed templates、payment channels。
- 42 个 `home_*` function。
- 7 个 RLS policy。
- production 尚无 V3 wage batch / School FX sync 等 staging 新结构；V3 prod 必须先从空库安装当前冻结 bootstrap，再导入 legacy ledger。

### 数据规模

| 模块 | 数量 |
| --- | ---: |
| Cash account | 7 |
| CNY transaction | 58 |
| JPY transaction | 29 |
| payment channel | 3 |
| fixed template | 25（active 17） |
| fixed month item | 53（paid 43 / unpaid 10） |
| external request | 33 |

Cash ledger 数据由 1 个用户拥有；Auth 中共有 2 个用户。迁移不得无条件复制全部 Auth 用户，必须只迁移 ledger owner 和明确批准的运营身份。

### Transaction 汇总

- CNY：expense 33 / CNY 114,062.47；fx_in 2 / CNY 19,180；income 22 / CNY 190,607.37；transfer 1 / CNY 10,000。
- JPY：expense 14 / JPY 790,740；fixed_out 3 / JPY 401,000；fx_out 2 / JPY 404,000；income 6 / JPY 1,099,430；transfer 4 / JPY 1,021,400。
- 日期范围为 2026-05-01 至 2026-07-19，具体范围按 transaction type 保存在只读查询输出中，报告不含逐行记录。

### External request 汇总

- CNY expense approved 12 / CNY 39,809；rejected 2 / CNY 8,394。
- CNY income approved 5 / CNY 23,963.77。
- CNY tuition income approved 11 / CNY 115,327.60。
- JPY expense approved 3 / JPY 108,000。
- approved request 均有唯一 transaction；rejected request 均无 transaction。

### 引用完整性

以下全部为 0：

- JPY / CNY transaction account orphan；
- fixed item template / account orphan；
- external request account orphan；
- approved request transaction orphan；
- non-approved request 带 transaction。

## 对迁移设计的直接影响

1. Cash prod 必须迁移完整 7 表 ledger，而不是只搬 School 引用；原 account / transaction / request UUID 全部保留。
2. Cash bootstrap 先安装 V3 10 表 / 48 functions / guards，再由独立 legacy importer 写入 7 表历史事实；不得运行旧 destructive schema 文件。
3. Auth 迁移使用显式 allowlist，只迁移 ledger owner 和批准身份。
4. School 私塾打工 schema 必须先增加 migration batch、record audit、history-only linkage 和历史状态承载。
5. 使用合成 fixture 在 staging 验证 12 条 historical-confirmed、8 条 synced、3 条 legacy transaction metadata 缺失以及 soft-delete audit 等形状；不导入本次 production 数据。
6. `v3-prod` 尚未创建；目标 UUID collision、initial/final delta 和正式导入仍未执行。
