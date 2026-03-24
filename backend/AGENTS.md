# Backend (NestJS BFF)

## Стек

- **NestJS 11** — фреймворк
- **TypeORM** — ORM, PostgreSQL
- **pnpm** — пакетный менеджер
- **Biome** — линтер (НЕ ESLint). Настройки: `useImportType: off`, `unsafeParameterDecoratorsEnabled: true`

## Архитектура

- **BFF паттерн**: проксирует все вызовы к SoundCloud API.
- **Auth**: OAuth 2.1 + PKCE, сессии в PostgreSQL. Аутентификация через `x-session-id` header.
- **Stream proxy**: `GET /tracks/:id/stream?format=http_mp3_128` — проксирует аудио с поддержкой Range headers.
- **OpenAPI**: `/openapi.json`, Swagger UI — `/api`.
- **Модули**: auth, me, tracks, playlists, users, likes, reposts, resolve, health.

## Правила

- **Использовать декораторы NestJS** (@Controller, @Injectable, @Get и тд). НЕ писать роутинг вручную.
- **TypeORM** для работы с БД. НЕ писать сырой SQL если можно обойтись query builder / repository API.
- **class-validator + class-transformer** для валидации DTO. НЕ валидировать вручную.
- **ConfigService** для конфигурации. НЕ читать process.env напрямую в сервисах.
- **HttpModule (axios)** для запросов к SoundCloud API. НЕ использовать node-fetch или свой HTTP клиент.
- **Ошибки**: бросать NestJS exceptions (NotFoundException, BadRequestException и тд). НЕ возвращать ошибки в body с 200 статусом.
- **Guard'ы** для аутентификации. НЕ проверять сессию внутри каждого контроллера вручную.
- **Docker**: multi-stage Dockerfile, docker-compose с dev/prod профилями.

## Проверки

- `npx tsc --noEmit` — типы
- `npx biome check` — линтинг