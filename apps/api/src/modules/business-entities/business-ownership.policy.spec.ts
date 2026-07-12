import { BadRequestException } from "@nestjs/common";
import { RecordStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultOperationalBusinessEntityCode,
  getOperationalBusinessEntityCode,
  isOperationalBusinessEntityCode,
  resolveOperationalBusinessEntityId,
} from "./business-ownership.policy";

describe("business ownership policy", () => {
  const originalCode = process.env.OPERATIONAL_BUSINESS_ENTITY_CODE;

  afterEach(() => {
    if (originalCode === undefined) {
      delete process.env.OPERATIONAL_BUSINESS_ENTITY_CODE;
    } else {
      process.env.OPERATIONAL_BUSINESS_ENTITY_CODE = originalCode;
    }
  });

  it("uses aozora_school as the default operational entity code", () => {
    delete process.env.OPERATIONAL_BUSINESS_ENTITY_CODE;

    expect(getOperationalBusinessEntityCode()).toBe(
      defaultOperationalBusinessEntityCode,
    );
    expect(isOperationalBusinessEntityCode("aozora_school")).toBe(true);
    expect(isOperationalBusinessEntityCode("personal")).toBe(false);
  });

  it("defaults new business records to the operational entity", async () => {
    const prisma = {
      businessEntity: {
        findUnique: vi.fn().mockResolvedValue({
          id: "aozora-id",
          status: RecordStatus.active,
        }),
      },
    };

    await expect(
      resolveOperationalBusinessEntityId(prisma as never, null),
    ).resolves.toBe("aozora-id");
  });

  it("rejects a different entity for new business", async () => {
    const prisma = {
      businessEntity: {
        findUnique: vi.fn().mockResolvedValue({
          id: "aozora-id",
          status: RecordStatus.active,
        }),
      },
    };

    await expect(
      resolveOperationalBusinessEntityId(prisma as never, "personal-id"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects writes when the operational entity is not active", async () => {
    const prisma = {
      businessEntity: {
        findUnique: vi.fn().mockResolvedValue({
          id: "aozora-id",
          status: RecordStatus.archived,
        }),
      },
    };

    await expect(
      resolveOperationalBusinessEntityId(prisma as never, null),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
