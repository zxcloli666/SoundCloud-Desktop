# Состояние форка

## Что уже отвязано

- Удалены экран покупки, промо-карточки, premium-бейджи и локальные блокировки настроек.
- Удалены premium bootstrap/cache и сохранение premium-флага в Tauri-сессии.
- Клиент использует только основные API, streaming и storage endpoints; STAR/pay endpoints удалены.
- Удалены проверка обновлений и новости исходного проекта.
- GitHub Actions больше не запрашивают `SoundCloud-Internal` и `INTERNAL_PAT`.
- Релизы создаются стандартным `softprops/action-gh-release`, без action и AI-секретов автора.
- Удалены workflow публикации в AUR/Flatpak с идентификаторами исходного автора.
- Удалён peer-network UI и `call-client`: публичный крейт был заглушкой, всегда возвращавшей `Disabled`.
- Удалены обе decrypt-заглушки и ветка `encrypted-hls`; неизвестные кандидаты скачивания теперь игнорируются.
- Удалён раздел «обход белых списков»: его настройка сохранялась, но нигде не использовалась.
- Удалены неподключённые floating-comments и неиспользуемые UI-компоненты.
- Удалён незавершённый альтернативный каркас `App/`, `bindings/` и `depens/`: он зависел от отсутствующих `Core`, `@sc/data` и `@sc/ui`. Рабочее приложение теперь однозначно находится в `desktop/`.
- Удалены остатки call/pay-топологии и фоновая отправка health-телеметрии с постоянным UUID устройства.
- Backend-адреса вынесены в единый `desktop/backend.config.json`, который используют frontend и Rust.
- Пассивная отправка истории прослушиваний, skip/full-play и feedback рекомендаций отключена в
  `desktop/backend.config.json`; явные действия пользователя (лайки, комментарии, плейлисты) не затронуты.
- Включён CSP, HTTP capability ограничен известными HTTPS-хостами, release-devtools и удалённая загрузка `react-scan` отключены.

## Что ещё зависит от внешней инфраструктуры

- Авторизация, каталог, рекомендации и медиапотоки обслуживаются внешним backend `scnative.space`.
- Локальная настройка HQ передаёт `hq=true`, но фактическое качество определяет streaming backend.
- Зашифрованные сегменты не поддерживаются; клиент использует только progressive/HLS-кандидаты.

## Настройка своих endpoints

Измените `desktop/backend.config.json`. Для backend без совместимых health/relay
сервисов установите `healthBase` и `relayZone` в `null`. Новый HTTPS-хост также
нужно явно разрешить в `desktop/src-tauri/capabilities/default.json`; подробности
описаны в `desktop/BACKEND_CONFIG.md`.

## Проверка

```powershell
cd desktop
pnpm install --frozen-lockfile
pnpm build
```

Полную Tauri/Rust-сборку нужно проверять в окружении с Rust toolchain и системными зависимостями Tauri.
