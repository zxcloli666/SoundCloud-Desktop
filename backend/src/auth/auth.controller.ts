import { Controller, Get, Header, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { renderCallbackPage } from './callback-page.js';
import {
  LoginResponseDto,
  LogoutResponseDto,
  RefreshResponseDto,
  SessionResponseDto,
} from './dto/auth-response.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @ApiOperation({ summary: 'Initiate OAuth 2.1 login flow with PKCE' })
  @ApiOkResponse({ type: LoginResponseDto })
  async login() {
    return this.authService.initiateLogin();
  }

  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback from SoundCloud' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  @ApiOkResponse({ description: 'HTML callback page' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async callback(@Query('code') code: string, @Query('state') state: string) {
    const result = await this.authService.handleCallback(code, state);

    return renderCallbackPage({
      success: result.success,
      sessionId: result.session.id,
      username: result.session.username,
      error: result.error,
    });
  }

  @Get('session')
  @ApiOperation({ summary: 'Get current session status' })
  @ApiHeader({ name: 'x-session-id', required: true })
  @ApiOkResponse({ type: SessionResponseDto })
  async session(@Headers('x-session-id') sessionId: string) {
    const session = await this.authService.getSession(sessionId);
    if (!session) {
      return { authenticated: false };
    }
    return {
      authenticated: true,
      sessionId: session.id,
      username: session.username,
      soundcloudUserId: session.soundcloudUserId,
      expiresAt: session.expiresAt,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiHeader({ name: 'x-session-id', required: true })
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(@Headers('x-session-id') sessionId: string) {
    const session = await this.authService.refreshSession(sessionId);
    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiHeader({ name: 'x-session-id', required: true })
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(@Headers('x-session-id') sessionId: string) {
    await this.authService.logout(sessionId);
    return { success: true };
  }
}
