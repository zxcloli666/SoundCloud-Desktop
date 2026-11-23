# Свой CSS

[English version](CUSTOM_CSS.md)

Настройки > Дополнительно > Свой CSS позволяют перекрасить приложение своим CSS. Изменения видны сразу, в главном окне и в мини-плеере из трея. Переключатель в заголовке карточки выключает стили, не удаляя их.

Свой CSS ложится поверх темы из каталога, так что ваши правила главнее.

## Если стиль сломал интерфейс

- Нажмите **Ctrl+Alt+Shift+C** (**Cmd+Option+Shift+C** на macOS). Выключатся свой CSS и тема из каталога. Повторное нажатие вернёт то, что выключило первое.
- Или запустите приложение с флагом `--no-custom-css`. Он выключает свой CSS и тему из каталога до загрузки интерфейса:
  - Windows: допишите ` --no-custom-css` в конец поля «Объект» у ярлыка или запустите `soundcloud-desktop.exe --no-custom-css`.
  - macOS: `open -n -a soundcloud-desktop --args --no-custom-css`
  - Linux: `soundcloud-desktop --no-custom-css`

Если приложение уже запущено, например свёрнуто в трей, флаг дойдёт до этой копии: выключит оба и покажет окно.

## Стабильные хуки

Классы Tailwind меняются от версии к версии. Эти атрибуты останутся.

### Окно

| Селектор | Элемент |
|---|---|
| `[data-ui="app"]` | Вся рамка окна |
| `[data-ui="app"][data-wall]` | Рамка окна, пока включены обои или свой фон; боковые панели становятся полупрозрачными |
| `[data-ui="titlebar"]` | Заголовок с поиском и кнопками окна |
| `[data-ui="brand"]` | Логотип в заголовке |
| `[data-ui="titlebar-navigation"]` | Кнопки назад, вперёд, домой и перезагрузки в заголовке |
| `[data-ui="scheme-toggle"]` | Переключатель светлой и тёмной темы в заголовке |
| `[data-ui="window-controls"]` | Свернуть, развернуть, закрыть |
| `[data-ui="search"]` | Поле поиска в заголовке |
| `[data-ui="sidebar"]` | Левое меню |
| `[data-ui="nav-item"]` | Ссылка в левом меню |
| `[data-ui="quick-access"]` | Блок быстрого доступа в левом меню: разделы библиотеки и закрепы |
| `[data-ui="sidebar-pins"]` | Строки быстрого доступа, закреплённые плейлисты и артисты в левом меню |
| `[data-ui="star-card"]` | Карточка STAR в левом меню |
| `[data-ui="profile"]` | Ваш профиль внизу левого меню |
| `[data-ui="main"]` | Прокручиваемая область страниц |
| `[data-ui="back-to-top"]` | Плавающая кнопка «наверх» над областью страниц |
| `[data-ui="page"]` | Страница. Её имя в `data-page`: `home`, `search`, `library`, `history`, `discover`, `star`, `track`, `playlist`, `user`, `artist`, `album`, `offline`, `recap`, `settings`, `login` |
| `[data-ui="modal"]` | Диалоговое окно |
| `[data-ui="context-menu"]` | Контекстное меню |
| `[data-ui="menu-item"]` | Пункт этого меню |
| `[data-ui="toast"]` | Всплывающая новость |
| `[data-ui="tray"]` | Мини-плеер в трее |

### Плеер

