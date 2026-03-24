# Desktop (Tauri + React)

## Стек

- **Tauri v2** — нативная оболочка, Rust backend
- **React 19** + Vite — фронтенд
- **Tailwind CSS 4** — стили
- **Zustand** — стейт-менеджмент
- **TanStack Query** — серверный стейт, кеширование, пагинация
- **React Router 7** — роутинг
- **Radix UI** — примитивы (Slider, Dialog и тд)
- **Howler.js** — аудио движок
- **Biome** — линтер + форматтер (НЕ ESLint/Prettier)
- **pnpm** — пакетный менеджер

## Структура

```
desktop/
  src/
    components/    # React компоненты
      layout/      # AppShell, NowPlayingBar, Sidebar, Titlebar
      music/       # TrackCard, PlaylistCard, и тд
      ui/          # Skeleton, HorizontalScroll, общие UI
    pages/         # Home, Library, Search, TrackPage, UserPage, PlaylistPage
    stores/        # Zustand stores (player.ts, auth.ts)
    lib/           # Утилиты (audio.ts, api.ts, cache.ts, hooks.ts, cdn.ts)
  src-tauri/
    src/           # Rust: audio_server, proxy_server, proxy, discord, tray
    capabilities/  # Tauri permissions (default.json)
```

## i18n (ОБЯЗАТЕЛЬНО)

- **ВСЕ пользовательские строки** должны быть через `t('key')` из `react-i18next`. НИКОГДА не хардкодить текст на английском/русском в JSX.
- Переводы лежат в `src/i18n/locales/{en,ru}.json`. При добавлении/изменении строк — обновлять ОБА файла.
- Плюрализация для русского: `_one`, `_few`, `_many` (не только `_one`/`_other` как в английском).

## Правила для React

- **Не раздувать файлы.** Если файл начинает становиться большим, смешивает несколько ответственностей или его уже тяжело читать/держать в голове — разносить на маленькие модули, компоненты, хуки и утилиты. Это правило относится ко всему фронту и к Rust-коду тоже.
- **Не дублировать код.** Если одна и та же функция, логика, парсинг, маппинг, форматирование или UI-паттерн нужны больше чем в одном месте — выносить в shared-хуки, utils, helpers, shared components или Rust-модули.
- **Писать переиспользуемо, а не одноразово.** Не захардкодивать решение только под один экран/кейс, если задача по природе общая. Сразу проектировать интерфейсы, функции и компоненты так, чтобы их можно было безопасно переиспользовать в других местах без копипасты.
- **Фронт должен быть тонким.** На фронте по возможности оставлять только рендер, композицию UI, минимальную оркестрацию и лёгкий state binding.
- **Не тащить тяжёлую логику в React.** Парсинг, тайминг, scheduling, агрегации, дорогие вычисления, потоковую обработку, файловую работу, сетевой orchestration и всё горячее по CPU/IO по возможности выносить из фронта.
- **Большие наборы данных — только через virtualization.** Если у списка/сетки потенциально много элементов, использовать shared `VirtualList` / `VirtualGrid` и рендерить только то, что реально находится на экране плюс небольшой overscan.
- **Не рендерить невидимое.** Не держать в DOM сотни/тысячи карточек или строк только потому, что "оно работает". На экране должны жить только видимые элементы.
- **React.memo** на все компоненты, которые могут ре-рендериться без причины.
- **Изолированные подписки.** Каждый компонент подписывается только на нужные поля через Zustand selectors: `usePlayerStore((s) => s.isPlaying)`, а не `usePlayerStore()`.
- **60fps анимации через DOM refs**, НЕ через React state. Пример: ProgressSlider обновляет `ref.style.left` в `subscribe()` listener, React не перерендеривается.
- **useSyncExternalStore** — для аудио-стейта (currentTime, duration). Snapshot функция должна возвращать стабильное значение (напр. `Math.floor()` для секунд), иначе 60 ре-рендеров/сек.
- **TanStack Query**: использовать `staleTime`, `setQueriesData` для optimistic updates, `invalidateQueries` с задержкой если API eventual consistent.
- **useCallback/useMemo** — только где реально нужно (тяжёлые вычисления, пропсы в memo-компоненты). Не на каждую функцию.
- **Data Storage** - НЕ используй localStorage, на проде при каждом запуске меняется порт. Для хранения данных используй tauri storage, примеры есть, например, у auth компонента.
- **Desktop adaptive layout обязателен.** Хотя это desktop-app, интерфейсы нужно проектировать под разные размеры и соотношения: узкие окна, вертикальные мониторы, 16:9, 21:9, split-view. Нельзя проектировать страницы только под один "широкий горизонтальный" макет.

## Правила для Tauri (Rust)

