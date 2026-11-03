import { ShapeType, DotType, Options, TypeNumber, ErrorCorrectionLevel, Mode, DrawType, Gradient } from "../types";
export interface RequiredOptions extends Options {
    type: DrawType;
    shape: ShapeType;
    width: number;
    height: number;
    margin: number;
    data: string;
    qrOptions: {
        typeNumber: TypeNumber;
        mode?: Mode;
        errorCorrectionLevel: ErrorCorrectionLevel;
    };
    imageOptions: {
        saveAsBlob: boolean;
        hideBackgroundDots: boolean;
        imageSize: number;
        crossOrigin?: string;
        margin: number;
    };
    dotsOptions: {
        type: DotType;
        color: string;
        gradient?: Gradient;
        roundSize?: boolean;
    };
    backgroundOptions: {
        round: number;
        color: string;
        gradient?: Gradient;
    };
}
declare const defaultOptions: RequiredOptions;
export default defaultOptions;