| Селектор | Элемент |
|---|---|
| `[data-ui="player"]` | Плавающий плеер |
| `[data-ui="player-art"]` | Обложка в плеере |
| `[data-ui="player-title"]` | Название трека в плеере |
| `[data-ui="marquee"]` | Длинное имя, которое прокручивается; `data-moving="true"`, пока едет |
| `[data-ui="player-rating"]` | Чип рейтинга трека (A, C, F) в плеере |
| `[data-ui="play-button"]` | Пуск и пауза |
| `[data-ui="player-transport"]` | Назад, пуск, вперёд и зоны перед плеем и после плея вокруг них |
| `[data-ui="player-zone"]` | Группа кнопок плеера. `data-zone`: `left`, `before`, `after`, `right` или `title` (только в деке Главной); `data-drop` во время перетаскивания `open` у всех зон и `over` у той, что под кнопкой |
| `[data-ui="player-zone-chip"]` | Кнопка, которая едет за курсором при перетаскивании |
| `[data-ui="player-seek"]` | Волна перемотки в плеере |
| `[data-ui="player-like"]` | Кнопка лайка в плеере |
| `[data-ui="player-dislike"]` | Кнопка дизлайка в плеере |
| `[data-ui="player-playlist"]` | Кнопка «В плейлист» в плеере |
| `[data-ui="player-album"]` | Кнопка альбома в плеере |
| `[data-ui="player-block"]` | Кнопка «Больше не играть» в плеере |
| `[data-ui="player-quality"]` | Место качества и рейтинга в плеере |
| `[data-ui="player-shuffle"]` | Кнопка перемешивания в плеере |
| `[data-ui="player-repeat"]` | Кнопка повтора в плеере |
| `[data-ui="player-abloop"]` | Кнопка цикла A-B в плеере |
| `[data-ui="player-together"]` | Кнопка «Слушать вместе» в плеере |
| `[data-ui="player-lyrics"]` | Кнопка текста в плеере |
| `[data-ui="player-queue"]` | Кнопка очереди в плеере |
| `[data-ui="player-ghosts"]` | Невидимое место, где живут скрытые кнопки плеера для поиска и горячих клавиш |
| `[data-ui="player-tuning"]` | Кнопка скорости и питча в плеере |
| `[data-ui="player-sleep"]` | Кнопка таймера сна в плеере |
| `[data-ui="player-eq"]` | Кнопка эквалайзера в плеере |
| `[data-ui="player-effects"]` | Кнопка эффектов в плеере (реверб, 8D, бас) |
| `[data-ui="progress"]` | Полоса прогресса в полноэкранном плеере |
| `[data-ui="volume"]` | Громкость |
| `[data-ui="namecard"]` | Карточка, которая открывается по названию трека |
| `[data-ui="queue"]` | Панель очереди, `[data-state]`: `open` или `closed` |
| `[data-ui="queue-hero"]` | Текущий трек вверху очереди: обложка, название, прогресс |
| `[data-ui="queue-clear"]` | Кнопка очистки в шапке очереди |
| `[data-ui="queue-close"]` | Кнопка закрытия в шапке очереди |
| `[data-ui="queue-played"]` | Переключатель группы прослушанных в очереди |
| `[data-ui="queue-section"]` | Подпись раздела в очереди, `[data-group]`: `added`, `context` или `auto` |
| `[data-ui="queue-item"]` | Трек в очереди, `[data-tone]`: `played`, `now` или `next` |
| `[data-ui="queue-remove"]` | Кнопка удаления у трека в очереди |
| `[data-ui="queue-empty"]` | Пустая очередь с кнопкой «Запустить волну» |
| `[data-ui="lyrics"]` | Полноэкранный текст песни |
| `[data-ui="lyrics-backdrop"]` | Размытый фон полноэкранного плеера |
| `[data-ui="lyrics-line"]` | Строка текста, состояние в `data-state` |
| `[data-ui="lyrics-offset"]` | Подстройка тайминга текста (минус, значение, плюс) |
| `[data-ui="lyrics-own"]` | Метка своего текста песни |
| `[data-ui="lyrics-attach"]` | Поиск или вставка своего текста |
| `[data-ui="lyrics-candidate"]` | Найденный текст, у выбранного `data-state="active"` |
| `[data-ui="lyrics-paste"]` | Поле для своего текста или LRC |
| `[data-ui="track-video"]` | Видео трека; `data-place`: `player-cover`, `player-background`, `player-view`, `moments` или `room` (обложка страницы трека) |
| `html[data-video-opaque]` | Стоит, пока видео целиком закрывает своё место (значения как у `data-place`); то, что под ним, скрыто |
| `[data-ui="lyrics-video-toggle"]` | Кнопка видео вкл/выкл в полноэкранном плеере |
| `[data-ui="waveform"]` | Волна трека |

### Голос

| Селектор | Элемент |
|---|---|
| `[data-ui="voice-mic"]` | Кнопка голоса в плеере |
| `[data-ui="voice-island"]` | Окно голоса над плеером, вид в `data-state` |
| `[data-ui="voice-orb"]` | Шар прослушивания, режим в `data-mode` |
| `[data-ui="voice-avatar"]` | Аватар ассистента |
| `[data-ui="voice-hero"]` | Верхний блок в Настройки > Голос |
| `[data-ui="voice-locked"]` | Блок голоса без STAR |
| `[data-ui="voice-device"]` | Плитка микрофона, выбор в `data-on` |
| `[data-ui="voice-role"]` | Плитка роли в «Ты и ассистент», выбор в `data-on` |
| `[data-ui="voice-credits"]` | Список лицензий в Настройки > Голос |
| `[data-ui="voice-model"]` | Строка модели, состояние в `data-state` |
| `[data-ui="voice-history-row"]` | Строка в истории голоса |

### Контент

