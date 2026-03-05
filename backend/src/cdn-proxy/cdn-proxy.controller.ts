import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CdnProxyService } from './cdn-proxy.service.js';

@ApiTags('cdn-proxy')
@Controller('proxy')
export class CdnProxyController {
  constructor(private readonly cdnProxyService: CdnProxyService) {}

  @Get('cdn')
  @ApiOperation({
    summary: 'Proxy SoundCloud CDN resources',
    description: 'Proxies and caches images/waveforms from *.sndcdn.com',
  })
  @ApiQuery({ name: 'url', required: true, description: 'Full *.sndcdn.com URL' })
  async proxy(@Query('url') url: string, @Res() res: any) {
    const { data, contentType } = await this.cdnProxyService.fetch(url);

    res.header('Content-Type', contentType);
    res.header('Content-Length', data.length);
    res.header('Cache-Control', 'public, max-age=86400');
    res.send(data);
  }
}
