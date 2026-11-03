/**
 * Create and manipulate windows that host a single webview.
 *
 * {@linkcode WebviewWindow} is the type you want for ordinary multi-window apps: it
 * mixes together the {@link Window} and {@link Webview} APIs, so one object exposes
 * both the window methods (`setTitle`, `maximize`, `close`, ...) and the webview
 * ones (`setZoom`, `clearAllBrowsingData`, ...).
 *
 * ```typescript
 * import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
 *
 * const settings = new WebviewWindow('settings', {
 *   url: '/settings',
 *   title: 'Settings'
 * });
 * settings.once('tauri://created', () => console.log('window created'));
 * settings.once('tauri://error', (e) => console.error(e));
 * ```
 *
 * Unlike {@link Webview | child webviews}, this does **not** require the `unstable`
 * Cargo feature.
 *
 * This package is also accessible with `window.__TAURI__.webviewWindow` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 *
 * @remarks Creating a webview window requires the
 * `core:webview:allow-create-webview-window` permission, which is not included in
 * `core:webview:default`. The methods inherited from {@link Window} and
 * {@link Webview} each document their own permission.
 *
 * @module
 */
import { Webview, WebviewLabel, WebviewOptions } from './webview';
import type { WindowOptions } from './window';
import { Window } from './window';
import type { EventName, EventCallback, UnlistenFn } from './event';
import type { Color, DragDropEvent } from './webview';
/**
 * Get an instance of `Webview` for the current webview window.
 *
 * @since 2.0.0
 */
declare function getCurrentWebviewWindow(): WebviewWindow;
/**
 * Gets a list of instances of `Webview` for all available webview windows.
 *
 * @remarks Uses the `core:window:allow-get-all-windows` permission, which is part
 * of `core:window:default`.
 *
 * @since 2.0.0
 */
declare function getAllWebviewWindows(): Promise<WebviewWindow[]>;
interface WebviewWindow extends Webview, Window {
}
declare class WebviewWindow {
    label: string;
    /** Local event listeners. */
    listeners: Record<string, Array<EventCallback<any>>>;
    /**
     * Creates a new {@link Window} hosting a {@link Webview}.
     * @example
     * ```typescript
     * import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
     * const webview = new WebviewWindow('my-label', {
     *   url: 'https://github.com/tauri-apps/tauri'
     * });
     * webview.once('tauri://created', function () {
     *  // webview successfully created
     * });
     * webview.once('tauri://error', function (e) {
     *  // an error happened creating the webview
     * });
     * ```
     *
     * @param label The unique webview label. Must be alphanumeric: `a-zA-Z-/:_`.
     * @param options The window and webview configuration, see {@link WindowOptions}
     * and {@link WebviewOptions}.
     * @returns The {@link WebviewWindow} instance to communicate with the window and webview.
     *
     * @remarks Requires the `core:webview:allow-create-webview-window` permission
     * (not included in `core:webview:default`).
     */
    constructor(label: WebviewLabel, options?: Omit<WebviewOptions, 'x' | 'y' | 'width' | 'height'> & WindowOptions);
    /**
     * Gets the Webview for the webview associated with the given label.
     * @example
     * ```typescript
     * import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
     * const mainWebview = WebviewWindow.getByLabel('main');
     * ```
     *
     * @param label The webview label.
     * @returns The Webview instance to communicate with the webview or null if the webview doesn't exist.
     */
    static getByLabel(label: string): Promise<WebviewWindow | null>;
    /**
     * Get an instance of `Webview` for the current webview.
     */
    static getCurrent(): WebviewWindow;
    /**
     * Gets a list of instances of `Webview` for all available webviews.
     */
    static getAll(): Promise<WebviewWindow[]>;
    /**
     * Listen to an emitted event on this webview window.
     *
     * @example
     * ```typescript
     * import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
     * const unlisten = await WebviewWindow.getCurrent().listen<string>('state-changed', (event) => {
     *   console.log(`Got error: ${payload}`);
     * });
     *
     * // call unlisten when your handler goes out of scope e.g. the component is unmounted
     * unlisten();
     * ```
     *
     * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
     * @param handler Event handler.
     * @returns A promise resolving to a function to unlisten to the event.
     *
     * @remarks The listener is removed automatically when this webview window is
     * destroyed, so you do not need to unlisten just because the window is closing.
     * Do call the returned function when the listener's own scope ends, e.g. on page
     * navigation or when a component unmounts.
     */
    listen<T>(event: EventName, handler: EventCallback<T>): Promise<UnlistenFn>;
    /**
     * Listen to an emitted event on this webview window only once.
     *
     * @example
     * ```typescript
     * import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
     * const unlisten = await WebviewWindow.getCurrent().once<null>('initialized', (event) => {
     *   console.log(`Webview initialized!`);
     * });
     *
     * // call unlisten when your handler goes out of scope e.g. the component is unmounted
     * unlisten();
     * ```
     *
     * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
     * @param handler Event handler.
     * @returns A promise resolving to a function to unlisten to the event.
     *
     * @remarks The listener removes itself after the first event and is also removed
     * automatically when this webview window is destroyed. Do call the returned
     * function if the listener's own scope ends before the event arrives.
     */
    once<T>(event: EventName, handler: EventCallback<T>): Promise<UnlistenFn>;
    /**
     * Set the window and webview background color.
     *
     * #### Platform-specific:
     *
     * - **Android / iOS:** Unsupported for the window layer.
     * - **macOS / iOS**: Not implemented for the webview layer.
     * - **Windows**:
     *   - alpha channel is ignored for the window layer.
     *   - On Windows 7, alpha channel is ignored for the webview layer.
     *   - On Windows 8 and newer, if alpha channel is not `0`, it will be ignored.
     *
     * @example
     * ```typescript
     * import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
     * await getCurrentWebviewWindow().setBackgroundColor('#2f2f2f');
     * ```
     *
     * @param color The new background color.
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires both the `core:window:allow-set-background-color` and
     * `core:webview:allow-set-webview-background-color` permissions, neither of which
     * is included in the respective default permission set.
     *
     * @since 2.1.0
     */
    setBackgroundColor(color: Color): Promise<void>;
}
export { WebviewWindow, getCurrentWebviewWindow, getAllWebviewWindows };
export type { DragDropEvent, Color };