| Селектор | Элемент |
|---|---|
| `[data-ui="track-card"]` | Плитка трека в сетках и лентах |
| `[data-ui="track-row"]` | Строка трека в лайках и других списках с порядком |
| `[data-ui="playlist-card"]` | Плитка плейлиста и альбома |
| `[data-ui="artwork"]` | Обложка в плитках и строках |
| `[data-ui="track-title"]` | Название трека |
| `[data-ui="artist-name"]` | Имя артиста у трека |
| `[data-ui="like-button"]` | Кнопка лайка |
| `[data-ui="greeting"]` | Приветствие вверху Библиотеки |
| `[data-ui="soundwave"]` | Дека плеера сверху Главной |
| `[data-ui="deck-scene"]` | Свечение цвета обложки за декой Главной; `data-live="true"`, пока рисуется живой фон |
| `[data-ui="deck-status"]` | Подпись «Сейчас играет» или «На паузе» в деке Главной |
| `[data-ui="deck-artist"]` | Имена артистов в деке Главной |
| `[data-ui="deck-frame"]` | Квадрат вокруг большой обложки, в нём свечение |
| `[data-ui="deck-cover"]` | Большая обложка в деке Главной |
| `[data-ui="deck-title"]` | Название трека в деке Главной и его зона кнопок `title` |
| `[data-ui="deck-seek"]` | Капсула перемотки с волной и временем внутри |
| `[data-ui="deck-controls"]` | Кнопки плеера в деке Главной; `data-fit`: `flank`, когда боковые зоны стоят у капсулы перемотки, или `tray`, когда они рядом под кнопками |
| `[data-ui="deck-tray"]` | Ряд левой и правой зон под кнопками деки Главной в узком окне |
| `[data-ui="deck-lyrics"]` | Текущая и следующая строки текста под плеером в узком окне |
| `[data-ui="deck-lyric-current"]` | Текущая строка текста под списком волны в широком окне |
| `[data-ui="deck-lyric-next"]` | Следующая строка текста под настройками волны в широком окне |
| `[data-ui="deck-idle"]` | Дека Главной, когда ничего не играет |
| `[data-ui="deck-start"]` | Кнопка запуска волны, когда ничего не играет |
| `[data-ui="wave-pane"]` | Список волны слева в деке Главной в широком окне |
| `[data-ui="wave-row"]` | Трек в этом списке |
| `[data-ui="up-next"]` | Список «Далее» в деке Главной |
| `[data-ui="up-next-row"]` | Трек в списке «Далее» |
| `[data-ui="wave-settings"]` | Блок настроек волны под «Далее» |
| `[data-ui="vibe-search"]` | Кнопка поиска по вайбу в деке Главной |
| `[data-ui="home-shelf"]` | Полка «Любимые, новые релизы, артисты, плейлисты, история» на Главной |
| `[data-ui="shelf-tab"]` | Вкладка этой полки; `aria-selected` у открытой |
| `[data-ui="shelf-tab-count"]` | Число непрослушанных на вкладке «Новые релизы» |
| `[data-ui="shelf-actions"]` | «Слушать все» и «В очередь» для новых релизов рядом с кнопкой полки |
| `[data-ui="shelf-toggle"]` | Кнопка свернуть и развернуть эту полку |
| `[data-ui="shelf-card"]` | Карточка этой полки |
| `[data-ui="shelf-locked"]` | Тизер новых релизов без STAR |
| `[data-ui="river-section"]` | Секция реки волны на Главной |
| `[data-ui="moments-station"]` | Блок "Моменты" на Главной |
| `[data-ui="moments"]` | Страница Моментов |
| `[data-ui="moments-stage"]` | Область листания Моментов |
| `[data-ui="moment-card"]` | Момент: обложка, название, волна, действия |
| `[data-ui="moment-wave"]` | Волна 30-секундного момента |
| `[data-ui="moment-listen-full"]` | Кнопка "Слушать целиком" |
| `[data-ui="moments-rail"]` | Стрелки и прогресс справа |
| `[data-ui="moments-empty"]` | Моменты ещё не готовы |
| `[data-ui="soundprint"]` | Полосы вашего саундпринта |
| `[data-ui="artist-hero"]` | Верхний блок страницы артиста |
| `[data-ui="album-hero"]` | Верхний блок страницы альбома |
| `[data-ui="playlist-hero"]` | Верхний блок страницы плейлиста |
| `[data-ui="playlist-cover-change"]` | Кнопка смены обложки на своём плейлисте |
| `[data-ui="playlist-cover-state"]` | Значок загрузки обложки. `[data-state]`: `sending`, `syncing` или `failed` |
| `[data-ui="playlist-cover-editor"]` | Окно кадрирования обложки |
| `[data-ui="playlist-cover-crop"]` | Квадратная рамка в этом окне, её двигают и масштабируют |
| `[data-ui="user-hero"]` | Верхний блок профиля |
| `[data-ui="my-music"]` | Блок «Моя музыка» в своём профиле |
| `[data-ui="user-banner"]` | Баннер профиля над этим блоком |
| `[data-ui="track-hero"]` | Верхний блок страницы трека |
| `[data-ui="track-cover-video"]` | Слой видео в обложке страницы трека, гаснет, когда трек перестаёт быть текущим |
| `[data-ui="discover-hero"]` | Верхний блок Обзора |
| `[data-ui="comments"]` | Список комментариев |
| `[data-ui="comment"]` | Комментарий |
| `[data-ui="comment-like"]` | Кнопка лайка комментария |
| `[data-ui="comment-delete"]` | Кнопка удаления комментария |
| `[data-ui="moment-reaction"]` | Кнопка реакции в действиях трека |
| `[data-ui="moment-reaction-mark"]` | Метка реакции на волне |
| `[data-ui="search-tabs"]` | Вкладки режимов поиска |
| `[data-ui="search-strip"]` | Строка с вкладками режимов поиска и переключателем вида |
| `[data-ui="search-view"]` | Переключатель Обложки / Моменты в поиске |
| `[data-ui="search-layout"]` | Переключатель плитки / список в поиске |
| `[data-ui="search-kinds"]` | Вкладки видов результатов в списке каталожного поиска |
| `[data-ui="search-moments"]` | Вид Моменты внутри поиска |
| `[data-ui="search-wave-tail"]` | Последняя карточка моментов поиска: дальше волной |
| `[data-ui="moments-from-here"]` | Кнопка «Моменты отсюда» на обложке в поиске |
| `[data-ui="tab"]` | Вкладка |
| `[data-ui="chip"]` | Чипы жанров и фильтров |
| `[data-ui="shelf"]` | Горизонтальная лента |
| `[data-ui="sync-wait"]` | Библиотека ещё в очереди синхронизации: заготовки, карточка очереди, полоса на месте ленты, дорожка STAR. `[data-stage]`: `calm`, `long` или `priority`, `[data-kind]`: `syncing` или `stalled` |
| `[data-ui="sync-wait-progress"]` | Внутри полосы синхронизации: линия, обратный отсчет и число загруженного. `[data-lane]`: `read` или `queue` |

