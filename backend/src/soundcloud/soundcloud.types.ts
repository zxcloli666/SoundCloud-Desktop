import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScUser {
  @ApiProperty() avatar_url: string;
  @ApiPropertyOptional() city: string;
  @ApiPropertyOptional() country: string;
  @ApiPropertyOptional() description: string;
  @ApiPropertyOptional() discogs_name: string;
  @ApiPropertyOptional() first_name: string;
  @ApiProperty() followers_count: number;
  @ApiProperty() followings_count: number;
  @ApiPropertyOptional() full_name: string;
  @ApiProperty() urn: string;
  @ApiProperty() kind: string;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional() last_modified: string;
  @ApiPropertyOptional() last_name: string;
  @ApiProperty() permalink: string;
  @ApiProperty() permalink_url: string;
  @ApiPropertyOptional() plan: string;
  @ApiProperty() playlist_count: number;
  @ApiProperty() public_favorites_count: number;
  @ApiProperty() reposts_count: number;
  @ApiProperty() track_count: number;
  @ApiProperty() uri: string;
  @ApiProperty() username: string;
  @ApiPropertyOptional() website: string;
  @ApiPropertyOptional() website_title: string;
}

export class ScQuota {
  @ApiProperty() unlimited_upload_quota: boolean;
  @ApiProperty() upload_seconds_used: number;
  @ApiProperty() upload_seconds_left: number;
}

export class ScMe extends ScUser {
  @ApiProperty() comments_count: number;
  @ApiProperty() likes_count: number;
  @ApiPropertyOptional() locale: string;
  @ApiProperty() online: boolean;
  @ApiProperty() private_playlists_count: number;
  @ApiProperty() private_tracks_count: number;
  @ApiProperty() primary_email_confirmed: boolean;
  @ApiProperty({ type: ScQuota }) quota: ScQuota;
  @ApiProperty() upload_seconds_left: number;
}

export class ScTranscoding {
  @ApiProperty() url: string;
  @ApiProperty() preset: string;
  @ApiProperty() duration: number;
  @ApiProperty() snipped: boolean;
  @ApiProperty({
    type: 'object',
    properties: {
      protocol: { type: 'string' },
      mime_type: { type: 'string' },
    },
  })
  format: { protocol: string; mime_type: string };
  @ApiPropertyOptional() quality: string;
}

export class ScMedia {
  @ApiProperty({ type: [ScTranscoding] }) transcodings: ScTranscoding[];
}

export class ScTrack {
  @ApiProperty({ enum: ['playable', 'preview', 'blocked'] })
  access: 'playable' | 'preview' | 'blocked';
  @ApiPropertyOptional() artwork_url: string;
  @ApiPropertyOptional() caption: string;
  @ApiProperty() commentable: boolean;
  @ApiProperty() comment_count: number;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional() description: string;
  @ApiProperty() download_count: number;
  @ApiProperty() downloadable: boolean;
  @ApiProperty() duration: number;
  @ApiPropertyOptional() embeddable_by: string;
  @ApiProperty() full_duration: number;
  @ApiPropertyOptional() genre: string;
  @ApiProperty() has_downloads_left: boolean;
  @ApiProperty() urn: string;
  @ApiProperty() kind: string;
  @ApiPropertyOptional() label_name: string;
  @ApiPropertyOptional() last_modified: string;
  @ApiPropertyOptional() license: string;
  @ApiProperty() likes_count: number;
  @ApiProperty({ type: ScMedia }) media: ScMedia;
  @ApiPropertyOptional() monetization_model: string;
  @ApiProperty() permalink: string;
  @ApiProperty() permalink_url: string;
  @ApiProperty() playback_count: number;
  @ApiPropertyOptional() policy: string;
  @ApiProperty() public: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) publisher_metadata: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() purchase_title: string;
  @ApiPropertyOptional() purchase_url: string;
  @ApiPropertyOptional() release_date: string;
  @ApiProperty() reposts_count: number;
  @ApiPropertyOptional() secret_token: string;
  @ApiProperty() sharing: string;
  @ApiProperty() state: string;
  @ApiPropertyOptional() station_permalink: string;
  @ApiPropertyOptional() station_urn: string;
  @ApiProperty() streamable: boolean;
  @ApiPropertyOptional() stream_url: string;
  @ApiPropertyOptional() tag_list: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() track_format: string;
  @ApiProperty() uri: string;
  @ApiProperty({ type: ScUser }) user: ScUser;
  @ApiProperty() user_id: number;
  @ApiPropertyOptional() waveform_url: string;
  @ApiPropertyOptional() display_date: string;
}

