import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { AuthenticatedUser } from "../users/users.types";
import { jwtExpiresIn } from "./auth.config";
import { LoginRequestBody } from "./auth.types";
import { PasswordService } from "./password.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  async login(body: LoginRequestBody) {
    const email = this.normalizeEmail(body.email);
    const password = this.normalizePassword(body.password);

    const user = await this.usersService.findAuthUserByEmail(email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roleCodes: user.roleCodes,
      permissionCodes: user.permissionCodes,
    };

    const accessToken = await this.jwtService.signAsync(
      {
        email: authenticatedUser.email,
      },
      {
        subject: authenticatedUser.id,
        expiresIn: jwtExpiresIn,
      },
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: jwtExpiresIn,
      user: authenticatedUser,
    };
  }

  private normalizeEmail(email: unknown) {
    if (typeof email !== "string" || !email.trim()) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return email.trim().toLowerCase();
  }

  private normalizePassword(password: unknown) {
    if (typeof password !== "string" || !password) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return password;
  }
}
