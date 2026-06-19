<p align="center">
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest">
<img src="https://raw.githubusercontent.com/zxcloli666/SoundCloud-Desktop/legacy/icons/appLogo.png" width="180px" style="border-radius: 50%;" />
</a>
</p>

<h1 align="center"><a href="https://soundcloud-desktop.fun/">SoundCloud Desktop</a></h1>

<p align="center">
<b>Нативное десктопное приложение для SoundCloud</b><br>
Без рекламы · Без капчи · Без цензуры · Доступно в России
</p>

<p align="center">
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest">
<img src="https://img.shields.io/github/v/release/zxcloli666/SoundCloud-Desktop?style=for-the-badge&logo=github&color=FF5500&label=VERSION" alt="Version"/>
</a>
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/releases">
<img src="https://img.shields.io/github/downloads/zxcloli666/SoundCloud-Desktop/total?style=for-the-badge&logo=download&color=FF5500&label=Downloads" alt="Downloads"/>
</a>
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/stargazers">
<img src="https://img.shields.io/github/stars/zxcloli666/SoundCloud-Desktop?style=for-the-badge&logo=github&color=FF5500&label=Stars" alt="Stars"/>
</a>
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/blob/main/LICENSE">
<img src="https://img.shields.io/badge/License-MIT-FF5500?style=for-the-badge" alt="License"/>
</a>
</p>

<p align="center">
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest">
<img src="https://img.shields.io/badge/Скачать-Последнюю_Версию-FF5500?style=for-the-badge" alt="Download"/>
</a>
<a href="https://github.com/zxcloli666/SoundCloud-Desktop-EN">
<img src="https://img.shields.io/badge/English-README-0066FF?style=for-the-badge" alt="English"/>
</a>
</p>

---

