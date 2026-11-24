# Custom CSS

[Русская версия](CUSTOM_CSS.ru.md)

Settings > Advanced > Custom CSS lets you restyle the app with your own CSS. Changes apply as you type, in the main window and in the tray mini player. The switch in the card header turns the styles off without deleting them.

Custom CSS sits on top of a theme from the catalog, so your rules win.

## If a style breaks the interface

- Press **Ctrl+Alt+Shift+C** (**Cmd+Option+Shift+C** on macOS). It turns off custom CSS and the catalog theme. The second press brings back what the first one turned off.
- Or start the app with the `--no-custom-css` flag. It turns off custom CSS and the catalog theme before anything else loads:
  - Windows: add ` --no-custom-css` to the end of the shortcut's Target field, or run `soundcloud-desktop.exe --no-custom-css`.
  - macOS: `open -n -a soundcloud-desktop --args --no-custom-css`
  - Linux: `soundcloud-desktop --no-custom-css`

If the app is already running, for example in the tray, the flag reaches that copy: it turns both off and shows the window.

## Stable hooks

Tailwind class names change from release to release. These attributes do not.

### Window

| Selector | Element |
|---|---|
| `[data-ui="app"]` | The whole window frame |
| `[data-ui="app"][data-wall]` | The window frame while a wallpaper or custom background is on; the side panels turn translucent |
| `[data-ui="titlebar"]` | Title bar with search and window buttons |
| `[data-ui="brand"]` | Logo in the title bar |
| `[data-ui="titlebar-navigation"]` | Back, forward, home and reload buttons in the title bar |
| `[data-ui="scheme-toggle"]` | Light and dark switch in the title bar |
| `[data-ui="window-controls"]` | Minimize, maximize, close |
| `[data-ui="search"]` | Search field in the title bar |
| `[data-ui="sidebar"]` | Left navigation |
| `[data-ui="nav-item"]` | A link in the left navigation |
| `[data-ui="quick-access"]` | Quick access block in the left navigation: library shortcuts and pins |
| `[data-ui="sidebar-pins"]` | Quick access rows, pinned playlists and artists in the left navigation |
| `[data-ui="sidebar-more"]` | Sections hidden from the left navigation, unfolded by the More row |
| `[data-ui="star-card"]` | STAR card in the left navigation; `data-tone` is `calm`, `warn` (7 days or less left, or a charge within 3 days) or `bad` (3 days or less left) |
| `[data-ui="profile"]` | Your profile at the bottom of the left navigation |
| `[data-ui="main"]` | Scrollable page area |
| `[data-ui="page-glow"]` | Soft light behind the page area, in the colours of the cover, genre or aura. `data-level` is `calm`, `page`, `star` (STAR profile; stars on user and artist pages) or `off`. `opacity` dims it, `display: none` turns it off |
| `[data-ui="back-to-top"]` | Floating back-to-top button over the page area |
| `[data-ui="page"]` | A page. `data-page` names it: `home`, `search`, `library`, `history`, `discover`, `star`, `track`, `playlist`, `user`, `artist`, `album`, `offline`, `recap`, `settings`, `login` |
| `[data-ui="modal"]` | Dialog window |
| `[data-ui="context-menu"]` | Right-click menu |
| `[data-ui="menu-item"]` | An item in that menu |
| `[data-ui="toast"]` | News popup |
| `[data-ui="tray"]` | Tray mini player |

### Player

