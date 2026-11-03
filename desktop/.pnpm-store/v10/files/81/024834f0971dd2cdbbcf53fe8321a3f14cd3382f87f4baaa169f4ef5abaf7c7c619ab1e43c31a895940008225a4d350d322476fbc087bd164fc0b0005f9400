/**
 * Size and position types for working with logical and physical pixels.
 *
 * Window and webview APIs report sizes and positions in **physical pixels** (actual
 * screen pixels), while most browser APIs and the window creation options use
 * **logical pixels** (physical pixels divided by the monitor scale factor). The
 * classes in this module make the unit explicit and convert between the two.
 *
 * ```typescript
 * import { getCurrentWindow } from '@tauri-apps/api/window';
 *
 * const appWindow = getCurrentWindow();
 * const size = await appWindow.innerSize(); // PhysicalSize
 * const logical = size.toLogical(await appWindow.scaleFactor());
 * ```
 *
 * They also serialize into the shape `tauri::Size` / `tauri::Position` expect, so
 * they can be passed straight to your own commands, see {@linkcode Size} and
 * {@linkcode Position}.
 *
 * This package is also accessible with `window.__TAURI__.dpi` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 *
 * @module
 */
import { SERIALIZE_TO_IPC_FN } from './core';
/**
 * A size represented in logical pixels.
 * Logical pixels are scaled according to the window's DPI scale.
 * Most browser APIs (i.e. `MouseEvent`'s `clientX`) will return logical pixels.
 *
 * For logical-pixel-based position, see {@linkcode LogicalPosition}.
 *
 * @since 2.0.0
 */
declare class LogicalSize {
    readonly type = "Logical";
    width: number;
    height: number;
    constructor(width: number, height: number);
    constructor(object: {
        Logical: {
            width: number;
            height: number;
        };
    });
    constructor(object: {
        width: number;
        height: number;
    });
    /**
     * Converts the logical size to a physical one.
     * @example
     * ```typescript
     * import { LogicalSize } from '@tauri-apps/api/dpi';
     * import { getCurrentWindow } from '@tauri-apps/api/window';
     *
     * const appWindow = getCurrentWindow();
     * const factor = await appWindow.scaleFactor();
     * const size = new LogicalSize(400, 500);
     * const physical = size.toPhysical(factor);
     * ```
     *
     * @since 2.0.0
     */
    toPhysical(scaleFactor: number): PhysicalSize;
    [SERIALIZE_TO_IPC_FN](): {
        width: number;
        height: number;
    };
    toJSON(): {
        width: number;
        height: number;
    };
}
/**
 * A size represented in physical pixels.
 *
 * Physical pixels represent actual screen pixels, and are DPI-independent.
 * For high-DPI windows, this means that any point in the window on the screen
 * will have a different position in logical pixels {@linkcode LogicalSize}.
 *
 * For physical-pixel-based position, see {@linkcode PhysicalPosition}.
 *
 * @since 2.0.0
 */
declare class PhysicalSize {
    readonly type = "Physical";
    width: number;
    height: number;
    constructor(width: number, height: number);
    constructor(object: {
        Physical: {
            width: number;
            height: number;
        };
    });
    constructor(object: {
        width: number;
        height: number;
    });
    /**
     * Converts the physical size to a logical one.
     * @example
     * ```typescript
     * import { getCurrentWindow } from '@tauri-apps/api/window';
     * const appWindow = getCurrentWindow();
     * const factor = await appWindow.scaleFactor();
     * const size = await appWindow.innerSize(); // PhysicalSize
     * const logical = size.toLogical(factor);
     * ```
     *
     * @since 2.0.0
     */
    toLogical(scaleFactor: number): LogicalSize;
    [SERIALIZE_TO_IPC_FN](): {
        width: number;
        height: number;
    };
    toJSON(): {
        width: number;
        height: number;
    };
}
/**
 * A size represented either in physical or in logical pixels.
 *
 * This type is basically a union type of {@linkcode LogicalSize} and {@linkcode PhysicalSize}
 * but comes in handy when using `tauri::Size` in Rust as an argument to a command, as this class
 * automatically serializes into a valid format so it can be deserialized correctly into `tauri::Size`
 *
 * So instead of
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 * import { LogicalSize, PhysicalSize } from '@tauri-apps/api/dpi';
 *
 * const size: LogicalSize | PhysicalSize = someFunction(); // where someFunction returns either LogicalSize or PhysicalSize
 * const validSize = size instanceof LogicalSize
 *   ? { Logical: { width: size.width, height: size.height } }
 *   : { Physical: { width: size.width, height: size.height } }
 * await invoke("do_something_with_size", { size: validSize });
 * ```
 *
 * You can just use {@linkcode Size}
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 * import { LogicalSize, PhysicalSize, Size } from '@tauri-apps/api/dpi';
 *
 * const size: LogicalSize | PhysicalSize = someFunction(); // where someFunction returns either LogicalSize or PhysicalSize
 * const validSize = new Size(size);
 * await invoke("do_something_with_size", { size: validSize });
 * ```
 *
 * @since 2.1.0
 */
