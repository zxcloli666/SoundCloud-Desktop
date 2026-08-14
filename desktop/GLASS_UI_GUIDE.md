# Glass UI / Vision Pro Cookbook

Гайд для нового чата. Ты только открыл проект, ничего не знаешь. Тебе нужно сделать **любую** страницу/компонент на уровне «ахуеть, разъёб». Это рецепты, которые работают именно в этом стеке (Tauri WebView + React 19 + Tailwind 4).

Прежде чем начать — прочитай `CLAUDE.md` (корень) и `desktop/CLAUDE.md`. Здесь — практика, не дублирующая правила.

Гайд не привязан к одной странице. Применяй блоки выборочно — Hero не нужен для Library, Tab Dock не нужен для TrackPage и т.д. Бери то, что подходит твоей задаче.

---

## 1. Стиль в одну строку

**Apple Vision Pro spatial UI**: всё парит, прозрачно, многослойно, светится изнутри. Не плоско. Не «бумага на бумаге». Каждый слой — стекло, сквозь которое видна атмосфера позади.

Если результат на скриншоте мог бы быть из Spotify/SoundCloud-веба — пошёл не туда.

---

## 2. Базовые принципы (нарушать = убить вайб)

1. **Никогда не перекрывай фон сплошным цветом.** Никакого `bg-black` / `bg-zinc-950` на корневых контейнерах страницы. У приложения уже есть кастомный фон от пользователя — твоя задача наложить атмосферу поверх, а не закрасить.
2. **Прозрачность по умолчанию.** Все панели/чипы/кнопки начинаются с `rgba(255,255,255, 0.03..0.08)` + `0.5px` border + `backdrop-filter: blur(...)`. Чем глубже слой — тем меньше алфа.
3. **Свет — не цвет.** Цвет на странице делается светящимися сферами (`radial-gradient + blur 120-160px + mix-blend-screen`), а не заливкой. Текст и элементы остаются белыми/полупрозрачно-белыми, цвет «просвечивает» из-под них.
4. **Один accent правит балом.** Используй глобальный `var(--color-accent)` из `ThemeProvider`. Не миксуй три разных accent-цвета на одной странице. Если странице нужен свой акцент (как «aura» в UserPage) — это исключение под фичу, не норма.
5. **Все цифры округлены крупно.** `rounded-2xl` (16px) — минимум для панелей. Hero-монолиты — `rounded-[2rem]..[2.5rem]`. Кнопки-таблетки — `rounded-full`. Острые углы = шум.
6. **Тени двойные.** Outer (для глубины: `0 30px 80px rgba(0,0,0,0.4)`) + inner (для подсветки канта: `inset 0 1px 0 rgba(255,255,255,0.08)`). Только outer = плоско.
7. **Анимации длинные.** `duration-500..1000` + `cubic-bezier(0.2, 0.8, 0.2, 1)` (он же `var(--ease-apple)` в проекте). Default 150ms — слишком резко, ломает spatial-впечатление.
8. **Не пересоздавай существующие компоненты.** Используй `TrackCard`, `PlaylistCard`, `Avatar`, `LikeButton`, `VirtualList`, `VirtualGrid`, `CopyLinkButton`, `TrackTitleArtist`. Они уже соответствуют стилю.

---

## 3. Цвета и accent

### Глобальный accent (по умолчанию используй его)
ThemeProvider кладёт на `:root` четыре переменные:
- `--color-accent` — основной hex
- `--color-accent-hover` — чуть светлее
- `--color-accent-glow` — `rgba(r,g,b,0.2)` для теней/свечений
- `--color-accent-selection` — `rgba(r,g,b,0.3)` для `::selection`

Используй их через Tailwind (`bg-accent`, `text-accent`, `shadow-[0_0_20px_var(--color-accent-glow)]`) или прямой `var(--color-accent)`.

**НЕ хардкодь** `#ff5500` или `rgba(255,85,0,...)` — в проекте accent у каждого пользователя свой.

### Локальная «aura» (на специальных страницах)
Если страница имеет собственную тему, не зависящую от глобального accent (как UserPage у Star-юзеров), заведи объект:

