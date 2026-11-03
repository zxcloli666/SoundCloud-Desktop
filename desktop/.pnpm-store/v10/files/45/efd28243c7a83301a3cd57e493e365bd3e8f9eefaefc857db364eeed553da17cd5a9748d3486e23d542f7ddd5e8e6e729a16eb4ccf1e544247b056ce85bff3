import { MenuItemOptions, SubmenuOptions, IconMenuItemOptions, PredefinedMenuItemOptions, CheckMenuItemOptions } from '../menu';
import { MenuItem } from './menuItem';
import { CheckMenuItem } from './checkMenuItem';
import { IconMenuItem } from './iconMenuItem';
import { PredefinedMenuItem } from './predefinedMenuItem';
import { Submenu } from './submenu';
import { type LogicalPosition, PhysicalPosition, Position } from '../dpi';
import { type Window } from '../window';
import { MenuItemBase } from './base';
/** Options for creating a new menu. */
export interface MenuOptions {
    /** Specify an id to use for the new menu. */
    id?: string;
    /** List of items to add to the new menu. */
    items?: Array<Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem | MenuItemOptions | SubmenuOptions | IconMenuItemOptions | PredefinedMenuItemOptions | CheckMenuItemOptions>;
}
/** A type that is either a menu bar on the window
 * on Windows and Linux or as a global menu in the menubar on macOS.
 *
 * #### Platform-specific:
 *
 * - **macOS**: if using {@linkcode Menu} for the global menubar, it can only contain {@linkcode Submenu}s.
 */
export declare class Menu extends MenuItemBase {
    /** @ignore */
    protected constructor(rid: number, id: string);
    /**
     * Create a new menu.
     *
     * @example
     * ```typescript
     * import { Menu } from '@tauri-apps/api/menu';
     *
     * const menu = await Menu.new({
     *   items: [
     *     {
     *       text: 'File',
     *       items: [
     *         { id: 'open', text: 'Open', accelerator: 'CmdOrCtrl+O', action: () => console.log('open') },
     *         { item: 'Separator' },
     *         { item: 'Quit' }
     *       ]
     *     }
     *   ]
     * });
     * ```
     */
    static new(opts?: MenuOptions): Promise<Menu>;
    /**
     * Create the default application menu, the same one Tauri installs when no menu
     * is configured.
     *
     * It contains an `Edit` submenu (undo, redo, cut, copy, paste, select all), a
     * `Window` submenu (minimize, maximize, close window) and a `Help` submenu, plus:
     *
     * - **macOS:** an application submenu named after your app (about, services,
     *   hide, hide others, quit) and a `View` submenu with the fullscreen item.
     * - **Windows:** a `File` submenu with close window and quit; the about item
     *   lives in `Help`.
     * - **Linux:** no `File` submenu; the about item lives in `Help`.
     *
     * Useful as a starting point you then extend with {@linkcode Menu.append},
     * {@linkcode Menu.insert} or {@linkcode Menu.prepend}.
     *
     * @example
     * ```typescript
     * import { Menu } from '@tauri-apps/api/menu';
     *
     * await using menu = await Menu.default();
     * await menu.append({ text: 'Tools', items: [{ id: 'fmt', text: 'Format' }] });
     * await menu.setAsAppMenu();
     * ```
     */
    static default(): Promise<Menu>;
    /**
     * Add a menu item to the end of this menu.
     *
     * #### Platform-specific:
     *
     * - **macOS:** Only {@linkcode Submenu}s can be added to a {@linkcode Menu}.
     */
    append<T extends Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem | MenuItemOptions | SubmenuOptions | IconMenuItemOptions | PredefinedMenuItemOptions | CheckMenuItemOptions>(items: T | T[]): Promise<void>;
    /**
     * Add a menu item to the beginning of this menu.
     *
     * #### Platform-specific:
     *
     * - **macOS:** Only {@linkcode Submenu}s can be added to a {@linkcode Menu}.
     */
    prepend<T extends Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem | MenuItemOptions | SubmenuOptions | IconMenuItemOptions | PredefinedMenuItemOptions | CheckMenuItemOptions>(items: T | T[]): Promise<void>;
    /**
     * Add a menu item to the specified position in this menu.
     *
     * #### Platform-specific:
     *
     * - **macOS:** Only {@linkcode Submenu}s can be added to a {@linkcode Menu}.
     */
    insert<T extends Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem | MenuItemOptions | SubmenuOptions | IconMenuItemOptions | PredefinedMenuItemOptions | CheckMenuItemOptions>(items: T | T[], position: number): Promise<void>;
    /** Remove a menu item from this menu. */
    remove(item: Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem): Promise<void>;
    /** Remove a menu item from this menu at the specified position. */
    removeAt(position: number): Promise<Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem | null>;
    /** Returns a list of menu items that has been added to this menu. */
    items(): Promise<Array<Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem>>;
    /** Retrieves the menu item matching the given identifier. */
    get(id: string): Promise<Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem | IconMenuItem | null>;
    /**
     * Popup this menu as a context menu on the specified window.
     *
     * Call it from a `contextmenu` DOM listener (and `preventDefault()` on the event)
     * to replace the webview context menu with a native one. The promise resolves as
     * soon as the menu is shown, not when an item is picked: use each item's `action`
     * handler for that.
     *
     * @example
     * ```typescript
     * import { Menu } from '@tauri-apps/api/menu';
     * import { LogicalPosition } from '@tauri-apps/api/dpi';
     *
     * const menu = await Menu.new({
     *   items: [{ id: 'copy', text: 'Copy', action: () => console.log('copy') }]
     * });
     *
     * document.addEventListener('contextmenu', (event) => {
     *   event.preventDefault();
     *   void menu.popup(new LogicalPosition(event.clientX, event.clientY));
     * });
     * ```
     *
     * @param at If a position is provided, it is relative to the window's top-left corner.
     * If there isn't one provided, the menu will pop up at the current location of the mouse.
     * @param window The window to show the menu on. Defaults to the current window.
     */
    popup(at?: PhysicalPosition | LogicalPosition | Position, window?: Window): Promise<void>;
    /**
     * Sets the app-wide menu and returns the previous one.
     *
     * If a window was not created with an explicit menu or had one set explicitly,
     * this menu will be assigned to it.
     *
     * This is the menu bar shown at the top of the screen on macOS. On Windows and
     * Linux, where menus belong to a window, use {@linkcode Menu.setAsWindowMenu}
     * to target one window instead.
     *
     * @example
     * ```typescript
     * import { Menu } from '@tauri-apps/api/menu';
     *
     * await using menu = await Menu.default();
     * const previous = await menu.setAsAppMenu();
     * await previous?.close();
     * ```
     *
     * @returns The menu that was set before this call, or `null` if there was none.
     */
    setAsAppMenu(): Promise<Menu | null>;
    /**
     * Sets the window menu and returns the previous one.
     *
     * #### Platform-specific:
     *
     * - **macOS:** Unsupported. The menu on macOS is app-wide and not specific to one
     * window, if you need to set it, use {@linkcode Menu.setAsAppMenu} instead.
     *
     * @example
     * ```typescript
     * import { Menu } from '@tauri-apps/api/menu';
     * import { getCurrentWindow } from '@tauri-apps/api/window';
     *
     * await using menu = await Menu.default();
     * await menu.setAsWindowMenu(getCurrentWindow());
     * ```
     *
     * @param window The window to set the menu on. Defaults to the current window.
     * @returns The menu that was set on that window before this call, or `null` if there was none.
     */
    setAsWindowMenu(window?: Window): Promise<Menu | null>;
}
