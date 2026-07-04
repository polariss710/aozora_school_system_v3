import { describe, expect, it } from "vitest";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes and verifies a password", async () => {
    const hash = await service.hashPassword("correct-password");

    await expect(service.verifyPassword("correct-password", hash)).resolves.toBe(
      true,
    );
    await expect(service.verifyPassword("wrong-password", hash)).resolves.toBe(
      false,
    );
  });

  it("rejects malformed hashes", async () => {
    await expect(
      service.verifyPassword("correct-password", "not-a-valid-hash"),
    ).resolves.toBe(false);
  });
});
