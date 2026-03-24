import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AccessToken } from '../common/decorators/access-token.decorator.js';
import { PaginationQuery } from '../common/dto/pagination.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import {
  PaginatedPlaylistResponse,
  PaginatedTrackResponse,
  PaginatedUserResponse,
  ScPlaylist,
} from '../soundcloud/soundcloud.types.js';
import { PlaylistsService } from './playlists.service.js';

@ApiTags('playlists')
@ApiHeader({ name: 'x-session-id', required: true })
@UseGuards(AuthGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get()
  @ApiOperation({ summary: 'Search playlists' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiQuery({ name: 'show_tracks', required: false, type: Boolean })
  @ApiOkResponse({ type: PaginatedPlaylistResponse })
  search(
    @AccessToken() token: string,
    @Query() query: PaginationQuery,
    @Query('q') q?: string,
    @Query('access') access: string = 'playable,preview,blocked',
    @Query('show_tracks') showTracks?: string,
  ) {
    const params: Record<string, unknown> = { ...query, access };
    if (q) params.q = q;
    if (showTracks !== undefined) params.show_tracks = showTracks;
    return this.playlistsService.search(token, params);
  }

  @Post()
  @ApiOperation({ summary: 'Create a playlist' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        playlist: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            sharing: { type: 'string', enum: ['public', 'private'] },
            tracks: {
              type: 'array',
              items: { type: 'object', properties: { urn: { type: 'string' } } },
            },
          },
          required: ['title'],
        },
      },
    },
  })
  @ApiOkResponse({ type: ScPlaylist })
  create(@AccessToken() token: string, @Body() body: Record<string, unknown>) {
    return this.playlistsService.create(token, body);
  }

  @Get(':playlistUrn')
  @ApiOperation({ summary: 'Get playlist by URN' })
  @ApiQuery({ name: 'secret_token', required: false })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiQuery({ name: 'show_tracks', required: false, type: Boolean })
  @ApiOkResponse({ type: ScPlaylist })
  getById(
    @AccessToken() token: string,
    @Param('playlistUrn') playlistUrn: string,
    @Query('secret_token') secretToken?: string,
    @Query('access') access: string = 'playable,preview,blocked',
    @Query('show_tracks') showTracks?: string,
  ) {
    const params: Record<string, unknown> = { access };
    if (secretToken) params.secret_token = secretToken;
    if (showTracks !== undefined) params.show_tracks = showTracks;
    return this.playlistsService.getById(token, playlistUrn, params);
  }

  @Put(':playlistUrn')
  @ApiOperation({ summary: 'Update a playlist' })
  @ApiOkResponse({ type: ScPlaylist })
  update(
    @AccessToken() token: string,
    @Param('playlistUrn') playlistUrn: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.playlistsService.update(token, playlistUrn, body);
  }

  @Delete(':playlistUrn')
  @ApiOperation({ summary: 'Delete a playlist' })
  delete(@AccessToken() token: string, @Param('playlistUrn') playlistUrn: string) {
    return this.playlistsService.delete(token, playlistUrn);
  }

  @Get(':playlistUrn/tracks')
  @ApiOperation({ summary: 'Get playlist tracks' })
  @ApiQuery({ name: 'secret_token', required: false })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getTracks(
    @AccessToken() token: string,
    @Param('playlistUrn') playlistUrn: string,
    @Query() query: PaginationQuery,
    @Query('secret_token') secretToken?: string,
    @Query('access') access: string = 'playable,preview,blocked',
  ) {
    const params: Record<string, unknown> = { ...query, access };
    if (secretToken) params.secret_token = secretToken;
    return this.playlistsService.getTracks(token, playlistUrn, params);
  }

  @Get(':playlistUrn/reposters')
  @ApiOperation({ summary: 'Get playlist reposters' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getReposters(
    @AccessToken() token: string,
    @Param('playlistUrn') playlistUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.playlistsService.getReposters(token, playlistUrn, query as Record<string, unknown>);
  }
}