### Элементы

| Селектор | Элемент |
|---|---|
| `[data-ui="button"]` | Стеклянная кнопка |
| `[data-ui="glass-card"]` | Стеклянная карточка |
| `[data-ui="hero"]` | Большая стеклянная панель |
| `[data-ui="avatar"]` | Аватар |
| `[data-ui="skeleton"]` | Заглушка загрузки |
| `[data-ui="error-state"]` | Ошибка с кнопкой повтора |
| `[data-ui="sync-notice"]` | Уведомление, пока раздел синхронизируется или синхронизация не удалась |
| `[data-ui="kbd"]` | Подсказка клавиши |
| `[data-ui="card"]` | Карточки настроек |
| `[data-ui="settings-nav"]` | Список разделов в Настройках |
| `[data-ui="settings-nav-item"]` | Раздел в этом списке, `[aria-current="page"]` у открытого |
| `[data-ui="settings-header"]` | Заголовок открытого раздела Настроек |
| `[data-ui="settings-tabs"]` | Вкладки раздела из нескольких страниц, например Дополнительно |
| `[data-ui="settings-tab"]` | Одна из этих вкладок, `[aria-selected="true"]` у открытой |
| `[data-ui="settings-row"]` | Строка настройки |
| `[data-ui="player-zones"]` | Карта расстановки кнопок в настройках, `data-surface`: `player` (нижний плеер) или `deck` (Главная); у каждой зоны `data-zone`, у её списка `data-drop` при перетаскивании |
| `[data-ui="settings-info"]` | Значок подсказки у настройки, текст при наведении |
| `[data-ui="mobile-access-badge"]` | Статус расширенного доступа в настройках; `data-state`: `off`, `active` или `relink` |
| `[data-ui="mobile-link"]` | Окно подключения расширенного доступа; `data-phase`: `starting`, `waiting`, `received`, `completed`, `mismatch`, `failed` или `expired` |
| `[data-ui="mobile-link-account"]` | Подключаемый аккаунт в этом окне |
| `[data-ui="mobile-link-steps"]` | Шаги «браузер, код, готово» в этом окне |
| `[data-ui="mobile-link-status"]` | Блок статуса в этом окне; `data-tone`: `busy`, `ok`, `warn` или `bad` |
| `[data-ui="mobile-link-paste"]` | Запасное поле «вставить адрес» в этом окне |
| `[data-ui="mobile-link-island"]` | Плашка внизу, пока подключение ждёт SoundCloud |
| `[data-ui="settings-search"]` | Поле поиска над списком разделов Настроек |
| `[data-ui="settings-search-result"]` | Строка результата поиска, `[data-active]` равен `true` у подсвеченной |
| `[data-ui="settings-search-results"]` | Список результатов поиска в Настройках |
| `[data-ui="settings-search-count"]` | Число результатов рядом с заголовком поиска |
| `[data-ui="settings-search-empty"]` | Блок «ничего не найдено» в поиске |
| `[data-ui="settings-search-clear"]` | Кнопка очистки в поле поиска |
| `[data-ui="switch"]` | Переключатель |
| `[data-ui="segmented"]` | Группа вариантов |
| `[data-ui="segment"]` | Вариант в группе, его id в `data-value` |

