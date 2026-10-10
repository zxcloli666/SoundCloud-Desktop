# Custom CSS

[Русская версия](CUSTOM_CSS.ru.md)

Settings > Appearance > Custom CSS lets you restyle the app with your own CSS. Changes apply as you type, in the main window and in the tray mini player. The switch in the card header turns the styles off without deleting them.

## If a style breaks the interface

- Press **Ctrl+Alt+Shift+C** (**Cmd+Option+Shift+C** on macOS). It turns custom CSS off, and pressing it again turns it back on.
- Or start the app with the `--no-custom-css` flag. It switches custom CSS off before anything else loads:
  - Windows: add ` --no-custom-css` to the end of the shortcut's Target field, or run `soundcloud-desktop.exe --no-custom-css`.
  - macOS: `open -a soundcloud-desktop --args --no-custom-css`
  - Linux: `soundcloud-desktop --no-custom-css`

Close the running app first, otherwise the flag reaches the copy that is already open and is ignored.

## Stable hooks

Tailwind class names change from release to release. These attributes do not:

| Selector | Element |
|---|---|
| `[data-ui="app"]` | The whole window frame |
| `[data-ui="titlebar"]` | Title bar with search and window buttons |
| `[data-ui="sidebar"]` | Left navigation |
| `[data-ui="main"]` | Scrollable page area |
| `[data-ui="player"]` | Floating player bar |
| `[data-ui="queue"]` | Queue panel |
| `[data-ui="lyrics"]` | Full-screen lyrics |
| `[data-ui="card"]` | Settings cards |
| `[data-ui="tray"]` | Tray mini player |
| `html[data-perf="light"]`, `"medium"` | Performance mode (no attribute means Beauty) |

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

## Your own images

An image works in custom CSS in two ways: as a file added in Settings (`sc-assets/...`), or as a `data:` string right in the stylesheet. Links to websites are stripped, and paths to files on disk (`C:\...`, `file://`, `asset:`) are not loaded.

### Window background without CSS

A plain background needs no CSS:

1. Open Settings > Appearance > Background image.
2. Click **File** and pick an image. You can also paste a link and click **Download**, or find a wallpaper in the **Online** tab.
3. Click the thumbnail to turn the background on. **None** turns it off.
4. Adjust **Background blur**, **Background darkening** and **Edge darkening**.

### An image file in custom CSS

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

Write the path exactly as it is, `sc-assets/name`: the app turns it into a working address by itself. The file name is lowercase letters, digits, `-` and `_`; other characters are replaced with `-`. Adding a file with a taken name gives it a number: `bg-2.webp`.

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

`@import` rules and `url()` links to the internet are removed before the CSS is applied, so a theme copied from someone else cannot load files from other sites or leak what you type. `data:` URIs and `sc-assets/` files still work, see [Your own images](#your-own-images).
