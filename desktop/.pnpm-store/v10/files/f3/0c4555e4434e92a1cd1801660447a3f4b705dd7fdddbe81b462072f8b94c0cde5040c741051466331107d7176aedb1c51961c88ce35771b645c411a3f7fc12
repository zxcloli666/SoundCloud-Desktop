'use strict';

var tslib_es6 = require('./external/tslib/tslib.es6.cjs');

// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT
var _Channel_instances, _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Channel_deliver, _Resource_rid;
/**
 * Invoke your custom commands.
 *
 * This package is also accessible with `window.__TAURI__.core` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 * @module
 */
/**
 * A key to be used to implement a special function
 * on your types that define how your type should be serialized
 * when passing across the IPC.
 * @example
 * Given a type in Rust that looks like this
 * ```rs
 * #[derive(serde::Serialize, serde::Deserialize)
 * enum UserId {
 *   String(String),
 *   Number(u32),
 * }
 * ```
 * `UserId::String("id")` would be serialized into `{ String: "id" }`
 * and so we need to pass the same structure back to Rust
 * ```ts
 * import { SERIALIZE_TO_IPC_FN } from "@tauri-apps/api/core"
 *
 * class UserIdString {
 *   id
 *   constructor(id) {
 *     this.id = id
 *   }
 *
 *   [SERIALIZE_TO_IPC_FN]() {
 *     return { String: this.id }
 *   }
 * }
 *
 * class UserIdNumber {
 *   id
 *   constructor(id) {
 *     this.id = id
 *   }
 *
 *   [SERIALIZE_TO_IPC_FN]() {
 *     return { Number: this.id }
 *   }
 * }
 *
 * type UserId = UserIdString | UserIdNumber
 * ```
 *
 */
// if this value changes, make sure to update it in:
// 1. ipc.js
// 2. process-ipc-message-fn.js
const SERIALIZE_TO_IPC_FN = '__TAURI_TO_IPC_KEY__';
/**
 * Stores the callback in a known location, and returns an identifier that can be passed to the backend.
 * The backend uses the identifier to `eval()` the callback.
 *
 * @return An unique identifier associated with the callback function.
 *
 * @since 1.0.0
 */
