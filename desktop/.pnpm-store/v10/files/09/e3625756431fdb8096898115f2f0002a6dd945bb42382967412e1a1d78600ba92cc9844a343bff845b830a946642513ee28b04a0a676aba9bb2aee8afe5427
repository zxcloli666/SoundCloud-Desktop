import { RequiredOptions } from "./QROptions";
import { QRCode, FilterFunction, Gradient, Window } from "../types";
import { Image } from "canvas";
export default class QRSVG {
    _window: Window;
    _element: SVGElement;
    _defs: SVGElement;
    _backgroundClipPath?: SVGElement;
    _dotsClipPath?: SVGElement;
    _cornersSquareClipPath?: SVGElement;
    _cornersDotClipPath?: SVGElement;
    _options: RequiredOptions;
    _qr?: QRCode;
    _image?: HTMLImageElement | Image;
    _imageUri?: string;
    _instanceId: number;
    static instanceCount: number;
    constructor(options: RequiredOptions, window: Window);
    get width(): number;
    get height(): number;
    getElement(): SVGElement;
    drawQR(qr: QRCode): Promise<void>;
    drawBackground(): void;
    drawDots(filter?: FilterFunction): void;
    drawCorners(): void;
    loadImage(): Promise<void>;
    drawImage({ width, height, count, dotSize }: {
        width: number;
        height: number;
        count: number;
        dotSize: number;
    }): Promise<void>;
    _createColor({ options, color, additionalRotation, x, y, height, width, name }: {
        options?: Gradient;
        color?: string;
        additionalRotation: number;
        x: number;
        y: number;
        height: number;
        width: number;
        name: string;
    }): void;
    _roundSize: (value: number) => number;
}
