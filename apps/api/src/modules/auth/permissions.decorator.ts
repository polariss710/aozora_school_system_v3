import { SetMetadata } from "@nestjs/common";

export const requiredPermissionsMetadataKey = "requiredPermissions";

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(requiredPermissionsMetadataKey, permissions);
}
