import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      service: "aozora-school-v3-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
