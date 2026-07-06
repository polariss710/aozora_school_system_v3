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

  getMoneyRules() {
    return {
      authorityLayer: "backend_domain_service",
      frontendPolicy: {
        canDisplayBackendAmounts: true,
        canCollectExplicitUserInputs: true,
        canDisplayNonPersistentPreview: true,
        cannotRoundBusinessAmounts: true,
        cannotSubmitDerivedBusinessAmounts: true,
      },
      currencies: [
        {
          currency: "JPY",
          fractionDigits: 0,
          businessAmountType: "integer",
        },
        {
          currency: "CNY",
          fractionDigits: 2,
          businessAmountType: "decimal_12_2",
        },
      ],
      exchangeRate: {
        inputPrecision: "decimal_18_8",
        submittedByUser: true,
        businessAmountPrecision:
          "Converted amounts are confirmed to target currency precision by backend.",
      },
      roundingPolicy: {
        mode: "half_away_from_zero",
        appliesTo: [
          "positive_amounts",
          "negative_amounts",
          "offsets",
          "carryover",
          "cash_request_amounts",
          "account_transactions",
        ],
      },
      mismatchPolicy: {
        frontendSubmittedDerivedAmount:
          "reject_when_it_does_not_match_backend_confirmed_amount",
      },
    };
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