```ts
type Aura = {
  id: string;
  name: string;
  orbs: [string, string, string];   // 3 hex для атмосферных сфер
  accent: [number, number, number]; // rgb tuple
};

const auraRgba = (a: Aura, alpha: number) =>
  `rgba(${a.accent[0]}, ${a.accent[1]}, ${a.accent[2]}, ${alpha})`;
```

Контрастный icon-helper (для случая «белая кнопка на белом accent»):
```ts
const luminance = ([r, g, b]: [number, number, number]) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const isLightAccent = (rgb: [number, number, number]) => luminance(rgb) > 0.78;
```

При `isLightAccent` → используй чёрные варианты иконок (`playBlack14`, `pauseBlack14` и т.п.). В `lib/icons.tsx` уже есть и белые, и чёрные.

---

## 4. Перформанс — без него красота не запустится

WebView не throttlit таймеры, каждый repaint blur-слоя — горячо. Применяй железно:

- **Atmosphere слой**: `style={{ contain: 'strict', transform: 'translateZ(0)' }}` — выносит в свой GPU-слой, repaint контента не пересчитывает blur.
- **Контентный wrapper над фоном**: `style={{ isolation: 'isolate' }}` — создаёт свой stacking context, изменения внутри не каскадируют в blur-слой. Бонус: без него `mix-blend-screen` фоновых сфер влияет на контент.
- **Никаких `width`/`height`/`padding` в `transition`.** Только `transform`, `opacity`, `color`, `background-color`. Увеличение текста = `transform: scale()`, не `font-size`.
- **`backdrop-filter: blur()` + `saturate()`** — самое дорогое. На страницу — 1-3 раза (hero/hub, dock, content panel), не на каждый чип.
- **Длинные списки — только через `VirtualList` / `VirtualGrid`.** Не рендерь 200 строк в DOM.
- **Частицы / звёзды** — фиксированный массив seeds (см. ниже), `Math.random()` в render запрещён.
- **Subscribe только на нужные поля.** `usePlayerStore((s) => s.isPlaying)`, не `usePlayerStore()`.
- **`React.memo`** на ряды списков и любые компоненты, которые рендерятся часто/в массиве.

---

## 5. Рецепты

### 5.1 Атмосферный фон страницы

Три размытые сферы, медленно дрейфуют, `mix-blend-screen` чтобы поверх любого пользовательского фона давало «свечение, а не плёнку».

```tsx
const KEYFRAMES = `
@keyframes orb-drift {
  0%   { transform: translate3d(0,0,0) scale(1); }
  33%  { transform: translate3d(3%,4%,0) scale(1.08); }
  66%  { transform: translate3d(-3%,2%,0) scale(1.04); }
  100% { transform: translate3d(0,0,0) scale(1); }
}`;

<>
  <style>{KEYFRAMES}</style>
  <div
    className="absolute inset-0 pointer-events-none overflow-hidden"
    style={{ contain: 'strict', transform: 'translateZ(0)' }}
  >
    <div className="absolute -top-[20%] -left-[15%] w-[80vw] h-[80vw] rounded-full mix-blend-screen"
      style={{
        background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 65%)',
        opacity: 0.25,
        filter: 'blur(120px)',
        animation: 'orb-drift 22s ease-in-out infinite',
      }}/>
    {/* ещё 1-2 сферы с другими цветами / задержкой / длительностью */}
  </div>
</>
```

Опасные ошибки:
- `bg-black/80` сверху — убьёт пользовательский фон.
- `mix-blend-screen` обязателен. Без него получается плёнка.
- Контент над фоном оборачивай в `style={{ isolation: 'isolate' }}` — иначе `mix-blend-screen` ползёт в контент.

### 5.2 Звёздное поле (опционально, для премиум/особых состояний)

Звёзды — **seeded**, чтобы не дёргались между ре-рендерами. Цвет берётся из текущей темы.

```tsx
const SEEDS = Array.from({ length: 40 }, (_, i) => ({
  size: 6 + ((i * 7) % 14),
  left: (i * 37) % 100,
  top:  (i * 53) % 100,
  rot:  (i * 41) % 360,
  delay: (i * 0.27) % 5,
  duration: 4 + (i % 5),
}));

@keyframes star-twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.85); }
  50%      { opacity: 0.9; transform: scale(1.05); }
}

{SEEDS.map((s, i) => (
  <div key={i} className="absolute"
    style={{
      left: `${s.left}%`, top: `${s.top}%`,
      color: 'var(--color-accent)',
      transform: `rotate(${s.rot}deg)`,
      filter: `drop-shadow(0 0 ${s.size}px var(--color-accent))`,
      animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
    }}>
    <Star size={s.size} fill="currentColor"/>
  </div>
))}
```

