import { PassThrough, Readable } from 'node:stream';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

const SC_BASE_URL = 'https://soundcloud.com';
const SC_API_V2 = 'https://api-v2.soundcloud.com';
const CLIENT_ID_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ScTranscodingInfo {
  url: string;
  preset: string;
  duration: number;
  snipped: boolean;
  format: { protocol: string; mime_type: string };
  quality: string;
}

interface ScResolvedTrack {
  media?: { transcodings?: ScTranscodingInfo[] };
}

/** Maps our format names to SC transcoding presets */
const FORMAT_TO_PRESETS: Record<string, string[]> = {
  hls_aac_160: ['aac_160k'],
  hls_mp3_128: ['mp3_1_0'],
  http_mp3_128: ['mp3_1_0'],
  hls_opus_64: ['opus_0_0'],
};

/** Preferred fallback order when requested preset not found */
const PRESET_FALLBACK_ORDER = ['mp3_1_0', 'aac_160k', 'opus_0_0', 'abr_sq'];

const MIME_TO_CONTENT_TYPE: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp4; codecs="mp4a.40.2"': 'audio/mp4',
  'audio/ogg; codecs="opus"': 'audio/ogg',
  'audio/mpegurl': 'audio/mpeg',
};

@Injectable()
export class ScPublicApiService {
  private readonly logger = new Logger(ScPublicApiService.name);
  private clientId: string | null = null;
  private clientIdFetchedAt = 0;

  constructor(private readonly httpService: HttpService) {}

  /* ── Client ID Management ──────────────────────────── */

  async getClientId(): Promise<string> {
    if (this.clientId && Date.now() - this.clientIdFetchedAt < CLIENT_ID_TTL_MS) {
      return this.clientId;
    }
    return this.refreshClientId();
  }

  invalidateClientId(): void {
    this.clientId = null;
    this.clientIdFetchedAt = 0;
  }

  private async refreshClientId(): Promise<string> {
    const { data: html } = await firstValueFrom(
      this.httpService.get<string>(SC_BASE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
        responseType: 'text',
      }),
    );

    const clientId = this.extractClientId(html);
    if (!clientId) {
      throw new Error('Failed to extract SoundCloud client_id from page');
    }

