import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { AuthenticatedUser } from "../users/users.types";
import { PreContractService } from "./pre-contract.service";
import { ListQuotesQuery, QuoteWriteBody } from "./pre-contract.types";

@Controller("pre-contract/quotes")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PreContractController {
  constructor(@Inject(PreContractService) private readonly service: PreContractService) {}

  @Get()
  @RequirePermissions("pre_contract.manage")
  list(@Query() query: ListQuotesQuery) { return this.service.listQuotes(query); }

  @Get(":id")
  @RequirePermissions("pre_contract.manage")
  get(@Param("id") id: string) { return this.service.getQuote(id); }

  @Post()
  @RequirePermissions("pre_contract.manage")
  create(@Body() body: QuoteWriteBody, @CurrentUser() user: AuthenticatedUser) { return this.service.createQuote(body, user.id); }

  @Patch(":id")
  @RequirePermissions("pre_contract.manage")
  update(@Param("id") id: string, @Body() body: QuoteWriteBody, @CurrentUser() user: AuthenticatedUser) { return this.service.updateQuote(id, body, user.id); }

  @Post(":id/archive")
  @RequirePermissions("pre_contract.manage")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) { return this.service.archiveQuote(id, user.id); }
}
