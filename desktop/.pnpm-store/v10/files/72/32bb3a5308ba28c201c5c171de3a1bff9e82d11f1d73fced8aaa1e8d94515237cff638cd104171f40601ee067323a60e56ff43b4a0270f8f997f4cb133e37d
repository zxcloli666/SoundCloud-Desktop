/**
 * Create and manipulate system tray (menu bar / notification area) icons.
 *
 * Tray icons are created with {@linkcode TrayIcon.new} and live on the Rust side,
 * the frontend only holds a handle to them.
 *
 * This package is also accessible with `window.__TAURI__.tray` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 *
 * @remarks All commands used by this module are part of the `core:tray:default`
 * permission set, which is enabled by default, so no extra capability
 * configuration is needed. Loading an icon from a path or from bytes additionally
 * requires the `image-png` / `image-ico` Cargo features of the `tauri` crate.
 *
 * @module
 */
import type { Menu, Submenu } from './menu';
import { Resource } from './core';
import { type JsImage } from './image';
import { PhysicalPosition, PhysicalSize } from './dpi';
/** Whether the mouse button was pressed (`Down`) or released (`Up`). */
export type MouseButtonState = 'Up' | 'Down';
/** The mouse button that triggered a tray icon event. */
export type MouseButton = 'Left' | 'Right' | 'Middle';
/**
 * The kind of a {@linkcode TrayIconEvent}.
 *
 * - `Click`: a mouse button was pressed or released over the icon.
 * - `DoubleClick`: the icon was double clicked.
 * - `Enter`: the cursor entered the icon area.
 * - `Move`: the cursor moved inside the icon area.
 * - `Leave`: the cursor left the icon area.
 */
export type TrayIconEventType = 'Click' | 'DoubleClick' | 'Enter' | 'Move' | 'Leave';
/** The fields shared by every {@linkcode TrayIconEvent}. */
export type TrayIconEventBase<T extends TrayIconEventType> = {
    /** The tray icon event type */
    type: T;
    /** Id of the tray icon which triggered this event. */
    id: string;
    /** Physical position of the click the triggered this event. */
    position: PhysicalPosition;
    /** Position and size of the tray icon. */
    rect: {
        position: PhysicalPosition;
        size: PhysicalSize;
    };
};
/** The extra fields of the `Click` and `DoubleClick` {@linkcode TrayIconEvent} variants. */
export type TrayIconClickEvent = {
    /** Mouse button that triggered this event. */
    button: MouseButton;
    /** Mouse button state when this event was triggered. */
    buttonState: MouseButtonState;
};
/**
 * Describes a tray icon event.
 *
 * #### Platform-specific:
 *
 * - **Linux**: Unsupported. The event is not emitted even though the icon is shown,
 * the icon will still show a context menu on right click.
 */
export type TrayIconEvent = (TrayIconEventBase<'Click'> & TrayIconClickEvent) | (TrayIconEventBase<'DoubleClick'> & Omit<TrayIconClickEvent, 'buttonState'>) | TrayIconEventBase<'Enter'> | TrayIconEventBase<'Move'> | TrayIconEventBase<'Leave'>;
/** {@link TrayIcon.new|`TrayIcon`} creation options */
export interface TrayIconOptions {
    /** The tray icon id. If undefined, a random one will be assigned */
    id?: string;
    /** The tray icon menu */
    menu?: Menu | Submenu;
    /**
     * The tray icon which could be icon bytes or path to the icon file.
     *
     * Note that you may need the `image-ico` or `image-png` Cargo features to use this API.
     * To enable it, change your Cargo.toml file:
     * ```toml
     * [dependencies]
     * tauri = { version = "...", features = ["...", "image-png"] }
     * ```
     */
    icon?: JsImage;
    /** The tray icon tooltip */
    tooltip?: string;
    /**
     * The tray title
     *
     * #### Platform-specific
     *
     * - **Linux:** The title will not be shown unless there is an icon
     * as well.  The title is useful for numerical and other frequently
     * updated information.  In general, it shouldn't be shown unless a
     * user requests it as it can take up a significant amount of space
     * on the user's panel.  This may not be shown in all visualizations.
     * - **Windows:** Unsupported.
     */
    title?: string;
    /**
     * The tray icon temp dir path. **Linux only**.
     *
     * On Linux, we need to write the icon to the disk and usually it will
     * be `$XDG_RUNTIME_DIR/tray-icon` or `$TEMP/tray-icon`.
     */
    tempDirPath?: string;
    /**
     * Use the icon as a [template](https://developer.apple.com/documentation/appkit/nsimage/1520017-template?language=objc). **macOS only**.
     */
    iconAsTemplate?: boolean;
    /**
     * Whether to show the tray menu on left click or not, default is `true`.
     *
     * #### Platform-specific:
     *
     * - **Linux**: Unsupported.
     *
     * @deprecated use {@linkcode TrayIconOptions.showMenuOnLeftClick} instead.
     */
    menuOnLeftClick?: boolean;
    /**
     * Whether to show the tray menu on left click or not, default is `true`.
     *
     * #### Platform-specific:
     *
     * - **Linux**: Unsupported.
     *
     * @since 2.2.0
     */
    showMenuOnLeftClick?: boolean;
    /** A handler for an event on the tray icon. */
    action?: (event: TrayIconEvent) => void;
}
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
export declare class TrayIcon extends Resource {
    /** The id associated with this tray icon.   */
    id: string;
    private constructor();
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
    static getById(id: string): Promise<TrayIcon | null>;
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
    static removeById(id: string): Promise<void>;
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
    static new(options?: TrayIconOptions): Promise<TrayIcon>;
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
    setIcon(icon: JsImage | null): Promise<void>;
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
    setMenu(menu: Menu | Submenu | null): Promise<void>;
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
    setTooltip(tooltip: string | null): Promise<void>;
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
    setTitle(title: string | null): Promise<void>;
    /**
     * Show or hide this tray icon.
     *
     * @example
     * ```typescript
     * await tray.setVisible(false);
     * ```
     */
    setVisible(visible: boolean): Promise<void>;
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
    setTempDirPath(path: string | null): Promise<void>;
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
    setIconAsTemplate(asTemplate: boolean): Promise<void>;
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
    setIconWithAsTemplate(icon: JsImage | null, asTemplate: boolean): Promise<void>;
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
    setMenuOnLeftClick(onLeft: boolean): Promise<void>;
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
    setShowMenuOnLeftClick(onLeft: boolean): Promise<void>;
}
