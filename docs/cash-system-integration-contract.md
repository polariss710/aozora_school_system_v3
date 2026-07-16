# V3 School ↔ Cash 联动合同

更新日期：2026-07-16

## 1. 定位与现行对端

- School V3 是业务账本，`income_records` / `expense_records` 是唯一的收入、支出业务来源。
- 现行 Cash System 为 `/Users/polariss710/Documents/home_account_book`，继续使用其 Supabase `home_` 账户和流水。
- Cash 只记录真实经过用户可控账户的资金移动，不判断 School 业务归属、课时、结算或工资规则。
- School 发起请求只在 Cash 端生成 `pending` 记录；Cash 用户 approve 后才生成 Cash transaction 并改变 Cash 余额，reject 不生成 transaction。
- V3 不新建 Supabase RPC / Edge Function 作为 School 业务层。V3 NestJS API 作为服务端适配器，通过 Cash 现有 REST/RPC 边界联动。

## 2. 环境边界

School 与 Cash 必须同环境配对：

| School runtime | Cash target |
| --- | --- |
| `dev` | 同一 `v3-dev` project 的 Cash dev，或明确的 mock |
| `staging` | 同一 `v3-staging` project 的 Cash staging |
| `prod` | 同一 `v3-prod` project 的 Cash prod |

“同一 project”只改变部署拓扑，不改变调用合同。School API 仍通过 Cash gateway 访问 `home_*` 边界，School 业务表不得直接组合写入 Cash ledger。现行 Cash production project 在 V3 正式切换前保持不变。

V3 使用 `SCHOOL_RUNTIME_ENV=dev|staging|prod` 选择配置，并只读取对应的显式环境变量：

- `CASH_<ENV>_SUPABASE_URL`
- `CASH_<ENV>_SERVICE_ROLE_KEY`
- `CASH_<ENV>_USER_ID`

`CASH_INTEGRATION_MODE=mock|supabase|disabled` 控制适配器。`service_role` 只存在于 School API 运行环境，不返回给浏览器、不记录到审计 snapshot、不提交到 Git。

## 3. 账户合同

- 账户权威仍属于 Cash `home_accounts`。
- V3 只读取配置 Cash user 下 `is_active = true` 且 `allow_school_requests = true` 的账户。
- School 提交时保存 Cash account UUID 及名称、币种、类型 snapshot，不保存或计算 Cash 余额。
- 请求币种必须与 Cash 账户币种一致。

## 4. School → Cash 请求字段

| V3 来源 | Cash 字段 / 规则 |
| --- | --- |
| `cash_requests.id` | `external_event_id`，每次尝试的 UUID |
| `cash_requests.id` | `idempotency_key = aozora-v3:cash-request:<uuid>` |
| income record ID | `external_reference_type = school_income_records` + `external_reference_id` |
| expense record ID | `external_reference_type = school_expense_records` + `external_reference_id` |
| income | `request_type = income_received`, `transaction_type = income` |
| expense | `request_type = expense_paid`, `transaction_type = expense` |
| 提交日期 | `transacted_at`，是预期真实收/付款日期，不用 `created_at` 代替 |
| 后端确认金额 | Cash `amount` / `currency` |
| 业务 snapshot | `payload_snapshot`，含 V3 schema version、来源记录、业务月、原始金额、请求金额和汇率信息 |

Cash 成功创建后，V3 必须保存 Cash `request_id`。同一 V3 `cash_request.id` 重试必须复用原幂等键，不得生成第二个 active Cash 请求。

## 5. Cash → School 回写

Cash approve/reject 后向 School V3 回写：

```text
POST /api/cash/callbacks/request-result
Authorization: Bearer <Cash signed-in user access token>
Content-Type: application/json

{
  "cash_request_id": "<Cash request UUID>",
  "action": "approved | rejected"
}
```

School API 不信任浏览器传入的金额、状态、交易 ID 或拒绝原因。适配器必须：

1. 通过 Cash Auth 验证 bearer token。
2. 用服务端凭据重新读取 `home_external_transaction_requests`。
3. 校验 Cash user、`external_source`、canonical reference type / request type、币种、金额、本地 request ID 和引用的 income / expense ID。
4. approved 必须存在 `created_transaction_id`；rejected 必须不存在 transaction ID。
5. 通过后才更新 V3 `cash_requests` 和对应 income / expense 状态。

成功响应必须明确返回 `ok: true`，供 Cash 前端区分成功回写和业务错误：

```json
{
  "ok": true,
  "action": "approved",
  "idempotent": false,
  "cashRequest": {}
}
```

V3 分别保存：

- Cash request ID：`external_cash_request_id`
- Cash transaction ID：`external_cash_transaction_id`
- Cash 确认时间：`cash_confirmed_at`
- Cash 拒绝原因：`rejection_reason`

重复回写且 payload 一致时返回 idempotent success；状态或外部 ID 冲突时拒绝并进入人工复核，不覆盖原审计事实。

## 6. 状态和失败策略

```text
School pending income / expense
  -> local cash_requested attempt
  -> Cash pending request created
  -> Cash approved -> School cash_confirmed
  -> Cash rejected -> School cash_rejected
```

- 远程创建超时时无法确定 Cash 是否已落库，V3 必须进入 `needs_manual_review`，保存尝试次数、时间和脱敏错误。
- 人工重试复用原幂等键；Cash 已有相同请求时返回原 request ID。
- Cash 已 pending 时，School 不允许本地撤回；在 Cash 增加正式 cancel 合同前，避免造成两端状态分裂。
- `confirm` / `reject` 手动 dev API 只用于 mock 模式；`supabase` 模式只接受经验证的 Cash callback。
- Cash 交易或 School 回写不做跨数据库伪事务回滚。任一端已成功的资金事实必须保留，另一端失败通过幂等重试和审计修复。

## 7. 当前与未来阶段

### 本轮第一阶段

- V3 服务端 Cash gateway、环境隔离配置和可用账户只读接口。
- canonical income / expense pending request 创建。
- Cash approve/reject callback 验证与幂等回写。
- 失败复核与同幂等键重试。
- dev 中保留 mock 模式，不把 mock 请求标记为已完成真实 Cash 联动。

### 后续阶段

- 为 `v3-dev` 创建专用 Cash Auth 用户和测试账户，配置 V3 callback URL，并执行跨系统 approve/reject E2E。
- 补充 Cash 端 pending cancel / withdraw 合同后，再开放 V3 已提交请求撤回。
- 将 Cash 聚合确认结果逐条回写 School canonical records。
- `v3-staging` / `v3-prod` 建立各自凭据、回调 URL、审计告警和运营重试流程，并另行执行 Cash ledger 迁移与对账。