Состояния тоже в атрибутах: `aria-current="page"` у открытой ссылки или раздела, `aria-checked` у переключателей, `aria-selected` или `data-active="true"` у вкладок, чипов и вариантов. `html[data-perf="beauty"]`, `"medium"` или `"light"` показывает режим производительности.

### Чаты

| Селектор | Элемент |
|---|---|
| `[data-ui="chat-page"]` | Страница «Чаты» |
| `[data-ui="chat-dock"]` | Панель чатов у правого края |
| `[data-ui="chat-dock-tabs"]` | Ряд вкладок панели чатов |
| `[data-ui="chat-list"]` | Список чатов |
| `[data-ui="chat-filter"]` | Фильтр над списком чатов. `[data-kind]`: `all`, `direct`, `groups`, `unread`, `requests` или `archived`, у выбранного есть `[aria-pressed="true"]` |
| `[data-ui="chat-row"]` | Чат в списке. `[data-kind]`: `direct`, `group`, `self`, `room` или `public`, у открытого есть `[aria-current]` |
| `[data-ui="chat-public-mark"]` | Значок общего чата в списке, шапке и панели «О чате» |
| `[data-ui="chat-public-slow"]` | Чип медленного режима в шапке общего чата |
| `[data-ui="chat-public-sanction"]` | Плашка «вам запрещено писать» или «вы забанены» вместо поля ввода, `[data-kind]`: `muted` или `banned` |
| `[data-ui="chat-public-gate"]` | Общий чат не открывается, `[data-gate]`: `muted`, `off` или `failed` |
| `[data-ui="chat-public-staff"]` | Вкладка «Модераторы» общего чата |
| `[data-ui="chat-public-log"]` | Журнал модерации общего чата |
| `[data-ui="chat-thread"]` | Открытый чат с сообщениями, `[data-kind]` как выше |
| `[data-ui="chat-thread-header"]` | Шапка открытого чата |
| `[data-ui="chat-bubble"]` | Сообщение. У ваших есть `[data-mine]`, у неотправленных `[data-failed]` |
| `[data-ui="chat-system-row"]` | Служебная строка между сообщениями, `[data-kind]` называет событие |
| `[data-ui="chat-composer"]` | Поле ввода сообщения |
| `[data-ui="chat-embed"]` | Карточка в сообщении. `[data-kind]`: `track`, `playlist`, `user` или `room_invite` |
| `[data-ui="chat-info"]` | Панель «О чате» |
| `[data-ui="chat-requests"]` | Запросы на переписку: список и полоса в чате |
| `[data-ui="chat-room"]` | Вкладка комнаты совместного прослушивания |
| `[data-ui="chat-room-stage"]` | Область комнаты под шапкой, в ней фон комнаты. `--room-accent` на ней подкрашивает фон |
| `[data-ui="room-tuning"]` | Кнопка настроек комнаты в шапке комнаты |
| `[data-ui="room-capacity"]` | Строка мест в настройках комнаты: участники из вместимости, полоса мест, пауза входов |
| `[data-ui="room-rules"]` | Кнопка правил комнаты в шапке комнаты (ведущий) |
| `[data-ui="room-images-policy"]` | Кто может отправлять картинки в комнате (ведущий) |
| `[data-ui="room-cover"]` | Строка обложки комнаты в правилах (ведущий) |
| `[data-ui="room-cover-picker"]` | Выбор обложки: сетка обложек, цвета, применить и сбросить |
| `[data-ui="open-room"]` | Комната в списке открытых комнат |
| `[data-ui="chat-toast"]` | Всплывающее новое сообщение |
| `[data-ui="chat-share"]` | Окно «Отправить» |
| `[data-ui="chat-album"]` | Картинки в сообщении. Плитка `[data-ui="chat-album-tile"]`, `[data-state]`: `loading`, `ready`, `failed`, `deleted` или `lost` |
| `[data-ui="chat-upload-tile"]` | Ваша картинка, которая ещё загружается, `[data-state]`: `queued`, `reserved`, `uploading`, `uploaded`, `committed` или `failed` |
| `[data-ui="chat-album-status"]` | Строка прогресса или ошибки под вашим альбомом |
| `[data-ui="chat-media-gone"]` | Заглушка удалённой или недоступной картинки |
| `[data-ui="chat-media-gif"]` | Метка GIF на неподвижной анимированной картинке, когда анимации снижены |
| `[data-ui="chat-lightbox"]` | Просмотр картинки, область картинки `[data-ui="chat-lightbox-stage"]` |
| `[data-ui="chat-gallery"]` | Вкладка «Картинки» в инфо чата. Плитка `[data-ui="chat-gallery-tile"]` с `[data-state]` как в альбоме, пустая вкладка `[data-ui="chat-gallery-empty"]` |
| `[data-ui="chat-device-alert"]` | Окно о новом устройстве |
| `[data-ui="chat-relogin"]` | Карточка входа в чаты |
| `[data-ui="chat-keychain"]` | Карточка, когда ключи чатов не читаются, `[data-reason]`: `keychain_denied` или `keychain_unavailable` |
| `[data-ui="chat-keys-reset"]` | Окно сброса ключей чатов, `[data-state]`: `ready`, `working` или `failed` |
| `[data-ui="chat-keys-storage"]` | Карточка «Ключи чатов» в настройках чатов, `[data-storage]`: `os` или `file` |
| `[data-ui="chat-sign-in-limit"]` | Карточка, пока этот компьютер не может войти в чаты. `[data-kind]`: `daily` (много новых входов за сегодня) или `cap` (у аккаунта уже максимум устройств) |
| `[data-ui="chat-storage"]` | Страница хранилища картинок (`/chats/storage`) |
| `[data-ui="chat-quota-ring"]` | Кольцо квоты: занято из доступного, на странице хранилища и в настройках чатов |
| `[data-ui="chat-storage-grid"]` | Сетка ваших картинок; плитка это `[data-ui="chat-storage-tile"]`, у выбранной есть `[aria-pressed="true"]` |
| `[data-ui="chat-storage-undo"]` | Полоса отмены после удаления картинок |
| `[data-ui="chat-storage-entry"]` | Карточка хранилища в настройках чатов |
| `[data-ui="chat-storage-button"]` | Кнопка хранилища картинок в шапке списка чатов, `[data-full]` когда квота заполнена |
| `[data-ui="chat-backdrop-stored-sheet"]` | Ваши картинки в выборе фона комнаты. Сетка `[data-ui="chat-backdrop-stored-grid"]` с плитками хранилища `[data-ui="chat-storage-tile"]` |
| `[data-ui="chat-backdrop-picker"]` | Выбор фона чата или комнаты, `[data-lock]`: `star`, `role` или `pending`, когда фон сменить нельзя. Плашка с причиной: `[data-ui="chat-backdrop-locked"]` |
| `[data-ui="chat-info-backdrop"]` | Строка «Фон» в панели «О чате», `[data-access]`: `ready`, `star`, `role`, `pending` или `loading` |
| `[data-ui="chat-newcomer"]` | Кольцо длины сообщения новичка в поле ввода общего чата, `[data-over]`, когда текст слишком длинный |
| `[data-ui="chat-public-mute-reason"]` | Вторая строка плашки «вам запрещено писать»: причина от модератора или время окончания |

