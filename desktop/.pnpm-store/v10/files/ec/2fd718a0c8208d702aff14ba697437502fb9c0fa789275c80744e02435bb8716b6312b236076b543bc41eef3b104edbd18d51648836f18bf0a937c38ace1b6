'use strict';

var core = require('./core.cjs');
var image = require('./image.cjs');
var dpi = require('./dpi.cjs');

// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT
/**
 * Tray icon class and associated methods. This type constructor is private,
 * instead, you should use the static method {@linkcode TrayIcon.new}.
 *
 * #### Warning
 *
 * Unlike Rust, JavaScript does not have any way to run cleanup code
 * when an object is being removed by garbage collection, but this tray icon
 * will be cleaned up when the tauri app exists, however if you want to cleanup
 * and remove the tray early, you need to call {@linkcode TrayIcon.close}.
 *
 * @example
 * ```ts
 * import { TrayIcon } from '@tauri-apps/api/tray';
 * const tray = await TrayIcon.new({ tooltip: 'awesome tray tooltip' });
 * await tray.setTooltip('new tooltip');
 * ```
 */
class TrayIcon extends core.Resource {
    constructor(rid, id) {
        super(rid);
        this.id = id;
    }
    /**
     * Gets a tray icon using the provided id.
     *
     * Use it to get a handle from the frontend to a tray icon that was created on
     * the Rust side with an explicit id.
     *
     * @example
     * ```typescript
     * import { TrayIcon } from '@tauri-apps/api/tray';
     * const tray = await TrayIcon.getById('main-tray');
     * await tray?.setTooltip('still here');
     * ```
     *
     * @returns The tray icon, or `null` if no tray icon with that id exists.
     */
    static async getById(id) {
        return core.invoke('plugin:tray|get_by_id', { id }).then((rid) => rid ? new TrayIcon(rid, id) : null);
    }
    /**
     * Removes a tray icon using the provided id from tauri's internal state.
     *
     * Note that this may cause the tray icon to disappear
     * if it wasn't cloned somewhere else or referenced by JS.
     *
     * @example
     * ```typescript
     * import { TrayIcon } from '@tauri-apps/api/tray';
     * await TrayIcon.removeById('main-tray');
     * ```
     */
    static async removeById(id) {
        return core.invoke('plugin:tray|remove_by_id', { id });
    }
    /**
     * Creates a new {@linkcode TrayIcon}
     *
     * #### Platform-specific:
     *
     * - **Linux:** Sometimes the icon won't be visible unless a menu is set.
     * Setting an empty {@linkcode Menu} is enough.
     *
     * @example
     * ```typescript
     * import { TrayIcon } from '@tauri-apps/api/tray';
     * import { Menu } from '@tauri-apps/api/menu';
     * import { defaultWindowIcon } from '@tauri-apps/api/app';
     *
     * await using menu = await Menu.new({
     *   items: [{ id: 'quit', text: 'Quit', action: () => console.log('quit') }]
     * });
     *
     * const tray = await TrayIcon.new({
     *   id: 'main-tray',
     *   icon: (await defaultWindowIcon()) ?? undefined,
     *   menu,
     *   tooltip: 'My app',
     *   action: (event) => {
     *     if (event.type === 'Click') {
     *       console.log('tray clicked with', event.button);
     *     }
     *   }
     * });
     * ```
     */
    static async new(options) {
        if (options === null || options === void 0 ? void 0 : options.menu) {
            // @ts-expect-error we only need the rid and kind
            options.menu = [options.menu.rid, options.menu.kind];
        }
        if (options === null || options === void 0 ? void 0 : options.icon) {
            options.icon = image.transformImage(options.icon);
        }
        const handler = new core.Channel();
        if (options === null || options === void 0 ? void 0 : options.action) {
            const action = options.action;
            handler.onmessage = (e) => action(mapEvent(e));
            delete options.action;
        }
        return core.invoke('plugin:tray|new', {
            options: options !== null && options !== void 0 ? options : {},
            handler
        }).then(([rid, id]) => new TrayIcon(rid, id));
    }
    /**
     *  Sets a new tray icon. If `null` is provided, it will remove the icon.
     *
     * Note that you may need the `image-ico` or `image-png` Cargo features to use this API.
     * To enable it, change your Cargo.toml file:
     * ```toml
     * [dependencies]
     * tauri = { version = "...", features = ["...", "image-png"] }
     * ```
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     * await tray.setIcon(await Image.fromPath('icons/active.png'));
     * // remove the icon
     * await tray.setIcon(null);
     * ```
     */
    async setIcon(icon) {
        let trayIcon = null;
        if (icon) {
            trayIcon = image.transformImage(icon);
        }
        return core.invoke('plugin:tray|set_icon', { rid: this.rid, icon: trayIcon });
    }
    /**
     * Sets a new tray menu.
     *
     * #### Platform-specific:
     *
     * - **Linux**: once a menu is set it cannot be removed so `null` has no effect
     *
     * @example
     * ```typescript
     * import { Menu } from '@tauri-apps/api/menu';
     * await using menu = await Menu.new({ items: [{ id: 'quit', text: 'Quit' }] });
     * await tray.setMenu(menu);
     * ```
     */
    async setMenu(menu) {
        if (menu) {
            // @ts-expect-error we only need the rid and kind
            menu = [menu.rid, menu.kind];
        }
        return core.invoke('plugin:tray|set_menu', { rid: this.rid, menu });
    }
    /**
     * Sets the tooltip for this tray icon, shown when the cursor hovers it.
     *
     * #### Platform-specific:
     *
     * - **Linux:** Unsupported
     *
     * @example
     * ```typescript
     * await tray.setTooltip('3 unread messages');
     * ```
     */
    async setTooltip(tooltip) {
        return core.invoke('plugin:tray|set_tooltip', { rid: this.rid, tooltip });
    }
    /**
     * Sets the title shown next to this tray icon.
     *
     * @example
     * ```typescript
     * await tray.setTitle('42');
     * ```
     *
     * #### Platform-specific:
     *
     * - **Linux:** The title will not be shown unless there is an icon
     * as well.  The title is useful for numerical and other frequently
     * updated information.  In general, it shouldn't be shown unless a
     * user requests it as it can take up a significant amount of space
     * on the user's panel.  This may not be shown in all visualizations.
     * - **Windows:** Unsupported
     */
    async setTitle(title) {
        return core.invoke('plugin:tray|set_title', { rid: this.rid, title });
    }
    /**
     * Show or hide this tray icon.
     *
     * @example
     * ```typescript
     * await tray.setVisible(false);
     * ```
     */
    async setVisible(visible) {
        return core.invoke('plugin:tray|set_visible', { rid: this.rid, visible });
    }
    /**
     * Sets the tray icon temp dir path. **Linux only**.
     *
     * On Linux, we need to write the icon to the disk and usually it will
     * be `$XDG_RUNTIME_DIR/tray-icon` or `$TEMP/tray-icon`.
     *
     * @example
     * ```typescript
     * import { appCacheDir } from '@tauri-apps/api/path';
     * await tray.setTempDirPath(await appCacheDir());
     * ```
     */
    async setTempDirPath(path) {
        return core.invoke('plugin:tray|set_temp_dir_path', { rid: this.rid, path });
    }
    /**
     * Sets the current icon as a [template](https://developer.apple.com/documentation/appkit/nsimage/1520017-template?language=objc). **macOS only**
     *
     * A template image is recolored by the system so it matches the menu bar
     * appearance in light and dark mode.
     *
     * @example
     * ```typescript
     * await tray.setIconAsTemplate(true);
     * ```
     */
    async setIconAsTemplate(asTemplate) {
        return core.invoke('plugin:tray|set_icon_as_template', {
            rid: this.rid,
            asTemplate
        });
    }
    /**
     * Sets a new tray icon and template status atomically. **macOS only**.
     *
     * Note that you may need the `image-ico` or `image-png` Cargo features to use this API.
     * To enable it, change your Cargo.toml file:
     * ```toml
     * [dependencies]
     * tauri = { version = "...", features = ["...", "image-png"] }
     * ```
     *
     * Prefer this over calling {@linkcode TrayIcon.setIcon} and
     * {@linkcode TrayIcon.setIconAsTemplate} in sequence, which can briefly show the
     * new icon with the previous template setting.
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     * await tray.setIconWithAsTemplate(await Image.fromPath('icons/active.png'), true);
     * ```
     */
    async setIconWithAsTemplate(icon, asTemplate) {
        let trayIcon = null;
        if (icon) {
            trayIcon = image.transformImage(icon);
        }
        return core.invoke('plugin:tray|set_icon_with_as_template', {
            rid: this.rid,
            icon: trayIcon,
            asTemplate
        });
    }
    /**
     *  Disable or enable showing the tray menu on left click.
     *
     * #### Platform-specific:
     *
     * - **Linux**: Unsupported.
     *
     * @deprecated use {@linkcode TrayIcon.setShowMenuOnLeftClick} instead.
     *
     * @example
     * ```typescript
     * await tray.setShowMenuOnLeftClick(false);
     * ```
     */
    async setMenuOnLeftClick(onLeft) {
        return core.invoke('plugin:tray|set_show_menu_on_left_click', {
            rid: this.rid,
            onLeft
        });
    }
    /**
     *  Disable or enable showing the tray menu on left click.
     *
     * #### Platform-specific:
     *
     * - **Linux**: Unsupported.
     *
     * Disable it to handle left clicks yourself through the
     * {@linkcode TrayIconOptions.action} handler while still showing the menu on
     * right click.
     *
     * @example
     * ```typescript
     * await tray.setShowMenuOnLeftClick(false);
     * ```
     *
     * @since 2.2.0
     */
    async setShowMenuOnLeftClick(onLeft) {
        return core.invoke('plugin:tray|set_show_menu_on_left_click', {
            rid: this.rid,
            onLeft
        });
    }
}
function mapEvent(e) {
    const out = e;
    out.position = new dpi.PhysicalPosition(e.position);
    out.rect.position = new dpi.PhysicalPosition(e.rect.position);
    out.rect.size = new dpi.PhysicalSize(e.rect.size);
    return out;
}

exports.TrayIcon = TrayIcon;
