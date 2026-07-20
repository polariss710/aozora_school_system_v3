# V2 → V3 普通教学迁移映射与缺口清单

更新日期：2026-07-19  
状态：源结构与 aggregate-only 范围已核验；普通教学业务行尚未导出、未生成普通教学快照、未写入 staging / prod。普通教学迁移批次审计 schema 已单独部署到 staging。

## 1. 依据与边界

本清单基于 School V2 production 的只读结构盘点：`REPEATABLE READ, READ ONLY`，仅访问 `information_schema`，随后 `ROLLBACK`。盘点时间为 `2026-07-19T09:51:45.79436+00:00`；返回 17 张候选表、403 个字段与 36 条外键，没有返回任何业务行。

普通教学长期政策仍从 `2026-07` 起计算；本次初始迁移演练的可导入运营窗口固定为 `2026-07` 至 `2026-12`。主数据只按被选中事实的 UUID 引用闭包带入。不得按名称、金额、创建时间或当前规则推断关联；不得用备注字段拼接替代身份或审计链。

私塾打工与 Cash ledger 已有独立、已演练的程序，不属于本文件的普通教学导入器。

## 2. 已确认的源表与目标去向

| V2 源表 | V3 目标 / 审计去向 | 范围 | 当前结论 |
| --- | --- | --- | --- |
| `school_business_entities` | `business_entities` + `migration_record_audits` | 被迁移事实引用 | V3 现有成对且唯一的 `legacy_table` / `legacy_id`；UUID / code 仍须显式映射，其他源字段必须保存在不可变审计 snapshot。 |
| `school_students` | `students` + 审计 | 引用闭包 | V3 现有成对且唯一的 `legacy_table` / `legacy_id` 加审计 snapshot 保留来源身份；联系方式等非运营字段不得静默丢失。 |
| `school_teachers` | `teachers` + 审计 | 引用闭包 | V3 现有成对且唯一的 `legacy_table` / `legacy_id`；旧付款账户资料和默认币种需先确定 V3 的安全落位，不能写进普通备注。 |
| `school_subjects` | `subjects` + 审计 | 引用闭包 | V3 现有成对且唯一的 `legacy_table` / `legacy_id`；`name/category/sort_order/status` 可映射，颜色、层级分类等需保留在审计 snapshot 或版本化目标扩展。 |
| `school_lesson_records` | `student_planned_lessons`、`student_actual_lessons` + 审计 | `year_month >= 2026-07` | 要按 `lesson_type` / `planned_lesson_id` 定义一一拆分；必须保留原 UUID、planned→actual 关系、时长、费用、状态、作废信息及来源行。 |
| `school_student_monthly_settlements` | `student_monthly_settlements` + 审计 | `year_month >= 2026-07` | 金额、结转、锁定状态和 source snapshot 必须按原值落位，不能按当前汇率重算。 |
| `school_student_settlement_adjustments` | 月结 `adjustment_amount_cny` / `calculation_snapshot` + 单行审计 | 跟随月结 | V3 没有独立 adjustment 表；必须先定义多条来源调整如何无损写入 snapshot 与审计，未定义前不得导入。 |
| `school_student_settlement_carryovers` | 月结前后结转字段 / `calculation_snapshot` + 单行审计 | 进入范围月及其必要前序引用 | V3 没有独立 carryover 表；必须验证唯一前序链与金额不变，再决定是否需要版本化承载表。 |
| `school_student_tuition_bills` | `student_tuition_bills`、`income_records` + 审计 | `billing_month >= 2026-07` | 原 UUID、版本、替代关系、账单快照、收入引用与取消状态须保留；收入链只可迁移一次，禁止在 V3 重建重复收入。 |
| `school_teacher_wage_rules` | `teacher_wage_rules` + 审计 | 被范围内工资 / 课时使用的规则闭包 | **结构缺口**：V2 规则可按 teacher + business entity + subject + student，并含 CNY / 汇率 / 交通与场地费；V3 当前只允许 teacher + business entity 的单一时薪。必须先版本化扩展或把历史规则限定为审计-only，不能静默折叠。 |
| `school_teacher_wage_locks` | `teacher_wage_snapshots`、`expense_records` + 审计 | `settlement_month >= 2026-07` | 需保留原 UUID、版本、锁定 / 作废状态、JPY/CNY 历史金额、费用与来源快照。 |
| `school_teacher_wage_lock_details` | `teacher_wage_snapshot_details` + 审计 | 跟随工资快照 | 要以原 lesson UUID 关联；V3 当前详情缺少旧 CNY、汇率、交通 / 场地及状态字段，需放入不可变 snapshot 或扩展后再导入。 |
| `school_teacher_wage_detail_adjustments` | 工资快照 `manual_adjustment_jpy` / `calculation_snapshot` + 单行审计 | 跟随工资快照 | **结构缺口**：V3 没有独立明细调整历史；多条调整的前后值与原因必须可逐条审计。 |
| `school_income_records` | `income_records` + 审计；Cash 仅按已批准的 ledger 迁移合同解析 | 跟随已选业务链 | 原币种、原金额、状态、冲销 / 取消、来源快照均要保留；不得生成新的 Cash request。 |
| `school_expense_records` | `expense_records` + 审计；Cash 仅按已批准的 ledger 迁移合同解析 | 跟随已选业务链 | 原币种、原金额、工资 / 业务来源、状态、报销 / 冲销信息均需保留；历史已支付但无 V3 Cash 身份的行使用 `historical_confirmed`，不得重建付款或 Cash request。 |
| `school_expense_attachments` | 独立受控附件迁移清单 + 审计 | 仅被迁移支出引用 | **结构缺口**：V3 当前没有附件元数据 / storage 目标模型。没有文件哈希、对象复制、访问控制和回滚方案时不得搬运或丢弃附件。 |
| `school_payment_requests` | 仅 legacy 审计承载（必要时 `migration_record_audits` / 专用承载） | 仅被已选收入 / 支出链引用 | 不映射为新的 V3 `cash_requests`；必须先确认 source type、付款 / 冲销 / reissue 关系和 Cash ledger ID 的唯一去向。 |

