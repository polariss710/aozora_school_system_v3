import { Inject, Injectable } from "@nestjs/common";
import { Prisma, RecordStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuthUserRecord, AuthenticatedUser } from "./users.types";

type UserWithAccess = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.findUserWithAccess({ email });

    return user ? this.toAuthUserRecord(user) : null;
  }

  async findAuthUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.findUserWithAccess({ id });

    return user ? this.toAuthenticatedUser(user) : null;
  }

  private async findUserWithAccess(where: { id: string } | { email: string }) {
    return this.prisma.user.findFirst({
      where: {
        ...where,
        status: UserStatus.active,
      },
      include: {
        userRoles: {
          where: {
            role: {
              status: RecordStatus.active,
            },
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  where: {
                    permission: {
                      status: RecordStatus.active,
                    },
                  },
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private toAuthUserRecord(user: UserWithAccess): AuthUserRecord {
    return {
      ...this.toAuthenticatedUser(user),
      passwordHash: user.passwordHash,
    };
  }

  private toAuthenticatedUser(user: UserWithAccess): AuthenticatedUser {
    const roleCodes = user.userRoles.map((userRole) => userRole.role.code);
    const permissionCodes = [
      ...new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map(
            (rolePermission) => rolePermission.permission.code,
          ),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roleCodes,
      permissionCodes,
    };
  }
}
