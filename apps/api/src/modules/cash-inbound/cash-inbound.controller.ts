import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { AuthenticatedUser } from "../users/users.types";
import { CashInboundService } from "./cash-inbound.service";
import {
  CreateCashInboundEventBody,
  ListCashInboundEventsQuery,
} from "./cash-inbound.types";

@Controller("cash-inbound")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CashInboundController {
  constructor(
    @Inject(CashInboundService)
    private readonly cashInboundService: CashInboundService,
  ) {}

  @Get("events")
  @RequirePermissions("cash_inbound.manage")
  listEvents(@Query() query: ListCashInboundEventsQuery) {
    return this.cashInboundService.listEvents(query);
  }

  @Get("events/:id")
  @RequirePermissions("cash_inbound.manage")
  getEvent(@Param("id") id: string) {
    return this.cashInboundService.getEvent(id);
  }

  @Post("events")
  @RequirePermissions("cash_inbound.manage")
  createEvent(
    @Body() body: CreateCashInboundEventBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashInboundService.createEvent(body, user.id);
  }
}
