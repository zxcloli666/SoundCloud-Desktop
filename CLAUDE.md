# Desktop — десктопные приложения (win/mac/linux)

Живое приложение — `desktop/` (Tauri), из него собираются релизы; правила — в
`desktop/CLAUDE.md`. `App/` и `bindings/` — приостановленный план на React Native,
ниже он описан как есть.

```
Desktop/
  desktop/   живое Tauri-приложение, из него собираются релизы
  App/       приостановленный план: десктоп-приложение на RN (win/mac/linux); экраны + шелл
  bindings/  приостановленный план: Rust sc-rpc (loopback POST /rpc/{method} + WS /events, токен-гейт)
```

## План на RN (приостановлен)

Визуал на React Native. Логика/сеть/аудио — в Rust-ядре (`Core/shared`), мост —
loopback-facade `sc-rpc` (`bindings/`). RN держит **только визуал**.

Хосты: Linux — react-native-web в Servo-шелле; macOS — react-native-macos;
Windows — react-native-windows. Экраны десктопа общие для win/mac/linux (пишутся
на RN-примитивах), кирпичи — из `@sc/ui`. Дизайн 1:1 с `desktop/`, но код заново
(см. `Core/CLAUDE.md` «Правила кода»).

## Перф: никаких лишних React ре-рендеров (КРИТИЧНО, для `App/`)

Полное правило — `Core/CLAUDE.md` п.10. Коротко:

- **Высокочастотное вне React-стейта.** Позиция/прогресс плеера, drag, скролл-жесты,
  живая волна — НЕ в `useState`/контекст. Иначе тик (~10Гц) ре-рендерит весь
  экран/реку/карточки.
- **Императив через `Animated.Value`** — одна кросс-платформенная реализация: событие
  ядра → `.setValue()`, вью читает интерполяцию (`width`/`scaleX`/clip). 0 ре-рендеров.
- **Таймкоды** — `useSyncExternalStore` с флором до секунды; ре-рендерится только сам
  листовой компонент-число.
- **Изоляция:** подписка на частое живёт в листе, не в родителе; в `PlayerContext`
  value НЕТ поля позиции.
- Референс: `App/src/player/position.ts` + потребители (`EstuaryDeck`,
  `NowPlayingBar/ProgressLane/Slider`, `LiveWaveform.progressValue`).

## Инвариант логина (для `App/`)

Без сессии главный шелл не показываем (гейт `App/src/App.tsx`). Сессия owned ядром —
`poll_login` не пишет токен, обязателен явный `auth.setSession`.