## 3. 已确认的引用顺序

普通教学导入器未来只能按以下顺序写入，并在每一步验证 UUID 引用：

```text
business entities / students / teachers / subjects
→ planned lessons → actual lessons
→ student settlements / bills / income
→ wage rules (如已完成扩展) → wage snapshots / details / adjustments / expense
→ attachment metadata（如已完成附件方案）
→ legacy payment-request audit
→ Cash ledger reference reconciliation
```

`school_lesson_records`、月结、账单、工资、收入和支出都带有到主数据的外键；工资明细还依赖课时，账单依赖学生和收入，调整依赖锁定明细。任何一个来源 UUID 无法解析时，整批应停止，不得部分成功后通过手工补行继续。

## 4. 上线前阻断项

已完成的基础前置：

- 已创建版本化 `core_teaching_migration_batches`，并为 `migration_record_audits` 增加受外键约束的 `core_teaching_batch_id`。两种 batch 不能同时归属；staging 验收确认表、字段、约束及浏览器角色零 grant 均正常。
- `business_entities`、`students`、`teachers` 与 `subjects` 已补齐成对且唯一的 legacy source identity。该结构只保存未来受控 mapping 的来源表 / ID，不读取、写入或推断 production 数据。
- 已完成 aggregate-only 范围盘点、引用闭包与关键孤儿核验；它不等同 source snapshot。

以下项目仍未完成，因此普通教学目前不能形成 snapshot 或 persistent importer：

1. 决定并实施 V2 多维工资规则、工资明细 CNY / 费用 / 汇率、逐条工资调整的无损目标模型。
2. 决定学生月结 adjustment / carryover 的逐条历史承载方式，并证明目标月结快照可回放来源值。
3. 建立附件对象的加密复制、哈希、权限、删除回滚和 source → target path 映射；或由业务明确批准保留 V2 只读附件且在审计中记录该例外。
4. 为 legacy payment request 定义只读审计承载和 Cash transaction / request 身份对账，明确不创建 V3 `cash_requests`。
5. 新增受控 JSON snapshot 合同；该 snapshot 必须位于仓库外、权限 `600`，并以 SHA-256 固定。
6. 普通教学 persistent importer 必须沿用 staging-only / 双确认 / production-ref 拒绝 / 单事务 / 幂等重跑 / 零新 Cash request 的防线；通过 staging 演练后，才能进入 final delta / freeze 设计。

## 5. 本次结构盘点结论

- 17 / 17 候选源表存在，普通教学迁移的源表命名和字段基线可据此冻结。
- 盘点发现 36 条源侧外键；字段差异是 V3 需要先补齐的真实建模事项，不是可在导入脚本中临时忽略的事项。
- production 本次没有导出业务行、没有复制数据、没有写入、没有冻结；现行 School 和 Cash production 仍可继续正常写入。

## 6. `2026-07` 至 `2026-12` 初始演练汇总基线

结构盘点后，已运行同样只读、rollback 的 aggregate-only 合同。它只返回按业务月、状态与币种汇总的计数 / 金额，以及不带身份的引用闭包和孤儿数。

- 当前范围内有聚合结果的来源模块只有课时、账单、收入和支出；月结、工资锁定及其明细 / 调整、结转、附件和 payment request 均为零。
- 引用闭包汇总为 2 个业务归属、6 名学生、8 名老师、7 个科目；未返回任何 UUID、姓名、课时内容或其他业务行。
- `wage detail → lesson`、`wage adjustment → lock`、`attachment → expense`、`carryover → settlement` 四项孤儿检查均为零。

这是一份当前 cutoff 的范围基线，不是 source snapshot，更不是上线导入授权。production 继续写入时，未来 final delta / freeze 必须重新生成相同合同的结果。

本仓库还提供 `assess-core-teaching-aggregate-readiness.mjs`，只消费上述 aggregate JSON。它将工资明细 / 调整、结转、附件、payment request、引用孤儿与 actual→planned 状态组合设为硬门禁；任一不满足即拒绝准备受限快照。通过仅表示当前窗口可进入“行级 snapshot 合同设计”，不表示已授权 persistent importer、Cash 创建或 production cutover。

## 7. 课时与远期异常结论

- 汇总确认 25 条 actual 课时都通过 `planned_lesson_id` 连接到 source planned 课时，缺失关联为 0；其中 20 条 completed、4 条 makeup completed、1 条 cancelled。没有无计划来源的 actual 课时。
- 计划课时中，普通计划完成后对应 V3 `actual_created`，补课待定完成后对应 `makeup_completed`，待补课且未完成对应 `makeup_pending`；actual cancelled 保留为 V3 actual cancelled，并让其来源计划维持可排课状态。所有来源状态和原字段仍要进入逐行 audit snapshot。
- 在 `2026-07` 至 `2026-12` 范围外发现 3 条远期收入汇总，业务月为 `2099`；没有同类远期课时或支出。它们不代表本次普通教学迁移范围，不会复制、删除或修改，必须留在独立异常清单，待业务另行决定其处置。
