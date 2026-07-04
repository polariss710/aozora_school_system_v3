import { AuthenticatedUser } from "../users/users.types";

export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
};

export type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};
