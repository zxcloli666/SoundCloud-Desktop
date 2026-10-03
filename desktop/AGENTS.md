# Desktop (Tauri + React)

## Стек

### Frontend

- **Tauri v2** — нативная оболочка
- **React 19** + Vite — фронтенд
- **Tailwind CSS 4** — стили (`@tailwindcss/vite`)
- **Zustand** — стейт-менеджмент, персист через `lib/tauri-storage.ts` (НЕ localStorage)
- **TanStack Query** — серверный стейт, кеширование, инвалидация
- **@tanstack/react-virtual** — основа для `VirtualList` / `VirtualGrid`
- **React Router 7** — роутинг
- **Radix UI** — dialog, popover, slider
- **@dnd-kit** — drag-and-drop (очередь и т.п.)
- **i18next + react-i18next** — переводы
- **sonner** — тосты
- **react-markdown** — markdown в новостях/комментариях
- **qr-code-styling** — QR-логин
- **simple-icons / lucide-react** — иконки
- **Biome** — линтер + форматтер (НЕ ESLint/Prettier)
- **pnpm** — пакетный менеджер

### Rust (src-tauri)

- **tokio** — async рантайм, в `setup` запускается единый `Runtime` и держится живым отдельным `std::thread`
- **warp** — все HTTP-серверы (proxy / static / static_server / wallpapers)
- **reqwest** (rustls, socks, stream) — единственный HTTP-клиент
- **rodio** + **symphonia** (mp3, aac/m4a/mp4, ogg) — аудио-движок и декодеры
- **cpal** — устройства вывода
- **biquad** — параметрический EQ
- **rustfft** — анализатор спектра (FFT в выделенном потоке)
- **souvlaki** — системные media controls (MPRIS / SMTC / NowPlaying)
- **discord-rich-presence** — Discord RPC
- **chrono / tracing / serde / sha2 / base64 / hex** — служебные
- Внутренние крейты из `../utils/`: `call-client`, `decrypt-client`, `dpi-desync`

## Структура

```
desktop/
  src/
    App.tsx, main.tsx
    components/
      layout/        AppShell, Sidebar, Titlebar, NowPlayingBar, StarSubscription
      ui/            VirtualList, VirtualGrid, GlassButton, GlassCard, GlassHeroPanel,
                     HorizontalScroll, Skeleton, Avatar, CopyLinkButton
      music/         TrackCard, PlaylistCard, LikeButton, EqualizerPanel, LyricsPanel,
                     QueuePanel, FloatingComments, AddToPlaylistDialog,
                     TrackStatusBadges, TrackTitleArtist, UploadKindDot,
                     YMImportDialog, YMImportFloatingStatus,
                     cluster/   (рекомендательные «соседи»: ClusterHeader/Row, NeighborCard…)
                     soundwave/ (бесконечная лента «волны»: home-block, similar-block,
                                 waveform, vibe-search-bar, strip, ambient, lock-overlay/…)
      album/         AlbumHero, AlbumCast, AlbumTrackList, AlbumTrackRow,
                     AlbumPlayButton, AlbumCoverArtifact, useAlbumData
      artist/        ArtistHero, Artist*Tab (About/Tracks/Albums/Covers/Related),
                     socials, useArtistData, wave/ArtistSoundWave
      user/          IdentityHub, AuraField, AuraPicker, StarField, StatOrb,
                     TabDock, UserTabs, UserChips, UserSearchBox, ThemedTrackRow,
                     AvatarArtifact, FollowBtn, useUserAura
      discover/      DiscoverHero, DiscoverSpotlight, AlbumsCatalog,
                     ArtistsCatalog, *GridCard, FilterRow, InfiniteSentinel,
                     useDebouncedValue, visuals
      auth/          QrCode, QrLinkSheet, useQrLink
      settings/      CallProxySection
      NewsToast.tsx, SessionRecoveryModal.tsx, ThemeProvider.tsx, UpdateChecker.tsx
    pages/           Home, Library, Search, Discover, Login, Settings, OfflinePage,
                     TrackPage, UserPage, PlaylistPage, AlbumPage, ArtistPage
    stores/          player, auth, auth-recovery, settings, app-status,
                     lyrics, news, searchHistory, searchPrefs, ym-import
    lib/             api / api-client / streaming — HTTP к нашему бэку
                     audio — оркестратор плеера + слушатель `audio:*` событий
                     asset-url, scproxy — проксирование изображений
                     cache, premium-cache, offline-index, host-health — клиентские кеши
                     equalizer, lyrics, waveform, soundwave, discover, dislikes,
                     likes, recsFeedback, subscription, track-display, queue-autopilot,
                     useTrackPlay — фичевая логика
                     auth-recovery, auth-status, use-oauth-flow, qr-link — авторизация
                     events, hooks, useAutoHide — общие утилиты
                     diagnostics — `trackedInvoke`, watchdog event-loop, slow-call логи
                     tauri-storage — `StateStorage` для zustand persist на ФС
                     call, discord, dpi, tray, window, platform, update-check, semver
                     query-client, formatters, icons, constants
    i18n/locales/    en.json, ru.json
  src-tauri/
    src/
      lib.rs, main.rs    — bootstrap, регистрация команд, `scproxy://` scheme
      app/               diagnostics (app_log_dir/desktop.log + FD-monitor на Linux), tray
      audio/             engine, decode (symphonia + cached normalization gain),
                         eq (biquad), analyser (rustfft, отдельный поток),
                         device (cpal + follow-default-output),
                         media_controls (souvlaki), tick (emit `audio:tick`/`audio:ended`),
                         timing (lyrics / floating-comments timelines), state, types, commands
      network/           proxy (`scproxy://` handler, cache по SHA256(url)),
                         proxy_server (warp: `/p/...`, `/img/...`),
                         static_server (warp: `/wallpapers/...`),
                         server (общий cors + регистрация портов),
                         image_cache (постоянный кеш картинок в app_data_dir/images),
                         dpi (dpi-desync через SOCKS, подмешивается в reqwest builder),
                         call (call-client agent, флаг enabled в `call_enabled.json`)
      track_cache/       commands, state, direct_download, sc_anon/{mod,hls}
      discord/           mod + commands
      import/            ym (Yandex Music likes → SoundCloud)
      shared/            constants (whitelisted домены и пр.)
    capabilities/        Tauri permissions (default.json)