Остальные окна чатов (новый чат, жалоба, удаление) это `[data-ui="modal"]`. Цвета чатов берутся из токенов схемы (раздел «Белая и тёмная»): `--ink` для текста и линий, `--paper` и `--surface` для подложек, `--shade` для колодцев и затемнений. Тема, которая их задаёт, меняет и чаты. Ваши сообщения, открытый чат и выбранный фильтр подкрашены `--color-chat-tint`.

### Страница STAR

| Селектор | Элемент |
|---|---|
| `[data-ui="star-header"]` | Заголовок с кнопкой «назад» |
| `[data-ui="star-who"]` | Для кого: Личный, Duo, Family и переключатель подарка |
| `[data-ui="star-term"]` | Плитки срока (месяц, квартал, год) |
| `[data-ui="star-method"]` | Способы оплаты |
| `[data-ui="star-renew"]` | Переключатель автопродления под способами |
| `[data-ui="star-perks"]` | Плашки того, что входит в STAR |
| `[data-ui="star-receipt"]` | Чек справа: строки `[data-ui="star-receipt-lines"]`, сумма `[data-ui="star-total"]`, кнопка оплаты `[data-star-act="pay"]`, ход оплаты `[data-ui="star-progress"]`, ссылки `[data-ui="star-extras"]` |
| `[data-ui="star-offer"]` | Личное предложение в чеке |
| `[data-ui="star-pay"]` | Идёт оплата; состояние внутри: `star-pay-qr`, `star-pay-open`, `star-pay-wait`, `star-pay-confirm` или `star-pay-failed` |
| `[data-ui="star-timer"]` | Кольцо обратного отсчёта у QR и страницы оплаты |
| `[data-ui="star-step"]` | Отдельный шаг, `data-step`: `card`, `sbp`, `trial`, `plan`, `redeem`, `invite` или `gifts`; форма привязки карты `[data-ui="star-card-link"]` с `data-stage`, ошибка привязки `[data-ui="star-card-failed"]` с `data-retry` (`same`, `edit` или `fresh`), картинка карты `[data-ui="star-card-face"]`, привязка СБП `[data-ui="star-sbp-link"]` с `data-stage` |
| `[data-ui="star-trial"]` | Пробный период |
| `[data-ui="star-redeem"]` | Ввод кода |
| `[data-ui="star-invite"]` | Пригласить друга |
| `[data-ui="star-gifts"]` | Коды подарков; один код `[data-ui="star-gift-ticket"]` |
| `[data-ui="star-shared"]` | Места в Duo или Family; одно место `[data-ui="star-seat"]` |
| `[data-ui="star-success"]` | Оплачено |
| `[data-ui="star-manage"]` | Список управления: строки `star-autorenew`, `star-trial-row`, `star-bind`, `star-seats` |
| `[data-ui="star-confirm-renewal"]`, `[data-ui="star-expiring"]` | Предупреждения над списком, `data-tone` это `warn` или `bad` |
| `[data-ui="star-member"]` | Твоё место в чужом Duo или Family |
| `[data-ui="star-tenure"]` | Серия STAR |
| `[data-ui="star-discord"]` | Привязка Discord |
| `[data-ui="star-pass-summary"]` | Карточка пропуска справа: сколько дней осталось, следующее списание, действия |

