# Aozora School System v3 初始状态

记录日期：2026-06-25

最近整理日期：2026-06-26

## 1. 项目路径

```text
/Users/polariss710/Documents/aozora_school_system_v3
```

## 2. Git 状态

已执行：

```bash
git status --short
```

结果：

```text
fatal: not a git repository (or any of the parent directories): .git
```

结论：

- 当前目录尚未初始化为 Git 仓库。
- 暂无可记录的 tracked / modified / untracked Git 状态。
- 后续如进入正式开发，应先决定是否在当前目录执行 `git init`。

## 3. 当前目录结构

已读取项目目录结构，当前内容如下：

```text
.
├── .DS_Store
└── docs
    ├── aozora-school-v3-development-plan.md
    ├── environment-strategy.md
    ├── initial-state.md
    └── project-rules.md
```

说明：

- 当前项目主要由文档组成，尚未发现前端、后台、数据库 migration 或部署代码。
- `.DS_Store` 是 macOS 本地系统文件，后续初始化 Git 时建议加入 `.gitignore`。

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

v3 是未来全面重构前端和后台程序的正式系统准备目录。

当前原则：

- v2 继续作为稳定运营和数据补充来源。
- v2 运营期预计继续覆盖 2-3 个月真实业务，用于沉淀 v3 需求证据。
- v3 暂时以立项讨论、技术底座讨论、主链路边界整理、环境策略整理为主。
- 未进入正式开发前，不急于创建前端或后台代码。
- v3 初期数据库平台暂定 Supabase paid project；当前重点是快速搭建、快速迁移 v2 数据和验证主链路，而不是一开始采用更重的数据库托管平台。
- v3 技术线暂定为轻量化现代 JS / TS 路线：前端 React + Vite，后端 NestJS，数据访问层 Prisma，部署优先 Render。
- 任何涉及生产数据、Cash 联动、收入、支出、工资、账户流水的设计，都必须先明确环境、权限、审计和验证方式。
- v3.0 当前定位为技术底座 + 主链路 + 数据模型 + 数据迁移，不一次性包含报价、合同、CRM、通知、图片、文件生成等扩展业务。

## 6. 当前未做事项

本次初始化未执行以下动作：

- 未初始化 Git。
- 未创建前端项目。
- 未创建后台项目。
- 未创建数据库 migration。
- 未连接 Supabase。
- 未读取或修改 v2 项目。
- 未执行任何生产数据操作。

## 7. 建议下一步

建议后续按以下顺序推进：

1. 继续用 v2 真实运营记录 v3 需求证据。
2. 先讨论 v3 技术底座：前端、后端、平台、数据库、认证权限。
3. 明确 v3.0 主链路边界和核心数据模型。
4. 梳理主链路状态机和锁定 / 只读 / 冲销规则。
5. 决定数据迁移范围前，先完成 v2 数据和业务链路盘点。
6. Git 初始化、`.gitignore`、项目脚手架等工程动作暂不着急，等进入实现阶段再处理。