| Selector | Element |
|---|---|
| `[data-ui="player"]` | Floating player bar |
| `[data-ui="player-art"]` | Cover in the player |
| `[data-ui="player-title"]` | Track title in the player |
| `[data-ui="marquee"]` | A long name that scrolls; `data-moving="true"` while it moves |
| `[data-ui="player-rating"]` | Track rating chip (A, C, F) in the player |
| `[data-ui="play-button"]` | Play and pause |
| `[data-ui="player-transport"]` | Previous, play, next and the before and after play zones around them |
| `[data-ui="player-zone"]` | A group of player buttons. `data-zone` is `left`, `before`, `after`, `right` or `title` (Home deck only); `data-drop` is `open` on every zone while a button is dragged and `over` on the one under it |
| `[data-ui="player-zone-chip"]` | The button that follows the pointer while it is dragged |
| `[data-ui="player-seek"]` | Waveform seek bar in the player |
| `[data-ui="player-like"]` | Like button in the player |
| `[data-ui="player-dislike"]` | Dislike button in the player |
| `[data-ui="player-playlist"]` | Add to playlist button in the player |
| `[data-ui="player-album"]` | Open album button in the player |
| `[data-ui="player-block"]` | Never play again button in the player |
| `[data-ui="player-quality"]` | Quality and rating slot in the player |
| `[data-ui="player-shuffle"]` | Shuffle button in the player |
| `[data-ui="player-repeat"]` | Repeat button in the player |
| `[data-ui="player-together"]` | Listen together button in the player |
| `[data-ui="player-lyrics"]` | Lyrics button in the player |
| `[data-ui="player-queue"]` | Queue button in the player |
| `[data-ui="player-ghosts"]` | Invisible slot that keeps hidden player buttons working for search, hotkeys and the assistant |
| `[data-ui="player-more"]` | Track actions button in the player |
| `[data-ui="player-sound"]` | Sound button in the player, the only one for effects, equalizer, speed, pitch, sleep timer and A-B loop; `data-live` is set while one of them is on |
| `[data-ui="sound-console"]` | Sound window that opens from that button |
| `[data-ui="sound-view"]` | Its middle; `data-view` is `main`, `eq` (the equalizer takes it all) or `effects` |
| `[data-ui="sound-expand"]` | Arrow that opens the equalizer or the effects at full size and back |
| `[data-ui="sound-effects"]`, `[data-ui="sound-effect"]` | Effect tiles and one tile in the sound window |
| `[data-ui="sound-live"]`, `[data-ui="sound-locked"]`, `[data-ui="sound-effects-manual"]` | Picture of the effect at work, the STAR plate over it and the reverb, room, 8D and bass sliders, at full size |
| `[data-ui="sound-eq"]`, `[data-ui="sound-eq-presets"]`, `[data-ui="sound-eq-curve"]` | Equalizer, its presets and its curve in the sound window |
| `[data-ui="sound-preamp"]` | Preamp next to the curve; `data-clipping` is set while the sound can clip |
| `[data-ui="sound-eq-actions"]`, `[data-ui="sound-eq-save"]`, `[data-ui="sound-eq-transfer"]` | Equalizer reset, import, export and save buttons, the preset name form, the import and export form |
| `[data-ui="sound-rate"]`, `[data-ui="sound-pitch"]` | Speed and pitch in the sound window |
| `[data-ui="sound-sleep"]`, `[data-ui="sound-loop"]` | Sleep timer and A-B loop in the sound window |
| `[data-ui="sound-remember"]`, `[data-ui="sound-reset"]` | Remember for this track and reset buttons in the sound window |
| `[data-ui="progress"]` | Progress bar in the full screen player |
| `[data-ui="volume"]` | Volume |
| `[data-ui="namecard"]` | Card that opens from the track title |
| `[data-ui="queue"]` | Queue panel, `[data-state]` is `open` or `closed` |
| `[data-ui="queue-hero"]` | Now playing at the top of the queue: cover, title, progress |
| `[data-ui="queue-clear"]` | Clear button in the queue header |
| `[data-ui="queue-close"]` | Close button in the queue header |
| `[data-ui="queue-played"]` | Played group toggle in the queue |
| `[data-ui="queue-section"]` | Section label in the queue, `[data-group]` is `added`, `context` or `auto` |
| `[data-ui="queue-item"]` | A track in the queue, `[data-tone]` is `played`, `now` or `next` |
| `[data-ui="queue-remove"]` | Remove button on a queue track |
| `[data-ui="queue-empty"]` | Empty queue with the Play the wave button |
| `[data-ui="lyrics"]` | Full-screen lyrics |
| `[data-ui="lyrics-backdrop"]` | Blurred background of the full screen player |
| `[data-ui="lyrics-line"]` | A line of lyrics, with `data-state` |
| `[data-ui="lyrics-offset"]` | Lyrics timing offset control (minus, value, plus) |
| `[data-ui="lyrics-own"]` | Mark on lyrics you attached yourself |
| `[data-ui="lyrics-attach"]` | Find or paste your own lyrics |
| `[data-ui="lyrics-candidate"]` | A found lyrics record, `data-state="active"` on the selected one |
| `[data-ui="lyrics-paste"]` | Box to paste your own lyrics or LRC |
| `[data-ui="track-video"]` | Track video; `data-place` is `player-cover`, `player-background`, `player-view`, `moments` or `room` (track page cover) |
| `html[data-video-opaque]` | Set while the video fully covers its place (same values as `data-place`); what it covers is hidden |
| `[data-ui="lyrics-video-toggle"]` | Video on/off button in full screen; `data-state` is `off`, `none`, `loading`, `failed` or `on` |
| `[data-ui="video-load"]` | Video loading ring on a cover |
| `[data-ui="waveform"]` | Waveform |

