import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AccessToken } from '../common/decorators/access-token.decorator.js';
import { SessionId } from '../common/decorators/session-id.decorator.js';
import { PaginationQuery } from '../common/dto/pagination.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import {
  PaginatedCommentResponse,
  PaginatedTrackResponse,
  PaginatedUserResponse,
  ScComment,
  ScStreams,
  ScTrack,
} from '../soundcloud/soundcloud.types.js';
import { TracksService } from './tracks.service.js';

@ApiTags('tracks')
@ApiHeader({ name: 'x-session-id', required: true })
@UseGuards(AuthGuard)
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  @ApiOperation({ summary: 'Search tracks' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated track IDs' })
  @ApiQuery({ name: 'genres', required: false, description: 'Comma-separated genres' })
  @ApiQuery({ name: 'tags', required: false, description: 'Comma-separated tags' })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  search(
    @AccessToken() token: string,
    @SessionId() sessionId: string,
    @Query() query: PaginationQuery,
    @Query('q') q?: string,
    @Query('ids') ids?: string,
    @Query('genres') genres?: string,
    @Query('tags') tags?: string,
    @Query('access') access: string = 'playable,preview,blocked',
  ) {
    const params: Record<string, unknown> = { ...query, access };
    if (q) params.q = q;
    if (ids) params.ids = ids;
    if (genres) params.genres = genres;
    if (tags) params.tags = tags;
    return this.tracksService.search(token, sessionId, params);
  }

  @Get(':trackUrn')
  @ApiOperation({ summary: 'Get track by URN' })
  @ApiQuery({ name: 'secret_token', required: false })
  @ApiOkResponse({ type: ScTrack })
  getById(
    @AccessToken() token: string,
    @SessionId() sessionId: string,
    @Param('trackUrn') trackUrn: string,
    @Query('secret_token') secretToken?: string,
  ) {
    const params: Record<string, unknown> = {};
    if (secretToken) params.secret_token = secretToken;
    return this.tracksService.getById(token, sessionId, trackUrn, params);
  }

  @Put(':trackUrn')
  @ApiOperation({ summary: 'Update track metadata' })
  @ApiOkResponse({ type: ScTrack })
  update(
    @AccessToken() token: string,
    @Param('trackUrn') trackUrn: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.tracksService.update(token, trackUrn, body);
  }

  @Delete(':trackUrn')
  @ApiOperation({ summary: 'Delete a track' })
  delete(@AccessToken() token: string, @Param('trackUrn') trackUrn: string) {
    return this.tracksService.delete(token, trackUrn);
  }

  @Get(':trackUrn/streams')
  @ApiOperation({ summary: 'Get track stream URLs' })
  @ApiQuery({
    name: 'secret_token',
    required: false,
    description: 'Token for accessing private tracks (the s-xxx part from private share URLs)',
  })
  @ApiOkResponse({ type: ScStreams })
  getStreams(
    @AccessToken() token: string,
    @Param('trackUrn') trackUrn: string,
    @Query('secret_token') secretToken?: string,
  ) {
    const params: Record<string, unknown> = {};
    if (secretToken) params.secret_token = secretToken;
    return this.tracksService.getStreams(token, trackUrn, params);
  }

  @Get(':trackUrn/stream')
  @ApiOperation({
    summary: 'Proxy audio stream',
    description:
      'Proxies the actual audio stream from SoundCloud with proper auth. Use the format query param to pick a transcoding. Supports Range requests for seeking.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description:
      'Stream format: http_mp3_128, hls_mp3_128, hls_aac_160, hls_opus_64, preview_mp3_128',
    example: 'http_mp3_128',
  })
  @ApiQuery({ name: 'secret_token', required: false })
  @ApiHeader({
    name: 'range',
    required: false,
    description: 'HTTP Range header for seeking (e.g. bytes=0-999999)',
  })
  async proxyStream(
    @AccessToken() token: string,
    @Res({ passthrough: true }) res: any,
    @Param('trackUrn') trackUrn: string,
    @Query('format') format: string = 'hls_aac_160',
    @Query('secret_token') secretToken?: string,
    @Headers('range') range?: string,
  ) {
    const params: Record<string, unknown> = {};
    if (secretToken) params.secret_token = secretToken;

    let streamData = await this.tracksService.tryOAuthStream(
      token,
      trackUrn,
      format,
      params,
      range,
    );

    if (!streamData) {
      streamData = await this.tracksService.getPublicStream(trackUrn, format);
    }

    if (!streamData) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Track not available for streaming',
      };
    }

    const { stream, headers } = streamData;

    res.header('Accept-Ranges', 'bytes');
    if (headers['content-range']) {
      res.status(206);
      res.header('Content-Range', headers['content-range']);
    }
    return new StreamableFile(stream, {
      type: headers['content-type'],
      length: headers['content-length'] ? Number(headers['content-length']) : undefined,
    });
  }

  @Get(':trackUrn/comments')
  @ApiOperation({ summary: 'Get track comments' })
  @ApiOkResponse({ type: PaginatedCommentResponse })
  getComments(
    @AccessToken() token: string,
    @Param('trackUrn') trackUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.tracksService.getComments(token, trackUrn, query as Record<string, unknown>);
  }

  @Post(':trackUrn/comments')
  @ApiOperation({ summary: 'Post a comment on a track' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'object',
          properties: {
            body: { type: 'string' },
            timestamp: { type: 'number' },
          },
          required: ['body'],
        },
      },
    },
  })
  @ApiOkResponse({ type: ScComment })
  createComment(
    @AccessToken() token: string,
    @Param('trackUrn') trackUrn: string,
    @Body() body: { comment: { body: string; timestamp?: number } },
  ) {
    return this.tracksService.createComment(token, trackUrn, body);
  }

  @Get(':trackUrn/favoriters')
  @ApiOperation({ summary: 'Get users who favorited a track' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getFavoriters(
    @AccessToken() token: string,
    @Param('trackUrn') trackUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.tracksService.getFavoriters(token, trackUrn, query as Record<string, unknown>);
  }

  @Get(':trackUrn/reposters')
  @ApiOperation({ summary: 'Get users who reposted a track' })
  @ApiOkResponse({ type: PaginatedUserResponse })
  getReposters(
    @AccessToken() token: string,
    @Param('trackUrn') trackUrn: string,
    @Query() query: PaginationQuery,
  ) {
    return this.tracksService.getReposters(token, trackUrn, query as Record<string, unknown>);
  }

  @Get(':trackUrn/related')
  @ApiOperation({ summary: 'Get related tracks' })
  @ApiQuery({
    name: 'access',
    required: false,
    enum: ['playable', 'preview', 'blocked'],
    default: ['playable', 'preview', 'blocked'],
  })
  @ApiOkResponse({ type: PaginatedTrackResponse })
  getRelated(
    @AccessToken() token: string,
    @SessionId() sessionId: string,
    @Param('trackUrn') trackUrn: string,
    @Query() query: PaginationQuery,
    @Query('access') access: string = 'playable,preview,blocked',
  ) {
    const params: Record<string, unknown> = { ...query, access };
    return this.tracksService.getRelated(token, sessionId, trackUrn, params);
  }
}
