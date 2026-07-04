import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBusinessEntities() {
    const items = await this.prisma.businessEntity.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        memo: true,
      },
    });

    return { items };
  }

  async listAccounts() {
    const items = await this.prisma.account.findMany({
      orderBy: [{ status: "asc" }, { type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        currency: true,
        status: true,
        memo: true,
      },
    });

    return { items };
  }

  async listRoles() {
    const items = await this.prisma.role.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
      },
    });

    return { items };
  }

  async listPermissions() {
    const items = await this.prisma.permission.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
      },
    });

    return { items };
  }

  async listSubjects() {
    const items = await this.prisma.subject.findMany({
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        sortOrder: true,
        status: true,
        memo: true,
      },
    });

    return { items };
  }

  async listExternalWorkplaces() {
    const items = await this.prisma.externalWorkplace.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        memo: true,
      },
    });

    return { items };
  }
}
