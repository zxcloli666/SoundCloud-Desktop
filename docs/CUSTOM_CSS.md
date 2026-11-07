# Custom CSS

[Русская версия](CUSTOM_CSS.ru.md)

Settings > Appearance > Custom CSS lets you restyle the app with your own CSS. Changes apply as you type, in the main window and in the tray mini player. The switch in the card header turns the styles off without deleting them.

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
| `[data-ui="titlebar"]` | Title bar with search and window buttons |
| `[data-ui="brand"]` | Logo in the title bar |
| `[data-ui="window-controls"]` | Minimize, maximize, close |
| `[data-ui="search"]` | Search field in the title bar |
| `[data-ui="sidebar"]` | Left navigation |
| `[data-ui="nav-item"]` | A link in the left navigation |
| `[data-ui="sidebar-pins"]` | Pinned artists in the left navigation |
| `[data-ui="star-card"]` | STAR card in the left navigation |
| `[data-ui="profile"]` | Your profile at the bottom of the left navigation |
| `[data-ui="main"]` | Scrollable page area |
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
| `[data-ui="player-rating"]` | Track rating chip (A, C, F) in the player |
| `[data-ui="play-button"]` | Play and pause |
| `[data-ui="progress"]` | Progress bar |
| `[data-ui="volume"]` | Volume |
| `[data-ui="namecard"]` | Card that opens from the track title |
| `[data-ui="queue"]` | Queue panel |
| `[data-ui="queue-item"]` | A track in the queue |
| `[data-ui="lyrics"]` | Full-screen lyrics |
| `[data-ui="lyrics-line"]` | A line of lyrics, with `data-state` |
| `[data-ui="waveform"]` | Waveform |

### Content

| Selector | Element |
|---|---|
| `[data-ui="track-card"]` | Track tile in grids and shelves |
| `[data-ui="track-row"]` | Track row in Likes and other reorderable lists |
| `[data-ui="playlist-card"]` | Playlist and album tile |
| `[data-ui="artwork"]` | Cover image in tiles and rows |
| `[data-ui="track-title"]` | Track title |
| `[data-ui="artist-name"]` | Artist name next to a track |
| `[data-ui="like-button"]` | Like button |
| `[data-ui="greeting"]` | Greeting at the top of Home and Library |
| `[data-ui="soundwave"]` | "The current" block on Home |
| `[data-ui="soundprint"]` | Your soundprint bars |
| `[data-ui="artist-hero"]` | Top block of an artist page |
| `[data-ui="album-hero"]` | Top block of an album page |
| `[data-ui="playlist-hero"]` | Top block of a playlist page |
| `[data-ui="user-hero"]` | Top block of a profile page |
| `[data-ui="user-banner"]` | Profile banner above that block |
| `[data-ui="user-banner-glow"]` | Blurred banner behind the whole block |
| `[data-ui="track-hero"]` | Top block of a track page |
| `[data-ui="discover-hero"]` | Top block of Discover |
| `[data-ui="comments"]` | Comments list |
| `[data-ui="comment"]` | A comment |
| `[data-ui="search-tabs"]` | Search mode tabs |
| `[data-ui="tab"]` | A tab |
| `[data-ui="chip"]` | Genre and filter chips |
| `[data-ui="shelf"]` | Horizontal shelf |

### Controls

| Selector | Element |
|---|---|
| `[data-ui="button"]` | Glass button |
| `[data-ui="glass-card"]` | Glass card |
| `[data-ui="hero"]` | Large glass panel |
| `[data-ui="avatar"]` | Avatar |
| `[data-ui="skeleton"]` | Loading placeholder |
| `[data-ui="error-state"]` | Error message with a retry button |
| `[data-ui="kbd"]` | Key hint |
| `[data-ui="card"]` | Settings cards |
| `[data-ui="settings-nav"]` | Section list in Settings |
| `[data-ui="settings-nav-item"]` | A section in that list |
| `[data-ui="settings-row"]` | A setting row |
| `[data-ui="switch"]` | On/off switch |
| `[data-ui="segmented"]` | Group of options |
| `[data-ui="segment"]` | One option in a group |

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

Other chat windows (new chat, report, delete) are `[data-ui="modal"]`. Chat colors come from the scheme tokens (see "White and dark"): `--ink` for text and lines, `--paper` and `--surface` for surfaces, `--shade` for wells and scrims. A theme that sets them restyles chats too. Your messages, the open chat and the chosen filter are tinted with `--color-chat-tint`.

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

1. Open Settings > Appearance > Custom CSS > **Your images**.
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