### Voice

| Selector | Element |
|---|---|
| `[data-ui="voice-mic"]` | Voice button in the player |
| `[data-ui="voice-island"]` | Voice popup above the player, `data-state` names its view |
| `[data-ui="voice-orb"]` | Listening orb, with `data-mode` |
| `[data-ui="voice-avatar"]` | Assistant avatar |
| `[data-ui="voice-hero"]` | Top block of Settings > Voice |
| `[data-ui="voice-locked"]` | Voice block without STAR |
| `[data-ui="voice-device"]` | A microphone tile, with `data-on` |
| `[data-ui="voice-role"]` | A role tile in "You and the assistant", with `data-on` |
| `[data-ui="voice-credits"]` | Licenses list in Settings > Voice |
| `[data-ui="voice-model"]` | A model row, with `data-state` |
| `[data-ui="voice-history-row"]` | A row in the voice history |

### Content

| Selector | Element |
|---|---|
| `[data-ui="track-card"]` | Track tile in grids and shelves |
| `[data-ui="track-row"]` | Track row in Likes and other reorderable lists |
| `[data-ui="track-rating"]` | Track rating (A, C, F) in lists, on covers and in the player; the state is in `data-tier`, `data-video`, `data-hq` |
| `[data-ui="playlist-card"]` | Playlist and album tile |
| `[data-ui="artwork"]` | Cover image in tiles and rows |
| `[data-ui="track-title"]` | Track title |
| `[data-ui="artist-name"]` | Artist name next to a track |
| `[data-ui="like-button"]` | Like button |
| `[data-ui="greeting"]` | Greeting at the top of Library |
| `[data-ui="soundwave"]` | The player deck on top of Home |
| `[data-ui="deck-scene"]` | Cover colour glow behind the Home deck; `data-live="true"` while the live background is drawn |
| `[data-ui="deck-status"]` | "Now playing" or "Paused" label in the Home deck |
| `[data-ui="deck-artist"]` | Artist names in the Home deck |
| `[data-ui="deck-frame"]` | Square around the big cover that holds the glow |
| `[data-ui="deck-cover"]` | Big cover in the Home deck |
| `[data-ui="deck-cover-fade"]` | Cover opacity slider shown on hover over the Home deck cover |
| `[data-ui="deck-title"]` | Track title in the Home deck with its `title` button zone |
| `[data-ui="deck-seek"]` | Seek capsule with the waveform and the time inside |
| `[data-ui="deck-controls"]` | Player buttons in the Home deck; `data-fit` is `flank` with the side zones beside the seek capsule or `tray` with them in a row under the buttons |
| `[data-ui="deck-tray"]` | Row of the left and right zones under the Home deck buttons in a narrow window |
| `[data-ui="deck-lyrics"]` | Current and next lyric lines under the player in a narrow window |
| `[data-ui="deck-lyric-current"]` | Current lyric line under the wave list in a wide window |
| `[data-ui="deck-lyric-next"]` | Next lyric line under the wave settings in a wide window |
| `[data-ui="deck-idle"]` | Home deck when nothing is playing |
| `[data-ui="deck-start"]` | Button that starts the wave when nothing is playing |
| `[data-ui="wave-pane"]` | Wave and its stations on the left of the Home deck in a wide window |
| `[data-ui="wave-tabs"]` | Row of Wave station tabs, on a narrow deck also the Up next / Wave switch |
| `[data-ui="wave-tab"]` | One tab in it |
| `[data-ui="wave-row"]` | A track or an artist in a Wave station |
| `[data-ui="up-next"]` | Up next list in the Home deck |
| `[data-ui="up-next-row"]` | A track in the Up next list |
| `[data-ui="wave-settings"]` | Wave settings box under Up next |
| `[data-ui="vibe-search"]` | Vibe search button in the Home deck |
| `[data-ui="home-shelf"]` | Liked, new releases, artists, playlists and history shelf on Home |
| `[data-ui="shelf-tab"]` | A tab of that shelf; `aria-selected` marks the open one |
| `[data-ui="shelf-tab-count"]` | Unheard count on the New releases tab |
| `[data-ui="shelf-actions"]` | Play all and add to queue for new releases, next to the shelf toggle |
| `[data-ui="shelf-toggle"]` | Collapse and expand button of that shelf |
| `[data-ui="shelf-card"]` | A card in that shelf |
| `[data-ui="shelf-locked"]` | New releases teaser without STAR |
| `[data-ui="moments-station"]` | "Moments" block on Home |
| `[data-ui="moments"]` | Moments page |
| `[data-ui="moments-stage"]` | Swipe area of the Moments page |
| `[data-ui="moment-card"]` | A moment: cover, title, wave, actions |
| `[data-ui="moment-wave"]` | Wave of the 30 s moment |
| `[data-ui="moment-listen-full"]` | "Play full track" button |
| `[data-ui="moments-rail"]` | Up/down arrows and progress on the right |
| `[data-ui="moments-empty"]` | Moments are not ready yet |
| `[data-ui="soundprint"]` | Your soundprint bars |
| `[data-ui="artist-hero"]` | Top block of an artist page |
| `[data-ui="album-hero"]` | Top block of an album page |
| `[data-ui="playlist-hero"]` | Top block of a playlist page |
| `[data-ui="playlist-cover-change"]` | Change cover button on your own playlist cover |
| `[data-ui="playlist-cover-state"]` | Cover upload badge. `[data-state]` is `sending`, `syncing` or `failed` |
| `[data-ui="playlist-cover-editor"]` | Cover crop window |
| `[data-ui="playlist-cover-crop"]` | Square frame you drag and zoom in that window |
| `[data-ui="user-hero"]` | Top block of a profile page |
| `[data-ui="my-music"]` | My music block on your own profile |
| `[data-ui="user-banner"]` | Profile banner above that block |
| `[data-ui="track-hero"]` | Top block of a track page |
| `[data-ui="track-cover-video"]` | Video layer inside the track page cover, fades out when the track stops being current |
| `[data-ui="discover-hero"]` | Top block of Discover |
| `[data-ui="comments"]` | Comments list |
| `[data-ui="comment"]` | A comment |
| `[data-ui="comment-like"]` | Comment like button |
| `[data-ui="comment-delete"]` | Comment delete button |
| `[data-ui="moment-reaction"]` | Reaction button in the track actions |
| `[data-ui="moment-reaction-mark"]` | Reaction mark on the waveform |
| `[data-ui="search-tabs"]` | Search mode tabs |
| `[data-ui="search-strip"]` | Row with the search mode tabs and the view switch |
| `[data-ui="search-view"]` | Covers / Moments switch in search |
| `[data-ui="search-layout"]` | Tiles / list switch in search |
| `[data-ui="search-kinds"]` | Result kind tabs in the list view of catalog search |
| `[data-ui="search-moments"]` | Moments view inside search |
| `[data-ui="search-wave-tail"]` | Last card of search moments: continue as a wave |
| `[data-ui="moments-from-here"]` | "Moments from here" button on a search cover |
| `[data-ui="tab"]` | A tab |
| `[data-ui="chip"]` | Genre and filter chips |
| `[data-ui="shelf"]` | Horizontal shelf |
| `[data-ui="sync-wait"]` | Your library is still in the sync queue: placeholders, the queue card, a strip in place of a shelf, the STAR lane. `[data-stage]` is `calm`, `long` or `priority`, `[data-kind]` is `syncing` or `stalled` |
| `[data-ui="sync-wait-progress"]` | Inside the sync strip: the lane, the countdown and the saved count. `[data-lane]` is `read` or `queue` |

