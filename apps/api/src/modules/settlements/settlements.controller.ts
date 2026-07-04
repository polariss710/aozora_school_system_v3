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
import { SettlementsService } from "./settlements.service";
import {
  ListStudentSettlementsQuery,
  LockStudentSettlementBody,
  PreviewStudentSettlementBody,
  RevokeStudentSettlementBody,
} from "./settlements.types";

@Controller("settlements")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettlementsController {
  constructor(
    @Inject(SettlementsService)
    private readonly settlementsService: SettlementsService,
  ) {}

  @Get("student")
  @RequirePermissions("student_settlements.manage")
  listStudentSettlements(@Query() query: ListStudentSettlementsQuery) {
    return this.settlementsService.listStudentSettlements(query);
  }

  @Get("student/:id")
  @RequirePermissions("student_settlements.manage")
  getStudentSettlement(@Param("id") id: string) {
    return this.settlementsService.getStudentSettlement(id);
  }

  @Post("student/preview")
  @RequirePermissions("student_settlements.manage")
  previewStudentSettlement(@Body() body: PreviewStudentSettlementBody) {
    return this.settlementsService.previewStudentSettlement(body);
  }

  @Post("student/lock")
  @RequirePermissions("student_settlements.manage")
  lockStudentSettlement(
    @Body() body: LockStudentSettlementBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settlementsService.lockStudentSettlement(body, user.id);
  }

  @Post("student/:id/revoke")
  @RequirePermissions("student_settlements.manage")
  revokeStudentSettlement(
    @Param("id") id: string,
    @Body() body: RevokeStudentSettlementBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settlementsService.revokeStudentSettlement(id, body, user.id);
  }
}