```

### Локальные директории (создаются в `setup`)

- `app_cache_dir/audio/` — кеш треков
- `app_cache_dir/audio_liked/` — отдельная квота под лайки
- `app_cache_dir/assets/` — кеш ответов прокси (картинки/шрифты/css/js)
- `app_cache_dir/wallpapers/` — скачанные обои
- `app_data_dir/images/` — постоянный кеш картинок (чистится только вручную)
- `app_data_dir/*.json` — zustand-сторы через `tauri-storage.ts`
- `app_data_dir/call_enabled.json` — флаг call-режима
- `app_log_dir/desktop.log` — лог из `diagnostics_log`

## i18n (ОБЯЗАТЕЛЬНО)

- **ВСЕ пользовательские строки** — через `t('key')` из `react-i18next`. НИКОГДА не хардкодить английский/русский текст
  в JSX.
- Переводы в `src/i18n/locales/{en,ru}.json`. При добавлении/изменении строк — обновлять ОБА файла.
- Плюрализация для русского: `_one`, `_few`, `_many` (а не `_one`/`_other` как в английском).

## Правила для React

- **Не раздувать файлы.** Большие/мультиответственные файлы — разбивать на модули, компоненты, хуки и утилиты. Правило
  относится и к Rust-коду.
- **Не дублировать код.** Повторяющаяся логика/маппинг/форматирование/UI-паттерн — в shared-хуки, utils, helpers, shared
  components или Rust-модули.
- **Переиспользуемо, а не одноразово.** Сразу проектировать функции/компоненты под повторное использование.
- **Фронт должен быть тонким.** Рендер, композиция, оркестрация, лёгкий state binding — всё остальное по возможности в
  Rust.
- **Не тащить тяжёлую логику в React.** Парсинг, scheduling, агрегации, тяжёлые вычисления, потоковая обработка,
  файловая работа, сетевой orchestration — выносить из фронта.
- **Большие наборы данных — только через virtualization.** Использовать shared `VirtualList` / `VirtualGrid` (на
  `@tanstack/react-virtual`) с разумным overscan.
- **Не рендерить невидимое.** Никаких «оно работает, пусть висит» — на экране только видимые элементы плюс overscan.
- **React.memo** — на компоненты, склонные к лишним ре-рендерам.
- **Изолированные подписки.** Zustand-селекторы: `usePlayerStore((s) => s.isPlaying)`, а не `usePlayerStore()`.
- **60fps анимации через DOM refs**, НЕ через React state. Пример: `ProgressSlider` обновляет `ref.style.left` внутри
  `subscribe()` listener'а — React не ре-рендерится.
- **useSyncExternalStore** — для аудио-стейта (`currentTime`, `duration`). Snapshot должен возвращать стабильное
  значение (например, `Math.floor()` для секунд), иначе 60 ре-рендеров/сек.
- **TanStack Query**: `staleTime`, `setQueriesData` для optimistic updates, `invalidateQueries` с задержкой если бэк
  eventual-consistent.
- **useCallback/useMemo** — только где реально нужно (тяжёлые вычисления, пропсы в memo-компоненты). Не на каждую функцию.
- **Data storage.** НЕ используй `localStorage` — на проде при каждом запуске меняется порт. Для zustand-persist
  использовать `tauri-storage.ts` (см. `stores/auth.ts`, `stores/player.ts`).
- **Desktop adaptive layout обязателен.** Хотя это desktop-app, интерфейсы должны работать на разных размерах и
  пропорциях: узкие окна, вертикальные мониторы, 16:9, 21:9, split-view. Не проектировать только под один «широкий
  горизонтальный» макет.
- **Все инвоки — через `trackedInvoke`** из `lib/diagnostics.ts` (импорт как `invoke`). Голый `invoke` из
  `@tauri-apps/api/core` использовать только внутри самой `diagnostics.ts`.

## Правила для Tauri (Rust)

- **Тяжёлое выносить в Rust.** Если логика дешевле/надёжнее в Rust — приоритет у Rust.
- **Rust-модули тоже держать маленькими.** Не строить god-files; делить по ответственности, чтобы изменения были
  локальными.
- **Не грузить фронт лишним.** Не прокидывать в JS лишние данные/события, если можно отдать уже подготовленный
  компактный результат.
- **Warp** — единственный HTTP-сервер. НЕ переключаться на actix/axum: warp уже async на tokio.
- **reqwest** — единственный HTTP-клиент. НЕ писать свой. Не забывать прогонять билдер через `network::dpi::apply(...)`,
  если запрос должен уметь идти через SOCKS-десинк.
- **tokio** — рантайм. НЕ использовать `std::thread` для I/O. Блокирующие операции — `tokio::spawn_blocking`.
  Долгоживущие фоновые потоки (audio output, audio-tick, FFT) — это допустимый случай для именованных
  `std::thread::Builder`.
- **Не плодить рантаймы.** Единый `Runtime` создаётся в `setup` и шарится через `rt.handle()`; новый Runtime в фичах не
  создавать.
- **Аудио-движок (Rust).** Состояние — `AudioState`, выделенный поток `audio-output` рулит `cpal`-устройством и
  обрабатывает `AudioThreadCmd` (переключение/восстановление device). Поток `audio-tick` шлёт `audio:tick` (позиция, ~10
  Гц), `audio:ended`, `audio:device-reconnected`, плюс лирика и floating-comments через `timing::process_*`. Frontend
  ТОЛЬКО зовёт `audio_*` команды и слушает `audio:*` / `media:*` события.
- **`get_pos()` у player'а** — единственный источник истины для позиции. Не вычислять позицию из времени старта.
- **Кеширование в прокси.** Cacheable GET-ответы (image/*, font/*, text/css, javascript без `no-store`/`no-cache`)
  пишутся в `{cache_dir}/assets/`. Ключ — `SHA256(url)`. Запись на диск — `tokio::spawn`, не блокировать ответ.
  Картинки, идущие через `/img/...`, кешируются отдельно в `{data_dir}/images/` и НЕ чистятся автоматически.
- **Track cache.** Источников два: `sc_anon` (HLS через анонимный SC API) и `direct_download` (наше SCD-хранилище).
  Раздаётся через статический сервер из `{cache_dir}/audio[_liked]/` с поддержкой Range. Файлы — через `tokio::fs`, не
  `std::fs`.
- **Custom URI scheme `scproxy://`** регистрируется в `lib.rs` как асинхронный, отвечает через `proxy::handle_uri`. На
  non-macOS используется sharded `http://scproxy-N.localhost:PORT/p/...` (N=0..19) — обходит per-host лимит соединений
  WebView и параллелит загрузки.
- **`#[cfg(not(dev))]`** — для localhost plugin / navigate. В dev — Vite devUrl.
- **Не буферизовать** большие ответы целиком, если не нужно кешировать — стримить через `Body::wrap_stream`.
- **Ошибки** — возвращать HTTP-статусы (502, 400, 404), НЕ паниковать. `.unwrap()` допустим только для заведомо валидных
  builder-операций, `.expect("...")` — только в `setup` для критической инициализации.
- **Диагностика.** Тяжёлые/подозрительные операции логировать через `app::diagnostics::log_native` (пишет в
  `app_log_dir/desktop.log`). Фронту аналог — `trackedInvoke` + watchdog event-loop в `lib/diagnostics.ts`.
- **Проверка**: `cargo check` после каждого изменения в Rust.

## Акцентный цвет и CSS-переменные

Акцентный цвет задаётся в настройках (`stores/settings.ts` → `accentColor`). `ThemeProvider` обновляет CSS-переменные на
`:root`:

- `--color-accent` — основной цвет (`#hex`)
- `--color-accent-hover` — чуть светлее (+26 на каждый канал)
- `--color-accent-glow` — `rgba(r,g,b, 0.2)` для теней/свечений
- `--color-accent-selection` — `rgba(r,g,b, 0.3)` для `::selection`

**Всегда** использовать эти переменные. НЕ хардкодить `#ff5500` или `rgba(255,85,0,...)`. Нужна другая прозрачность —
добавить новую переменную в `ThemeProvider` и `:root` в `index.css`.

## Режимы производительности (perf modes)

Дизайн намеренно тяжёлый (backdrop-filter, частицы, aurora-орбы, per-char караоке). Чтобы он масштабировался под слабое
железо, есть единый рубильник `perfMode: 'light' | 'medium' | 'beauty'` (`stores/settings.ts`, дефолт **beauty**, экран
в Настройки → Производительность). **`beauty` обязан быть байт-в-байт как без режимов** — это продакшен-дизайн, его не
трогаем.

**Как устроено:**

- `ThemeProvider` пишет `html[data-perf]`; `lib/perf.ts` отдаёт хук `usePerfMode()` → профиль (стабильный объект на
  режим):
  - `blur(px)` — масштабирует радиус блюра. beauty→px, medium→~½, light→**0**.
  - `particles(n)` — масштабирует число декоративных элементов. beauty→n, medium→~45%, light→**0**.
  - `idleAnim` — крутить ли idle-анимации (дрейфы, твинклы, спины, маркизы). light→`false`.
  - `atmosphere` — монтировать ли атмосферу страницы (орбы, звёздные поля, ambient-слои). light→`false`.
  - `glow` — per-element `drop-shadow`/`box-shadow` свечения на частицах. medium/light→`false`.
  - `bloom` — монтировать ли тяжёлые фоновые блумы (`AmbientGlow`, per-card гало). light→`false`.
- Вне React: `getPerfProfile(useSettingsStore.getState().perfMode)`.
- **Глобальный visibility-gate**: один слушатель в `lib/perf.ts` (`setupVisibilityGate`) ставит `html[data-app-hidden]`,
  а `index.css` паузит ВСЕ анимации при свёрнутом окне (WebView не throttle'ит). `lib/audio.ts notify()` тоже
  early-return при hidden. **Не изобретать поштучную visibility-паузу в компонентах** — она уже глобальная.

**Гибрид — где что гейтить:**

- **CSS-классовые эффекты** (`.glass`/`.glass-featured`/`.npb-glass`, кейфреймы в `index.css`) — гейтятся в `index.css`
  через `[data-perf="…"]`: радиусы на `var(--glass-blur | --glass-blur-strong | --glass-blur-soft)`, light = solid-tint
  своп. Добавляешь новый glass-класс — вешай радиус на `var(--glass-blur)` и добавь его в light-блок.
- **Инлайновые эффекты** (`style={{ backdropFilter, filter, animation }}`, число частиц, целые декоративные
  поддеревья) — гейтятся в компоненте через `usePerfMode()`. Инлайн-стиль CSS-классом не перебить, только JS.

**Паттерны** (правило: выражай эффект ЧЕРЕЗ API — тогда в beauty `blur()`/`particles()` вернут оригинал, булевы =
`true`,
и beauty сходится к исходнику сам; НИКОГДА не хардкодить уменьшенную константу):

```tsx
const perf = usePerfMode();
const b = perf.blur(40);
// blur → 0 в light: дропни backdrop-filter и подставь solid-tint (тёмный фрост сохраняется плоским)
style = {
{
  backdropFilter: b ? `blur(${b}px) saturate(160%)` : undefined,
          WebkitBackdropFilter
:
  b ? `blur(${b}px) saturate(160%)` : undefined,
          background
:
  b ? '<оригинальный bg>' : 'rgba(20,20,24,0.85)',
}
}
// частицы:        SEEDS.slice(0, perf.particles(SEEDS.length))   // 0 → не рендерить
// атмосфера/блум: {perf.atmosphere && <AuraField/>}  /  {perf.bloom && <Glow/>}
// idle-анимация:  animation: perf.idleAnim ? 'drift 8s infinite' : undefined   // hover-анимации НЕ трогать
// glow:           boxShadow: perf.glow ? '0 0 6px var(--color-accent-glow)' : undefined
```

- **`scale` на blur запрещён** (пересчёт гаусса каждый кадр, см. коммент `sw-aurora` в `index.css`). Если дизайн требует
  «дыхание» орба в beauty — ДВА кейфрейма: `orb-drift` (со `scale`) для beauty, `orb-drift-lite` (только `translate3d`)
  для medium; компонент выбирает по `perf.mode === 'beauty'`. Образец — `AuraField` / `search/Atmosphere`.
- `settings.glassBlur` — **мёртвый**, не использовать; блюр гонит только `perfMode`.

## Как верстать экран

1. **Дизайн — через skill.** Любой новый экран / редизайн / нетривиальный компонент верстать с подключённым skill
   **`frontend-design`** — он даёт отличительный, не «AI-generic» вид. Без него выходит шаблонно. (Концепт-метафора
   важнее раскладки — не рескин.)
2. **Атмосферный фон** — `fixed inset-0` + `contain:strict` + `translateZ(0)`, контент `relative z-10` +
   `isolation:isolate` (см. `AuraField` / `search/Atmosphere`). Монтаж гейтить на `perf.atmosphere`.
3. Каждый инлайновый `backdrop-filter`/`filter:blur` — через `perf.blur()` + solid-tint своп на 0.
4. Любое декоративное поле частиц/звёзд — счётчик через `perf.particles()`, свечения под `perf.glow`, анимации под
   `perf.idleAnim`.
5. Большие наборы — только `VirtualList`/`VirtualGrid`; горизонтальные ленты — кап/виртуализация, не «пусть висит».
6. Проверить во ВСЕХ трёх режимах: beauty = как задумано, light = плоско/быстро но узнаваемо, medium = посередине.
7. **Выделение текста.** Весь UI по умолчанию `user-select:none` (`body` в `index.css`) — это нативный десктоп-фил,
   нельзя выделить случайный div. Копируемый ТЕКСТ-КОНТЕНТ (описания, био, тела комментов, markdown/новости) опт-инить
   классом `selectable` (наследуется детям); инпуты/`[contenteditable]` уже selectable глобально. Хром — заголовки,
   имена, числа, длительности, бейджи, лейблы, лирику (click-to-seek) — НЕ опт-инить.

## Производительность CSS (КРИТИЧНО)

Это десктоп на WebView (WebKitGTK / WebView2), не браузер. WebView НЕ throttle'ит таймеры/rAF при сворачивании. Каждый
лишний repaint стоит дорого.

### Blur и backdrop-filter
- **`filter: blur()` и `backdrop-filter: blur()`** — самые дорогие CSS-свойства. Blur пересчитывается при КАЖДОМ repaint в той же compositing layer.
- **НИКОГДА** не класть динамический контент (слайдеры, анимации, скролл) в один compositing layer с blur-элементом. Blur-фон и контент ОБЯЗАНЫ быть в разных слоях.
- Blur-элемент: `contain: strict` + `transform: translateZ(0)` — выносит в отдельный GPU layer.
- Контент поверх blur: `isolation: isolate` — создаёт новый stacking context, repaints не каскадируют к blur.
- Пример правильной структуры:
  ```tsx
  <div className="relative">
    {/* GPU-isolated blur background */}
    <div className="absolute inset-0 blur-3xl" style={{ contain: 'strict', transform: 'translateZ(0)' }} />
    {/* Content — repaints here don't recalculate blur */}
    <div className="relative" style={{ isolation: 'isolate' }}>
      <DynamicContent />
    </div>
  </div>
  ```

### Атмосферный слой страницы (свечение / орбы)

Иммерсивные страницы (Search, UserPage, ArtistPage, Discover, AlbumPage) накладывают фон-свечение — дрейфующие орбы (
`mix-blend-screen`, `blur 120–160px`). Контент скроллится внутри `<main>` (`overflow-y-auto`, глобальный `pb-[136px]`
под парящий NowPlayingBar), а плеер парит ПОВЕРХ контента.

- **Атмосферный слой позиционируй `fixed inset-0`, НЕ `absolute inset-0`.** `absolute` привязывает свечение к боксу
  контента: на длинной странице орбы уезжают со скроллом, а низ вьюпорта (за парящим плеером) и боковые края остаются
  тёмными. `fixed` крепит слой к вьюпорту — свечение всегда на весь экран, включая низ и бока.
- Обязательно: `pointer-events-none` + `contain: strict` + `transform: translateZ(0)` (свой GPU-слой). Контент над ним —
  `relative z-10` + `isolation: isolate` (порядок стекинга среди positioned-сиблингов = DOM-order, так что `fixed`-фон
  остаётся позади).
- Распредели орбы так, чтобы хотя бы один светил **снизу** (`-bottom-[…]`), иначе нижняя кромка пустая даже при `fixed`.
- **Вспоминать когда:** делаешь/правишь страницу с фоновой атмосферой и «снизу/по бокам нет свечения» или оно «уезжает
  при скролле». Общий слой — `components/user/AuraField.tsx` (User/Artist/Discover/Album), у Search свой
  `components/search/Atmosphere.tsx`; оба уже `fixed`.

### Transitions и анимации

- **НИКОГДА** не анимировать `font-size`, `width`, `height`, `padding`, `margin` — это layout properties, вызывают
  reflow всего поддерева.
- Для визуального увеличения текста — `transform: scale()`, не `font-size`. Scale — composite-only, GPU.
- Безопасные для анимации: `transform`, `opacity`, `color`, `background-color`.
- `will-change: transform` — на элементах с частыми style changes (слайдеры, progress bars). Не злоупотреблять: каждый
  `will-change` — отдельный GPU layer и память.

### DOM-обновления

- **querySelectorAll** — дорого. Один раз на mount, кеш в `useRef`. Не в циклах/таймерах.
- **scrollTo({ behavior: 'smooth' })** — запускает CSS-анимацию скролла. Не чаще раза в 200ms.

## Производительность JS

### Таймеры и циклы обновления

- **requestAnimationFrame** — 60 вызовов/сек. Использовать только когда нужна синхронизация с vsync (drag, жесты). Для
  progress bars достаточно `setInterval(100)` (~10fps).
- **Частота обновления = скорости изменения данных.** Прогресс-бар: 10–30fps. Синхронизированная лирика: 5fps.
  MediaSession sync: раз в 5 сек.
- **Visibility API** — при `document.visibilityState === 'hidden'` полностью останавливать UI-обновления (
  setInterval/rAF). Оставлять только фоновые задачи (MediaSession sync). WebView НЕ замедляет таймеры автоматически.

### Аудио engine (lib/audio.ts)

- Сам декод и воспроизведение живут в Rust (`audio/engine.rs`). Frontend держит ровно две переменные — `cachedTime` /
  `cachedDuration` — и обновляет их по событию `audio:tick` от Rust.
- `subscribe()` + `notify()` — паттерн для `useSyncExternalStore`. `notify()` вызывается из listener'а `audio:tick`, НЕ
  в rAF.
- Listeners читают кеш, НЕ зовут лишних `invoke('audio_get_position')`. `invoke` на каждый кадр — гарантированный тормоз
  через JS↔Rust bridge.
- При `visibilitychange: hidden` тяжёлые UI-подписки тушатся; MediaSession и Discord Presence продолжают идти от событий
  Rust.
- Команды от media-keys / системных контролов приходят как `media:play|pause|toggle|next|prev|seek|seek-relative`. Не
  дублировать обработку в JS.

### Общие правила

- **Не подписываться на audio subscribe из компонентов без необходимости.** Если данные обновляются редко (лирика,
  waveform), завести свой `setInterval` с подходящей частотой.
- **Partial DOM updates.** Из 100 элементов изменился один — обновлять только его.
- **Кешировать DOM-ссылки.** `querySelectorAll` → `useRef<HTMLElement[]>`, обновлять при mount/unmount.
- **Сначала думать о цене решения.** Перед добавлением логики оценивать цену по re-render, layout, paint, GC, bridge
  JS↔Rust, I/O и памяти. Если можно убрать архитектурно — убирать, а не маскировать `memo`.

## Проверки

- `npx tsc --noEmit` — типы React/TS
- `cargo check` (в `src-tauri/`) — компиляция Rust
- `pnpm check` (или `npx biome check`) — линтинг + форматирование (Biome в режиме `--write`)