# V2 → V3 私塾打工迁移映射草案

更新日期：2026-07-19

## 状态与边界

本文依据 V2 仓库中的版本化 SQL 与 V3 Prisma schema 建立代码级映射，不包含 production 查询结果，不授权执行导入、修改现行 School/Cash、创建 `v3-prod` 或写入 staging。

迁移范围固定为私塾打工 2026 结算年度，即 `2025-12` 至 `2026-11`。范围只按 `year_month` 判断，不按创建时间、到账日或 Cash 交易日裁剪。

V3 prod 已确定为 School + Cash 共置的新 project；现行 Cash production ledger 未来必须由独立 Cash ledger 迁移程序搬入，School 迁移不得生成替代 Cash 流水。

## 表级映射

| V2 来源 | V3 目标 | 身份政策 | 当前结论 |
| --- | --- | --- | --- |
| `school_historical_part_time_work_import_batches` | 待新增历史迁移批次表 | 原 batch UUID 必须沿用 | V3 当前无承载表，schema blocker |
| `school_part_time_work_lessons` | `external_work_lessons` | 原 lesson UUID 沿用；planned/actual 关系保持 | 业务字段可映射；历史批次、原行号、软删除审计尚无承载 |
| `school_part_time_work_monthly_settlements` | `external_work_monthly_settlements` | 原 settlement UUID 沿用 | 主金额可映射；V2 状态与 V3 状态需受控转换 |
| `school_part_time_work_monthly_settlement_details` | `external_work_settlement_details` | 原 detail UUID 沿用 | 可直接保持 settlement / actual lesson 引用 |
| `school_income_records` | `income_records` | 原 income UUID 沿用 | `source_snapshot` 与历史确认状态尚无完整承载 |
| `school_personal_cash_income_linkage_events` | 待新增 history-only linkage 表；必要时另建 V3 `cash_requests` 引用 | 原 event UUID、幂等键和 Cash identity 原样保留 | 不得把 `historical_confirmed` 伪造成 Cash transaction |
| `school_part_time_work_income_requests` | 只迁移仍被正式链引用的 legacy request audit | 原 request UUID 沿用 | 实际引用数量待只读盘点 |
| Cash `home_*` ledger | V3 prod `home_*` | 原 account/request/transaction/batch/FX UUID 保留 | 独立 Cash ledger 迁移阶段，不由本文程序写入 |

## 课时逐字段映射

| V2 `school_part_time_work_lessons` | V3 `external_work_lessons` | 规则 |
| --- | --- | --- |
| `id` | `id` | 原 UUID |
| `workplace_name` | `workplace_id` | 通过受控 workplace mapping 精确解析；禁止模糊名称匹配 |
| `year_month` | `year_month` | 原值，且必须位于迁移年度 |
| `record_kind` | `lesson_type` | `planned → planned`，`actual → actual` |
| `planned_lesson_id` | `planned_lesson_id` | actual 必须解析到同批或引用闭包中的 planned |
| `work_date` | `lesson_date` | 原值 |
| `start_time` / `end_time` | `start_time` / `end_time` | 规范化为 `HH:MM`，时间含义不变 |
| `planned_hours` / `actual_hours` | `duration_hours` | planned 使用 `planned_hours`；actual 使用 `actual_hours` |
| `teacher_name` | `instructor_name` | snapshot 原值，不映射普通教学老师主数据 |
| `subject_name` | `lesson_title` | 原值 |
| `class_description` | `content` | 原值 |
| `hourly_rate_jpy` | `hourly_rate_jpy` | 原值，不按当前规则重算 |
| `transportation_fee_jpy` | `transportation_fee_jpy` | 原值 |
| `lesson_wage_jpy` | `lesson_wage_jpy` | 原值，不按时长重算 |
| `memo` | `memo` | 原值 |
| `historical_import_batch_id` | 待新增 provenance FK | 原 UUID |
| `historical_source_row` | 待新增 provenance 字段 | 原正整数 |
| `lesson_count` / `cumulative_hours` | 历史 source snapshot | 仅为 V2 展示字段，不进入 V3 工资计算，但不得丢失 |
| `created_at` / `updated_at` / `deleted_at` | 目标时间戳 + 历史 source snapshot | 原时间必须保留；软删除转换待只读盘点后冻结 |

