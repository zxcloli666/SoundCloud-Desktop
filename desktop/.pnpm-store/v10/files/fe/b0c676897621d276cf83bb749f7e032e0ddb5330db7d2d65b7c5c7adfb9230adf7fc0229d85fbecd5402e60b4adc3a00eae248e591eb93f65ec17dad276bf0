/**
 * Load and inspect images to use as window icons, tray icons and menu item icons.
 *
 * Images live on the Rust side (they extend {@linkcode Resource}), the frontend only
 * holds a handle to them. Call `close()` when an image is no longer needed, or let
 * it be released when the app exits.
 *
 * @remarks {@linkcode Image.fromPath} and {@linkcode Image.fromBytes} decode PNG and ICO
 * files, which requires the `image-png` and/or `image-ico` Cargo features of the
 * `tauri` crate:
 * ```toml
 * [dependencies]
 * tauri = { version = "2", features = ["image-png"] }
 * ```
 * {@linkcode Image.new} takes raw RGBA data and needs no extra feature.
 *
 * @remarks All commands used by this module are part of the `core:image:default`
 * permission set, which is enabled by default.
 *
 * This package is also accessible with `window.__TAURI__.image` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 *
 * @module
 */
import { Resource } from './core';
import { NativeIcon } from './menu/iconMenuItem';
/** Image dimensions, in pixels. */
export interface ImageSize {
    /** Image width, in pixels. */
    width: number;
    /** Image height, in pixels. */
    height: number;
}
/**
 * A type that can be passed to Rust side as [`tauri::image::JsImage`](https://docs.rs/tauri/2/tauri/image/enum.JsImage.html) through {@linkcode transformImage}
 *
 * Values of this type must go through {@linkcode transformImage} before being placed in `invoke` arguments;
 * an {@linkcode Image} instance is not serializable on its own.
 *
 * ## Variants
 *
 * - **string:** Path to an image in the filesystem. Maps to [`JsImage::Path`](https://docs.rs/tauri/2/tauri/image/enum.JsImage.html#variant.Path)
 * - **Uint8Array | ArrayBuffer | number[]:** ICO or PNG image in raw bytes. Maps to [`JsImage::Bytes`](https://docs.rs/tauri/2/tauri/image/enum.JsImage.html#variant.Bytes)
 * - **Image:** An image that was previously loaded with the API and is stored in the resource table. Maps to [`JsImage::Resource`](https://docs.rs/tauri/2/tauri/image/enum.JsImage.html#variant.Resource)
 *
 * The `string` and bytes variants require the `image-ico` or `image-png` Cargo features.
 * To enable them, change your Cargo.toml file:
 * ```toml
 * [dependencies]
 * tauri = { version = "...", features = ["...", "image-png"] }
 * ```
 *
 * The Rust [`JsImage::Rgba`](https://docs.rs/tauri/2/tauri/image/enum.JsImage.html#variant.Rgba) variant is intentionally not exposed here;
 * use {@linkcode Image.new} to create an image from raw RGBA data instead.
 */
export type JsImage = string | Uint8Array | ArrayBuffer | number[] | Image;
/** A type that represents an icon that can be used in menu items. */
export type MenuIcon = JsImage | NativeIcon;
/**
 * An RGBA Image in row-major order from top to bottom.
 *
 * Instances are created with {@linkcode Image.new}, {@linkcode Image.fromBytes} or
 * {@linkcode Image.fromPath} and can be passed wherever a {@linkcode JsImage} is
 * accepted, such as `Window.setIcon`, `TrayIcon.setIcon` or an icon menu item.
 *
 * @example
 * ```typescript
 * import { Image } from '@tauri-apps/api/image';
 * import { getCurrentWindow } from '@tauri-apps/api/window';
 *
 * const icon = await Image.fromPath('icons/icon.png');
 * await getCurrentWindow().setIcon(icon);
 * await icon.close();
 * ```
 *
 * @since 2.0.0
 */
export declare class Image extends Resource {
    /**
     * Creates an Image from a resource ID. For internal use only.
     *
     * @ignore
     */
    constructor(rid: number);
    /**
     * Creates a new Image using RGBA data, in row-major order from top to bottom, and with specified width and height.
     *
     * The buffer must contain exactly `width * height * 4` bytes.
     * Unlike {@linkcode Image.fromBytes} and {@linkcode Image.fromPath} this does not
     * decode an image format, so it requires no extra Cargo feature.
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     *
     * // a 1x1 opaque red image
     * const image = await Image.new(new Uint8Array([255, 0, 0, 255]), 1, 1);
     * ```
     *
     * @since 2.0.0
     */
    static new(rgba: number[] | Uint8Array | ArrayBuffer, width: number, height: number): Promise<Image>;
    /**
     * Creates a new image using the provided bytes by inferring the file format.
     *
     * Only `ico` and `png` are supported (based on activated feature flag).
     *
     * Note that you need the `image-ico` or `image-png` Cargo features to use this API.
     * To enable it, change your Cargo.toml file:
     * ```toml
     * [dependencies]
     * tauri = { version = "...", features = ["...", "image-png"] }
     * ```
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     *
     * const bytes = await fetch('/icon.png').then((r) => r.arrayBuffer());
     * const image = await Image.fromBytes(bytes);
     * ```
     *
     * @since 2.0.0
     */
    static fromBytes(bytes: number[] | Uint8Array | ArrayBuffer): Promise<Image>;
    /**
     * Creates a new image using the provided path.
     *
     * Only `ico` and `png` are supported (based on activated feature flag).
     *
     * Note that you need the `image-ico` or `image-png` Cargo features to use this API.
     * To enable it, change your Cargo.toml file:
     * ```toml
     * [dependencies]
     * tauri = { version = "...", features = ["...", "image-png"] }
     * ```
     *
     * The path is resolved on the Rust side, so it must be a path on the user's
     * machine (for example one returned by the path APIs or a bundled resource
     * resolved with `resolveResource`), not a frontend asset URL.
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     * import { resolveResource } from '@tauri-apps/api/path';
     *
     * const image = await Image.fromPath(await resolveResource('icons/icon.png'));
     * ```
     *
     * @since 2.0.0
     */
    static fromPath(path: string): Promise<Image>;
    /**
     * Returns the RGBA data for this image, in row-major order from top to bottom.
     *
     * The returned buffer has `width * height * 4` bytes, see {@linkcode Image.size}.
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     *
     * const image = await Image.fromPath('icons/icon.png');
     * const rgba = await image.rgba();
     * ```
     *
     * @since 2.0.0
     */
    rgba(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * Returns the size of this image, in pixels.
     *
     * @example
     * ```typescript
     * import { Image } from '@tauri-apps/api/image';
     *
     * const image = await Image.fromPath('icons/icon.png');
     * const { width, height } = await image.size();
     * ```
     *
     * @since 2.0.0
     */
    size(): Promise<ImageSize>;
}
/**
 * Transforms image from various types into a type acceptable by Rust.
 *
 * See [`tauri::image::JsImage`](https://docs.rs/tauri/2/tauri/image/enum.JsImage.html) for more information.
 * Note the API signature is not stable and might change.
 */
export declare function transformImage<T>(image: JsImage | null): T;
