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

## What is blocked

`@import` rules and `url()` links to the internet are removed before the CSS is applied, so a theme copied from someone else cannot load files from other sites or leak what you type. `data:` URIs and local `asset:` files still work. For a background picture use Settings > Appearance > Background image.
