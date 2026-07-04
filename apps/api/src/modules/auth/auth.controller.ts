import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthenticatedUser } from "../users/users.types";
import { AuthService } from "./auth.service";
import { LoginRequestBody } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() body: LoginRequestBody) {
    return this.authService.login(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      user,
    };
  }
}
