export type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  roleCodes: string[];
  permissionCodes: string[];
};

export type AuthenticatedUser = Omit<AuthUserRecord, "passwordHash">;
