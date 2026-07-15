import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { CashService } from "./cash.service";
import { CashRequestResultCallbackBody } from "./cash.types";

@Controller("cash/callbacks")
export class CashCallbackController {
  constructor(@Inject(CashService) private readonly cashService: CashService) {}

  @Post("request-result")
  applyRequestResult(
    @Body() body: CashRequestResultCallbackBody,
    @Headers("authorization") authorization?: string,
  ) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) {
      throw new UnauthorizedException("Cash bearer token is required.");
    }

    return this.cashService.applyExternalRequestResult(body, token);
  }
}
