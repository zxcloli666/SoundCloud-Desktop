export { BaseDirectory } from '@tauri-apps/api/path';
import { Resource, invoke, Channel } from '@tauri-apps/api/core';

// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT
/**
 * Access the file system.
 *
 * ## iOS security-scoped resources
 *
 * On iOS, the `fs` plugin automatically manages access to security-scoped resources when a file URL is accessed.
 * This is required for files outside the app's sandbox (e.g., from file picker).
 *
 * @example
 * ```typescript
 * import { open } from '@tauri-apps/plugin-fs';
 *
 * const file = await open('file:///path/to/file.txt');
 * await file.close();
 * ```
 *
 * ## Security
 *
 * This module prevents path traversal, not allowing parent directory accessors to be used
 * (i.e. "/usr/path/to/../file" or "../path/to/file" paths are not allowed).
 * Paths accessed with this API must be either relative to one of the {@link BaseDirectory | base directories}
 * or created with the {@link https://v2.tauri.app/reference/javascript/api/namespacepath/ | path API}.
 *
 * The API has a scope configuration that forces you to restrict the paths that can be accessed using glob patterns.
 *
 * The scope configuration is an array of glob patterns describing file/directory paths that are allowed.
 * For instance, this scope configuration allows **all** enabled `fs` APIs to (only) access files in the
 * *databases* directory of the {@link https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir | `$APPDATA` directory}:
 * ```json
 * {
 *   "permissions": [
 *     {
 *       "identifier": "fs:scope",
 *       "allow": [{ "path": "$APPDATA/databases/*" }]
 *     }
 *   ]
 * }
 * ```
 *
 * Scopes can also be applied to specific `fs` APIs by using the API's identifier instead of `fs:scope`:
 * ```json
 * {
 *   "permissions": [
 *     {
 *       "identifier": "fs:allow-exists",
 *       "allow": [{ "path": "$APPDATA/databases/*" }]
 *     }
 *   ]
 * }
 * ```
 *
 * Notice the use of the `$APPDATA` variable. The value is injected at runtime, resolving to the {@link https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir | app data directory}.
 *
 * The available variables are:
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#appconfigdir | $APPCONFIG},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir | $APPDATA},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#applocaldatadir | $APPLOCALDATA},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#appcachedir | $APPCACHE},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#applogdir | $APPLOG},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#audiodir | $AUDIO},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#cachedir | $CACHE},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#configdir | $CONFIG},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#datadir | $DATA},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#localdatadir | $LOCALDATA},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#desktopdir | $DESKTOP},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#documentdir | $DOCUMENT},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#downloaddir | $DOWNLOAD},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#executabledir | $EXE},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#fontdir | $FONT},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#homedir | $HOME},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#picturedir | $PICTURE},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#publicdir | $PUBLIC},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#runtimedir | $RUNTIME},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#templatedir | $TEMPLATE},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#videodir | $VIDEO},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#resourcedir | $RESOURCE},
 * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#tempdir | $TEMP}.
 *
 * Trying to execute any API with a URL not configured on the scope results in a promise rejection due to denied access.
 *
 * @module
 */
/**
 * Defines how the offset given to {@linkcode FileHandle.seek} is interpreted.
 */
var SeekMode;
(function (SeekMode) {
    /** The offset is relative to the start of the file. */
    SeekMode[SeekMode["Start"] = 0] = "Start";
    /** The offset is relative to the current cursor position. */
    SeekMode[SeekMode["Current"] = 1] = "Current";
    /** The offset is relative to the end of the file. */
    SeekMode[SeekMode["End"] = 2] = "End";
})(SeekMode || (SeekMode = {}));
function parseFileInfo(r) {
    return {
        isFile: r.isFile,
        isDirectory: r.isDirectory,
        isSymlink: r.isSymlink,
        size: r.size,
        mtime: r.mtime !== null ? new Date(r.mtime) : null,
        atime: r.atime !== null ? new Date(r.atime) : null,
        birthtime: r.birthtime !== null ? new Date(r.birthtime) : null,
        readonly: r.readonly,
        fileAttributes: r.fileAttributes,
        dev: r.dev,
        ino: r.ino,
        mode: r.mode,
        nlink: r.nlink,
        uid: r.uid,
        gid: r.gid,
        rdev: r.rdev,
        blksize: r.blksize,
        blocks: r.blocks
    };
}
// https://gist.github.com/zapthedingbat/38ebfbedd98396624e5b5f2ff462611d
/** Converts a big-endian eight byte array to number  */
function fromBytes(buffer) {
    const bytes = new Uint8ClampedArray(buffer);
    const size = bytes.byteLength;
    let x = 0;
    for (let i = 0; i < size; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const byte = bytes[i];
        x *= 0x100;
        x += byte;
    }
    return x;
}
/**
 *  The Tauri abstraction for reading and writing files.
 *
 * @since 2.0.0
 */
