# V2 / V3 学生链路与财务边界对齐

更新时间：2026-07-11

本文件记录 V2 最新学生链路规则与 V3 当前实现的对照结果。范围限定为：

- 学生课时、学费账单、学生月度结算、学费收据。
- 学生链路进入收入记录、Cash 请求和账户流水时的边界。
- 不重新审查已经独立完成的普通财务、报销和账户基础管理功能。

## 参考来源

- V2 `docs/current-status.md`：v10.3.60 带条件删除预定课时、v10.3.53 学费账单作废/重新生成。
- V2 `sql/current/school_delete_fresh_planned_lesson_rpc.sql`。
- V2 `sql/current/school_cancel_pending_income_record_rpc.sql`。
- V2 `docs/system-map.md`：收入记录和学生链路边界。
- V3 `apps/api/src/modules/lessons/lessons.service.ts`。
- V3 `apps/api/src/modules/tuition-billing/tuition-billing.service.ts`。
- V3 `apps/api/src/modules/income/income.service.ts`。
- V3 `apps/api/src/modules/cash/cash.service.ts`。

## 对齐结论

### 1. 预定课时

| 规则 | V3 状态 | 结论 |
| --- | --- | --- |
| 正式 planned 课时参与学费账单 | 已对齐 | 保留 |
| planned 生成 actual、取消、待补课、补课完成 | 已对齐 | 保留 |
| 全新 planned 允许物理删除 | 后端已实现，前端入口本轮补齐 | 删除只适用于 `scheduled`、未作废、无 actual、无任何下游引用的记录 |
| 删除需要显式确认 | 已对齐 | API 要求 `confirmDelete = true`，前端二次确认 |
| 删除需要乐观锁 | 已对齐 | API 要求 `expectedUpdatedAt`，版本不一致时拒绝 |
| 删除最终由后端判断 | 已对齐 | 前端只做候选显示，不能绕过后端 guard |

V2 的删除 guard 必须覆盖：实际课时、取消课/补课记录、学生月度结算、结算调整、老师工资明细、学费账单快照和收入快照。V3 后端已覆盖对应的 actual、settlement、tuition bill 和 wage detail 引用检查；本轮前端已接入 `POST /lessons/planned/:id/delete-fresh`。

### 2. 学费账单

| 规则 | V3 状态 | 结论 |
| --- | --- | --- |
| 来源为正式 planned 课时和上月 locked carryover | 已对齐 | 金额由后端计算 |
| 账单生成后可生成收入 | 已对齐 | 生成收入前保持账单可修正 |
| 基础课时或结转变化后重新计算 | 已实现基础动作 | 当前按钮为“重新生成账单”，语义上属于重算 |
| 已生成收入后不能直接重算账单 | 后端已阻止 | 保留收入来源保护 |
| 作废后重新生成新版本并保留旧历史 | 本轮已补齐 | V3 使用 `version`、`replaces_id` 和 `superseded`；旧账单与旧收入保留审计关系 |

“重新生成账单”不是提交 Cash 失败后的重试按钮。它只用于账单来源发生变化、初次生成错误，或已作废账单重新生成。Cash 重试属于收入记录 / Cash 请求链路。

### 3. 学费收入记录

| 收入状态 | 应有动作 | V3 对齐状态 |
| --- | --- | --- |
| `pending + not_requested` | 提交 Cash、作废/撤销收入 | 本轮补齐学费收入作废入口 |
| `pending + cash_requested` | 只读；从 Cash 请求侧撤回请求 | Cash 请求侧已有撤回动作 |
| `pending + cash_rejected` | 重新提交 Cash；必要时作废/撤销收入 | 后端允许，前端需继续按状态验证 |
| `cash_confirmed` | 不能普通作废，只能冲销/修正 | 后端保护已存在 |
| `account_transaction_created` | 不能删除，只能反向流水 | 财务边界规则保留 |

V2 的 pending income 作废规则是：没有待确认/已确认 Cash 请求、没有账户流水、没有已确认收款事实时才允许作废；Cash rejected 可以作为可修正分支。学费收入作废后，关联 tuition bill 应回到可重新生成状态，并保留原收入和账单审计记录。

### 4. 学生月度结算

V3 后端已有 preview、lock、revoke 和下游 carryover guard，业务方向与 V2 对齐。前端已接入单学生预览、锁定、撤销和重新锁定，并验证未处理课时阻断、汇率校验及下游学费账单保护。

### 5. 学费收据

V2 和 V3 核心口径一致：收据只能从已 Cash 确认的学费收入进入，金额使用 Cash 确认后的权威到账金额，不能自由手填。V3 仍未实装正式 receipt 页面/记录模型，暂不把 Beta 手动收据工具接入学生链路。

## 财务 / Cash 边界

当前 V3 的收入、Cash request 和状态回写是 School dev API 内部模型；它还没有连接现有 V2 Cash 系统的真实账户、请求同步和 Cash event 回写。因此：

- V3 的“提交 Cash”只能视为 School 端创建 `cash_requested` 请求的开发阶段动作。
- `cashAccountCode` 当前仍是可选字段，不能当成已完成的 Cash 账户联动。
- Cash 侧确认/拒绝、Cash transaction、实际到账金额和 School account transaction 的真实映射仍待接口合同确认。
- 在真实 Cash 接口确定前，不强行把账户选择改成 V3 本地账户下拉框，也不在 School 端模拟 Cash 确认。

## 后续实现顺序

1. 完成学生月度结算前端动作，并验证课时处理状态、锁定、撤销和结转保护。
2. 补学费账单 preview，并验证版本化作废/重新生成在 dev DB migration 后的完整链路。
3. 对照现有 Cash 系统确定请求、账户、确认、拒绝、transaction 和回写幂等合同。
4. 完成学费收据第一阶段：已 Cash 确认收入 -> 权威金额 -> PDF。

本轮不重复改造普通收入/支出、报销和账户基础页面；它们只有在共享 Cash 状态或下游保护规则发生变化时，才做针对性修正。