### Controls

| Selector | Element |
|---|---|
| `[data-ui="button"]` | Glass button |
| `[data-ui="glass-card"]` | Glass card |
| `[data-ui="hero"]` | Large glass panel |
| `[data-ui="hero"][data-star]` | That panel on the page of a STAR member, their artist page or album |
| `[data-ui="avatar"]` | Avatar |
| `[data-ui="skeleton"]` | Loading placeholder |
| `[data-ui="error-state"]` | Error message with a retry button |
| `[data-ui="sync-notice"]` | Notice while a section is syncing or failed to sync |
| `[data-ui="kbd"]` | Key hint |
| `[data-ui="card"]` | Settings cards |
| `[data-ui="settings-nav"]` | Section list in Settings |
| `[data-ui="settings-nav-item"]` | A section in that list, `[aria-current="page"]` on the open one |
| `[data-ui="settings-header"]` | Title of the open Settings section |
| `[data-ui="settings-tabs"]` | Tabs of a section with several pages, like Advanced |
| `[data-ui="settings-tab"]` | One of those tabs, `[aria-selected="true"]` on the open one |
| `[data-ui="settings-row"]` | A setting row |
| `[data-ui="player-zones"]` | Button placement map in Settings, `data-surface` is `player` (bottom player) or `deck` (Home); each zone has `data-zone`, its list `data-drop` while dragging |
| `[data-ui="settings-info"]` | Info mark next to a setting, shows a hint on hover |
| `[data-ui="app-icons"]` | App icon choices in Settings |
| `[data-ui="app-icon"]` | One of those icons, `[aria-checked="true"]` on the chosen one |
| `[data-ui="mobile-access-badge"]` | Extended access status in Settings; `data-state` is `off`, `active` or `relink` |
| `[data-ui="mobile-link"]` | Extended access link dialog; `data-phase` is `starting`, `waiting`, `received`, `completed`, `mismatch`, `failed` or `expired` |
| `[data-ui="mobile-link-account"]` | Account being linked, in that dialog |
| `[data-ui="mobile-link-steps"]` | Browser, code, done steps in that dialog |
| `[data-ui="mobile-link-status"]` | Status block in that dialog; `data-tone` is `busy`, `ok`, `warn` or `bad` |
| `[data-ui="mobile-link-paste"]` | Paste-the-address fallback in that dialog |
| `[data-ui="mobile-link-island"]` | Pill at the bottom while a link waits for SoundCloud |
| `[data-ui="settings-search"]` | Search field at the top of the Settings section list |
| `[data-ui="settings-search-result"]` | Search result row, `[data-active]` is `true` on the lit one |
| `[data-ui="settings-search-results"]` | Results list in Settings search |
| `[data-ui="settings-search-count"]` | Result count next to the Settings search title |
| `[data-ui="settings-search-empty"]` | Nothing-found block in Settings search |
| `[data-ui="settings-search-clear"]` | Clear button in the search field |
| `[data-ui="switch"]` | On/off switch |
| `[data-ui="segmented"]` | Group of options |
| `[data-ui="segment"]` | One option in a group, `data-value` is its id |