Не делай 200 звёзд — 40-80 хватает. Не делай `Math.random()` в render.

### 5.3 Glass-панель (универсальный рецепт)

```tsx
<div
  className="rounded-[2rem] relative"
  style={{
    background:
      'linear-gradient(165deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.04) 100%)',
    border: '0.5px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(40px) saturate(160%)',
    WebkitBackdropFilter: 'blur(40px) saturate(160%)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
    isolation: 'isolate',
  }}
>
  {/* specular sheen — тонкая блестящая полоса сверху, делает «стекло» убедительным */}
  <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
       style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}/>
  {/* контент */}
</div>
```

Ключи:
- `0.5px` border (не 1px) — стекло тоньше.
- Лёгкий gradient внутри background (не сплошная alpha) — даёт «полировку».
- `saturate(160%)` поверх blur — то, что разделяет дешёвый glass от Vision Pro.

Для мелких карточек переиспользуй ближайший доменный компонент. Для крупных hero/hub-панелей используй `GlassHeroPanel` либо собирай панель с теми же токенами.

### 5.4 Hero / Hub-монолит

Для страниц вида TrackPage / PlaylistPage / UserPage / AlbumPage не разноси хедер на 5 карточек. Сделай **один монолит** glass-панели, в которую помещаешь: artwork/avatar, badges, заголовок (никнейм/название), описание, метаданные, actions, статы (опционально боковой колонкой).

Базовая структура:
```
[Hero glass panel                                            ]
  [Artwork]  [Badges row                                  ]
             [BIG TITLE                                    ]   [Stats col xl:]
             [Description / artist line                    ]
             [Chips / metadata                             ]
             [Primary action]  [Secondary]  [Tertiary]
[Mobile/lg fallback: Stats строкой внутри hub снизу       ]
```

Title — самый крупный элемент на странице:
```tsx
<h1 className="text-5xl md:text-7xl font-black leading-[0.85] tracking-tighter">
  {title}
</h1>
```

Hover на длинном описании раскрывает полностью:
```tsx
<p className="line-clamp-3 hover:line-clamp-none transition-all duration-700 cursor-help">
  {description}
</p>
```

### 5.5 Primary white button с specular shimmer

Универсальная primary-кнопка (Follow, Play All, Subscribe и т.п.):
```tsx
<button
  className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-7 h-11 rounded-full text-[13px] font-semibold text-black hover:scale-[1.03] active:scale-[0.97] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer"
  style={{
    background: 'linear-gradient(180deg, #ffffff, #e5e7eb)',
    border: '0.5px solid rgba(255,255,255,0.4)',
    boxShadow: '0 12px 32px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.6)',
  }}
>
  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }}/>
  Action
</button>
```

Тень кнопки — **в цвете accent**, не серая. Это и делает кнопку «частью темы».

Secondary-кнопка — glass-pill: `bg rgba(255,255,255,0.06)` + `border 0.5px rgba(255,255,255,0.12)` + `backdrop-blur 20px`.

### 5.6 Floating Tab Dock с плавающим pill

Для страниц с несколькими секциями (UserPage, Library). Один общий sticky-контейнер. Pill — отдельный absolute div, позиционируется через `getBoundingClientRect` активной кнопки в `useEffect`. Все табы выглядят одинаково «выключенно», но pill плавно скользит за активным.

```tsx
const [pill, setPill] = useState<{x:number; w:number} | null>(null);
useEffect(() => {
  const dock = dockRef.current;
  const btn = dock?.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
  if (!dock || !btn) return;
  const dr = dock.getBoundingClientRect();
  const r  = btn.getBoundingClientRect();
  setPill({ x: r.left - dr.left, w: r.width });
}, [active, tabs]);

<div ref={dockRef} className="sticky top-3 z-40 ... relative">
  {pill && (
    <div className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      style={{
        left: pill.x, width: pill.w,
        background: 'linear-gradient(180deg, var(--color-accent-glow), transparent)',
        border: '0.5px solid var(--color-accent-glow)',
        boxShadow: '0 6px 20px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.12)',
      }}/>
  )}
  {tabs.map(...)}
</div>
```

