import { Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccessToken } from '../common/decorators/access-token.decorator.js';
import { PaginationQuery } from '../common/dto/pagination.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import {
  PaginatedActivityResponse,
  PaginatedPlaylistResponse,
  PaginatedTrackResponse,
  PaginatedUserResponse,
  ScMe,
} from '../soundcloud/soundcloud.types.js';
import { MeService } from './me.service.js';

@ApiTags('me')
@ApiHeader({ name: 'x-session-id', required: true })
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiOkResponse({ type: ScMe })
  getProfile(@AccessToken() token: string) {
    return this.meService.getProfile(token);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get authenticated user feed' })
  @ApiOkResponse({ type: PaginatedActivityResponse })
  getFeed(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getFeed(token, query as Record<string, unknown>);
  }

  @Get('feed/tracks')
  @ApiOperation({ summary: 'Get authenticated user track feed' })
  @ApiOkResponse({ type: PaginatedActivityResponse })
  getFeedTracks(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getFeedTracks(token, query as Record<string, unknown>);
  }

  @Get('likes/tracks')
  @ApiOperation({ summary: 'Get liked tracks' })
  @ApiQuery({ name: 'access', required: false, enum: ['playable', 'preview', 'blocked'] })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getLikedTracks(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getLikedTracks(token, query as Record<string, unknown>);
  }

  @Get('likes/playlists')
  @ApiOperation({ summary: 'Get liked playlists' })
  @ApiOkResponse({ type: PaginatedPlaylistResponse })
  getLikedPlaylists(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getLikedPlaylists(token, query as Record<string, unknown>);
  }

  @Get('followings')
  @ApiOperation({ summary: 'Get users followed by authenticated user' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getFollowings(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getFollowings(token, query as Record<string, unknown>);
  }

  @Get('followings/tracks')
  @ApiOperation({ summary: 'Get tracks from followed users' })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getFollowingsTracks(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getFollowingsTracks(token, query as Record<string, unknown>);
  }

  @Put('followings/:userUrn')
  @ApiOperation({ summary: 'Follow a user' })
  followUser(@AccessToken() token: string, @Param('userUrn') userUrn: string) {
    return this.meService.followUser(token, userUrn);
  }

  @Delete('followings/:userUrn')
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollowUser(@AccessToken() token: string, @Param('userUrn') userUrn: string) {
    return this.meService.unfollowUser(token, userUrn);
  }

  @Get('followers')
  @ApiOperation({ summary: 'Get followers of authenticated user' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getFollowers(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getFollowers(token, query as Record<string, unknown>);
  }

  @Get('playlists')
  @ApiOperation({ summary: 'Get user playlists' })
  @ApiQuery({ name: 'show_tracks', required: false, type: Boolean })
  @ApiOkResponse({ type: PaginatedPlaylistResponse })
  getPlaylists(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getPlaylists(token, query as Record<string, unknown>);
  }

  @Get('tracks')
  @ApiOperation({ summary: 'Get user tracks' })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getTracks(@AccessToken() token: string, @Query() query: PaginationQuery) {
    return this.meService.getTracks(token, query as Record<string, unknown>);
  }
}