States are in attributes too: `aria-current="page"` on the open link or section, `aria-checked` on switches, `aria-selected` or `data-active="true"` on tabs, chips and options. `html[data-perf="beauty"]`, `"medium"` or `"light"` is the performance mode.

### Chats

| Selector | Element |
|---|---|
| `[data-ui="chat-page"]` | Chats page |
| `[data-ui="chat-dock"]` | Chat panel at the right edge |
| `[data-ui="chat-dock-tabs"]` | Tab row of the chat panel |
| `[data-ui="chat-list"]` | Chat list |
| `[data-ui="chat-filter"]` | Filter above the chat list. `[data-kind]` is `all`, `direct`, `groups`, `unread`, `requests` or `archived`, the chosen one has `[aria-pressed="true"]` |
| `[data-ui="chat-row"]` | A chat in the list. `[data-kind]` is `direct`, `group`, `self`, `room` or `public`, the open one has `[aria-current]` |
| `[data-ui="chat-public-mark"]` | Glyph of the public chat in the list, the header and the info panel |
| `[data-ui="chat-public-slow"]` | Slow mode chip in the public chat header |
| `[data-ui="chat-public-sanction"]` | Muted or banned bar instead of the composer, `[data-kind]` is `muted` or `banned` |
| `[data-ui="chat-public-gate"]` | The public chat cannot open, `[data-gate]` is `muted`, `off` or `failed` |
| `[data-ui="chat-public-staff"]` | Moderators tab of the public chat |
| `[data-ui="chat-public-log"]` | Moderation log of the public chat |
| `[data-ui="chat-thread"]` | Open chat with its messages, `[data-kind]` as above |
| `[data-ui="chat-thread-header"]` | Header of the open chat |
| `[data-ui="chat-bubble"]` | A message. Yours have `[data-mine]`, unsent ones `[data-failed]` |
| `[data-ui="chat-system-row"]` | Service line between messages, `[data-kind]` names the event |
| `[data-ui="chat-composer"]` | Message input |
| `[data-ui="chat-embed"]` | Card in a message. `[data-kind]` is `track`, `playlist`, `user` or `room_invite` |
| `[data-ui="chat-info"]` | Chat info panel |
| `[data-ui="chat-requests"]` | Message requests: the list and the bar in a chat |
| `[data-ui="chat-room"]` | Listening room tab |
| `[data-ui="chat-room-stage"]` | Room area under the header that holds the room backdrop. Set `--room-accent` on it to tint the backdrop |
| `[data-ui="room-tuning"]` | Room settings button in the room header |
| `[data-ui="room-capacity"]` | Seats row in room settings: members of capacity, the seat strip, paused joins |
| `[data-ui="room-rules"]` | Room rules button in the room header (host) |
| `[data-ui="room-images-policy"]` | Who may post images in the room (host) |
| `[data-ui="room-cover"]` | Room cover row in the room rules (host) |
| `[data-ui="room-cover-picker"]` | Cover picker: artwork grid, accent colors, apply and reset |
| `[data-ui="open-room"]` | A room in the open rooms list |
| `[data-ui="chat-toast"]` | New message popup |
| `[data-ui="chat-share"]` | "Send" window |
| `[data-ui="chat-album"]` | Images in a message. A tile is `[data-ui="chat-album-tile"]`, `[data-state]` is `loading`, `ready`, `failed`, `deleted` or `lost` |
| `[data-ui="chat-upload-tile"]` | Your image that is still uploading, `[data-state]` is `queued`, `reserved`, `uploading`, `uploaded`, `committed` or `failed` |
| `[data-ui="chat-album-status"]` | Upload progress or failure line under your album |
| `[data-ui="chat-media-gone"]` | Placeholder of a deleted or unavailable image |
| `[data-ui="chat-media-gif"]` | GIF badge on a still animated image, shown when motion is reduced |
| `[data-ui="chat-lightbox"]` | Image viewer, the image area is `[data-ui="chat-lightbox-stage"]` |
| `[data-ui="chat-gallery"]` | Images tab in chat info. A tile is `[data-ui="chat-gallery-tile"]` with `[data-state]` as in an album, the empty tab is `[data-ui="chat-gallery-empty"]` |
| `[data-ui="chat-device-alert"]` | New device alert |
| `[data-ui="chat-relogin"]` | Chat sign-in card |
| `[data-ui="chat-keychain"]` | Card shown when the chat keys can't be read, `[data-reason]` is `keychain_denied` or `keychain_unavailable` |
| `[data-ui="chat-keys-reset"]` | Reset chat keys window, `[data-state]` is `ready`, `working` or `failed` |
| `[data-ui="chat-keys-storage"]` | Chat keys card in chat settings, `[data-storage]` is `os` or `file` |
| `[data-ui="chat-sign-in-limit"]` | Card shown while this computer can't sign in to chats. `[data-kind]` is `daily` (too many new sign-ins today) or `cap` (the account is on its maximum number of devices) |
| `[data-ui="chat-storage"]` | Image storage page (`/chats/storage`) |
| `[data-ui="chat-quota-ring"]` | Quota ring: used of quota, on the storage page and in chat settings |
| `[data-ui="chat-storage-grid"]` | Grid of your images; a tile is `[data-ui="chat-storage-tile"]`, a selected one has `[aria-pressed="true"]` |
| `[data-ui="chat-storage-undo"]` | Undo bar after deleting images |
| `[data-ui="chat-storage-entry"]` | Storage card in chat settings |
| `[data-ui="chat-storage-button"]` | Image storage button in the chat list header, `[data-full]` when the quota is full |
| `[data-ui="chat-backdrop-stored-sheet"]` | Your images in the room backdrop picker. The grid is `[data-ui="chat-backdrop-stored-grid"]` with storage tiles `[data-ui="chat-storage-tile"]` |
| `[data-ui="chat-backdrop-picker"]` | Backdrop picker of a chat or a room, `[data-lock]` is `star`, `role` or `pending` when it cannot be changed. The reason bar is `[data-ui="chat-backdrop-locked"]` |
| `[data-ui="chat-info-backdrop"]` | Backdrop row in chat info, `[data-access]` is `ready`, `star`, `role`, `pending` or `loading` |
| `[data-ui="chat-newcomer"]` | Newcomer length ring in the public chat composer, `[data-over]` when the text is too long |
| `[data-ui="chat-public-mute-reason"]` | Second line of the muted bar: the moderator's reason or the end time |

