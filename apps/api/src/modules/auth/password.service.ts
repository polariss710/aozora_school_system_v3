import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;
const separator = "$";
const scheme = "scrypt";

@Injectable()
export class PasswordService {
  async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

    return [scheme, salt, derivedKey.toString("hex")].join(separator);
  }

  async verifyPassword(password: string, passwordHash: string) {
    const [hashScheme, salt, storedKey] = passwordHash.split(separator);

    if (hashScheme !== scheme || !salt || !storedKey) {
      return false;
    }

    const storedKeyBuffer = Buffer.from(storedKey, "hex");
    const derivedKey = (await scrypt(password, salt, storedKeyBuffer.length)) as Buffer;

    if (derivedKey.length !== storedKeyBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedKeyBuffer);
  }
}
