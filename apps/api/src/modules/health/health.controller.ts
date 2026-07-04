import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return {
      service: "aozora-school-v3-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("db")
  async getDatabaseHealth() {
    const database = await this.prisma.checkConnection();

    return {
      service: "aozora-school-v3-api",
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