Other chat windows (new chat, report, delete) are `[data-ui="modal"]`. Chat colors come from the scheme tokens (see "White and dark"): `--ink` for text and lines, `--paper` and `--surface` for surfaces, `--shade` for wells and scrims. A theme that sets them restyles chats too. Your messages, the open chat and the chosen filter are tinted with `--color-chat-tint`.

### STAR page

| Selector | Element |
|---|---|
| `[data-ui="star-header"]` | Title row with the back button |
| `[data-ui="star-who"]` | Who it is for: Solo, Duo, Family and the gift switch |
| `[data-ui="star-term"]` | Term tiles (month, quarter, year) |
| `[data-ui="star-method"]` | Payment methods |
| `[data-ui="star-renew"]` | Auto-renew switch under the methods |
| `[data-ui="star-perks"]` | Perk chips |
| `[data-ui="star-receipt"]` | Receipt on the right: lines `[data-ui="star-receipt-lines"]`, total `[data-ui="star-total"]`, pay button `[data-star-act="pay"]`, progress `[data-ui="star-progress"]`, links `[data-ui="star-extras"]` |
| `[data-ui="star-offer"]` | Personal offer in the receipt |
| `[data-ui="star-pay"]` | Payment in progress; the state inside is `star-pay-qr`, `star-pay-open`, `star-pay-wait`, `star-pay-confirm` or `star-pay-failed` |
| `[data-ui="star-timer"]` | Countdown ring of a QR or payment page |
| `[data-ui="star-step"]` | Deep step, `data-step` is `card`, `sbp`, `trial`, `plan`, `redeem`, `invite` or `gifts`; card link form `[data-ui="star-card-link"]` with `data-stage`, failed bind `[data-ui="star-card-failed"]` with `data-retry` (`same`, `edit` or `fresh`), card picture `[data-ui="star-card-face"]`, SBP link `[data-ui="star-sbp-link"]` with `data-stage` |
| `[data-ui="star-trial"]` | Free trial |
| `[data-ui="star-redeem"]` | Code entry |
| `[data-ui="star-invite"]` | Invite a friend |
| `[data-ui="star-gifts"]` | Gift codes; one code is `[data-ui="star-gift-ticket"]` |
| `[data-ui="star-shared"]` | Duo or Family seats; a seat is `[data-ui="star-seat"]` |
| `[data-ui="star-success"]` | Paid |
| `[data-ui="star-manage"]` | Manage list: `star-autorenew`, `star-trial-row`, `star-bind`, `star-seats` rows |
| `[data-ui="star-confirm-renewal"]`, `[data-ui="star-expiring"]` | Warnings above the manage list, `data-tone` is `warn` or `bad` |
| `[data-ui="star-member"]` | Your place in someone else's Duo or Family |
| `[data-ui="star-tenure"]` | STAR streak |
| `[data-ui="star-discord"]` | Discord link |
| `[data-ui="star-pass-summary"]` | Pass card on the right: days left, next charge, actions |

