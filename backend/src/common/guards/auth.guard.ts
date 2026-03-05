import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.headers['x-session-id'] ?? request.query?.session_id;

    if (!sessionId) {
      throw new UnauthorizedException('Missing x-session-id header');
    }

    request.accessToken = await this.authService.getValidAccessToken(sessionId);
    request.sessionId = sessionId;

    return true;
  }
}
