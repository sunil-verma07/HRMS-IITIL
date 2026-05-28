export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = AuthTokens & {
  user: {
    id: string;
    userId: string;
    roles: string[];
    permissions: string[];
    forcePasswordReset: boolean;
  };
};