### 5.7 Themed track row (одна строка списка треков)

Для списков треков на любой странице. Используй существующий `TrackCard` если подходит. Если нужна кастомизация — вот строка (используется в UserPage):

Принципы:
- Index/play-button слева в одной ячейке: на hover index сменяется на play-icon.
- Кнопка play в активном состоянии красится в accent.
- Highlight active row: тонкая `inset 0 0 0 0.5px var(--color-accent)` + лёгкий gradient слева.
- Артворк `12-14` (48-56px) — больше становится тяжело, меньше теряется.
- Stats блоки (`hidden md:flex`) — прячутся на узком окне.

Контрастные иконки (если accent светлый):
```tsx
const lightAcc = isLightAccent(accentRgb);
const playIcon = lightAcc ? playBlack14 : playWhite14;
const pauseIcon = lightAcc ? pauseBlack14 : pauseWhite14;
```

### 5.8 Карточки в сетке

Используй `PlaylistCard` / `TrackCard`. Для чужих сущностей (юзеры в followers, теги в search) делай свою через тот же паттерн:

```tsx
<button
  type="button"
  onClick={onClick}
  className="group relative h-full w-full flex flex-col items-center gap-3 p-6 rounded-3xl transition-all duration-500 cursor-pointer overflow-hidden hover:scale-[1.02]"
  style={{
    background: 'rgba(255,255,255,0.03)',
    border: '0.5px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  }}
>
  {/* artwork / avatar */}
  {/* meta */}
</button>
```

Размещай через `VirtualGrid` (минимальная ширина колонки, gap, infinite scroll через `useInfiniteScroll`).

### 5.9 Контрастные иконки play/pause

В `lib/icons.tsx` есть `playWhite14`/`pauseWhite14` и `playBlack14`/`pauseBlack14`. Если фон кнопки = accent, а accent светлый (Void тема, белый custom user-color) — используй чёрные. Иначе будет белое-на-белом.

### 5.10 Custom color picker (если фича просит выбор цвета)

Скрытый `<input type="color">` поверх «лейбла» с rainbow-conic:
```tsx
<label className="relative w-7 h-7 rounded-lg cursor-pointer overflow-hidden"
  style={{
    background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)',
  }}>
  <input type="color" value={hex} onChange={(e) => setHex(e.target.value)}
         className="absolute inset-0 opacity-0 cursor-pointer"/>
  <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.6)]">
    <Sparkles size={12}/>
  </span>
</label>
```

### 5.11 Avatar с вращающимся ring (опционально, для премиум-индикатора)

Двухслойная конструкция: внешний контейнер с `mask-composite: exclude` режет центр, внутренний conic-gradient крутится. Так вращается **цвет**, а не геометрия квадрата.

```tsx
<div className="relative">
  <div
    className="absolute -inset-[5px] rounded-[2.2rem] pointer-events-none overflow-hidden"
    style={{
      padding: '3px',
      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      filter: 'drop-shadow(0 0 14px var(--color-accent-glow))',
    }}
  >
    <div className="absolute -inset-[40%]"
      style={{
        background: 'conic-gradient(from 0deg, #7c3aed, #06b6d4, #ec4899, #7c3aed)',
        animation: 'ring-rotate 12s linear infinite',
      }}/>
  </div>
  <div className="relative w-[180px] h-[180px] rounded-[2rem] overflow-hidden ...">
    <img src={avatarUrl}/>
  </div>
</div>
```

Анти-паттерн: вращать сам контейнер с conic-gradient — получишь крутящийся прямоугольник.

### 5.12 Skeleton/Loading state

Пока данные грузятся — не пустой экран и не спиннер по центру в куче случаев. Используй `Skeleton` (`components/ui/Skeleton.tsx`) с тем же rounded и приблизительным размером того, что должно появиться. Спиннер — только когда контент не имеет известного layout (например, infinite scroll bottom).

### 5.13 Empty state

Не «No tracks found.» текстом. Минимум: glass-кружок 64×64 с приглушённой иконкой + одна короткая i18n-строка `text-white/30 text-sm`.

```tsx
<div className="py-24 flex flex-col items-center gap-4">
  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
       style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
    <Music size={24} className="text-white/15"/>
  </div>
  <p className="text-white/30 text-sm">{t('common.empty')}</p>
</div>
```

