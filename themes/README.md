# Themes

[Русская версия](README.ru.md)

The theme catalog for SoundCloud Desktop. A theme installs in one click: **Settings -> Appearance -> Themes**.

## Add a theme

1. Fork the repo and create a branch `theme/<id>`.
2. Create the folder `themes/<id>/`:

   ```
   themes/<id>/
     theme.json      metadata
     theme.css       styles
     preview.webp    screenshot
     assets/         images and fonts, if you need them
   ```

3. Check it (Node 22.6 or newer, nothing to install):

   ```
   node --experimental-strip-types themes/tools/check.mjs <id>
   ```

4. Open a PR to `main`. Change only your folder.

After the merge the theme shows up in the catalog within an hour. Installed copies update within a few hours.

## theme.json

```json
{
  "$schema": "../theme.schema.json",
  "id": "midnight",
  "name": "Midnight",
  "description": { "en": "Deep blue with soft glass", "ru": "Глубокий синий и мягкое стекло" },
  "version": "1.0.0",
  "author": { "name": "Your Name", "github": "your-login" },
  "license": "MIT",
  "accent": "#7aa2ff",
  "background": "#070a12",
  "font": "onest"
}
```

| Field | Value |
|---|---|
| `id` | 3-32 characters: `a-z`, `0-9`, `-`. Same as the folder name |
| `name` | Up to 32 characters |
| `description` | `en`, `ru`, `tr`, `ko`, at least one, up to 140 characters |
| `version` | `1.0.0`. Raise it every time the files change |
| `author` | `name` up to 40 characters, `github` is your login |
| `license` | `MIT`, `Apache-2.0`, `CC0-1.0`, `CC-BY-4.0` or `CC-BY-SA-4.0` |
| `accent`, `background` | Optional. A `#rrggbb` color in lowercase |
| `scheme` | Optional. `dark` (default) or `white`. A white theme needs `"minApp": "8.8.0"` |
| `font` | Optional. `inter`, `manrope`, `onest`, `golos`, `montserrat`, `rubik`, `nunito`, `raleway`, `comfortaa` or `system` |
| `minApp` | Only if the theme needs something older app versions do not have |

Any other field is an error.

## theme.css

- Selectors and variables: [docs/CUSTOM_CSS.md](../docs/CUSTOM_CSS.md). Use `[data-ui="..."]`, Tailwind classes change between releases.
- Images and fonts come only from your folder: `url("assets/bg.webp")`. `url(#id)` and `data:` with an image or woff2 also work.
- Not allowed: links to websites, `@import`, `image()`, `src()`, `element()`, `paint()`, `var()` inside `image-set()`, `behavior`, `-webkit-app-region`.
- At-rules: `@media`, `@supports`, `@keyframes`, `@font-face`, `@layer`, `@container`, `@property`, `@scope`, `@starting-style`.
- Light mode (`html[data-perf="light"]`): drop animations and heavy blur.
- The app sets the scheme, accent, background and font from `scheme`, `accent`, `background` and `font`. Overriding them in CSS needs `!important`.
- On a white theme write colors through the scheme variables (`--ink`, `--paper`, `--surface`, `--shade`), see [White and dark](../docs/CUSTOM_CSS.md#white-and-dark).
- Up to 256 KB.

Long text in `content:` and `<text>` in SVG get a look in review.

## Images and fonts

- `assets/` has no subfolders: up to 24 files, 1 MB each, 3 MB in total.
- Images up to 4096 px on each side, `data:` images too.
- File names: `a-z`, `0-9`, `-`, `_`. Extensions: `webp`, `png`, `jpg`, `jpeg`, `avif`, `gif`, `svg`, `woff2`.
- Every file must be used in `theme.css`.
- SVG: no scripts, no outside links, no `&...;`, no backslash, only the svg and xlink namespaces.

## Preview

- `preview.webp` or `preview.png`, 960-1600 wide, about 16:10, up to 256 KB. 1280x800 works best.
- No screenshot? Open the PR anyway. The Themes check renders one: download `theme-previews` from the run page, put `<id>/preview.webp` into your folder and push.

## Try it in the app

1. **Settings -> Appearance -> Custom CSS**: paste `theme.css`.
2. Add the images from `assets/` in **Your images** under the same names. Fonts (woff2) cannot be added there, check them on the CI preview.
3. Set the scheme, accent, background and font by hand in **Appearance**.

If the interface breaks: **Ctrl+Alt+Shift+C** (**Cmd+Option+Shift+C** on macOS).

## Update or remove

- Update: change the files and raise `version`. CI rejects changed files without a new version.
- Remove: a PR that deletes the folder.

## For developers

Tool tests, as in CI:

```
node --experimental-strip-types --test 'themes/tools/*.test.mjs'
```
