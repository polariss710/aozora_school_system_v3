import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { getJwtSecret } from "./auth.config";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordService } from "./password.service";
import { PermissionGuard } from "./permission.guard";

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAuthGuard, PermissionGuard],
  exports: [
    JwtModule,
    UsersModule,
    AuthService,
    PasswordService,
    JwtAuthGuard,
    PermissionGuard,
  ],
})
export class AuthModule {}
