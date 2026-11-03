'use strict';

var dpi = require('./dpi.cjs');
var event = require('./event.cjs');
var core = require('./core.cjs');
var window$1 = require('./window.cjs');

// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT
/**
 * Provides APIs to create webviews, communicate with other webviews and manipulate the current webview.
 *
 * #### Webview events
 *
 * Events can be listened to using {@link Webview.listen}:
 * ```typescript
 * import { getCurrentWebview } from "@tauri-apps/api/webview";
 * getCurrentWebview().listen("my-webview-event", ({ event, payload }) => { });
 * ```
 *
 * #### The `unstable` Cargo feature
 *
 * Creating *child webviews* — several webviews inside one window, via
 * {@link Webview | `new Webview(...)`} — is an unstable API. It requires the
 * `unstable` feature of the `tauri` crate:
 *
 * ```toml
 * [dependencies]
 * tauri = { version = "2", features = ["unstable"] }
 * ```
 *
 * Without it the `plugin:webview|create_webview` command returns an
 * "unstable feature not supported" error. Everything else in this module —
 * {@link getCurrentWebview}, {@link getAllWebviews} and the methods of an existing
 * webview — works without the feature, and so does
 * {@link WebviewWindow | `new WebviewWindow(...)`}, which creates a window with a
 * single webview.
 *
 * This package is also accessible with `window.__TAURI__.webview` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 *
 * @remarks `core:webview:default` only enables the getters
 * (`allow-get-all-webviews`, `allow-webview-position`, `allow-webview-size` and
 * `allow-internal-toggle-devtools`). Every other method documents the permission
 * it needs, which you must add to a capability yourself.
 *
 * @module
 */
/**
 * Get an instance of `Webview` for the current webview.
 *
 * @since 2.0.0
 */
function getCurrentWebview() {
    return new Webview(window$1.getCurrentWindow(), window.__TAURI_INTERNALS__.metadata.currentWebview.label, {
        // @ts-expect-error `skip` is not defined in the public API but it is handled by the constructor
        skip: true
    });
}
/**
 * Gets a list of instances of `Webview` for all available webviews.
 *
 * @remarks Uses the `core:webview:allow-get-all-webviews` permission, which is part
 * of `core:webview:default`.
 *
 * @since 2.0.0
 */
async function getAllWebviews() {
    return core.invoke('plugin:webview|get_all_webviews').then((webviews) => webviews.map((w) => new Webview(new window$1.Window(w.windowLabel, {
        // @ts-expect-error `skip` is not defined in the public API but it is handled by the constructor
        skip: true
    }), w.label, {
        // @ts-expect-error `skip` is not defined in the public API but it is handled by the constructor
        skip: true
    })));
}
/** @ignore */
// events that are emitted right here instead of by the created webview
const localTauriEvents = ['tauri://created', 'tauri://error'];
/**
 * Create new webview or get a handle to an existing one.
 *
 * Webviews are identified by a *label*  a unique identifier that can be used to reference it later.
 * It may only contain alphanumeric characters `a-zA-Z` plus the following special characters `-`, `/`, `:` and `_`.
 *
 * #### Requires the `unstable` Cargo feature
 *
 * Creating a webview with `new Webview(...)` adds a *child webview* to an existing
 * window, which is an unstable API gated behind the `unstable` feature of the
 * `tauri` crate:
 *
 * ```toml
 * [dependencies]
 * tauri = { version = "2", features = ["unstable"] }
 * ```
 *
 * Without it the call rejects with an "unstable feature not supported" error.
 * Getting a handle to an existing webview (`Webview.getByLabel`,
 * {@link getCurrentWebview}, {@link getAllWebviews}) and every method on this class
 * work without the feature. To create a window that hosts a single webview, use
 * {@link WebviewWindow} instead, which is stable.
 *
 * @example
 * ```typescript
 * import { Window } from "@tauri-apps/api/window"
 * import { Webview } from "@tauri-apps/api/webview"
 *
 * const appWindow = new Window('uniqueLabel');
 *
 * appWindow.once('tauri://created', async function () {
 *   // `new Webview` Should be called after the window is successfully created,
 *   // or webview may not be attached to the window since window is not created yet.
 *
 *   // loading embedded asset:
 *   const webview = new Webview(appWindow, 'theUniqueLabel', {
 *     url: 'path/to/page.html',
 *
 *     // create a webview with specific logical position and size
 *     x: 0,
 *     y: 0,
 *     width: 800,
 *     height: 600,
 *   });
 *   // alternatively, load a remote URL:
 *   const webview = new Webview(appWindow, 'theUniqueLabel', {
 *     url: 'https://github.com/tauri-apps/tauri',
 *
 *     // create a webview with specific logical position and size
 *     x: 0,
 *     y: 0,
 *     width: 800,
 *     height: 600,
 *   });
 *
 *   webview.once('tauri://created', function () {
 *     // webview successfully created
 *   });
 *   webview.once('tauri://error', function (e) {
 *     // an error happened creating the webview
 *   });
 *
 *
 *   // emit an event to the backend
 *   await webview.emit("some-event", "data");
 *   // listen to an event from the backend
 *   const unlisten = await webview.listen("event-name", e => { });
 *   unlisten();
 * });
 * ```
 *
 * @since 2.0.0
 */