function transformCallback(
// TODO: Make this not optional in v3
callback, once = false) {
    return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
/**
 * A message channel used to stream values from Rust to the frontend.
 *
 * A `Channel` is the JavaScript counterpart of [`tauri::ipc::Channel`](https://docs.rs/tauri/2/tauri/ipc/struct.Channel.html).
 * Pass an instance as a command argument and the Rust command can declare a
 * `tauri::ipc::Channel<T>` parameter with the same name; every value sent from
 * Rust is then delivered to {@linkcode Channel.onmessage}. Messages are delivered
 * in the order they were sent, even when they arrive out of order.
 *
 * The channel stays alive until the Rust `Channel` is dropped, so it can be used
 * for long-running work such as download progress or log streaming.
 *
 * Raw byte payloads are delivered to the frontend as an `ArrayBuffer` rather than
 * a JSON value, so declare the channel as `Channel<ArrayBuffer>` when the Rust
 * side sends `tauri::ipc::InvokeResponseBody::Raw` — for example through a
 * `Channel<tauri::ipc::Response>` whose values are built with
 * `tauri::ipc::Response::new(bytes)`.
 *
 * @example
 * ```typescript
 * import { Channel, invoke } from '@tauri-apps/api/core';
 *
 * const onEvent = new Channel<string>();
 * onEvent.onmessage = (message) => {
 *   console.log(`got download event ${message}`);
 * };
 *
 * await invoke('download', { url: 'https://tauri.app', onEvent });
 * ```
 *
 * The matching Rust command:
 * ```rust
 * #[tauri::command]
 * async fn download(url: String, on_event: tauri::ipc::Channel<String>) -> tauri::Result<()> {
 *   on_event.send("started".to_string())?;
 *   on_event.send("finished".to_string())?;
 *   Ok(())
 * }
 * ```
 *
 * @since 2.0.0
 */
class Channel {
    constructor(onmessage) {
        _Channel_instances.add(this);
        _Channel_onmessage.set(this, void 0);
        // the index is used as a mechanism to preserve message order
        _Channel_nextMessageIndex.set(this, 0);
        _Channel_pendingMessages.set(this, []);
        _Channel_messageEndIndex.set(this, void 0);
        tslib_es6.__classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => { }), "f");
        this.id = transformCallback((rawMessage) => {
            const index = rawMessage.index;
            if ('end' in rawMessage) {
                if (index == tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
                    this.cleanupCallback();
                }
                else {
                    tslib_es6.__classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
                }
                return;
            }
            const message = rawMessage.message;
            // Process the message if we're at the right order
            if (index == tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
                tslib_es6.__classPrivateFieldGet(this, _Channel_instances, "m", _Channel_deliver).call(this, message);
                tslib_es6.__classPrivateFieldSet(this, _Channel_nextMessageIndex, tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
                // process pending messages
                while (tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in tslib_es6.__classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
                    const message = tslib_es6.__classPrivateFieldGet(this, _Channel_pendingMessages, "f")[tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
                    tslib_es6.__classPrivateFieldGet(this, _Channel_instances, "m", _Channel_deliver).call(this, message);
                    // eslint-disable-next-line @typescript-eslint/no-array-delete
                    delete tslib_es6.__classPrivateFieldGet(this, _Channel_pendingMessages, "f")[tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
                    tslib_es6.__classPrivateFieldSet(this, _Channel_nextMessageIndex, tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
                }
                if (tslib_es6.__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === tslib_es6.__classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) {
                    this.cleanupCallback();
                }
            }
            // Queue the message if we're not
            else {
                // eslint-disable-next-line security/detect-object-injection
                tslib_es6.__classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
            }
        });
    }
    cleanupCallback() {
        window.__TAURI_INTERNALS__.unregisterCallback(this.id);
    }
    /**
     * The handler called for every message sent by the Rust side of this channel.
     *
     * Assigning a new handler replaces the previous one; messages that arrived
     * before a handler was set are not replayed, so set it (or pass it to the
     * constructor) before sending the channel to the backend.
     */
    set onmessage(handler) {
        tslib_es6.__classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
    }
    get onmessage() {
        return tslib_es6.__classPrivateFieldGet(this, _Channel_onmessage, "f");
    }
    [(_Channel_onmessage = new WeakMap(), _Channel_nextMessageIndex = new WeakMap(), _Channel_pendingMessages = new WeakMap(), _Channel_messageEndIndex = new WeakMap(), _Channel_instances = new WeakSet(), _Channel_deliver = function _Channel_deliver(message) {
        try {
            tslib_es6.__classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
        }
        catch (error) {
            // A throwing handler must not stall the channel: the message index would
            // never advance and every later message would stay queued. Rethrow
            // asynchronously so the error is still reported as uncaught.
            queueMicrotask(() => {
                throw error;
            });
        }
    }, SERIALIZE_TO_IPC_FN)]() {
        return `__CHANNEL__:${this.id}`;
    }
    toJSON() {
        // eslint-disable-next-line security/detect-object-injection
        return this[SERIALIZE_TO_IPC_FN]();
    }
}
/**
 * A handle to a listener registered with {@linkcode addPluginListener}.
 *
 * Keep the returned instance around and call {@linkcode PluginListener.unregister}
 * when the listener goes out of scope, otherwise the plugin keeps sending events
 * to a handler nothing uses anymore.
 *
 * @since 2.0.0
 */
class PluginListener {
    constructor(plugin, event, channelId) {
        this.plugin = plugin;
        this.event = event;
        this.channelId = channelId;
    }
    /** Removes this listener from the plugin, so its handler stops being called. */
    async unregister() {
        return invoke(`plugin:${this.plugin}|remove_listener`, {
            event: this.event,
            channelId: this.channelId
        });
    }
}
/**
 * Adds a listener to a plugin event.
 *
 * This is meant to be used by plugin authors to wrap the `register_listener`
 * command their mobile plugin implements; application code normally calls the
 * wrapper the plugin exposes instead of this function.
 *
 * @example
 * ```typescript
 * import { addPluginListener } from '@tauri-apps/api/core';
 *
 * interface ScanEvent {
 *   value: string
 * }
 *
 * const listener = await addPluginListener<ScanEvent>(
 *   'barcode-scanner',
 *   'scan',
 *   (payload) => console.log('scanned', payload.value)
 * );
 *
 * // stop listening when the scanner screen is closed
 * await listener.unregister();
 * ```
 *
 * @param plugin The plugin name, as used in the `plugin:<name>|<command>` IPC command format.
 * @param event The plugin event name.
 * @param cb The callback executed for each event payload.
 * @returns The listener object to stop listening to the events.
 *
 * @since 2.0.0
 */
async function addPluginListener(plugin, event, cb) {
    const handler = new Channel(cb);
    try {
        await invoke(`plugin:${plugin}|register_listener`, {
            event,
            handler
        });
        return new PluginListener(plugin, event, handler.id);
    }
    catch {
        // TODO(v3): remove this fallback
        // note: we must try with camelCase here for backwards compatibility
        await invoke(`plugin:${plugin}|registerListener`, { event, handler });
        return new PluginListener(plugin, event, handler.id);
    }
}
/**
 * Get permission state for a plugin.
 *
 * This should be used by plugin authors to wrap their actual implementation,
 * it calls the `plugin:<name>|check_permissions` command implemented by the
 * mobile plugin and returns its permission status object without prompting
 * the user.
 *
 * @example
 * ```typescript
 * import { checkPermissions, type PermissionState } from '@tauri-apps/api/core';
 *
 * interface Permissions {
 *   camera: PermissionState
 * }
 *
 * const status = await checkPermissions<Permissions>('barcode-scanner');
 * if (status.camera === 'prompt') {
 *   // ask the user, see requestPermissions
 * }
 * ```
 *
 * @param plugin The plugin name, as used in the `plugin:<name>|<command>` IPC command format.
 *
 * @since 2.0.0
 */
async function checkPermissions(plugin) {
    return invoke(`plugin:${plugin}|check_permissions`);
}
/**
 * Request permissions.
 *
 * This should be used by plugin authors to wrap their actual implementation,
 * it calls the `plugin:<name>|request_permissions` command implemented by the
 * mobile plugin, which shows the native permission prompt when needed, and
 * returns the resulting permission status object.
 *
 * @example
 * ```typescript
 * import { requestPermissions, type PermissionState } from '@tauri-apps/api/core';
 *
 * interface Permissions {
 *   camera: PermissionState
 * }
 *
 * const status = await requestPermissions<Permissions>('barcode-scanner');
 * if (status.camera !== 'granted') {
 *   throw new Error('camera permission denied');
 * }
 * ```
 *
 * @param plugin The plugin name, as used in the `plugin:<name>|<command>` IPC command format.
 *
 * @since 2.0.0
 */
async function requestPermissions(plugin) {
    return invoke(`plugin:${plugin}|request_permissions`);
}
/**
 * Sends a message to the backend.
 * @example
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 * await invoke('login', { user: 'tauri', password: 'poiwe3h4r5ip3yrhtew9ty' });
 * ```
 *
 * @param cmd The command name.
 * @param args The optional arguments to pass to the command.
 * @param options The request options.
 * @return A promise resolving or rejecting to the backend response.
 *
 * @since 1.0.0
 */
async function invoke(cmd, args = {}, options) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
/**
 * Convert a device file path to a URL that can be loaded by the webview.
 *
 * The asset protocol must be enabled and the files you want to expose must be
 * included in its scope. The protocol origins must also be allowed by the
 * relevant [`app.security.csp`](https://v2.tauri.app/reference/config/#csp-1)
 * directive. For example, this configuration allows images from the user's
 * downloads directory:
 *
 * ```json
 * {
 *   "app": {
 *     "security": {
 *       "assetProtocol": {
 *         "enable": true,
 *         "scope": ["$DOWNLOAD/**"]
 *       },
 *       "csp": "default-src 'self'; img-src 'self' asset: http://asset.localhost"
 *     }
 *   }
 * }
 * ```
 *
 * See [`assetProtocol`](https://v2.tauri.app/reference/config/#assetprotocolconfig)
 * for the available scope variables and platform-specific protocol details.
 *
 * @param  filePath The file path.
 * @param  protocol The protocol to use. Defaults to `asset`. You only need to set this when using a custom protocol.
 * @example
 * ```typescript
 * import { downloadDir, join } from '@tauri-apps/api/path';
 * import { convertFileSrc } from '@tauri-apps/api/core';
 * const downloads = await downloadDir();
 * const filePath = await join(downloads, 'photo.png');
 * const assetUrl = convertFileSrc(filePath);
 *
 * const image = document.getElementById('my-image') as HTMLImageElement;
 * image.src = assetUrl;
 * ```
 *
 * @return the URL that can be used as source on the webview.
 *
 * @since 1.0.0
 */
function convertFileSrc(filePath, protocol = 'asset') {
    return window.__TAURI_INTERNALS__.convertFileSrc(filePath, protocol);
}
/**
 * A rust-backed resource stored through `tauri::Manager::resources_table` API.
 *
 * The resource lives in the main process and does not exist
 * in the Javascript world, and thus will not be cleaned up automatically
 * except on application exit. If you want to clean it up early, call {@linkcode Resource.close} or use [Explicit Resource Management].
 *
 * Several API types are resources and inherit this behavior, among them `Menu`,
 * `TrayIcon`, `Image`, `Webview` and the menu item classes.
 *
 * To support older browsers with [Explicit Resource Management], use a supported compiler (e.g. tsc) or bundler (e.g. rollup).
 *
 * @example
 * ```typescript
 * import { Resource, invoke } from '@tauri-apps/api/core';
 *
 * export class DatabaseHandle extends Resource {
 *   static async open(path: string): Promise<DatabaseHandle> {
 *     const rid: number = await invoke('open_db', { path });
 *     return new DatabaseHandle(rid);
 *   }
 *
 *   async execute(sql: string): Promise<void> {
 *     await invoke('execute_sql', { rid: this.rid, sql });
 *   }
 * }
 * ```
 *
 * Only asynchronous disposal is implemented (`Symbol.asyncDispose`), because closing
 * a resource is an IPC call. Use `await using`; the synchronous `using` form does
 * **not** work with resources.
 *
 * @example
 * ```
 * await using db = await DatabaseHandle.open('test.db');
 * await db.execute('SELECT *');
 * // `db` is closed here, by awaiting `db[Symbol.asyncDispose]()`
 * ```
 *
 * To support older browsers, add the following to the globals (e.g. adding to the HTML file):
 *
 * ```javascript
 * Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");
 * ```
 *
 * And for the compiler, for example `tsc`, `rollup`, `vite`, add the following to `tsconfig.json`:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "target": "es2022",
 *     "lib": ["es2022", "esnext.disposable", "dom"]
 *   }
 * }
 * ```
 *
 * [Explicit Resource Management]: https://github.com/tc39/proposal-explicit-resource-management
 */
class Resource {
    get rid() {
        return tslib_es6.__classPrivateFieldGet(this, _Resource_rid, "f");
    }
    constructor(rid) {
        _Resource_rid.set(this, void 0);
        tslib_es6.__classPrivateFieldSet(this, _Resource_rid, rid, "f");
    }
    /**
     * Destroys and cleans up this resource from memory.
     * **You should not call any method on this object anymore and should drop any reference to it.**
     *
     * @remarks Uses the `core:resources:allow-close` permission, which is part of
     * the `core:resources:default` permission set enabled by default.
     */
    async close() {
        return invoke('plugin:resources|close', {
            rid: this.rid
        });
    }
    async [(_Resource_rid = new WeakMap(), Symbol.asyncDispose)]() {
        await this.close();
    }
}
/**
 * Checks whether the code is running inside a Tauri webview.
 *
 * Useful for frontends that are also served on the web, to guard calls to APIs
 * that only exist inside the application.
 *
 * @example
 * ```typescript
 * import { isTauri } from '@tauri-apps/api/core';
 * import { getVersion } from '@tauri-apps/api/app';
 *
 * const version = isTauri() ? await getVersion() : 'web';
 * ```
 *
 * @returns `true` when running inside a Tauri app, `false` otherwise (e.g. in a
 * browser or in unit tests).
 *
 * @since 2.0.0
 */
function isTauri() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return !!(globalThis || window).isTauri;
}

exports.Channel = Channel;
exports.PluginListener = PluginListener;
exports.Resource = Resource;
exports.SERIALIZE_TO_IPC_FN = SERIALIZE_TO_IPC_FN;
exports.addPluginListener = addPluginListener;
exports.checkPermissions = checkPermissions;
exports.convertFileSrc = convertFileSrc;
exports.invoke = invoke;
exports.isTauri = isTauri;
exports.requestPermissions = requestPermissions;
exports.transformCallback = transformCallback;
