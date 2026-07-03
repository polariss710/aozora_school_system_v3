# Aozora School System v3 初始状态

记录日期：2026-06-25

最近整理日期：2026-07-04

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

v3 已进入正式工程准备阶段：前端 demo 主框架已确认，后端 skeleton 已开始建立。

当前原则：

- v2 继续作为稳定运营和数据补充来源。
- v2 运营期预计继续覆盖 2-3 个月真实业务，用于沉淀 v3 需求证据。
- v3 已完成立项讨论、技术底座讨论、主链路边界整理和前端 demo 主框架确认。
- 前端 demo 已部署到 Render preview 环境，用于 UI / 页面结构 / 流程确认。
- 后端已建立 NestJS skeleton，但尚未接入真实数据库。
- v3 初期数据库平台暂定 Supabase paid project；当前重点是快速搭建、快速迁移 v2 数据和验证主链路，而不是一开始采用更重的数据库托管平台。
- v3 技术线暂定为轻量化现代 JS / TS 路线：前端 React + Vite，后端 NestJS，数据访问层 Prisma，部署优先 Render。
- 任何涉及生产数据、Cash 联动、收入、支出、工资、账户流水的设计，都必须先明确环境、权限、审计和验证方式。
- v3.0 当前定位为技术底座 + 主链路 + 数据模型 + 数据迁移，不一次性包含报价、合同、CRM、通知、图片、文件生成等扩展业务。

## 6. 当前未做事项

当前仍未执行以下动作：

- 未创建 Supabase v3 dev project。
- 未写入真实 `DATABASE_URL`。
- 未创建数据库 migration。
- 未连接真实后端 API 到前端。
- 未导入或迁移 v2 数据。
- 未读取或修改 v2 项目。
- 未执行任何生产数据操作。

已完成：

- Git 初始化和 GitHub 推送。
- Render 前端 demo preview 部署。
- `apps/web` 前端 demo 主框架。
- `apps/api` NestJS 后端 skeleton。
- `GET /api/health` 和 `GET /api/version`。
- `MoneyService` 初版金额取舍测试骨架。

## 7. 建议下一步

建议后续按以下顺序推进：

1. 完成后端底座：NestJS module skeleton、MoneyService、Prisma placeholder、health/version。
2. 确认第一版数据模型草案，再决定何时创建 Supabase v3 dev project。
3. 创建 Supabase v3 dev project 后，补充真实 `.env`，开始 Prisma migration。
4. 优先实现金额层、认证权限骨架和主链路基础 API。
5. 前端继续作为 demo preview，根据主链路 API 逐步接入真实 dev API。