export class ScPlaylist {
  @ApiPropertyOptional() artwork_url: string;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional() description: string;
  @ApiProperty() duration: number;
  @ApiPropertyOptional() embeddable_by: string;
  @ApiPropertyOptional() genre: string;
  @ApiProperty() urn: string;
  @ApiProperty() kind: string;
  @ApiPropertyOptional() label_name: string;
  @ApiPropertyOptional() last_modified: string;
  @ApiPropertyOptional() license: string;
  @ApiProperty() likes_count: number;
  @ApiProperty() managed_by_feeds: boolean;
  @ApiProperty() permalink: string;
  @ApiProperty() permalink_url: string;
  @ApiProperty() public: boolean;
  @ApiPropertyOptional() purchase_title: string;
  @ApiPropertyOptional() purchase_url: string;
  @ApiPropertyOptional() release_date: string;
  @ApiProperty() reposts_count: number;
  @ApiPropertyOptional() secret_token: string;
  @ApiProperty() sharing: string;
  @ApiPropertyOptional() tag_list: string;
  @ApiProperty() title: string;
  @ApiProperty() track_count: number;
  @ApiProperty({ type: [ScTrack] }) tracks: ScTrack[];
  @ApiProperty() uri: string;
  @ApiProperty({ type: ScUser }) user: ScUser;
  @ApiProperty() user_id: number;
}

export class ScComment {
  @ApiProperty() body: string;
  @ApiProperty() created_at: string;
  @ApiProperty() urn: string;
  @ApiProperty() kind: string;
  @ApiProperty() timestamp: number;
  @ApiProperty() track_id: number;
  @ApiProperty() uri: string;
  @ApiProperty({ type: ScUser }) user: ScUser;
  @ApiProperty() user_id: number;
}

export class ScWebProfile {
  @ApiProperty() created_at: string;
  @ApiProperty() kind: string;
  @ApiProperty() urn: string;
  @ApiProperty() network: string;
  @ApiProperty() title: string;
  @ApiProperty() url: string;
  @ApiProperty() username: string;
}

export class ScStreams {
  @ApiPropertyOptional() http_mp3_128_url?: string;
  @ApiPropertyOptional() hls_mp3_128_url?: string;
  @ApiPropertyOptional() hls_aac_160_url?: string;
  @ApiPropertyOptional() hls_opus_64_url?: string;
  @ApiPropertyOptional() preview_mp3_128_url?: string;
}

export class ScPaginatedResponse<T> {
  collection: T[];
  @ApiPropertyOptional() next_href?: string;
}

export class ScActivity {
  @ApiProperty() type: string;
  @ApiProperty() created_at: string;
  @ApiProperty() origin: ScTrack | ScPlaylist;
}

export class ScTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

// Concrete paginated response classes for Swagger
export class PaginatedTrackResponse {
  @ApiProperty({ type: [ScTrack] }) collection: ScTrack[];
  @ApiPropertyOptional() next_href?: string;
}

export class PaginatedPlaylistResponse {
  @ApiProperty({ type: [ScPlaylist] }) collection: ScPlaylist[];
  @ApiPropertyOptional() next_href?: string;
}

export class PaginatedUserResponse {
  @ApiProperty({ type: [ScUser] }) collection: ScUser[];
  @ApiPropertyOptional() next_href?: string;
}

export class PaginatedCommentResponse {
  @ApiProperty({ type: [ScComment] }) collection: ScComment[];
  @ApiPropertyOptional() next_href?: string;
}

export class PaginatedActivityResponse {
  @ApiProperty({ type: [ScActivity] }) collection: ScActivity[];
  @ApiPropertyOptional() next_href?: string;
}