---

## 6. Адаптивность (это desktop, но окно может быть узкое или вертикальное)

- **Никогда** не делай макет под одно соотношение. `lg:flex-row` для широкого, `flex-col` для узкого. Думай о split-view, 9:16 мониторе, узком окне.
- Боковые stat-колонки — только `xl:flex`. На меньшем разрешении переноси stat'ы строкой внизу того же hero.
- Артворк/аватар: `w-[148px] h-[148px] md:w-[180px] md:h-[180px]`. На мобильной ширине меньше.
- Заголовки: `text-5xl md:text-7xl`. Не `text-9xl` — на узком окне будет каша.
- Текст с описанием — `line-clamp-3 hover:line-clamp-none`. Длинный текст не разваливает hero.
- Сетки — `VirtualGrid` с `minColumnWidth` (а не `gridTemplateColumns: repeat(N, ...)` в захардкоженным числом колонок).

---

## 7. i18n — обязательно

Любая видимая строка через `t('key')`. Никаких хардкодов на en/ru. Обновляй `src/i18n/locales/en.json` И `ru.json` синхронно. Группируй ключи: `track.popular`, `playlist.empty`, `library.history` и т.д. Для русского — плюрализация `_one`, `_few`, `_many`.

---

## 8. Чек-лист перед сдачей

- [ ] Под пользовательским фоном видно изменения (не залито чёрным)
- [ ] Все интерактивные состояния используют `var(--color-accent)` (или единый локальный accent для специальной фичи)
- [ ] На светлой теме play/pause иконки чёрные, не белые
- [ ] Бейджи / overlays не вылезают за `overflow: hidden` родителя
- [ ] При узком окне (≤1024) все боковые колонки уехали под основной hero
- [ ] Все blur-слои в `contain: strict + translateZ(0)`, контент над ними в `isolation: isolate`
- [ ] Тени у glass-панелей двойные (outer + inset)
- [ ] Никаких `Math.random()` в JSX — только seeded массивы
- [ ] Длинные списки/сетки через `VirtualList` / `VirtualGrid`
- [ ] Ни одной хардкоженной строки — всё через i18n (en + ru)
- [ ] `npx tsc --noEmit` проходит, `npx biome check` без новых ошибок
- [ ] `cargo check` если трогал Rust

---

## 9. Анти-паттерны (этого не делай)

- ❌ `bg-black` / `bg-zinc-950` на корне страницы
- ❌ `border: 1px solid white` — слишком толсто, ломает стекло
- ❌ Анимации `padding` / `width` / `font-size` — reflow всего поддерева
- ❌ `setInterval` 60fps на UI — для прогресс-бара хватит 10fps, для лирики 5fps
- ❌ Микс трёх accent-цветов на одной странице
- ❌ `Math.random()` в render
- ❌ Отдельная карточка под каждое поле (название, дата, описание, ссылки) — собирай в один Hero
- ❌ Резкие 150-200ms transitions — увеличь до 500-700ms с cubic-bezier
- ❌ Захардкоженный `gridTemplateColumns: repeat(4, 1fr)` — используй `VirtualGrid` с `minColumnWidth`
- ❌ Решение «давайте впихнём всё в одну строку» / «пусть будет колонка справа» без условия `xl:` — ломает узкие окна
- ❌ Параллельная реализация существующего: свой TrackCard, свой PlaylistCard, свой Avatar, свой VirtualList — найди в `components/` и переиспользуй
- ❌ `localStorage` для сохранения настроек — порт меняется на проде, используй tauri storage
- ❌ Локальные комментарии в коде вида `// добавил для X` / `// раньше было Y`

---

## 10. Финальный совет

Если результат смотрится «приемлемо» — он не годен. Цель — реакция «бля... ну хорошо», открывая страницу. Перепроверь в трёх режимах: широкое окно с цветным фоном, узкое окно с чёрным фоном, и светлой темой (белый/почти-белый accent) — последний обычно ломается первым (white-on-white).

Не добавляй фичи, которые не просили. Дизайн ≠ перегруз. Один-два «вау»-элемента (вращающийся ring, прозрачный hub, плавающий pill) на страницу. Десять — превратится в новогоднюю ёлку.
