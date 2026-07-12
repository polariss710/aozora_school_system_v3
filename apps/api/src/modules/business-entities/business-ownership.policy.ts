import { BadRequestException } from "@nestjs/common";
import { RecordStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export const defaultOperationalBusinessEntityCode = "aozora_school";

export function getOperationalBusinessEntityCode() {
  return (
    process.env.OPERATIONAL_BUSINESS_ENTITY_CODE?.trim() ||
    defaultOperationalBusinessEntityCode
  );
}

export function isOperationalBusinessEntityCode(code: string) {
  return code === getOperationalBusinessEntityCode();
}

export async function resolveOperationalBusinessEntityId(
  prisma: PrismaService,
  requestedId?: string | null,
) {
  const operationalEntity = await prisma.businessEntity.findUnique({
    where: { code: getOperationalBusinessEntityCode() },
    select: { id: true, status: true },
  });

  if (!operationalEntity || operationalEntity.status !== RecordStatus.active) {
    throw new BadRequestException(
      "Operational business entity is not active or does not exist.",
    );
  }

  if (requestedId && requestedId !== operationalEntity.id) {
    throw new BadRequestException(
      "New business must belong to the operational business entity.",
    );
  }

  return operationalEntity.id;
}
