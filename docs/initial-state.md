# Aozora School System v3 初始状态

记录日期：2026-06-25

最近整理日期：2026-07-06

## 1. 项目路径

```text
/Users/polariss710/Documents/aozora_school_system_v3
```

## 2. Git 状态

当前目录已初始化为 Git 仓库，并已推送到 GitHub：

```text
https://github.com/polariss710/aozora_school_system_v3
```

主分支：

```text
main
```

初始提交：

```text
fddb61f Initialize v3 demo framework and planning docs
```

前端 demo preview 环境：

```text
https://aozora-school-system-v3-demo.onrender.com/
```

## 3. 当前目录结构

当前项目已经从文档目录升级为 v3 monorepo 初始工程：

```text
.
├── apps
│   ├── api
│   └── web
├── docs
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

说明：

- `apps/web` 是 React + TypeScript + Vite 前端 demo。
- `apps/api` 是 NestJS + TypeScript 后端 skeleton。
- `.gitignore` 已排除 `.DS_Store`、`node_modules`、`dist`、`.env` 等本地或敏感文件。

## 4. 已有文档

### `docs/aozora-school-v3-development-plan.md`

内容定位：

- 作为 v3 立项阶段主讨论框架。
- 明确 v2 继续稳定运营并沉淀 v3 需求证据。
- 将 v3 讨论拆成技术底座和 v3.0 主链路两层。
- 记录当前技术栈暂定结论：React + TypeScript + Vite、NestJS + TypeScript、Prisma + PostgreSQL、Render + Supabase。
- 记录暂缓进入 v3.0 的扩展业务。
- 明确 v3 防膨胀原则和当前待讨论问题。

### `docs/environment-strategy.md`

内容定位：

- 总结 v2 中真实数据、测试数据和 Cash 联动测试混用的问题。
- 明确 v3 需要从设计阶段区分 `prod` / `staging` / `dev`。
- 规定生产环境只保存真实业务数据。
- 建议使用显式环境变量命名。
- 记录当前环境策略：Supabase organization 升级到 Pro，开发阶段新增一个 `v3 dev` project，测试 / 上线准备阶段再拆分 `v3 staging` 和 `v3 prod`。
- 记录 v3 不继续使用 Supabase RPC 承担复杂业务逻辑，业务权威层转移到后端 domain service。
- 明确测试数据、删除清理和生产修复原则。

### `docs/project-rules.md`

内容定位：

- 固化 v3 当前阶段项目规则。
- 明确 v2 / v3 边界。
- 记录数据范围、环境隔离、资金操作安全、文档工作方式和待决事项。

### `docs/initial-state.md`

内容定位：

- 记录当前项目路径、Git 状态、目录结构和初始文档状态。
- 作为 v3 初始化阶段的基线说明。

## 5. v3 当前定位摘要

v3 已进入后端 API 第一轮主链路闭合阶段：前端 demo 主框架已确认并部署，后端已从 skeleton 推进到主业务 API 雏形，dev 数据库已接入并完成基础 schema / seed。

当前原则：

- v2 继续作为稳定运营和数据补充来源。
- v2 运营期预计继续覆盖 2-3 个月真实业务，用于沉淀 v3 需求证据。
- v3 已完成立项讨论、技术底座讨论、主链路边界整理和前端 demo 主框架确认。
- 前端 demo 已部署到 Render preview 环境，用于 UI / 页面结构 / 流程确认。
- 后端已建立 NestJS + Prisma API 工程，并已接入 Supabase v3 dev PostgreSQL。
- Prisma 已建立第一版 foundation schema 和 migration。
- dev DB 已执行基础 seed，包含角色、权限、业务归属和 School 侧账户。
- 后端 Controller 路由数约 `143`，已覆盖认证、用户、权限、主数据、学生课时、学生月度结算、学费账单、老师工资、勤务表导入、收入、支出、Cash 请求、Cash 入站、账户流水、报销、外部授课、审计、健康检查和版本信息。
- 当前 API 仍以 dev 联调为目标，前端正式接入前还需要继续整理字段级契约、错误提示口径和列表 / 详情 / 抽屉展示字段。
- v3 初期数据库平台暂定 Supabase paid project；当前重点是快速搭建、快速迁移 v2 数据和验证主链路，而不是一开始采用更重的数据库托管平台。
- v3 技术线暂定为轻量化现代 JS / TS 路线：前端 React + Vite，后端 NestJS，数据访问层 Prisma，部署优先 Render。
- 任何涉及生产数据、Cash 联动、收入、支出、工资、账户流水的设计，都必须先明确环境、权限、审计和验证方式。
- v3.0 当前定位为技术底座 + 主链路 + 数据模型 + 数据迁移，不一次性包含报价、合同、CRM、通知、图片、文件生成等扩展业务。

## 6. 当前未做事项

当前仍未执行以下动作：

- 未连接真实后端 API 到前端。
- 未导入或迁移 v2 数据。
- 未读取或修改 v2 项目。
- 未执行任何生产数据操作。
- 未将 dev API 部署为长期在线后端服务。
- 未建立 staging / prod Supabase project。
- 未建立正式迁移脚本和迁移校验报告。

已完成：

- Git 初始化和 GitHub 推送。
- Render 前端 demo preview 部署。
- `apps/web` 前端 demo 主框架。
- `apps/api` NestJS 后端 API 工程。
- `GET /api/health` 和 `GET /api/version`。
- `MoneyService` 初版金额取舍测试骨架。
- Supabase `aozora-school-v3-dev` project。
- Prisma foundation migration。
- 第一轮主业务 API：
  - 认证、用户、角色和权限。
  - 业务归属、学生、科目、老师、外部授课机构、账户等主数据。
  - 学生预定课时 / 实际课时，包括批量生成、全新预定课时删除、取消、恢复、补课、跨月补课和学生结算锁定保护。
  - 学生月度结算，包括预览、锁定、撤销和导出 payload。
  - 学费账单，包括生成、生成收入、导出 payload 和作废。
  - 老师工资，包括工资规则、预览、锁定、调整、勤务表导出、交通费 / 教室费导入、确认调整和撤销。
  - 收入、支出、Cash 请求、Cash 回写和 Cash 入站。
  - School 侧账户流水、账户内部调拨、报销生成 / 完成 / 作废。
  - 外部授课预定 / 实际课时、月度结算、导出 payload 和收入生成。
  - 审计事件列表和详情查询。
- 基础 seed：
  - 4 个角色：系统管理员、财务负责人、业务人员、销售人员。
  - 21 个权限。
  - 2 个业务归属：青空进学塾、个人名义。
  - 3 个 School 侧账户：法人账户、吴垫付账户、包垫付账户。

## 7. 建议下一步

建议后续按以下顺序推进：

1. 收口后端 API 第一轮缺口：状态机保护、撤销 / 作废边界、导出 payload 和 Cash 回写幂等。
2. 整理字段级 API 契约：列表字段、详情字段、抽屉操作、错误信息和权限要求。
3. 补充稳定测试：MoneyService、关键状态机、Cash 请求、收入 / 支出 / 账户流水一致性。
4. 部署 dev API 到 Render Web Service，并确认前端 preview 能访问 dev API。
5. 前端从 demo preview 逐步接入真实 dev API。
6. 设计 v2 数据迁移脚本和校验报告；真实数据只进入未来 prod，不进入 dev / staging。
