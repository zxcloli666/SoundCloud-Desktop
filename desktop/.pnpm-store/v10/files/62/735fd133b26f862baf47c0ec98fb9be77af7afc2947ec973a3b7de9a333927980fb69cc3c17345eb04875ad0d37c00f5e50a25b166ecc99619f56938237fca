declare global {
    interface Window {
        __TAURI_EVENT_PLUGIN_INTERNALS__: {
            unregisterListener: (event: string, eventId: number) => void;
        };
    }
}
/**
 * The target of an event, used to filter which listeners receive it and which
 * listeners a given emit reaches.
 *
 * - `Any`: matches every target (the default).
 * - `AnyLabel`: matches any window, webview or webview window with the given label.
 * - `App`: the application itself, i.e. listeners registered with `app.listen` on the Rust side.
 * - `Window` / `Webview` / `WebviewWindow`: the specific target with that label.
 *
 * @since 2.0.0
 */
type EventTarget = {
    kind: 'Any';
} | {
    kind: 'AnyLabel';
    label: string;
} | {
    kind: 'App';
} | {
    kind: 'Window';
    label: string;
} | {
    kind: 'Webview';
    label: string;
} | {
    kind: 'WebviewWindow';
    label: string;
};
interface Event<T> {
    /** Event name */
    event: EventName;
    /** Event identifier used to unlisten */
    id: number;
    /** Event payload */
    payload: T;
}
type EventCallback<T> = (event: Event<T>) => void;
type UnlistenFn = () => void;
type EventName = `${TauriEvent}` | (string & Record<never, never>);
interface Options {
    /**
     * The event target to listen to, defaults to `{ kind: 'Any' }`, see {@link EventTarget}.
     *
     * If a string is provided, it is used as the label of an `AnyLabel` target,
     * i.e. `{ kind: 'AnyLabel', label: <the string> }`.
     */
    target?: string | EventTarget;
}
/**
 * The built-in event names emitted by Tauri itself.
 *
 * These are the raw names behind the `on*` helpers of the `Window` and `Webview`
 * classes (e.g. `Window.onResized` listens to {@linkcode TauriEvent.WINDOW_RESIZED}).
 * Prefer those helpers when one exists, since they also decode the payload into
 * the matching class (`PhysicalSize`, `PhysicalPosition`, ...).
 *
 * @example
 * ```typescript
 * import { listen, TauriEvent } from '@tauri-apps/api/event';
 * const unlisten = await listen(TauriEvent.WINDOW_DESTROYED, (event) => {
 *   console.log('a window was destroyed', event.payload);
 * });
 * ```
 *
 * @since 1.1.0
 */