![wave-net](https://github.com/user-attachments/assets/616f80f0-c6d3-42ae-8093-0d2d3067cc17)

---

## Что это?

**SoundCloud Desktop** — полноценное десктопное приложение для прослушивания музыки на SoundCloud. Написано на Tauri 2 + React 19 — работает нативно, потребляет минимум ресурсов и не тормозит.

Более **100 000 скачиваний**. Работает на Windows, Linux и macOS.

---

## Почему SoundCloud Desktop

### Доступно в России

SoundCloud заблокирован Роскомнадзором — веб-версия не открывается. SoundCloud Desktop работает напрямую без каких-либо дополнительных программ. Весь каталог SoundCloud доступен полностью.

### Никакой рекламы

Ноль рекламных баннеров, ноль промо-вставок между треками, ноль всплывающих окон «оформи подписку». Чистый интерфейс, только музыка.

### Без капчи

Никаких бесконечных проверок «я не робот». Открыл — слушаешь.

### Без цензуры

Доступ ко всему каталогу SoundCloud без региональных ограничений. Все треки, все артисты, все жанры.

### Нативное и лёгкое

Построено на **Tauri 2** (Rust) вместо Electron. Результат:
- Размер установщика **~15 МБ** (а не 200+ МБ как у Electron-приложений)
- Потребление оперативной памяти **~80–120 МБ** при воспроизведении
- Мгновенный запуск
- Плавный интерфейс на 60 FPS даже на слабом железе

### Полностью на русском

Интерфейс переведён на русский язык. Язык определяется автоматически по системе — ничего настраивать не нужно.

### Системная интеграция

- **Управление из системы** — медиа-кнопки на клавиатуре, системный центр уведомлений (Windows), MPRIS (Linux)
- **Discord Rich Presence** — показывай друзьям, что слушаешь
- **Трей** — приложение работает в фоне
- **Автообновления** — новые версии устанавливаются в один клик

---

## Скачать

### Windows

Перейди на [страницу релизов](https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest) и скачай:
- **`.exe`** (NSIS-установщик) — рекомендуется
- **`.msi`** — альтернативный установщик

Требования: Windows 10 (1809+) или Windows 11

### Linux

| Формат | Архитектура | Описание |
|--------|------------|----------|
| `.deb` | amd64, arm64 | Ubuntu, Debian, Mint, Pop!_OS |
| `.rpm` | amd64, arm64 | Fedora, openSUSE, CentOS |
| `.AppImage` | amd64, arm64 | Универсальный, работает везде |
| `.flatpak` | amd64 | Песочница, автообновления |

Скачай нужный формат со [страницы релизов](https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest).

Для AppImage:
```bash
chmod +x soundcloud-desktop-*.AppImage
./soundcloud-desktop-*.AppImage
```

### macOS

- **Apple Silicon** (M1/M2/M3/M4): `*_arm64.dmg`
- **Intel**: `*_x64.dmg`

Скачай со [страницы релизов](https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest).

> [!NOTE]
> **macOS блокирует запуск?** Приложение не подписано Apple Developer сертификатом, поэтому Gatekeeper может показать ошибку «приложение повреждено». Исправляется одной командой:
> ```bash
> xattr -cr /Applications/soundcloud-desktop.app
> ```
> После этого приложение запустится нормально.

---

## Скриншоты

<p align="center">

![home-screen](https://github.com/user-attachments/assets/66d6abb5-7ecd-493c-a0a1-19e7b22d2da5)

![liked-tracks](https://github.com/user-attachments/assets/d590bfe7-487b-4578-90fd-2c21646e262a)

</p>

---

## Обратная связь

| | |
|---|---|
| Предложить идею | [Обсуждение #121](https://github.com/zxcloli666/SoundCloud-Desktop/discussions/121) |
| Что-то не работает? | [Обсуждение #144](https://github.com/zxcloli666/SoundCloud-Desktop/discussions/144) |
| Поставить звезду | [GitHub Stars](https://github.com/zxcloli666/SoundCloud-Desktop/stargazers) — помогает продвижению! |

Pull requests приветствуются. Для крупных изменений сначала откройте issue.

---

## Сборка из исходников

<details>
<summary><b>Инструкция для разработчиков</b></summary>

### Требования

- **Node.js** 22+
- **pnpm** 10+
- **Rust** 1.77+ (stable)

### Запуск

```bash
git clone https://github.com/zxcloli666/SoundCloud-Desktop.git
cd SoundCloud-Desktop/desktop
pnpm install
pnpm tauri dev
```

### Production-сборка

```bash
pnpm tauri build
```

Артефакты появятся в `src-tauri/target/release/bundle/`.

### Проверки

```bash
npx tsc --noEmit        # типы TypeScript
cargo check              # компиляция Rust
npx biome check src/     # линтинг
```

</details>

---

## Стек

| Компонент | Технология |
|-----------|-----------|
| Оболочка | Tauri 2 (Rust) |
| Фронтенд | React 19, Vite 7, Tailwind CSS 4 |
| Стейт | Zustand, TanStack Query |
| Аудио | rodio (rust) |
| UI-компоненты | Radix UI |
| Бэкенд | NestJS 11, TypeORM, PostgreSQL |
| CI/CD | GitHub Actions — сборка под все платформы |
| Линтер | Biome |

---

## Статистика

<p align="center">
<img src="https://api.star-history.com/svg?repos=zxcloli666/SoundCloud-Desktop&type=Date" alt="Star History" />
</p>

<p align="center">
<img src="https://zxcloli666.github.io/download-history/zxcloli666_SoundCloud-Desktop.svg" alt="Download History" />
</p>

---

## Лицензия

MIT. Подробности — в файле [LICENSE](LICENSE).

SoundCloud — торговая марка SoundCloud Ltd. Это приложение не аффилировано с SoundCloud.

---

<p align="center">
<code>soundcloud desktop</code> · <code>soundcloud приложение</code> · <code>soundcloud клиент</code> · <code>soundcloud для пк</code> · <code>soundcloud windows</code> · <code>soundcloud linux</code> · <code>soundcloud macos</code> · <code>soundcloud без рекламы</code> · <code>soundcloud россия</code> · <code>soundcloud в россии</code> · <code>soundcloud не открывается</code> · <code>soundcloud заблокирован</code> · <code>soundcloud blocked russia</code> · <code>soundcloud desktop app</code> · <code>soundcloud desktop client</code> · <code>soundcloud player</code> · <code>soundcloud app for pc</code> · <code>soundcloud без капчи</code> · <code>скачать soundcloud на компьютер</code> · <code>soundcloud desktop download</code> · <code>soundcloud alternative client</code> · <code>soundcloud no ads</code> · <code>музыкальный плеер soundcloud</code>
</p>

<p align="center">
<a href="https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest">
<img src="https://img.shields.io/badge/Скачать_SoundCloud_Desktop-FF5500?style=for-the-badge&logoColor=white" alt="Download" height="50"/>
</a>
</p>