## Variables

| Variable | Meaning |
|---|---|
| `--color-accent` | Accent colour |
| `--color-accent-hover` | Accent on hover |
| `--color-accent-glow` | Soft accent glow |
| `--color-accent-contrast` | Text on top of the accent |
| `--bg-primary` | Window background |
| `--font-sans` | Interface font |
| `--glass-blur`, `--glass-blur-strong`, `--glass-blur-soft` | Blur of glass panels |

The app writes the accent, background and font variables from your theme settings, so add `!important` when you override them:

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

Elements that get their look from inline styles also need `!important`.

## White and dark

`html[data-scheme]` is `dark` or `white`. People pick it in Settings > Appearance; a catalog theme picks its own with `"scheme"` in theme.json.

Colours are `r g b` channels, so any alpha works: `rgb(var(--ink) / 0.4)`.

| Variable | Meaning |
|---|---|
| `--ink` | Text, icons and lines |
| `--paper` | Window base |
| `--surface`, `--surface-hi` | Menus, popovers, solid panels |
| `--shade` | Shadows and wells |
| `--shade-alpha` | Shadow strength: 1 in dark, 0.32 in white |
| `--ink-lift` | How much faint text is lifted: 0 in dark, 0.6 in white |

Repaint the whole scheme at once instead of chasing elements:

