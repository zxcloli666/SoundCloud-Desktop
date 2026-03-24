import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccessToken } from '../common/decorators/access-token.decorator.js';
import { SessionId } from '../common/decorators/session-id.decorator.js';
import { PaginationQuery } from '../common/dto/pagination.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import {
  PaginatedPlaylistResponse,
  PaginatedTrackResponse,
  PaginatedUserResponse,
  ScUser,
  ScWebProfile,
} from '../soundcloud/soundcloud.types.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiHeader({ name: 'x-session-id', required: true })
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated user IDs' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  search(
    @AccessToken() token: string,
    @Query() query: PaginationQuery,
    @Query('q') q?: string,
    @Query('ids') ids?: string,
  ) {
    const params: Record<string, unknown> = { ...query };
    if (q) params.q = q;
    if (ids) params.ids = ids;
    return this.usersService.search(token, params);
  }

  @Get(':userUrn')
  @ApiOperation({ summary: 'Get user by URN' })
  @ApiOkResponse({ type: ScUser })
  getById(@AccessToken() token: string, @Param('userUrn') userUrn: string) {
    return this.usersService.getById(token, userUrn);
  }

  @Get(':userUrn/followers')
  @ApiOperation({ summary: 'Get user followers' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getFollowers(
    @AccessToken() token: string,
    @Param('userUrn') userUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.usersService.getFollowers(token, userUrn, query as Record<string, unknown>);
  }

  @Get(':userUrn/followings')
  @ApiOperation({ summary: 'Get user followings' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getFollowings(
    @AccessToken() token: string,
    @Param('userUrn') userUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.usersService.getFollowings(token, userUrn, query as Record<string, unknown>);
  }

  @Get(':userUrn/followings/:followingUrn')
  @ApiOperation({ summary: 'Get user A is following to user B' })
  @ApiOkResponse({ type: Boolean, description: 'Returns true if following, otherwise false' })
  getIsFollowing(
    @AccessToken() token: string,
    @Param('userUrn') userUrn: string,
    @Param('followingUrn') followingUrn: string,
  ) {
    return this.usersService.getIsFollowing(token, userUrn, followingUrn);
  }

  @Get(':userUrn/tracks')
  @ApiOperation({ summary: 'Get user tracks' })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getTracks(
    @AccessToken() token: string,
    @SessionId() sessionId: string,
    @Param('userUrn') userUrn: string,
    @Query() query: PaginationQuery,
    @Query('access') access: string = 'playable,preview,blocked',
  ) {
    const params: Record<string, unknown> = { ...query, access };
    return this.usersService.getTracks(token, sessionId, userUrn, params);
  }

  @Get(':userUrn/playlists')
  @ApiOperation({ summary: 'Get user playlists' })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiQuery({ name: 'show_tracks', required: false, type: Boolean })
  @ApiOkResponse({ type: PaginatedPlaylistResponse })
  getPlaylists(
    @AccessToken() token: string,
    @Param('userUrn') userUrn: string,
    @Query() query: PaginationQuery,
    @Query('access') access: string = 'playable,preview,blocked',
  ) {
    const params: Record<string, unknown> = { ...query, access };
    return this.usersService.getPlaylists(token, userUrn, params);
  }

  @Get(':userUrn/likes/tracks')
  @ApiOperation({ summary: 'Get user liked tracks' })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getLikedTracks(
    @AccessToken() token: string,
    @SessionId() sessionId: string,
    @Param('userUrn') userUrn: string,
    @Query() query: PaginationQuery,
    @Query('access') access: string = 'playable,preview,blocked',
  ) {
    const params: Record<string, unknown> = { ...query, access };
    return this.usersService.getLikedTracks(token, sessionId, userUrn, params);
  }

  @Get(':userUrn/likes/playlists')
  @ApiOperation({ summary: 'Get user liked playlists' })
  @ApiOkResponse({ type: PaginatedPlaylistResponse })
  getLikedPlaylists(
    @AccessToken() token: string,
    @Param('userUrn') userUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.usersService.getLikedPlaylists(token, userUrn, query as Record<string, unknown>);
  }

  @Get(':userUrn/web-profiles')
  @ApiOperation({ summary: 'Get user web profiles' })
  @ApiOkResponse({ type: [ScWebProfile] })
  getWebProfiles(@AccessToken() token: string, @Param('userUrn') userUrn: string) {
    return this.usersService.getWebProfiles(token, userUrn);
  }
}
