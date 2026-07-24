# V3 账户流水操作契约

更新日期：2026-07-24

## 范围

本阶段只把既有 School API 的账户流水动作接入 V3 Staging 前端；不新增数据库表、字段、RPC、Cash 回调或生产数据操作。

- 手工流水：仅用于已确认的独立账户更正/补录，不替代收入、支出、学费、工资或 Cash 主链路。
- 内部调拨：同币种的两个 active School 账户之间调拨；后端在同一事务内生成一条出金流水、一条入金流水和一条调拨记录。
- 冲销：只允许后端判定为可逆的手工/更正流水；收入、支出、Cash 入站、报销、调拨和其他已有来源流水必须回到各自业务链处理，前端不得绕过。

## 前端动作与后端边界

| 动作 | 前端提交内容 | 既有后端动作 | 结果 |
| --- | --- | --- | --- |
| 新增手工流水 | active 账户、入/出方向、日期、标题、与账户一致的币种和金额、备注 | `POST /accounts/transactions/manual` | 创建 active 流水；后端记录 `account_transaction.create_manual` 高风险审计 |
| 新增内部调拨 | 不同的 active 出/入账户、日期、币种和金额、备注 | `POST /accounts/transfers` | 原子生成双边流水和 transfer；后端记录 `account_transfer.create` 高风险审计 |
| 手动收入/支出直接入账 | 仅 `pending + not_requested` 的手动单据；同币种 active School 账户、日期、备注 | `POST /accounts/transactions/from-income/:id` 或 `from-expense/:id` | 后端按原单据金额生成一条流水并推进该单据为 `account_transaction_created`，记录高风险审计 |
| 冲销手工流水 | 可选原因 | `POST /accounts/transactions/:id/reverse` | 原流水保留并标记 `reversed`；后端记录 `account_transaction.reverse` critical 审计 |
| 作废内部调拨 | 可选原因 | `POST /accounts/transfers/:id/void` | 双边原流水均标记 `reversed`，transfer 保留并标记 `voided`；后端记录 `account_transfer.void` critical 审计 |

## 保护、确认与回滚

- 页面层不直接操作数据库、Supabase RPC 或 Cash。
- 每个写入在提交前展示明确的金额、账户与方向；冲销/作废使用二次确认并允许输入原因。
- 前端不提供删除或普通编辑入口。
- 后端是金额、账户 active 状态、账户币种一致性、同账户调拨拒绝、可逆来源范围、幂等键和审计的权威来源；前端错误只显示后端返回口径。
- 提交失败不修改本地列表；成功后重新读取账户流水、收入/支出和审计列表。
- 手工流水与调拨的测试如需在 Staging 进行，必须使用明确 `STAGING-TEST` 标记并在完成验证后走对应冲销/作废动作，不能物理删除。

## 不包含

- Cash 确认、Cash 入站创建、FX 回写、历史导入流水编辑或冲销。
- 生产数据验证、生产环境配置与数据库 migration。
