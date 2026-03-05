import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: 'SoundCloud OAuth authorization URL' }) url: string;
  @ApiProperty({ description: 'Session ID to use for subsequent requests', format: 'uuid' })
  sessionId: string;
}

export class SessionResponseDto {
  @ApiProperty() authenticated: boolean;
  @ApiPropertyOptional({ format: 'uuid' }) sessionId?: string;
  @ApiPropertyOptional() username?: string;
  @ApiPropertyOptional() soundcloudUserId?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) expiresAt?: Date;
}

export class RefreshResponseDto {
  @ApiProperty({ format: 'uuid' }) sessionId: string;
  @ApiProperty({ type: String, format: 'date-time' }) expiresAt: Date;
}

export class LogoutResponseDto {
  @ApiProperty() success: boolean;
}