    this.clientId = clientId;
    this.clientIdFetchedAt = Date.now();
    this.logger.log('Refreshed SoundCloud public client_id');
    return clientId;
  }

  private extractClientId(html: string): string | null {
    const marker = 'window.__sc_hydration =';
    const idx = html.indexOf(marker);
    if (idx === -1) return null;

    let pos = idx + marker.length;
    while (pos < html.length && html[pos] !== '[') {
      if (!/\s/.test(html[pos])) return null;
      pos++;
    }
    if (pos >= html.length) return null;

    let depth = 1;
    let inStr = false;
    let esc = false;
    let i = pos + 1;

    while (i < html.length && depth > 0) {
      const ch = html[i];
      if (!inStr) {
        if (ch === '"' && !esc) inStr = true;
        else if (ch === '[') depth++;
        else if (ch === ']') depth--;
      } else {
        if (ch === '"' && !esc) inStr = false;
      }
      esc = !esc && ch === '\\';
      i++;
    }

    try {
      const data = JSON.parse(html.substring(pos, i)) as Array<{
        hydratable: string;
        data: any;
      }>;
      return data.find((item) => item.hydratable === 'apiClient')?.data?.id ?? null;
    } catch {
      return null;
    }
  }

  /* ── Track Resolution ──────────────────────────────── */

  async getTrackById(trackId: string): Promise<ScResolvedTrack> {
    const clientId = await this.getClientId();
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ScResolvedTrack>(`${SC_API_V2}/tracks/${trackId}`, {
          params: { client_id: clientId },
        }),
      );
      return data;
    } catch (err: any) {
      // If 401/403 — client_id expired, retry once
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        this.invalidateClientId();
        const newClientId = await this.getClientId();
        const { data } = await firstValueFrom(
          this.httpService.get<ScResolvedTrack>(`${SC_API_V2}/tracks/${trackId}`, {
            params: { client_id: newClientId },
          }),
        );
        return data;
      }
      throw err;
    }
  }

  /* ── Transcoding Selection ─────────────────────────── */

  pickTranscoding(
    transcodings: ScTranscodingInfo[],
    preferredFormat?: string,
  ): ScTranscodingInfo | null {
    // Filter encrypted, sort snipped to the end
    const candidates = transcodings
      .filter((t) => !t.format?.protocol?.includes('encrypted'))
      .sort((a, b) => Number(a.snipped) - Number(b.snipped));
    if (!candidates.length) return null;

    // Try preferred format first (prefer non-snipped)
    if (preferredFormat) {
      const presets = FORMAT_TO_PRESETS[preferredFormat];
      if (presets) {
        const match = candidates.find((t) => presets.includes(t.preset));
        if (match) return match;
      }
    }

    // Fallback order (candidates already sorted: non-snipped first)
    for (const preset of PRESET_FALLBACK_ORDER) {
      const match = candidates.find((t) => t.preset === preset);
      if (match) return match;
    }

    return candidates[0];
  }

  /* ── Transcoding URL → Stream URL ──────────────────── */

  async resolveTranscodingUrl(transcodingUrl: string): Promise<string> {
    const clientId = await this.getClientId();
    const { data } = await firstValueFrom(
      this.httpService.get<{ url: string }>(transcodingUrl, {
        params: { client_id: clientId },
      }),
    );
    return data.url;
  }

  /* ── HLS Stream Resolution ─────────────────────────── */

  async streamFromHls(
    m3u8Url: string,
    mimeType: string,
  ): Promise<{ stream: Readable; headers: Record<string, string> }> {
    const { data: m3u8Content } = await firstValueFrom(
      this.httpService.get<string>(m3u8Url, { responseType: 'text' }),
    );

    const { initUrl, segmentUrls } = this.parseM3u8(m3u8Content, m3u8Url);
    if (!segmentUrls.length) {
      throw new Error('No segments found in m3u8 playlist');
    }

    // Check init segment for CENC encryption (enca box)
    let initSegment: Buffer | null = null;
    if (initUrl) {
      initSegment = await this.downloadSegment(initUrl);
      if (initSegment.includes(Buffer.from('enca'))) {
        throw new Error('Stream is CENC encrypted');
      }
    }

    const contentType = MIME_TO_CONTENT_TYPE[mimeType] ?? 'application/octet-stream';
    const passthrough = new PassThrough();

    // Pipe segments in background — don't await
    this.pipeSegmentsWithInit(passthrough, initSegment, segmentUrls).catch((err) => {
      this.logger.error(`HLS segment streaming failed: ${err.message}`);
      passthrough.destroy(err);
    });

    return {
      stream: passthrough,
      headers: { 'content-type': contentType },
    };
  }

  /* ── Convenience: full fallback flow ───────────────── */

  async getStreamForTrack(
    trackUrn: string,
    format?: string,
  ): Promise<{ stream: Readable; headers: Record<string, string> } | null> {
    const trackId = trackUrn.replace(/.*:/, '');

    const track = await this.getTrackById(trackId);
    const transcodings = track.media?.transcodings;

    if (!transcodings?.length) {
      this.logger.warn(`No transcodings available for track ${trackId}`);
      return null;
    }

    const transcoding = this.pickTranscoding(transcodings, format);
    if (!transcoding) return null;

    const m3u8Url = await this.resolveTranscodingUrl(transcoding.url);
    const result = await this.streamFromHls(m3u8Url, transcoding.format.mime_type);

    return result;
  }

  /* ── Private: m3u8 parsing ─────────────────────────── */

  private parseM3u8(
    content: string,
    baseUrl: string,
  ): { initUrl: string | null; segmentUrls: string[] } {
    const lines = content.split('\n').map((l) => l.trim());
    let initUrl: string | null = null;
    const segmentUrls: string[] = [];
    const base = new URL(baseUrl);

    for (const line of lines) {
      const mapMatch = line.match(/#EXT-X-MAP:URI="([^"]+)"/);
      if (mapMatch) {
        initUrl = this.resolveSegmentUrl(mapMatch[1], base);
        continue;
      }
      if (line.startsWith('#') || !line) continue;
      segmentUrls.push(this.resolveSegmentUrl(line, base));
    }

    return { initUrl, segmentUrls };
  }

  private resolveSegmentUrl(url: string, base: URL): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return new URL(url, base).href;
  }

  private async pipeSegments(
    output: PassThrough,
    initUrl: string | null,
    segmentUrls: string[],
  ): Promise<void> {
    try {
      if (initUrl) {
        output.write(await this.downloadSegment(initUrl));
      }
      for (const url of segmentUrls) {
        if (!output.writable) break;
        output.write(await this.downloadSegment(url));
      }
      output.end();
    } catch (err) {
      output.destroy(err as Error);
    }
  }

  private async pipeSegmentsWithInit(
    output: PassThrough,
    initSegment: Buffer | null,
    segmentUrls: string[],
  ): Promise<void> {
    try {
      if (initSegment) {
        output.write(initSegment);
      }
      for (const url of segmentUrls) {
        if (!output.writable) break;
        output.write(await this.downloadSegment(url));
      }
      output.end();
    } catch (err) {
      output.destroy(err as Error);
    }
  }

  private async downloadSegment(url: string): Promise<Buffer> {
    const { data } = await firstValueFrom(
      this.httpService.get(url, { responseType: 'arraybuffer' }),
    );
    return Buffer.from(data);
  }
}