declare class Size {
    size: LogicalSize | PhysicalSize;
    constructor(size: LogicalSize | PhysicalSize);
    /**
     * Converts the wrapped size to a logical one.
     *
     * Returns the inner value untouched when it already is a {@linkcode LogicalSize}.
     *
     * @param scaleFactor The monitor scale factor, e.g. `await appWindow.scaleFactor()`.
     *
     * @since 2.1.0
     */
    toLogical(scaleFactor: number): LogicalSize;
    /**
     * Converts the wrapped size to a physical one.
     *
     * Returns the inner value untouched when it already is a {@linkcode PhysicalSize}.
     *
     * @param scaleFactor The monitor scale factor, e.g. `await appWindow.scaleFactor()`.
     *
     * @since 2.1.0
     */
    toPhysical(scaleFactor: number): PhysicalSize;
    [SERIALIZE_TO_IPC_FN](): {
        [x: string]: {
            width: number;
            height: number;
        };
    };
    toJSON(): {
        [x: string]: {
            width: number;
            height: number;
        };
    };
}
/**
 * A position represented in logical pixels.
 * For an explanation of what logical pixels are, see description of {@linkcode LogicalSize}.
 *
 * @since 2.0.0
 */
declare class LogicalPosition {
    readonly type = "Logical";
    x: number;
    y: number;
    constructor(x: number, y: number);
    constructor(object: {
        Logical: {
            x: number;
            y: number;
        };
    });
    constructor(object: {
        x: number;
        y: number;
    });
    /**
     * Converts the logical position to a physical one.
     * @example
     * ```typescript
     * import { LogicalPosition } from '@tauri-apps/api/dpi';
     * import { getCurrentWindow } from '@tauri-apps/api/window';
     *
     * const appWindow = getCurrentWindow();
     * const factor = await appWindow.scaleFactor();
     * const position = new LogicalPosition(400, 500);
     * const physical = position.toPhysical(factor);
     * ```
     *
     * @since 2.0.0
     */
    toPhysical(scaleFactor: number): PhysicalPosition;
    [SERIALIZE_TO_IPC_FN](): {
        x: number;
        y: number;
    };
    toJSON(): {
        x: number;
        y: number;
    };
}
/**
 * A position represented in physical pixels.
 *
 * For an explanation of what physical pixels are, see description of {@linkcode PhysicalSize}.
 *
 * @since 2.0.0
 */
declare class PhysicalPosition {
    readonly type = "Physical";
    x: number;
    y: number;
    constructor(x: number, y: number);
    constructor(object: {
        Physical: {
            x: number;
            y: number;
        };
    });
    constructor(object: {
        x: number;
        y: number;
    });
    /**
     * Converts the physical position to a logical one.
     * @example
     * ```typescript
     * import { PhysicalPosition } from '@tauri-apps/api/dpi';
     * import { getCurrentWindow } from '@tauri-apps/api/window';
     *
     * const appWindow = getCurrentWindow();
     * const factor = await appWindow.scaleFactor();
     * const position = new PhysicalPosition(400, 500);
     * const logical = position.toLogical(factor);
     * ```
     *
     * @since 2.0.0
     */
    toLogical(scaleFactor: number): LogicalPosition;
    [SERIALIZE_TO_IPC_FN](): {
        x: number;
        y: number;
    };
    toJSON(): {
        x: number;
        y: number;
    };
}
/**
 * A position represented either in physical or in logical pixels.
 *
 * This type is basically a union type of {@linkcode LogicalPosition} and {@linkcode PhysicalPosition}
 * but comes in handy when using `tauri::Position` in Rust as an argument to a command, as this class
 * automatically serializes into a valid format so it can be deserialized correctly into `tauri::Position`
 *
 * So instead of
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 * import { LogicalPosition, PhysicalPosition } from '@tauri-apps/api/dpi';
 *
 * const position: LogicalPosition | PhysicalPosition = someFunction(); // where someFunction returns either LogicalPosition or PhysicalPosition
 * const validPosition = position instanceof LogicalPosition
 *   ? { Logical: { x: position.x, y: position.y } }
 *   : { Physical: { x: position.x, y: position.y } }
 * await invoke("do_something_with_position", { position: validPosition });
 * ```
 *
 * You can just use {@linkcode Position}
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 * import { LogicalPosition, PhysicalPosition, Position } from '@tauri-apps/api/dpi';
 *
 * const position: LogicalPosition | PhysicalPosition = someFunction(); // where someFunction returns either LogicalPosition or PhysicalPosition
 * const validPosition = new Position(position);
 * await invoke("do_something_with_position", { position: validPosition });
 * ```
 *
 * @since 2.1.0
 */
declare class Position {
    position: LogicalPosition | PhysicalPosition;
    constructor(position: LogicalPosition | PhysicalPosition);
    /**
     * Converts the wrapped position to a logical one.
     *
     * Returns the inner value untouched when it already is a {@linkcode LogicalPosition}.
     *
     * @param scaleFactor The monitor scale factor, e.g. `await appWindow.scaleFactor()`.
     *
     * @since 2.1.0
     */
    toLogical(scaleFactor: number): LogicalPosition;
    /**
     * Converts the wrapped position to a physical one.
     *
     * Returns the inner value untouched when it already is a {@linkcode PhysicalPosition}.
     *
     * @param scaleFactor The monitor scale factor, e.g. `await appWindow.scaleFactor()`.
     *
     * @since 2.1.0
     */
    toPhysical(scaleFactor: number): PhysicalPosition;
    [SERIALIZE_TO_IPC_FN](): {
        [x: string]: {
            x: number;
            y: number;
        };
    };
    toJSON(): {
        [x: string]: {
            x: number;
            y: number;
        };
    };
}
export { LogicalPosition, LogicalSize, Size, PhysicalPosition, PhysicalSize, Position };
