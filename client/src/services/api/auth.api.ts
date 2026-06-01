import { httpClient } from './http-client';
import { endpoints } from './endpoints';
import type { ApiResponse } from '@/types/api';
import type { AuthResult, LoginPayload } from '@/types/auth';

export const authApi = {
  async login(payload: LoginPayload, signal?: AbortSignal): Promise<AuthResult> {
    const response = await httpClient.post<ApiResponse<AuthResult>>(
      endpoints.auth.login,
      payload,
      signal ? { signal } : undefined
    );
    return response.data.data;
  },

  async refresh(refreshToken: string): Promise<AuthResult> {
    const response = await httpClient.post<ApiResponse<AuthResult>>(endpoints.auth.refresh, { refreshToken });
    return response.data.data;
  },

  async logout(refreshToken?: string): Promise<void> {
    await httpClient.post(endpoints.auth.logout, refreshToken ? { refreshToken } : {});
  },

  async forgotPassword(userId: string): Promise<unknown> {
    const response = await httpClient.post<ApiResponse<unknown>>(endpoints.auth.forgotPassword, { userId });
    return response.data.data;
  },

  async resetPassword(payload: { token: string; newPassword: string }): Promise<void> {
    await httpClient.post(endpoints.auth.resetPassword, payload);
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await httpClient.post(endpoints.auth.changePassword, payload);
  }
};
