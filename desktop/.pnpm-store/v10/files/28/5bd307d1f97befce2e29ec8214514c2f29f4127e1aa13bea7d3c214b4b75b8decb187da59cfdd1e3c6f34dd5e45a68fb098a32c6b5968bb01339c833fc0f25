import { MenuItemBase } from './base';
/** Options for creating a new menu item. */
export interface MenuItemOptions {
    /** Specify an id to use for the new menu item. */
    id?: string;
    /** The text of the new menu item. */
    text: string;
    /** Whether the new menu item is enabled or not. */
    enabled?: boolean;
    /**
     * Specify an accelerator (keyboard shortcut) for the new menu item, for example
     * `'CmdOrCtrl+Shift+K'`.
     *
     * The string is a list of zero or more modifiers followed by exactly one key,
     * joined with `+`. Matching is case insensitive and spaces around each token are
     * ignored, so `'CmdOrCtrl+Shift+K'` and `'cmdorctrl + shift + k'` are equivalent.
     * All modifiers must come before the key.
     *
     * Accepted modifiers:
     *
     * - `Shift`
     * - `Control`, `Ctrl`
     * - `Alt`, `Option`
     * - `Command`, `Cmd`, `Super`
     * - `CmdOrCtrl`, `CmdOrControl`, `CommandOrCtrl`, `CommandOrControl` — `Command`
     *   on macOS and `Control` everywhere else, which is what you usually want for
     *   application shortcuts.
     *
     * Accepted keys:
     *
     * - Letters `A`-`Z` (also written `KeyA`-`KeyZ`) and digits `0`-`9` (also `Digit0`-`Digit9`).
     * - Punctuation, either as the character or by name: `` ` ``/`Backquote`, `\`/`Backslash`,
     *   `[`/`BracketLeft`, `]`/`BracketRight`, `,`/`Comma`, `=`/`Equal`, `-`/`Minus`,
     *   `.`/`Period`, `'`/`Quote`, `;`/`Semicolon`, `/`/`Slash`.
     * - `Backspace`, `CapsLock`, `Enter`, `Space`, `Tab`, `Delete`, `End`, `Home`,
     *   `Insert`, `PageDown`, `PageUp`, `PrintScreen`, `ScrollLock`, `NumLock`,
     *   `Escape` (also `Esc`).
     * - Arrows: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` (also `Up`, `Down`, `Left`, `Right`).
     * - Function keys `F1` through `F24`.
     * - Numpad keys: `Numpad0`-`Numpad9` (also `Num0`-`Num9`), `NumpadAdd`, `NumpadSubtract`,
     *   `NumpadMultiply`, `NumpadDivide`, `NumpadDecimal`, `NumpadEnter`, `NumpadEqual`
     *   (each also accepted with the `Num` prefix, e.g. `NumAdd`).
     * - Media keys: `AudioVolumeUp`, `AudioVolumeDown`, `AudioVolumeMute` (also `VolumeUp`,
     *   `VolumeDown`, `VolumeMute`).
     *
     * @example
     * ```typescript
     * import { MenuItem } from '@tauri-apps/api/menu';
     *
     * await MenuItem.new({ text: 'Find', accelerator: 'CmdOrCtrl+F' });
     * await MenuItem.new({ text: 'Command palette', accelerator: 'CmdOrCtrl+Shift+P' });
     * await MenuItem.new({ text: 'Refresh', accelerator: 'F5' });
     * ```
     *
     * An accelerator that cannot be parsed is ignored and the item is created
     * without a shortcut, so double-check the spelling of the modifiers and key.
     */
    accelerator?: string;
    /** Specify a handler to be called when this menu item is activated. */
    action?: (id: string) => void;
}
/** A menu item inside a {@linkcode Menu} or {@linkcode Submenu} and contains only text. */
export declare class MenuItem extends MenuItemBase {
    /** @ignore */
    protected constructor(rid: number, id: string);
    /** Create a new menu item. */
    static new(opts: MenuItemOptions): Promise<MenuItem>;
    /** Returns the text of this menu item. */
    text(): Promise<string>;
    /** Sets the text for this menu item. */
    setText(text: string): Promise<void>;
    /** Returns whether this menu item is enabled or not. */
    isEnabled(): Promise<boolean>;
    /** Sets whether this menu item is enabled or not. */
    setEnabled(enabled: boolean): Promise<void>;
    /**
     * Sets the accelerator for this menu item, or removes it when given `null`.
     *
     * See {@linkcode MenuItemOptions.accelerator} for the accepted format.
     *
     * @example
     * ```typescript
     * await item.setAccelerator('CmdOrCtrl+Shift+K');
     * ```
     */
    setAccelerator(accelerator: string | null): Promise<void>;
}
