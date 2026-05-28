import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors/app-error';
import { HttpStatus } from '../../common/http/status-codes';
import { sendSuccess } from '../../common/http/api-response';
import { env } from '../../config/env';
import { AuthService } from './auth.service';
import type { RequestMeta } from './auth.types';

const REFRESH_COOKIE_NAME = 'refreshToken';

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login = async (request: Request, response: Response): Promise<Response> => {
    const result = await this.authService.login(request.body, this.getRequestMeta(request));
    this.setRefreshCookie(response, result.refreshToken);

    return sendSuccess(response, 'Login successful', result, HttpStatus.OK);
  };

  refresh = async (request: Request, response: Response): Promise<Response> => {
    const refreshToken = request.body.refreshToken ?? request.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    const result = await this.authService.refresh({ refreshToken }, this.getRequestMeta(request));
    this.setRefreshCookie(response, result.refreshToken);

    return sendSuccess(response, 'Token refreshed', result, HttpStatus.OK);
  };

  logout = async (request: Request, response: Response): Promise<Response> => {
    await this.authService.logout(request.body.refreshToken ?? request.cookies[REFRESH_COOKIE_NAME], request.user?.sessionId);
    response.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/api/v1/auth',
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
    });

    return sendSuccess(response, 'Logout successful', null, HttpStatus.OK);
  };

  forgotPassword = async (request: Request, response: Response): Promise<Response> => {
    const result = await this.authService.forgotPassword(request.body);

    return sendSuccess(response, 'Password reset request accepted', result, HttpStatus.OK);
  };

  resetPassword = async (request: Request, response: Response): Promise<Response> => {
    await this.authService.resetPassword(request.body);

    return sendSuccess(response, 'Password reset successful', null, HttpStatus.OK);
  };

  changePassword = async (request: Request, response: Response): Promise<Response> => {
    await this.authService.changePassword(request.user!.id, request.user!.sessionId, request.body);

    return sendSuccess(response, 'Password changed successfully', null, HttpStatus.OK);
  };

  me = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, 'Authenticated user profile', request.user, HttpStatus.OK);
  };

  private getRequestMeta(request: Request): RequestMeta {
    const userAgent = request.get('user-agent');

    return {
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(userAgent ? { deviceInfo: { userAgent } } : {})
    };
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }
}