## Переменные

| Переменная | Значение |
|---|---|
| `--color-accent` | Акцентный цвет |
| `--color-accent-hover` | Акцент при наведении |
| `--color-accent-glow` | Мягкое свечение акцента |
| `--color-accent-contrast` | Текст поверх акцента |
| `--bg-primary` | Фон окна |
| `--font-sans` | Шрифт интерфейса |
| `--glass-blur`, `--glass-blur-strong`, `--glass-blur-soft` | Размытие стеклянных панелей |

Акцент, фон и шрифт приложение берёт из настроек темы, поэтому при переопределении добавляйте `!important`:

```css
:root {
  --color-accent: #8b5cf6 !important;
  --bg-primary: #0b0614 !important;
}

[data-ui="sidebar"] {
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.08), transparent);
}

[data-ui="card"] {
  border-radius: 18px;
}
```

Элементам, которые оформлены встроенными стилями, тоже нужен `!important`.

## Белая и тёмная

`html[data-scheme]` равен `dark` или `white`. Схему выбирают в Настройки > Оформление; тема из каталога задаёт свою через `"scheme"` в theme.json.

Цвета хранятся каналами `r g b`, поэтому подходит любая прозрачность: `rgb(var(--ink) / 0.4)`.

| Переменная | Значение |
|---|---|
| `--ink` | Текст, иконки и линии |
| `--paper` | Основа окна |
| `--surface`, `--surface-hi` | Меню, поповеры, плотные панели |
| `--shade` | Тени и углубления |
| `--shade-alpha` | Сила теней: 1 в тёмной, 0.32 в белой |
| `--ink-lift` | Насколько поднимается бледный текст: 0 в тёмной, 0.6 в белой |

Перекрашивайте схему целиком, а не элементы по одному:

```css
[data-scheme="white"] {
  --ink: 58 18 51;
  --paper: 255 250 253;
  --shade: 192 37 106;
}
```

Задавайте их на `[data-scheme="white"]` или `[data-scheme="dark"]`, не на `:root`. Блоки поверх обложек несут `data-scheme="dark"` в обеих схемах и оставляют светлый текст.

## Свои картинки