class FileHandle extends Resource {
    /**
     * Reads up to `p.byteLength` bytes into `p`. It resolves to the number of
     * bytes read (`0` < `n` <= `p.byteLength`) and rejects if any error
     * encountered. Even if `read()` resolves to `n` < `p.byteLength`, it may
     * use all of `p` as scratch space during the call. If some data is
     * available but not `p.byteLength` bytes, `read()` conventionally resolves
     * to what is available instead of waiting for more.
     *
     * When `read()` encounters end-of-file condition, it resolves to EOF
     * (`null`).
     *
     * When `read()` encounters an error, it rejects with an error.
     *
     * Callers should always process the `n` > `0` bytes returned before
     * considering the EOF (`null`). Doing so correctly handles I/O errors that
     * happen after reading some bytes and also both of the allowed EOF
     * behaviors.
     *
     * @example
     * ```typescript
     * import { open, BaseDirectory } from "@tauri-apps/plugin-fs"
     * // if "$APPCONFIG/foo/bar.txt" contains the text "hello world":
     * const file = await open("foo/bar.txt", { baseDir: BaseDirectory.AppConfig });
     * const buf = new Uint8Array(100);
     * const numberOfBytesRead = await file.read(buf); // 11 bytes
     * const text = new TextDecoder().decode(buf);  // "hello world"
     * await file.close();
     * ```
     *
     * @param buffer The buffer the file contents are read into.
     * @returns A promise resolving to the number of bytes read, or `null` when the end of the file was reached.
     * @since 2.0.0
     */
    async read(buffer) {
        if (buffer.byteLength === 0) {
            return 0;
        }
        const data = await invoke('plugin:fs|read', {
            rid: this.rid,
            len: buffer.byteLength
        });
        // Rust side will never return an empty array for this command and
        // ensure there is at least 8 elements there.
        //
        // This is an optimization to include the number of read bytes (as bigendian bytes)
        // at the end of returned array to avoid serialization overhead of separate values.
        const nread = fromBytes(data.slice(-8));
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        buffer.set(bytes.slice(0, bytes.length - 8));
        return nread === 0 ? null : nread;
    }
    /**
     * Seek sets the offset for the next `read()` or `write()` to offset,
     * interpreted according to `whence`: `Start` means relative to the
     * start of the file, `Current` means relative to the current offset,
     * and `End` means relative to the end. Seek resolves to the new offset
     * relative to the start of the file.
     *
     * Seeking to an offset before the start of the file is an error. Seeking to
     * any positive offset is legal, but the behavior of subsequent I/O
     * operations on the underlying object is implementation-dependent.
     * It returns the number of cursor position.
     *
     * @example
     * ```typescript
     * import { open, SeekMode, BaseDirectory } from '@tauri-apps/plugin-fs';
     *
     * // Given hello.txt pointing to file with "Hello world", which is 11 bytes long:
     * const file = await open('hello.txt', { read: true, write: true, truncate: true, create: true, baseDir: BaseDirectory.AppLocalData });
     * await file.write(new TextEncoder().encode("Hello world"));
     *
     * // Seek 6 bytes from the start of the file
     * console.log(await file.seek(6, SeekMode.Start)); // "6"
     * // Seek 2 more bytes from the current position
     * console.log(await file.seek(2, SeekMode.Current)); // "8"
     * // Seek backwards 2 bytes from the end of the file
     * console.log(await file.seek(-2, SeekMode.End)); // "9" (e.g. 11-2)
     *
     * await file.close();
     * ```
     *
     * @param offset The number of bytes the cursor is moved by.
     * @param whence Defines the position the `offset` is relative to.
     * @returns A promise resolving to the new cursor position, relative to the start of the file.
     * @since 2.0.0
     */
    async seek(offset, whence) {
        return await invoke('plugin:fs|seek', {
            rid: this.rid,
            offset,
            whence
        });
    }
    /**
     * Returns a {@linkcode FileInfo } for this file.
     *
     * @example
     * ```typescript
     * import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
     * const file = await open("file.txt", { read: true, baseDir: BaseDirectory.AppLocalData });
     * const fileInfo = await file.stat();
     * console.log(fileInfo.isFile); // true
     * await file.close();
     * ```
     *
     * @returns A promise resolving to the metadata of this file.
     * @since 2.0.0
     */
    async stat() {
        const res = await invoke('plugin:fs|fstat', {
            rid: this.rid
        });
        return parseFileInfo(res);
    }
    /**
     * Truncates or extends this file, to reach the specified `len`.
     * If `len` is not specified then the entire file contents are truncated.
     *
     * @example
     * ```typescript
     * import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
     *
     * // truncate the entire file
     * const file = await open("my_file.txt", { read: true, write: true, create: true, baseDir: BaseDirectory.AppLocalData });
     * await file.truncate();
     *
     * // truncate part of the file
     * const file = await open("my_file.txt", { read: true, write: true, create: true, baseDir: BaseDirectory.AppLocalData });
     * await file.write(new TextEncoder().encode("Hello World"));
     * await file.truncate(7);
     * const data = new Uint8Array(32);
     * await file.read(data);
     * console.log(new TextDecoder().decode(data)); // Hello W
     * await file.close();
     * ```
     *
     * @param len The length the file is truncated or extended to, in bytes. When not provided the entire file contents are truncated.
     * @since 2.0.0
     */
    async truncate(len) {
        await invoke('plugin:fs|ftruncate', {
            rid: this.rid,
            len
        });
    }
    /**
     * Writes `data.byteLength` bytes from `data` to the underlying data stream. It
     * resolves to the number of bytes written from `data` (`0` <= `n` <=
     * `data.byteLength`) or reject with the error encountered that caused the
     * write to stop early. `write()` must reject with a non-null error if
     * would resolve to `n` < `data.byteLength`. `write()` must not modify the
     * slice data, even temporarily.
     *
     * @example
     * ```typescript
     * import { open, write, BaseDirectory } from '@tauri-apps/plugin-fs';
     * const encoder = new TextEncoder();
     * const data = encoder.encode("Hello world");
     * const file = await open("bar.txt", { write: true, baseDir: BaseDirectory.AppLocalData });
     * const bytesWritten = await file.write(data); // 11
     * await file.close();
     * ```
     *
     * @param data The bytes written to the file.
     * @returns A promise resolving to the number of bytes written.
     * @since 2.0.0
     */
    async write(data) {
        return await invoke('plugin:fs|write', {
            rid: this.rid,
            data
        });
    }
}
/**
 * Creates a file if none exists or truncates an existing file and resolves to
 *  an instance of {@linkcode FileHandle }.
 *
 * @example
 * ```typescript
 * import { create, BaseDirectory } from "@tauri-apps/plugin-fs"
 * const file = await create("foo/bar.txt", { baseDir: BaseDirectory.AppConfig });
 * await file.write(new TextEncoder().encode("Hello world"));
 * await file.close();
 * ```
 *
 * @param path The path of the file, relative to `options.baseDir` when it is provided.
 * @param options Options defining the base directory of `path`.
 * @returns A promise resolving to the handle of the created file.
 * @since 2.0.0
 */