## 结算与明细映射

- `actual_lesson_count → lesson_count`。
- `actual_hours_total → total_lesson_hours`。
- `lesson_wage_jpy`、`transportation_fee_jpy`、`adjustment_jpy → adjustment_amount_jpy`、`total_wage_jpy → total_amount_jpy` 原样迁移。
- `locked → locked`；`income_request_created` 只有在正式 income 引用完整时转换为 `income_created`。
- V2 `draft` 不得直接进入 V3 运营结算；是否作为 history-only 记录保留，待只读盘点数量后决定。
- detail 的 `settlement_id`、`actual_lesson_id`、日期、时间、时长、老师/科目 snapshot 和金额全部原样迁移；`lesson_count`、`cumulative_hours`、`memo` 进入历史 source snapshot。
- settlement 的 `calculation_snapshot` 必须保存 V2 原始聚合字段、来源 detail UUID 清单和迁移程序版本，禁止用 V3 当前算法重算历史金额。

## Income 与 Cash linkage 映射

- V2 income 的 `id`、`source_type`、`source_id`、币种、金额、日期、状态和 `source_snapshot` 必须保留。
- `source_type=external_part_time_work` 的 `source_id` 必须解析到同一原 UUID 的 V3 settlement。
- `historical_confirmed` linkage 不存在 Cash transaction：V3 必须保留 history-only event，income 不得创建虚构 `cash_request` 或 `home_*_transaction`。
- `synced` linkage 必须原样保存 `cash_user_id`、`cash_account_id`、账户 snapshot、transaction table、transaction ID、payment currency / rate / amount、幂等键和确认时间；对应 Cash transaction 只能由独立 Cash ledger 迁移程序导入。
- pending / rejected / failed / blocked 事件是否进入运营 `cash_requests`，取决于冻结时最终状态和实际引用闭包；不得只按状态批量转换。
- V2 `business_entity_id` 作为 legacy snapshot 保存，不用于给私塾打工补造 V3 普通教学业务归属。

## 目标 schema 必补能力

正式迁移程序前至少需要版本化实现：

1. 历史迁移批次表：保存原 batch UUID、source key、SHA-256、文件名、期间、预期行数/金额、result snapshot 与导入时间。
2. 迁移记录审计表：保存 source system/table/UUID、target table/UUID、原始 row snapshot、内容 SHA-256、migration batch 和程序版本；source 与 target 均一对一。
3. `external_work_lessons` 的历史 batch / source row 可查询身份，以及 `(batch, source row, lesson type)` 唯一约束。
4. history-only income linkage 表：完整保存 V2 event 和 Cash identity，但不参与 V3 新业务状态流转。
5. 能区分 `historical_confirmed` 与真实 `cash_confirmed` 的 income 历史状态或等价不可变审计表示。
6. 对上述历史表的普通 API 写入禁用；只允许迁移执行角色插入，运营端只读。

## 迁移顺序

```text
历史 batch
→ workplace 精确 mapping
→ planned lessons
→ actual lessons
→ settlements
→ settlement details
→ income records
→ history-only linkage / referenced legacy requests
→ 独立 Cash ledger identity 对账
→ migration record audits
```

同一批次重跑必须新增 0 条业务记录、0 条 linkage event、0 条 Cash transaction。

## 执行前必须由只读盘点回答

- 迁移年度内 active / soft-deleted planned、actual 各有多少条；是否存在被正式 detail 引用的 soft-deleted lesson。
- draft / locked / income_request_created settlement 各有多少条，是否存在重复 active workplace-month。
- settlement、detail、income、linkage 和 legacy request 是否存在孤儿或多重引用。
- `historical_confirmed`、`synced`、pending/rejected/failed/blocked linkage 的数量和金额。
- `synced` Cash transaction ID 是否全部非空、唯一，并能在 Cash production 只读盘点中解析。
- V2 source UUID 与空 V3 prod 目标是否存在任何冲突。

这些问题未回答前，不生成正式 migration DML，不导入 staging/prod 数据。
