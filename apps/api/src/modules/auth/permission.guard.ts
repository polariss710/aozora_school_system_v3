import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthenticatedRequest } from "./auth.types";
import { requiredPermissionsMetadataKey } from "./permissions.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      requiredPermissionsMetadataKey,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authenticated user is required.");
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissionCodes.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException("Insufficient permissions.");
    }

    return true;
  }
}
