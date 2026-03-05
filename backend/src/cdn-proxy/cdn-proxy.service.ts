import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

interface CacheEntry {
  data: Buffer;
  contentType: string;
  cachedAt: number;
}

const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

@Injectable()
export class CdnProxyService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly httpService: HttpService) {}

  async fetch(url: string): Promise<{ data: Buffer; contentType: string }> {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.sndcdn.com')) {
      throw new BadRequestException('Only *.sndcdn.com URLs are allowed');
    }

    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return { data: cached.data, contentType: cached.contentType };
    }

    const { data, headers } = await firstValueFrom(
      this.httpService.get(url, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
      }),
    );

    const buf = Buffer.from(data);
    const contentType = String(headers['content-type'] || 'application/octet-stream');

    // Evict oldest entries if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      let oldest: string | undefined;
      let oldestTime = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.cache) {
        if (entry.cachedAt < oldestTime) {
          oldestTime = entry.cachedAt;
          oldest = key;
        }
      }
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(url, { data: buf, contentType, cachedAt: Date.now() });

    return { data: buf, contentType };
  }
}
