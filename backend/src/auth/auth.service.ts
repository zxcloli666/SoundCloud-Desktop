import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import { ScMe } from '../soundcloud/soundcloud.types.js';
import { Session } from './entities/session.entity.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly soundcloudService: SoundcloudService,
    private readonly configService: ConfigService,
  ) {}

  async initiateLogin(): Promise<{ url: string; sessionId: string }> {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');

    const session = this.sessionRepo.create({
      codeVerifier,
      state,
      accessToken: '',
      refreshToken: '',
      expiresAt: new Date(),
      scope: '',
    });
    await this.sessionRepo.save(session);

    const clientId = this.soundcloudService.scClientId;
    const redirectUri = this.soundcloudService.scRedirectUri;
    const authBaseUrl = this.configService.get<string>('soundcloud.authBaseUrl');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    return {
      url: `${authBaseUrl}/authorize?${params.toString()}`,
      sessionId: session.id,
    };
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ session: Session; success: boolean; error?: string }> {
    const session = await this.sessionRepo.findOne({ where: { state } });
    if (!session) {
      throw new BadRequestException('Invalid state parameter');
    }

    if (!session.codeVerifier) {
      throw new BadRequestException('No code verifier found for this session');
    }

    try {
      const tokenResponse = await this.soundcloudService.exchangeCodeForToken(
        code,
        session.codeVerifier,
      );

      session.accessToken = tokenResponse.access_token;
      session.refreshToken = tokenResponse.refresh_token;
      session.expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      session.scope = tokenResponse.scope || '';
      session.codeVerifier = '';
      session.state = '';

      try {
        const me = await this.soundcloudService.apiGet<ScMe>('/me', session.accessToken);
        session.soundcloudUserId = me.urn;
        session.username = me.username;
      } catch {}

      await this.sessionRepo.save(session);
      return { session, success: true };
    } catch (error: any) {
      return {
        session,
        success: false,
        error:
          error?.response?.data?.error_description || error?.message || 'Token exchange failed',
      };
    }
  }

  async refreshSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (!session.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    try {
      const tokenResponse = await this.soundcloudService.refreshAccessToken(session.refreshToken);

      session.accessToken = tokenResponse.access_token;
      session.refreshToken = tokenResponse.refresh_token;
      session.expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      await this.sessionRepo.save(session);
      return session;
    } catch {
      await this.sessionRepo.remove(session);
      throw new UnauthorizedException('Refresh token expired or invalid. Please re-authenticate.');
    }
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) return;

    if (session.accessToken) {
      await this.soundcloudService.signOut(session.accessToken);
    }

    await this.sessionRepo.remove(session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async getValidAccessToken(sessionId: string): Promise<string> {
    let session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.expiresAt <= new Date()) {
      session = await this.refreshSession(sessionId);
    }

    return session.accessToken;
  }
}