declare enum TauriEvent {
    /** A window was resized. Payload: the new inner size, in physical pixels. See `Window.onResized`. */
    WINDOW_RESIZED = "tauri://resize",
    /** A window was moved. Payload: the new outer position, in physical pixels. See `Window.onMoved`. */
    WINDOW_MOVED = "tauri://move",
    /**
     * The user requested a window to be closed (e.g. clicked the close button).
     * See `Window.onCloseRequested`, which also handles preventing the close.
     */
    WINDOW_CLOSE_REQUESTED = "tauri://close-requested",
    /** A window was destroyed, i.e. it is gone and its label can be reused. */
    WINDOW_DESTROYED = "tauri://destroyed",
    /** A window gained focus. See `Window.onFocusChanged`. */
    WINDOW_FOCUS = "tauri://focus",
    /** A window lost focus. See `Window.onFocusChanged`. */
    WINDOW_BLUR = "tauri://blur",
    /**
     * The scale factor of the monitor a window is on changed, or the window moved to
     * a monitor with a different scale factor. See `Window.onScaleChanged`.
     */
    WINDOW_SCALE_FACTOR_CHANGED = "tauri://scale-change",
    /** The system or window theme changed. See `Window.onThemeChanged`. */
    WINDOW_THEME_CHANGED = "tauri://theme-changed",
    /** A new window was created. */
    WINDOW_CREATED = "tauri://window-created",
    /**
     * The window's event loop was suspended.
     *
     * #### Platform-specific
     *
     * - **Android:** emitted when the activity is paused.
     * - **Other platforms:** never emitted.
     */
    WINDOW_SUSPENDED = "tauri://suspended",
    /**
     * The window's event loop was resumed after being suspended.
     *
     * #### Platform-specific
     *
     * - **Android:** emitted when the activity is resumed.
     * - **Other platforms:** never emitted.
     */
    WINDOW_RESUMED = "tauri://resumed",
    /** A new webview was created. */
    WEBVIEW_CREATED = "tauri://webview-created",
    /** The user dragged files onto a webview. See `Webview.onDragDropEvent`. */
    DRAG_ENTER = "tauri://drag-enter",
    /** The user is moving dragged files over a webview. See `Webview.onDragDropEvent`. */
    DRAG_OVER = "tauri://drag-over",
    /** The user dropped files onto a webview. See `Webview.onDragDropEvent`. */
    DRAG_DROP = "tauri://drag-drop",
    /** The drag operation left the webview or was cancelled. See `Webview.onDragDropEvent`. */
    DRAG_LEAVE = "tauri://drag-leave"
}
/**
 * Listen to an emitted event to any {@link EventTarget|target}.
 *
 * @example
 * ```typescript
 * import { listen } from '@tauri-apps/api/event';
 * const unlisten = await listen<string>('error', (event) => {
 *   console.log(`Got error, payload: ${event.payload}`);
 * });
 *
 * // call unlisten when your handler goes out of scope e.g. the component is unmounted
 * unlisten();
 * ```
 *
 * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
 * @param handler Event handler callback.
 * @param options Event listening options.
 * @returns A promise resolving to a function to unlisten to the event.
 *
 * @remarks Listeners bound to a window or webview are removed automatically when
 * that window or webview is destroyed, so you do not need to unlisten just to
 * avoid leaking across a window close. You should still call the returned
 * function when the listener's own scope ends — for example on page navigation
 * or when a component unmounts — otherwise the handler keeps running for the
 * lifetime of the webview.
 *
 * @since 1.0.0
 */
declare function listen<T>(event: EventName, handler: EventCallback<T>, options?: Options): Promise<UnlistenFn>;
/**
 * Listens once to an emitted event to any {@link EventTarget|target}.
 *
 * @example
 * ```typescript
 * import { once } from '@tauri-apps/api/event';
 * interface LoadedPayload {
 *   loggedIn: boolean,
 *   token: string
 * }
 * const unlisten = await once<LoadedPayload>('loaded', (event) => {
 *   console.log(`App is loaded, loggedIn: ${event.payload.loggedIn}, token: ${event.payload.token}`);
 * });
 *
 * // call unlisten when your handler goes out of scope e.g. the component is unmounted
 * unlisten();
 * ```
 *
 * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
 * @param handler Event handler callback.
 * @param options Event listening options.
 * @returns A promise resolving to a function to unlisten to the event.
 *
 * @remarks The listener removes itself after the first event, and listeners bound
 * to a window or webview are also removed automatically when that target is
 * destroyed. Still call the returned function when the listener's own scope ends
 * before the event arrives — for example on page navigation or component unmount.
 *
 * @since 1.0.0
 */
declare function once<T>(event: EventName, handler: EventCallback<T>, options?: Options): Promise<UnlistenFn>;
/**
 * Emits an event to all {@link EventTarget|targets}.
 *
 * @example
 * ```typescript
 * import { emit } from '@tauri-apps/api/event';
 * await emit('frontend-loaded', { loggedIn: true, token: 'authToken' });
 * ```
 *
 * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
 * @param payload Event payload.
 *
 * @since 1.0.0
 */
declare function emit<T>(event: string, payload?: T): Promise<void>;
/**
 * Emits an event to all {@link EventTarget|targets} matching the given target.
 *
 * @example
 * ```typescript
 * import { emitTo } from '@tauri-apps/api/event';
 * await emitTo('main', 'frontend-loaded', { loggedIn: true, token: 'authToken' });
 * ```
 *
 * @param target Label of the target Window/Webview/WebviewWindow or raw {@link EventTarget} object.
 * @param event Event name. Must include only alphanumeric characters, `-`, `/`, `:` and `_`.
 * @param payload Event payload.
 *
 * @since 2.0.0
 */
declare function emitTo<T>(target: EventTarget | string, event: string, payload?: T): Promise<void>;
export type { Event, EventTarget, EventCallback, UnlistenFn, EventName, Options };
export { listen, once, emit, emitTo, TauriEvent };
