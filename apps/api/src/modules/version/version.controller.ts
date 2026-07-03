import { Controller, Get } from "@nestjs/common";

@Controller("version")
export class VersionController {
  @Get()
  getVersion() {
    return {
      service: "aozora-school-v3-api",
      version: "0.0.1",
      stage: "api-skeleton",
    };
  }
}
