export type AuthUser = {
  id: string;
  userId: string;
  roles: string[];
  permissions: string[];
  forcePasswordReset: boolean;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type LoginPayload = {
  userId: string;
  password: string;
};
