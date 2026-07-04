import {
  AccountType,
  CurrencyCode,
  PrismaClient,
  RecordStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

loadEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

type SeedPermission = {
  code: string;
  name: string;
  description: string;
};

type SeedRole = {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
};

const permissions: SeedPermission[] = [
  {
    code: "system.admin",
    name: "系统管理",
    description: "管理系统级设置、角色权限和高风险操作。",
  },
  {
    code: "audit.read",
    name: "审计读取",
    description: "查看集中审计中心和操作历史。",
  },
  {
    code: "settings.manage",
    name: "基础设置管理",
    description: "管理业务归属、账户、科目等基础设置。",
  },
  {
    code: "users.manage",
    name: "用户与权限管理",
    description: "管理登录用户、角色和权限分配。",
  },
  {
    code: "students.manage",
    name: "学生管理",
    description: "管理学生基础资料。",
  },
  {
    code: "lessons.manage",
    name: "课时管理",
    description: "管理正式预定课时、实际课时和补课登记。",
  },
  {
    code: "tuition_billing.manage",
    name: "学费账单管理",
    description: "生成和管理学生学费账单快照。",
  },
  {
    code: "student_settlements.manage",
    name: "学生月度结算管理",
    description: "生成、锁定、撤销和重锁学生月度结算。",
  },
  {
    code: "teachers.manage",
    name: "老师管理",
    description: "管理老师基础资料和工资规则入口。",
  },
  {
    code: "teacher_wages.manage",
    name: "老师工资管理",
    description: "生成工资快照、处理调整、生成支出记录。",
  },
  {
    code: "teacher_attendance_import.manage",
    name: "勤务表导入",
    description: "导入老师填写的交通费和教室费。",
  },
  {
    code: "external_work.manage",
    name: "外部授课管理",
    description: "管理私塾打工/外部授课课时、结算和收入生成。",
  },
  {
    code: "income.manage",
    name: "收入管理",
    description: "管理收入记录、作废和 Cash 请求。",
  },
  {
    code: "expenses.manage",
    name: "支出管理",
    description: "管理支出记录、作废和 Cash 请求。",
  },
  {
    code: "cash_requests.manage",
    name: "Cash 请求管理",
    description: "向 Cash 端提交收入/支出确认请求并处理拒绝后的重提。",
  },
  {
    code: "cash_inbound.manage",
    name: "Cash 入站管理",
    description: "处理 Cash 端向 School 端发起的法人账户入站请求。",
  },
  {
    code: "accounts.read",
    name: "账户读取",
    description: "查看 School 侧法人账户和垫付账户。",
  },
  {
    code: "account_transactions.read",
    name: "账户流水读取",
    description: "查看 School 侧账户流水。",
  },
  {
    code: "reimbursements.manage",
    name: "报销管理",
    description: "管理垫付支出后的法人账户报销链路。",
  },
  {
    code: "pre_contract.manage",
    name: "签约前功能",
    description: "管理报价单、合同生成和招生跟踪等签约前功能。",
  },
  {
    code: "profit.read",
    name: "利润读取",
    description: "查看利润分析和经营汇总。",
  },
];

const allPermissionCodes = permissions.map((permission) => permission.code);

const roles: SeedRole[] = [
  {
    code: "admin",
    name: "系统管理员",
    description: "拥有 V3 全部权限，负责系统设置、Cash 确认和高风险操作。",
    permissionCodes: allPermissionCodes,
  },
  {
    code: "finance",
    name: "财务负责人",
    description: "负责收入、支出、Cash 请求、账户流水、报销和利润读取。",
    permissionCodes: [
      "audit.read",
      "income.manage",
      "expenses.manage",
      "cash_requests.manage",
      "cash_inbound.manage",
      "accounts.read",
      "account_transactions.read",
      "reimbursements.manage",
      "profit.read",
    ],
  },
  {
    code: "business",
    name: "业务人员",
    description: "负责学生、课时、学费账单和学生月度结算等主业务操作。",
    permissionCodes: [
      "students.manage",
      "lessons.manage",
      "tuition_billing.manage",
      "student_settlements.manage",
      "teachers.manage",
      "teacher_wages.manage",
      "teacher_attendance_import.manage",
      "external_work.manage",
      "accounts.read",
    ],
  },
  {
    code: "sales",
    name: "销售人员",
    description: "负责报价、合同、学生跟踪等签约前功能。",
    permissionCodes: ["pre_contract.manage"],
  },
];

const businessEntities = [
  {
    code: "aozora_school",
    name: "青空进学塾",
    memo: "V3 默认正式业务归属。",
  },
  {
    code: "personal",
    name: "个人名义",
    memo: "保留 V2 既有业务归属，用于迁移和历史口径延续。",
  },
];

const accounts = [
  {
    code: "corporate_jpy",
    name: "法人账户",
    type: AccountType.corporate,
    currency: CurrencyCode.JPY,
    memo: "School 侧法人账户。Cash 账户不在 School 长期账户表中显示。",
  },
  {
    code: "wu_advance_jpy",
    name: "吴垫付账户",
    type: AccountType.advance,
    currency: CurrencyCode.JPY,
    memo: "低频垫付/报销链路使用。",
  },
  {
    code: "bao_advance_jpy",
    name: "包垫付账户",
    type: AccountType.advance,
    currency: CurrencyCode.JPY,
    memo: "低频垫付/报销链路使用。",
  },
];

async function seedPermissions() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        description: permission.description,
        status: RecordStatus.active,
      },
      create: {
        ...permission,
        status: RecordStatus.active,
      },
    });
  }
}

async function seedRoles() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        status: RecordStatus.active,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        status: RecordStatus.active,
      },
    });
  }

  for (const role of roles) {
    const dbRole = await prisma.role.findUniqueOrThrow({
      where: { code: role.code },
      select: { id: true },
    });

    for (const permissionCode of role.permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
        select: { id: true },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: dbRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: dbRole.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedBusinessEntities() {
  for (const businessEntity of businessEntities) {
    await prisma.businessEntity.upsert({
      where: { code: businessEntity.code },
      update: {
        name: businessEntity.name,
        memo: businessEntity.memo,
        status: RecordStatus.active,
      },
      create: {
        ...businessEntity,
        status: RecordStatus.active,
      },
    });
  }
}

async function seedAccounts() {
  for (const account of accounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {
        name: account.name,
        type: account.type,
        currency: account.currency,
        memo: account.memo,
        status: RecordStatus.active,
      },
      create: {
        ...account,
        status: RecordStatus.active,
      },
    });
  }
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedBusinessEntities();
  await seedAccounts();

  const [permissionCount, roleCount, businessEntityCount, accountCount] =
    await Promise.all([
      prisma.permission.count(),
      prisma.role.count(),
      prisma.businessEntity.count(),
      prisma.account.count(),
    ]);

  console.log("Seed completed");
  console.table({
    permissions: permissionCount,
    roles: roleCount,
    businessEntities: businessEntityCount,
    accounts: accountCount,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