async function create(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    const rid = await invoke('plugin:fs|create', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
    return new FileHandle(rid);
}
/**
 * Open a file and resolve to an instance of {@linkcode FileHandle}. The
 * file does not need to previously exist if using the `create` or `createNew`
 * open options. It is the callers responsibility to close the file when finished
 * with it.
 *
 * @example
 * ```typescript
 * import { open, BaseDirectory } from "@tauri-apps/plugin-fs"
 * const file = await open("foo/bar.txt", { read: true, write: true, baseDir: BaseDirectory.AppLocalData });
 * // Do work with file
 * await file.close();
 * ```
 *
 * @param path The path of the file, relative to `options.baseDir` when it is provided.
 * @param options Options defining the base directory of `path` and how the file is opened.
 * @returns A promise resolving to the handle of the open file.
 * @since 2.0.0
 */
async function open(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    const rid = await invoke('plugin:fs|open', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
    return new FileHandle(rid);
}
/**
 * Copies the contents and permissions of one file to another specified path, by default creating a new file if needed, else overwriting.
 * @example
 * ```typescript
 * import { copyFile, BaseDirectory } from '@tauri-apps/plugin-fs';
 * await copyFile('app.conf', 'app.conf.bk', { fromPathBaseDir: BaseDirectory.AppConfig, toPathBaseDir: BaseDirectory.AppConfig });
 * ```
 *
 * @param fromPath The path of the file to copy from.
 * @param toPath The path of the file to copy to.
 * @param options Options defining the base directory of each path.
 * @since 2.0.0
 */
async function copyFile(fromPath, toPath, options) {
    if ((fromPath instanceof URL && fromPath.protocol !== 'file:')
        || (toPath instanceof URL && toPath.protocol !== 'file:')) {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|copy_file', {
        fromPath: fromPath instanceof URL ? fromPath.toString() : fromPath,
        toPath: toPath instanceof URL ? toPath.toString() : toPath,
        options
    });
}
/**
 * Creates a new directory with the specified path.
 * @example
 * ```typescript
 * import { mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
 * await mkdir('users', { baseDir: BaseDirectory.AppLocalData });
 * ```
 *
 * @param path The path of the directory to create.
 * @param options Options defining the base directory of `path`, the directory permissions and whether intermediate directories are created.
 * @since 2.0.0
 */
async function mkdir(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|mkdir', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
}
/**
 * Reads the directory given by path and returns an array of `DirEntry`.
 * @example
 * ```typescript
 * import { readDir, BaseDirectory } from '@tauri-apps/plugin-fs';
 * import { join } from '@tauri-apps/api/path';
 * const dir = 'users';
 * const entries = await readDir(dir, { baseDir: BaseDirectory.AppLocalData });
 * await processEntriesRecursively(dir, entries);
 * async function processEntriesRecursively(parent, entries) {
 *   for (const entry of entries) {
 *     console.log(`Entry: ${entry.name}`);
 *     if (entry.isDirectory) {
 *       const entryPath = await join(parent, entry.name);
 *       await processEntriesRecursively(entryPath, await readDir(entryPath, { baseDir: BaseDirectory.AppLocalData }));
 *     }
 *   }
 * }
 * ```
 *
 * @param path The path of the directory to read.
 * @param options Options defining the base directory of `path`.
 * @returns A promise resolving to the list of entries in the directory.
 * @since 2.0.0
 */
async function readDir(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    return await invoke('plugin:fs|read_dir', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
}
/**
 * Reads and resolves to the entire contents of a file as an array of bytes.
 * TextDecoder can be used to transform the bytes to string if required.
 * @example
 * ```typescript
 * import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
 * const contents = await readFile('avatar.png', { baseDir: BaseDirectory.Resource });
 * ```
 *
 * @param path The path of the file to read.
 * @param options Options defining the base directory of `path`.
 * @returns A promise resolving to the contents of the file as bytes.
 * @since 2.0.0
 */
async function readFile(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    const arr = await invoke('plugin:fs|read_file', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
    return arr instanceof ArrayBuffer ? new Uint8Array(arr) : Uint8Array.from(arr);
}
/**
 * Reads and returns the entire contents of a file as a string using the specified encoding (default: UTF-8).
 * @example
 * ```typescript
 * import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
 * const contents = await readTextFile('app.conf', { baseDir: BaseDirectory.AppConfig });
 * ```
 *
 * @param path The path of the file to read.
 * @param options Options defining the base directory of `path` and the text encoding.
 * @returns A promise resolving to the contents of the file as a string.
 * @since 2.0.0
 */
async function readTextFile(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    const arr = await invoke('plugin:fs|read_text_file', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
    const bytes = arr instanceof ArrayBuffer ? arr : Uint8Array.from(arr);
    return new TextDecoder(options?.encoding ?? 'utf-8').decode(bytes);
}
/**
 * Returns an async {@linkcode AsyncIterableIterator} over the lines of a file, decoded using the specified encoding (default: UTF-8).
 * @example
 * ```typescript
 * import { readTextFileLines, BaseDirectory } from '@tauri-apps/plugin-fs';
 * const lines = await readTextFileLines('app.conf', { baseDir: BaseDirectory.AppConfig });
 * for await (const line of lines) {
 *   console.log(line);
 * }
 * ```
 * You could also call {@linkcode AsyncIterableIterator.next} to advance the
 * iterator so you can lazily read the next line whenever you want.
 *
 * @param path The path of the file to read.
 * @param options Options defining the base directory of `path` and the text encoding.
 * @returns A promise resolving to an iterator over the lines of the file.
 * @since 2.0.0
 */
async function readTextFileLines(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    const pathStr = path instanceof URL ? path.toString() : path;
    return await Promise.resolve({
        path: pathStr,
        rid: null,
        async next() {
            const decoder = new TextDecoder(options?.encoding ?? 'utf-8');
            if (this.rid === null) {
                // Use the normalized encoding label for options.
                const encoding = decoder.encoding;
                this.rid = await invoke('plugin:fs|read_text_file_lines', {
                    path: pathStr,
                    options: options != null ? { ...options, encoding } : undefined
                });
            }
            let arr;
            try {
                arr = await invoke('plugin:fs|read_text_file_lines_next', { rid: this.rid });
            }
            catch (error) {
                // the resource is closed on errors, the next iteration starts over
                this.rid = null;
                throw error;
            }
            const bytes = arr instanceof ArrayBuffer ? new Uint8Array(arr) : Uint8Array.from(arr);
            // Rust side will never return an empty array for this command and
            // ensure there is at least one elements there.
            //
            // This is an optimization to include whether we finished iteration or not (1 or 0)
            // at the end of returned array to avoid serialization overhead of separate values.
            const done = bytes[bytes.byteLength - 1] === 1;
            if (done) {
                // a full iteration is over, reset rid for next iteration
                this.rid = null;
                return { value: null, done };
            }
            const line = decoder.decode(bytes.slice(0, bytes.byteLength - 1));
            return {
                value: line,
                done
            };
        },
        // called when a `for await` loop exits early (`break`, `return` or `throw`)
        async return() {
            if (this.rid !== null) {
                const rid = this.rid;
                this.rid = null;
                // close the file, otherwise it stays open until the webview is destroyed
                await new Resource(rid).close();
            }
            return { value: null, done: true };
        },
        [Symbol.asyncIterator]() {
            return this;
        }
    });
}
/**
 * Removes the named file or directory.
 * If the directory is not empty and the `recursive` option isn't set to true, the promise will be rejected.
 * @example
 * ```typescript
 * import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';
 * await remove('users/file.txt', { baseDir: BaseDirectory.AppLocalData });
 * await remove('users', { baseDir: BaseDirectory.AppLocalData });
 * ```
 *
 * @param path The path of the file or directory to remove.
 * @param options Options defining the base directory of `path` and whether directories are removed recursively.
 * @since 2.0.0
 */
async function remove(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|remove', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
}
/**
 * Renames (moves) oldpath to newpath. Paths may be files or directories.
 * If newpath already exists and is not a directory, rename() replaces it.
 * OS-specific restrictions may apply when oldpath and newpath are in different directories.
 *
 * On Unix, this operation does not follow symlinks at either path.
 *
 * @example
 * ```typescript
 * import { rename, BaseDirectory } from '@tauri-apps/plugin-fs';
 * await rename('avatar.png', 'deleted.png', { oldPathBaseDir: BaseDirectory.App, newPathBaseDir: BaseDirectory.AppLocalData });
 * ```
 *
 * @param oldPath The path of the file or directory to rename.
 * @param newPath The path the file or directory is renamed to.
 * @param options Options defining the base directory of each path.
 * @since 2.0.0
 */
async function rename(oldPath, newPath, options) {
    if ((oldPath instanceof URL && oldPath.protocol !== 'file:')
        || (newPath instanceof URL && newPath.protocol !== 'file:')) {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|rename', {
        oldPath: oldPath instanceof URL ? oldPath.toString() : oldPath,
        newPath: newPath instanceof URL ? newPath.toString() : newPath,
        options
    });
}
/**
 * Resolves to a {@linkcode FileInfo} for the specified `path`. Will always
 * follow symlinks but will reject if the symlink points to a path outside of the scope.
 *
 * @example
 * ```typescript
 * import { stat, BaseDirectory } from '@tauri-apps/plugin-fs';
 * const fileInfo = await stat("hello.txt", { baseDir: BaseDirectory.AppLocalData });
 * console.log(fileInfo.isFile); // true
 * ```
 *
 * @param path The path of the file or directory to inspect.
 * @param options Options defining the base directory of `path`.
 * @returns A promise resolving to the metadata of the file or directory.
 * @since 2.0.0
 */
async function stat(path, options) {
    const res = await invoke('plugin:fs|stat', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
    return parseFileInfo(res);
}
/**
 * Resolves to a {@linkcode FileInfo} for the specified `path`. If `path` is a
 * symlink, information for the symlink will be returned instead of what it
 * points to.
 *
 * @example
 * ```typescript
 * import { lstat, BaseDirectory } from '@tauri-apps/plugin-fs';
 * const fileInfo = await lstat("hello.txt", { baseDir: BaseDirectory.AppLocalData });
 * console.log(fileInfo.isFile); // true
 * ```
 *
 * @param path The path of the file, directory or symlink to inspect.
 * @param options Options defining the base directory of `path`.
 * @returns A promise resolving to the metadata of the path itself.
 * @since 2.0.0
 */
async function lstat(path, options) {
    const res = await invoke('plugin:fs|lstat', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
    return parseFileInfo(res);
}
/**
 * Truncates or extends the specified file, to reach the specified `len`.
 * If `len` is `0` or not specified, then the entire file contents are truncated.
 *
 * @example
 * ```typescript
 * import { truncate, readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
 * // truncate the entire file
 * await truncate("my_file.txt", 0, { baseDir: BaseDirectory.AppLocalData });
 *
 * // truncate part of the file
 * const filePath = "file.txt";
 * await writeTextFile(filePath, "Hello World", { baseDir: BaseDirectory.AppLocalData });
 * await truncate(filePath, 7, { baseDir: BaseDirectory.AppLocalData });
 * const data = await readTextFile(filePath, { baseDir: BaseDirectory.AppLocalData });
 * console.log(data);  // "Hello W"
 * ```
 *
 * @param path The path of the file to truncate or extend.
 * @param len The length the file is resized to, in bytes. Defaults to `0`.
 * @param options Options defining the base directory of `path`.
 * @since 2.0.0
 */
async function truncate(path, len, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|truncate', {
        path: path instanceof URL ? path.toString() : path,
        len,
        options
    });
}
/**
 * Write `data` to the given `path`, by default creating a new file if needed, else overwriting.
 * @example
 * ```typescript
 * import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
 *
 * let encoder = new TextEncoder();
 * let data = encoder.encode("Hello World");
 * await writeFile('file.txt', data, { baseDir: BaseDirectory.AppLocalData });
 * ```
 *
 * @param path The path of the file to write to.
 * @param data The bytes written to the file, either as a buffer or as a stream of chunks.
 * @param options Options defining the base directory of `path` and how the file is opened.
 * @since 2.0.0
 */
async function writeFile(path, data, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    if (data instanceof ReadableStream) {
        const file = await open(path, {
            read: false,
            create: true,
            write: true,
            ...options,
            // overwrite the previous contents, like when writing a buffer
            truncate: !options?.append
        });
        const reader = data.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                await file.write(value);
            }
        }
        finally {
            reader.releaseLock();
            await file.close();
        }
    }
    else {
        await invoke('plugin:fs|write_file', data, {
            headers: {
                path: encodeURIComponent(path instanceof URL ? path.toString() : path),
                options: JSON.stringify(options)
            }
        });
    }
}
/**
 * Writes UTF-8 string `data` to the given `path`, by default creating a new file if needed, else overwriting.
 *
 * @example
 * ```typescript
 * import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
 *
 * await writeTextFile('file.txt', "Hello world", { baseDir: BaseDirectory.AppLocalData });
 * ```
 *
 * @param path The path of the file to write to.
 * @param data The UTF-8 string written to the file.
 * @param options Options defining the base directory of `path` and how the file is opened.
 * @since 2.0.0
 */
async function writeTextFile(path, data, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    const encoder = new TextEncoder();
    await invoke('plugin:fs|write_text_file', encoder.encode(data), {
        headers: {
            path: encodeURIComponent(path instanceof URL ? path.toString() : path),
            options: JSON.stringify(options)
        }
    });
}
/**
 * Check if a path exists.
 * @example
 * ```typescript
 * import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';
 * // Check if the `$APPDATA/avatar.png` file exists
 * await exists('avatar.png', { baseDir: BaseDirectory.AppData });
 * ```
 *
 * @param path The path to check.
 * @param options Options defining the base directory of `path`.
 * @returns A promise resolving to `true` when the path exists, `false` otherwise.
 * @since 2.0.0
 */
async function exists(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    return await invoke('plugin:fs|exists', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
}
class Watcher extends Resource {
}
async function watchInternal(paths, cb, options) {
    const watchPaths = Array.isArray(paths) ? paths : [paths];
    for (const path of watchPaths) {
        if (path instanceof URL && path.protocol !== 'file:') {
            throw new TypeError('Must be a file URL.');
        }
    }
    const onEvent = new Channel();
    onEvent.onmessage = cb;
    const rid = await invoke('plugin:fs|watch', {
        paths: watchPaths.map((p) => (p instanceof URL ? p.toString() : p)),
        options,
        onEvent
    });
    const watcher = new Watcher(rid);
    return () => {
        void watcher.close();
    };
}
// TODO: Return `Watcher` instead in v3
/**
 * Watch changes (after a delay) on files or directories.
 *
 * Events that happen within the `delayMs` window are grouped and delivered in a single callback call.
 * Requires the `watch` Cargo feature of the Rust plugin to be enabled.
 *
 * @example
 * ```typescript
 * import { watch, BaseDirectory } from '@tauri-apps/plugin-fs';
 *
 * const unwatch = await watch(
 *   'app.conf',
 *   (event) => console.log(event.type, event.paths),
 *   { baseDir: BaseDirectory.AppConfig, delayMs: 500 }
 * );
 *
 * // stop watching when you are done
 * unwatch();
 * ```
 *
 * @param paths The path or list of paths to watch. Each path can be a string or a `file://` URL.
 * @param cb The callback executed for each batch of file system changes.
 * @param options Options defining the base directory of the paths, the debounce delay and whether directories are watched recursively.
 * @returns A promise resolving to a function that stops watching the given paths.
 * @since 2.0.0
 */
async function watch(paths, cb, options) {
    return await watchInternal(paths, cb, {
        delayMs: 2000,
        ...options
    });
}
// TODO: Return `Watcher` instead in v3
/**
 * Watch changes on files or directories.
 *
 * Unlike `watch`, changes are reported as soon as they are detected, without a debounce delay.
 * Requires the `watch` Cargo feature of the Rust plugin to be enabled.
 *
 * @example
 * ```typescript
 * import { watchImmediate, BaseDirectory } from '@tauri-apps/plugin-fs';
 *
 * const unwatch = await watchImmediate(
 *   'logs',
 *   (event) => console.log(event.type, event.paths),
 *   { baseDir: BaseDirectory.AppLog, recursive: true }
 * );
 *
 * // stop watching when you are done
 * unwatch();
 * ```
 *
 * @param paths The path or list of paths to watch. Each path can be a string or a `file://` URL.
 * @param cb The callback executed for each file system change.
 * @param options Options defining the base directory of the paths and whether directories are watched recursively.
 * @returns A promise resolving to a function that stops watching the given paths.
 * @since 2.0.0
 */
async function watchImmediate(paths, cb, options) {
    return await watchInternal(paths, cb, {
        ...options,
        delayMs: undefined
    });
}
/**
 * Get the size of a file or directory. For files, the `stat` functions can be used as well.
 *
 * If `path` is a directory, this function will recursively iterate over every file and every directory inside of `path` and therefore will be very time consuming if used on larger directories.
 *
 * @example
 * ```typescript
 * import { size, BaseDirectory } from '@tauri-apps/plugin-fs';
 * // Get the size of the `$APPDATA/tauri` directory.
 * const dirSize = await size('tauri', { baseDir: BaseDirectory.AppData });
 * console.log(dirSize); // 1024
 * ```
 *
 * @param path The path of the file or directory to measure.
 * @param options Options defining the base directory of `path` (since 2.6.0).
 * @returns A promise resolving to the size in bytes.
 * @since 2.1.0
 */
async function size(path, options) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    return await invoke('plugin:fs|size', {
        path: path instanceof URL ? path.toString() : path,
        options
    });
}
/**
 * Starts accessing a security-scoped resource for the given file URL.
 * This should be called when you're accessing a file that was opened
 * using a security-scoped URL (e.g., from a file picker).
 *
 * Note that accessing security-scoped resources is automatically managed by the plugin on iOS, so you don't need to call this function
 * unless you want to manage the scope manually.
 *
 * You must call {@linkcode stopAccessingSecurityScopedResource} when you're done accessing the resource.
 *
 * #### Platform-specific
 *
 * - **iOS:** Starts accessing the security-scoped resource.
 * - **Other platforms:** does nothing.
 *
 * @example
 * ```typescript
 * import { startAccessingSecurityScopedResource } from '@tauri-apps/plugin-fs';
 *
 * const filePath = 'file:///path/to/file.txt';
 * await startAccessingSecurityScopedResource(filePath);
 * // ... use the resource ...
 * ```
 *
 * @param path The path or `file://` URL of the resource to start accessing.
 * @since 2.5.0
 */
async function startAccessingSecurityScopedResource(path) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|start_accessing_security_scoped_resource', {
        path: path instanceof URL ? path.toString() : path
    });
}
/**
 * Stops accessing a security-scoped resource for the given file URL.
 * This should be called when you're done accessing a file that was opened
 * using a security-scoped URL (e.g., from a file picker) when using manual tracking via {@linkcode startAccessingSecurityScopedResource}.
 *
 * #### Platform-specific
 *
 * - **iOS:** Stops accessing the security-scoped resource.
 * - **Other platforms:** does nothing.
 *
 * @example
 * ```typescript
 * import { stopAccessingSecurityScopedResource } from '@tauri-apps/plugin-fs';
 *
 * const filePath = 'file:///path/to/file.txt';
 * await startAccessingSecurityScopedResource(filePath);
 * // ... use the resource ...
 * // when you're done with the resource:
 * await stopAccessingSecurityScopedResource(filePath);
 * ```
 *
 * @param path The path or `file://` URL of the resource to stop accessing.
 * @since 2.5.0
 */
async function stopAccessingSecurityScopedResource(path) {
    if (path instanceof URL && path.protocol !== 'file:') {
        throw new TypeError('Must be a file URL.');
    }
    await invoke('plugin:fs|stop_accessing_security_scoped_resource', {
        path: path instanceof URL ? path.toString() : path
    });
}

export { FileHandle, SeekMode, copyFile, create, exists, lstat, mkdir, open, readDir, readFile, readTextFile, readTextFileLines, remove, rename, size, startAccessingSecurityScopedResource, stat, stopAccessingSecurityScopedResource, truncate, watch, watchImmediate, writeFile, writeTextFile };
