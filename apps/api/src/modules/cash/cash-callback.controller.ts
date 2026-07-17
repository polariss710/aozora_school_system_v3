import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { CashService } from "./cash.service";
import {
  CashFxInboundCallbackBody,
  CashFxInboundOptionsQuery,
  CashRequestResultCallbackBody,
} from "./cash.types";

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

  @Get("fx-inbound/options")
  getFxInboundOptions(
    @Query() query: CashFxInboundOptionsQuery,
    @Headers("authorization") authorization?: string,
  ) {
    return this.cashService.getExternalFxInboundOptions(
      query,
      this.requireBearerToken(authorization),
    );
  }

  @Post("fx-inbound")
  applyFxInbound(
    @Body() body: CashFxInboundCallbackBody,
    @Headers("authorization") authorization?: string,
  ) {
    return this.cashService.applyExternalFxInbound(
      body,
      this.requireBearerToken(authorization),
    );
  }

  private requireBearerToken(authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) {
      throw new UnauthorizedException("Cash bearer token is required.");
    }
    return token;
  }
}