Картинка в своём CSS работает двумя способами: файлом, добавленным в настройках (`sc-assets/...`), или строкой `data:` прямо в тексте стиля. Ссылки на сайты вырезаются, а пути к файлам на диске (`C:\...`, `file://`, `asset:`) приложение не загружает.

### Фон окна без CSS

Для обычного фона CSS не нужен:

1. Откройте Настройки > Оформление > Фоновое изображение.
2. Нажмите **Файл** и выберите картинку. Можно вставить ссылку и нажать **Скачать** или найти обои во вкладке **Онлайн**.
3. Щёлкните по миниатюре, чтобы включить фон. **Нет** выключает его.
4. Подстройте **Блюр фона**, **Затемнение фона** и **Затемнение краёв**.

### Файл-картинка в своём CSS

> Появится в следующем обновлении после 8.5.0. В 8.5.0 и старше работает только способ с `data:` ниже.

Нужна, когда картинку надо положить не на всё окно: в меню, в плеер, в карточки. Одинаково работает на Windows, macOS и Linux.

1. Откройте Настройки > Дополнительно > Свой CSS > **Свои картинки**.
2. Нажмите **Добавить картинку** и выберите файл: PNG, JPG, WebP, GIF, SVG или AVIF, до 10 МБ. Приложение копирует его в свою папку, оригинал остаётся на месте.
3. Нажмите кнопку копирования рядом с файлом и вставьте результат в CSS. Выглядит как `url("sc-assets/bg.webp")`.
4. Кнопка с корзиной удаляет файл. Правило, которое ссылается на удалённый файл, просто ничего не покажет.

Картинка в левом меню:

```css
[data-ui="sidebar"] {
  background-image: url("sc-assets/bg.webp") !important;
  background-size: cover;
  background-position: center;
}
```

Путь пишите как есть, `sc-assets/имя` или короче `assets/имя`: рабочий адрес приложение подставит само. В имени файла остаются строчные латинские буквы, цифры, `-` и `_`, остальное заменяется на `-`. Если имя занято, добавляется номер: `bg-2.webp`.

Файлы лежат только на этом компьютере. Если вы делитесь своим CSS, у другого человека этих файлов не будет: ему нужно добавить свои картинки под теми же именами.

### Картинка в CSS текстом (data:)

Запасной способ: картинка лежит прямо в CSS и переезжает вместе с текстом. Подходит для небольших картинок.

1. Подготовьте файл. Лучше WebP или JPEG до 300 КБ: вся картинка хранится текстом в настройках, и большой файл тормозит редактор.
2. Переведите файл в base64 и скопируйте результат:
   - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("bg.webp")) | Set-Clipboard`
   - macOS: `base64 -i bg.webp | tr -d '\n' | pbcopy`
   - Linux: `base64 -w0 bg.webp | xclip -selection clipboard`

   Подойдёт и любой сайт «image to base64».
3. Вставьте строку в `url("data:ТИП;base64,СТРОКА")`. Тип зависит от файла: `image/webp`, `image/jpeg`, `image/png`, `image/gif`, `image/svg+xml`.

Картинка в левом меню:

```css
[data-ui="sidebar"] {
  background-image: url("data:image/webp;base64,UklGR...") !important;
  background-size: cover;
  background-position: center;
}
```

Фон всего окна через CSS. Встроенный фон при этом выключите (**Нет**), иначе он ляжет поверх:

```css
[data-ui="app"] {
  background: url("data:image/webp;base64,UklGR...") center / cover no-repeat !important;
}
```

Если картинка не появилась:

- под редактором написано, что часть правил заблокирована: в `url()` попала ссылка на сайт или путь к файлу;
- для `sc-assets/`: имя не совпадает с именем в списке или файл удалён;
- тип в `data:` не совпадает с форматом файла;
- строка base64 вставилась с переносами или обрезалась;
- у элемента свой встроенный стиль: добавьте `!important`.

## Что блокируется

Правила `@import` и ссылки `url()` на интернет вырезаются перед применением, чтобы чужая тема не могла грузить файлы с других сайтов и подсматривать то, что вы вводите. Это работает и для экранированных вариантов вроде `\75 rl(` или `@\69mport`, и для ссылок, спрятанных за табуляцией, обратными слешами или пробелами в начале. Строки `data:` и файлы `sc-assets/` работают, см. [Свои картинки](#свои-картинки).

## Темы из каталога

В Настройки > Оформление > Темы есть готовые темы. **Применить** показывает тему на 20 секунд: **Оставить** сохраняет её, **Вернуть** или Esc возвращают как было. Темы обновляются сами, если не выключить **Автообновление** и не закрепить версию.

Как опубликовать свою тему, написано в [руководстве по темам](../themes/README.ru.md).