```css
[data-scheme="white"] {
  --ink: 58 18 51;
  --paper: 255 250 253;
  --shade: 192 37 106;
}
```

Set them on `[data-scheme="white"]` or `[data-scheme="dark"]`, not on `:root`. Blocks on top of covers carry `data-scheme="dark"` in both schemes and keep their light text.

## Your own images

An image works in custom CSS in two ways: as a file added in Settings (`sc-assets/...`), or as a `data:` string right in the stylesheet. Links to websites are stripped, and paths to files on disk (`C:\...`, `file://`, `asset:`) are not loaded.

### Window background without CSS

A plain background needs no CSS:

1. Open Settings > Appearance > Background image.
2. Click **File** and pick an image. You can also paste a link and click **Download**, or find a wallpaper in the **Online** tab.
3. Click the thumbnail to turn the background on. **None** turns it off.
4. Adjust **Background blur**, **Background darkening** and **Edge darkening**.

### An image file in custom CSS

> Arrives in the next update after 8.5.0. In 8.5.0 and older only the `data:` way below works.

Use this when the image belongs to one part of the window: the sidebar, the player, the cards. Works the same on Windows, macOS and Linux.

1. Open Settings > Advanced > Custom CSS > **Your images**.
2. Click **Add image** and pick a file: PNG, JPG, WebP, GIF, SVG or AVIF, up to 10 MB. The app copies it into its own folder, the original stays where it was.
3. Click the copy button next to the file and paste the result into your CSS. It looks like `url("sc-assets/bg.webp")`.
4. The trash button deletes the file. A rule that points to a deleted file just shows nothing.

An image in the sidebar:

```css
[data-ui="sidebar"] {
  background-image: url("sc-assets/bg.webp") !important;
  background-size: cover;
  background-position: center;
}
```

Write the path exactly as it is, `sc-assets/name` or the short `assets/name`: the app turns it into a working address by itself. The file name is lowercase letters, digits, `-` and `_`; other characters are replaced with `-`. Adding a file with a taken name gives it a number: `bg-2.webp`.

The files live only on this computer. If you share your CSS, the other person has no such files: they need to add their own images under the same names.

### An image in custom CSS as text (data:)

The alternative: the image sits inside the CSS itself, so it travels with the text. Good for small images.

1. Prepare the file. WebP or JPEG up to 300 KB works best: the whole image is stored as text in the settings, and a large file slows the editor down.
2. Convert the file to base64 and copy the result:
   - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("bg.webp")) | Set-Clipboard`
   - macOS: `base64 -i bg.webp | tr -d '\n' | pbcopy`
   - Linux: `base64 -w0 bg.webp | xclip -selection clipboard`

   Any "image to base64" website works too.
3. Paste the string into `url("data:TYPE;base64,STRING")`. The type follows the file: `image/webp`, `image/jpeg`, `image/png`, `image/gif`, `image/svg+xml`.

An image in the sidebar:

```css
[data-ui="sidebar"] {
  background-image: url("data:image/webp;base64,UklGR...") !important;
  background-size: cover;
  background-position: center;
}
```

A background for the whole window through CSS. Turn the built-in background off (**None**), otherwise it covers yours:

```css
[data-ui="app"] {
  background: url("data:image/webp;base64,UklGR...") center / cover no-repeat !important;
}
```

If the image does not show up:

- the editor says some rules were blocked: a website link or a file path got into `url()`;
- for `sc-assets/`: the name does not match the one in the list, or the file was deleted;
- the type in `data:` does not match the file format;
- the base64 string was pasted with line breaks or got cut off;
- the element has its own inline style: add `!important`.

## What is blocked

`@import` rules and `url()` links to the internet are removed before the CSS is applied, so a theme copied from someone else cannot load files from other sites or leak what you type. This also holds for escaped spellings such as `\75 rl(` or `@\69mport` and for links hidden behind tabs, backslashes or leading spaces. `data:` URIs and `sc-assets/` files still work, see [Your own images](#your-own-images).

## Themes from the catalog

Settings > Appearance > Themes has ready-made themes. **Apply** shows a theme for 20 seconds: **Keep** saves it, **Revert** or Esc goes back. Themes update by themselves unless you turn off **Auto-update** or pin a version.

To publish your own theme, see the [theme guide](../themes/README.md).
