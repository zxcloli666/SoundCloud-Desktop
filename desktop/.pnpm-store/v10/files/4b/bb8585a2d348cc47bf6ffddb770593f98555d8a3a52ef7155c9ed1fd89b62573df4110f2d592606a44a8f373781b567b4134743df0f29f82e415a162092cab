import { RequiredOptions } from "./QROptions";
import { FileExtension, QRCode, Options, DownloadOptions, ExtensionFunction, Window } from "../types";
import { Canvas as NodeCanvas } from "canvas";
export default class QRCodeStyling {
    _options: RequiredOptions;
    _window: Window;
    _container?: HTMLElement;
    _domCanvas?: HTMLCanvasElement;
    _nodeCanvas?: NodeCanvas;
    _svg?: SVGElement;
    _qr?: QRCode;
    _extension?: ExtensionFunction;
    _canvasDrawingPromise?: Promise<void>;
    _svgDrawingPromise?: Promise<void>;
    constructor(options?: Partial<Options>);
    static _clearContainer(container?: HTMLElement): void;
    _setupSvg(): void;
    _setupCanvas(): void;
    _getElement(extension?: FileExtension): Promise<HTMLCanvasElement | NodeCanvas | SVGElement | undefined>;
    update(options?: Partial<Options>): void;
    append(container?: HTMLElement): void;
    applyExtension(extension: ExtensionFunction): void;
    deleteExtension(): void;
    getRawData(extension?: FileExtension): Promise<Blob | Buffer | null>;
    download(downloadOptions?: Partial<DownloadOptions> | string): Promise<void>;
}