- **Тяжёлое выносить в Rust.** Если логику можно надёжно и дешевле выполнить в Rust, чем гонять её через React/JS, приоритет у Rust.
- **Rust-модули тоже держать маленькими.** Не собирать большие god-files; делить код по ответственности, чтобы изменения были локальными и предсказуемыми.
- **Не грузить фронт тем, что ему не нужно.** Во фронт не прокидывать лишние данные и лишние события, если можно отдать уже подготовленный, компактный результат.
- **Warp** для HTTP серверов. НЕ менять на actix/axum — warp уже async на tokio, конкурентный из коробки.
- **reqwest** для HTTP клиента. НЕ писать свой HTTP клиент.
- **tokio** рантайм. НЕ использовать std::thread для I/O. Блокирующие операции — через `tokio::spawn_blocking`.
- **Кеширование в прокси**: cacheable GET-ответы (image/*, font/*, css, js без no-store/no-cache) сохраняются в `{cache_dir}/assets/`. Ключ — SHA256(url). Запись на диск — `tokio::spawn`, не блокировать ответ.
- **Audio-сервер**: раздаёт MP3 из `{cache_dir}/audio/` с поддержкой Range requests. Читать файлы через `tokio::fs`, не `std::fs`.
- **`#[cfg(not(dev))]`** для localhost plugin и navigate. В dev — Vite devUrl.
- **Не буферизовать** большие ответы целиком если не нужно кешировать — стримить через `Body::wrap_stream`.
- **Ошибки**: возвращать HTTP-статусы (502, 400, 404), НЕ паниковать. `.unwrap()` допустим только для заведомо валидных операций (builder patterns).
- **Проверка**: `cargo check` после каждого изменения в Rust.

## Акцентный цвет и CSS-переменные

Акцентный цвет задаётся пользователем в настройках (`stores/settings.ts` → `accentColor`). `ThemeProvider` при смене цвета обновляет CSS-переменные на `:root`:

- `--color-accent` — основной цвет (#hex)
- `--color-accent-hover` — чуть светлее (+26 на каждый канал)
- `--color-accent-glow` — `rgba(r,g,b, 0.2)` для теней/свечений
- `--color-accent-selection` — `rgba(r,g,b, 0.3)` для `::selection`

**Всегда** использовать эти переменные, НЕ хардкодить `#ff5500` или `rgba(255,85,0,...)`. Если нужен акцент с другой прозрачностью — добавить новую переменную в `ThemeProvider` и `:root` в `index.css`.

## Производительность CSS (КРИТИЧНО)

Это десктопное приложение на WebView (WebKitGTK / WebView2), а не браузер. WebView НЕ throttlит таймеры/rAF при сворачивании окна. Каждый лишний repaint стоит дорого.

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

### Transitions и анимации
- **НИКОГДА** не анимировать `font-size`, `width`, `height`, `padding`, `margin` — это layout properties, вызывают reflow (пересчёт геометрии ВСЕГО поддерева).
- Для визуального увеличения текста — `transform: scale()` вместо `font-size`. Scale — composite-only, GPU.
- Безопасные для анимации свойства: `transform`, `opacity`, `color`, `background-color`.
- `will-change: transform` — на элементах с частыми style changes (слайдеры, progress bars). Но не злоупотреблять — каждый `will-change` создаёт GPU layer и ест память.

### DOM-обновления
- **querySelectorAll** — дорого. Вызывать один раз при mount, кешировать в `useRef`. Не вызывать в циклах/таймерах.
- **scrollTo({ behavior: 'smooth' })** — запускает CSS-анимацию скролла. Не вызывать чаще чем раз в 200ms.

## Производительность JS

### Таймеры и циклы обновления
- **requestAnimationFrame** — 60 вызовов/сек. Использовать только если нужна синхронизация с vsync (drag, жесты). Для progress bars достаточно `setInterval(100)` (~10fps).
- **Частота обновления должна соответствовать скорости изменения данных.** Прогресс-бар аудио: 10-30fps. Синхронизированная лирика: 5fps (строки меняются раз в 2-4 сек). MediaSession sync: раз в 5 сек.
- **Visibility API** — при `document.visibilityState === 'hidden'` полностью останавливать все UI-обновления (setInterval/rAF). Оставлять только фоновые задачи (MediaSession sync). WebView НЕ замедляет таймеры автоматически.

### Аудио engine (lib/audio.ts)
- `currentTime` и `duration` кешируются в переменных, обновляются один раз за tick через `syncFromHowl()`. Listeners читают кеш, НЕ вызывают `howl.seek()` / `howl.duration()` напрямую.
- `subscribe()` + `notify()` — паттерн для useSyncExternalStore. Notify вызывается в setInterval, НЕ в rAF.
- При `visibilitychange: hidden` — progress loop останавливается, запускается background timer (5сек) только для MediaSession.

### Общие правила
- **Не подписываться на audio subscribe из компонентов без необходимости.** Если данные обновляются редко (лирика, waveform), использовать свой `setInterval` с подходящей частотой.
- **Partial DOM updates.** Если из 100 элементов изменился один — обновлять только его, не проходить по всему списку.
- **Кешировать DOM-ссылки.** `querySelectorAll` → `useRef<HTMLElement[]>`, обновлять при mount/unmount.
- **Сначала думать о цене решения.** Перед добавлением новой логики оценивать цену по re-render, layout, paint, GC, bridge JS↔Rust, I/O и памяти. Если это можно убрать архитектурно — убирать, а не маскировать `memo`.

## Проверки

- `npx tsc --noEmit` — типы React/TS
- `cargo check` — компиляция Rust
- `npx biome check` — линтинг
