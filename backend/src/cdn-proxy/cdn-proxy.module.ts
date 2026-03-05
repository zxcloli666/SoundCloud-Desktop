import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CdnProxyController } from './cdn-proxy.controller.js';
import { CdnProxyService } from './cdn-proxy.service.js';

@Module({
  imports: [HttpModule],
  controllers: [CdnProxyController],
  providers: [CdnProxyService],
})
export class CdnProxyModule {}