class Webview {
    /**
     * Creates a new Webview.
     * @example
     * ```typescript
     * import { Window } from '@tauri-apps/api/window'
     * import { Webview } from '@tauri-apps/api/webview'
     * const appWindow = new Window('my-label')
     *
     * appWindow.once('tauri://created', async function() {
     *   const webview = new Webview(appWindow, 'my-label', {
     *     url: 'https://github.com/tauri-apps/tauri',
     *
     *     // create a webview with specific logical position and size
     *     x: 0,
     *     y: 0,
     *     width: 800,
     *     height: 600,
     *   });
     *
     *   webview.once('tauri://created', function () {
     *     // webview successfully created
     *   });
     *   webview.once('tauri://error', function (e) {
     *     // an error happened creating the webview
     *   });
     * });
     * ```
     *
     * @param window the window to add this webview to.
     * @param label The unique webview label. Must be alphanumeric: `a-zA-Z-/:_`.
     * @param options The webview configuration, see {@link WebviewOptions}.
     * @returns The {@link Webview} instance to communicate with the webview.
     *
     * @remarks Requires the `unstable` Cargo feature on the `tauri` crate
     * (`tauri = { version = "2", features = ["unstable"] }`), otherwise the call
     * rejects with an "unstable feature not supported" error. It also requires the
     * `core:webview:allow-create-webview` permission, which is not included in
     * `core:webview:default`.
     */
    constructor(window, label, options) {
        this.window = window;
        this.label = label;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.listeners = Object.create(null);
        // @ts-expect-error `skip` is not a public API so it is not defined in WebviewOptions
        if (!(options === null || options === void 0 ? void 0 : options.skip)) {
            core.invoke('plugin:webview|create_webview', {
                windowLabel: window.label,
                options: {
                    ...options,
                    label
                }
            })
                .then(async () => this.emit('tauri://created'))
                .catch(async (e) => this.emit('tauri://error', e));
        }
    }
    /**
     * Gets the Webview for the webview associated with the given label.
     * @example
     * ```typescript
     * import { Webview } from '@tauri-apps/api/webview';
     * const mainWebview = Webview.getByLabel('main');
     * ```
     *
     * @param label The webview label.
     * @returns The Webview instance to communicate with the webview or null if the webview doesn't exist.
     */
    static async getByLabel(label) {
        var _a;
        return (_a = (await getAllWebviews()).find((w) => w.label === label)) !== null && _a !== void 0 ? _a : null;
    }
    /**
     * Get an instance of `Webview` for the current webview.
     */
    static getCurrent() {
        return getCurrentWebview();
    }
    /**
     * Gets a list of instances of `Webview` for all available webviews.
     */
    static async getAll() {
        return getAllWebviews();
    }
    /**
     * Listen to an emitted event on this webview.
     *
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * const unlisten = await getCurrentWebview().listen<string>('state-changed', (event) => {
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
     * @remarks The listener is removed automatically when this webview is destroyed,
     * so you do not need to unlisten just because the webview is closing. Do call the
     * returned function when the listener's own scope ends, e.g. on page navigation
     * or when a component unmounts.
     */
    async listen(event$1, handler) {
        if (this._handleTauriEvent(event$1, handler)) {
            return () => {
                // eslint-disable-next-line security/detect-object-injection
                const listeners = this.listeners[event$1];
                listeners.splice(listeners.indexOf(handler), 1);
            };
        }
        return event.listen(event$1, handler, {
            target: { kind: 'Webview', label: this.label }
        });
    }
    /**
     * Listen to an emitted event on this webview only once.
     *
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * const unlisten = await getCurrentWebview().once<null>('initialized', (event) => {
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
     * automatically when this webview is destroyed. Do call the returned function if
     * the listener's own scope ends before the event arrives.
     */
    async once(event$1, handler) {
        if (this._handleTauriEvent(event$1, handler)) {
            return () => {
                // eslint-disable-next-line security/detect-object-injection
                const listeners = this.listeners[event$1];
                listeners.splice(listeners.indexOf(handler), 1);
            };
        }
        return event.once(event$1, handler, {
            target: { kind: 'Webview', label: this.label }
        });
    }
    /**
     * Emits an event to all {@link EventTarget|targets}.
     *
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().emit('webview-loaded', { loggedIn: true, token: 'authToken' });
     * ```
     *
     * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
     * @param payload Event payload.
     */
    async emit(event$1, payload) {
        if (localTauriEvents.includes(event$1)) {
            // eslint-disable-next-line
            for (const handler of this.listeners[event$1] || []) {
                handler({
                    event: event$1,
                    id: -1,
                    payload
                });
            }
            return;
        }
        return event.emit(event$1, payload);
    }
    /**
     * Emits an event to all {@link EventTarget|targets} matching the given target.
     *
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().emitTo('main', 'webview-loaded', { loggedIn: true, token: 'authToken' });
     * ```
     *
     * @param target Label of the target Window/Webview/WebviewWindow or raw {@link EventTarget} object.
     * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
     * @param payload Event payload.
     */
    async emitTo(target, event$1, payload) {
        if (localTauriEvents.includes(event$1)) {
            // eslint-disable-next-line
            for (const handler of this.listeners[event$1] || []) {
                handler({
                    event: event$1,
                    id: -1,
                    payload
                });
            }
            return;
        }
        return event.emitTo(target, event$1, payload);
    }
    /** @ignore */
    _handleTauriEvent(event, handler) {
        if (localTauriEvents.includes(event)) {
            if (!(event in this.listeners)) {
                // eslint-disable-next-line security/detect-object-injection
                this.listeners[event] = [handler];
            }
            else {
                // eslint-disable-next-line security/detect-object-injection
                this.listeners[event].push(handler);
            }
            return true;
        }
        return false;
    }
    // Getters
    /**
     * The position of the top-left hand corner of the webview's client area relative to the top-left hand corner of the desktop.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * const position = await getCurrentWebview().position();
     * ```
     *
     * @returns The webview's position, in physical pixels.
     *
     * @remarks Uses the `core:webview:allow-webview-position` permission, which is
     * part of `core:webview:default`.
     */
    async position() {
        return core.invoke('plugin:webview|webview_position', {
            label: this.label
        }).then((p) => new dpi.PhysicalPosition(p));
    }
    /**
     * The physical size of the webview's client area.
     * The client area is the content of the webview, excluding the title bar and borders.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * const size = await getCurrentWebview().size();
     * ```
     *
     * @returns The webview's size, in physical pixels.
     *
     * @remarks Uses the `core:webview:allow-webview-size` permission, which is part
     * of `core:webview:default`.
     */
    async size() {
        return core.invoke('plugin:webview|webview_size', {
            label: this.label
        }).then((s) => new dpi.PhysicalSize(s));
    }
    // Setters
    /**
     * Closes the webview.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().close();
     * ```
     *
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-webview-close` permission (not
     * included in `core:webview:default`).
     */
    async close() {
        return core.invoke('plugin:webview|webview_close', {
            label: this.label
        });
    }
    /**
     * Resizes the webview.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * import { LogicalSize } from '@tauri-apps/api/dpi';
     * await getCurrentWebview().setSize(new LogicalSize(600, 500));
     * ```
     *
     * @param size The logical or physical size.
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-set-webview-size` permission (not
     * included in `core:webview:default`).
     */
    async setSize(size) {
        return core.invoke('plugin:webview|set_webview_size', {
            label: this.label,
            value: size instanceof dpi.Size ? size : new dpi.Size(size)
        });
    }
    /**
     * Sets the webview position.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * import { LogicalPosition } from '@tauri-apps/api/dpi';
     * await getCurrentWebview().setPosition(new LogicalPosition(600, 500));
     * ```
     *
     * @param position The new position, in logical or physical pixels, relative to
     * the top-left corner of the hosting window.
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-set-webview-position` permission (not
     * included in `core:webview:default`).
     */
    async setPosition(position) {
        return core.invoke('plugin:webview|set_webview_position', {
            label: this.label,
            value: position instanceof dpi.Position ? position : new dpi.Position(position)
        });
    }
    /**
     * Bring the webview to front and focus.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().setFocus();
     * ```
     *
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-set-webview-focus` permission (not
     * included in `core:webview:default`).
     */
    async setFocus() {
        return core.invoke('plugin:webview|set_webview_focus', {
            label: this.label
        });
    }
    /**
     * Sets whether the webview should automatically grow and shrink its size and position when the parent window resizes.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().setAutoResize(true);
     * ```
     *
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-set-webview-auto-resize` permission
     * (not included in `core:webview:default`).
     */
    async setAutoResize(autoResize) {
        return core.invoke('plugin:webview|set_webview_auto_resize', {
            label: this.label,
            value: autoResize
        });
    }
    /**
     * Hide the webview.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().hide();
     * ```
     *
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-webview-hide` permission (not
     * included in `core:webview:default`).
     */
    async hide() {
        return core.invoke('plugin:webview|webview_hide', {
            label: this.label
        });
    }
    /**
     * Show the webview.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().show();
     * ```
     *
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-webview-show` permission (not
     * included in `core:webview:default`).
     */
    async show() {
        return core.invoke('plugin:webview|webview_show', {
            label: this.label
        });
    }
    /**
     * Set webview zoom level.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().setZoom(1.5);
     * ```
     *
     * @param scaleFactor The zoom level, where `1` is 100%.
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-set-webview-zoom` permission (not
     * included in `core:webview:default`).
     */
    async setZoom(scaleFactor) {
        return core.invoke('plugin:webview|set_webview_zoom', {
            label: this.label,
            value: scaleFactor
        });
    }
    /**
     * Moves this webview to the window with the given label.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().reparent('other-window');
     * ```
     *
     * @param window The target window, or its label.
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-reparent` permission (not included in
     * `core:webview:default`).
     */
    async reparent(window) {
        return core.invoke('plugin:webview|reparent', {
            label: this.label,
            window: typeof window === 'string' ? window : window.label
        });
    }
    /**
     * Clears all browsing data for this webview: cookies, localStorage, IndexedDB,
     * caches and any other data the webview stores for the loaded origins.
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().clearAllBrowsingData();
     * ```
     *
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-clear-all-browsing-data` permission
     * (not included in `core:webview:default`).
     */
    async clearAllBrowsingData() {
        return core.invoke('plugin:webview|clear_all_browsing_data');
    }
    /**
     * Specify the webview background color.
     *
     * #### Platform-specific:
     *
     * - **macOS / iOS**: Not implemented.
     * - **Windows**:
     *   - On Windows 7, transparency is not supported and the alpha value will be ignored.
     *   - On Windows higher than 7: translucent colors are not supported so any alpha value other than `0` will be replaced by `255`
     *
     * @example
     * ```typescript
     * import { getCurrentWebview } from '@tauri-apps/api/webview';
     * await getCurrentWebview().setBackgroundColor('#2f2f2f');
     * // or with an RGBA tuple, or `null` to restore the default background
     * await getCurrentWebview().setBackgroundColor([47, 47, 47, 255]);
     * ```
     *
     * @param color The new background color, or `null` to reset it.
     * @returns A promise indicating the success or failure of the operation.
     *
     * @remarks Requires the `core:webview:allow-set-webview-background-color`
     * permission (not included in `core:webview:default`).
     *
     * @since 2.1.0
     */
    async setBackgroundColor(color) {
        return core.invoke('plugin:webview|set_webview_background_color', {
            label: this.label,
            value: color
        });
    }
    // Listeners
    /**
     * Listen to a file drop event.
     * The listener is triggered when the user hovers the selected files on the webview,
     * drops the files or cancels the operation.
     *
     * @example
     * ```typescript
     * import { getCurrentWebview } from "@tauri-apps/api/webview";
     * const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
     *  if (event.payload.type === 'over') {
     *    console.log('User hovering', event.payload.position);
     *  } else if (event.payload.type === 'drop') {
     *    console.log('User dropped', event.payload.paths);
     *  } else {
     *    console.log('File drop cancelled');
     *  }
     * });
     *
     * // call unlisten when your handler goes out of scope e.g. the component is unmounted
     * unlisten();
     * ```
     *
     * When the debugger panel is open, the drop position of this event may be inaccurate due to a known limitation.
     * To retrieve the correct drop position, please detach the debugger.
     *
     * @returns A promise resolving to a function to unlisten to the event.
     *
     * @remarks The listeners are removed automatically when this webview is
     * destroyed. Do call the returned function when the listener's own scope ends,
     * e.g. on page navigation or when a component unmounts.
     */
    async onDragDropEvent(handler) {
        const unlistenDragEnter = await this.listen(event.TauriEvent.DRAG_ENTER, (event) => {
            handler({
                ...event,
                payload: {
                    type: 'enter',
                    paths: event.payload.paths,
                    position: new dpi.PhysicalPosition(event.payload.position)
                }
            });
        });
        const unlistenDragOver = await this.listen(event.TauriEvent.DRAG_OVER, (event) => {
            handler({
                ...event,
                payload: {
                    type: 'over',
                    position: new dpi.PhysicalPosition(event.payload.position)
                }
            });
        });
        const unlistenDragDrop = await this.listen(event.TauriEvent.DRAG_DROP, (event) => {
            handler({
                ...event,
                payload: {
                    type: 'drop',
                    paths: event.payload.paths,
                    position: new dpi.PhysicalPosition(event.payload.position)
                }
            });
        });
        const unlistenDragLeave = await this.listen(event.TauriEvent.DRAG_LEAVE, (event) => {
            handler({ ...event, payload: { type: 'leave' } });
        });
        return async () => {
            await Promise.all([
                unlistenDragEnter(),
                unlistenDragDrop(),
                unlistenDragOver(),
                unlistenDragLeave()
            ]);
        };
    }
}

exports.Webview = Webview;
exports.getAllWebviews = getAllWebviews;
exports.getCurrentWebview = getCurrentWebview;
