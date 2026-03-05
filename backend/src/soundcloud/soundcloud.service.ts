import { Readable } from 'node:stream';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { ScTokenResponse } from './soundcloud.types.js';

@Injectable()
export class SoundcloudService {
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiBaseUrl = this.configService.get<string>('soundcloud.apiBaseUrl')!;
    this.authBaseUrl = this.configService.get<string>('soundcloud.authBaseUrl')!;
    this.clientId = this.configService.get<string>('soundcloud.clientId')!;
    this.clientSecret = this.configService.get<string>('soundcloud.clientSecret')!;
    this.redirectUri = this.configService.get<string>('soundcloud.redirectUri')!;
  }

  get scClientId() {
    return this.clientId;
  }

  get scRedirectUri() {
    return this.redirectUri;
  }

  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<ScTokenResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<ScTokenResponse>(
        `${this.authBaseUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json; charset=utf-8',
          },
        },
      ),
    );
    return data;
  }

  async refreshAccessToken(refreshToken: string): Promise<ScTokenResponse> {
    const { data } = await firstValueFrom(
      this.httpService.post<ScTokenResponse>(
        `${this.authBaseUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json; charset=utf-8',
          },
        },
      ),
    );
    return data;
  }

  async signOut(accessToken: string): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.authBaseUrl}/sign-out`,
        JSON.stringify({ access_token: accessToken }),
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json; charset=utf-8',
          },
        },
      ),
    ).catch(() => {});
  }

  async apiGet<T>(path: string, accessToken: string, params?: Record<string, unknown>): Promise<T> {
    const config: AxiosRequestConfig = {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json; charset=utf-8',
      },
      params,
    };

    const { data } = await firstValueFrom(
      this.httpService.get<T>(`${this.apiBaseUrl}${path}`, config),
    );
    return data;
  }

  async apiPost<T>(
    path: string,
    accessToken: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const mergedConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/json; charset=utf-8',
        ...config?.headers,
      },
    };

    const { data } = await firstValueFrom(
      this.httpService.post<T>(`${this.apiBaseUrl}${path}`, body, mergedConfig),
    );
    return data;
  }

  async apiPut<T>(
    path: string,
    accessToken: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const mergedConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/json; charset=utf-8',
        ...config?.headers,
      },
    };

    const { data } = await firstValueFrom(
      this.httpService.put<T>(`${this.apiBaseUrl}${path}`, body, mergedConfig),
    );
    return data;
  }

  async proxyStream(
    url: string,
    accessToken: string,
    range?: string,
  ): Promise<{ stream: Readable; headers: Record<string, string> }> {
    const headers: Record<string, string> = {
      Authorization: `OAuth ${accessToken}`,
    };
    if (range) {
      headers.Range = range;
    }

    const { data, headers: resHeaders } = await firstValueFrom(
      this.httpService.get(url, {
        headers,
        responseType: 'stream',
        maxRedirects: 5,
      }),
    );

    const proxyHeaders: Record<string, string> = {};
    for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      if (resHeaders[key]) {
        proxyHeaders[key] = String(resHeaders[key]);
      }
    }

    return { stream: data as Readable, headers: proxyHeaders };
  }

  async apiDelete<T>(path: string, accessToken: string): Promise<T> {
    const config: AxiosRequestConfig = {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json; charset=utf-8',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    };

    const { data, status } = await firstValueFrom(
      this.httpService.delete<T>(`${this.apiBaseUrl}${path}`, config),
    );
    if (status === 204 || data === undefined || data === null || data === '') {
      return null as T;
    }
    return data;
  }
}
