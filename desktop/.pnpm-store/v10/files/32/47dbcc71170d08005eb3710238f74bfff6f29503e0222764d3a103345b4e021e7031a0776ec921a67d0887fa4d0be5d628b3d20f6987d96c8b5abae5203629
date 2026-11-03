import { CornerDotType, RotateFigureArgs, BasicFigureDrawArgs, DrawArgs, Window } from "../../types";
export declare const availableCornerDotTypes: CornerDotType[];
export default class QRCornerDot {
    _element?: SVGElement;
    _svg: SVGElement;
    _type: CornerDotType;
    _window: Window;
    constructor({ svg, type, window }: {
        svg: SVGElement;
        type: CornerDotType;
        window: Window;
    });
    draw(x: number, y: number, size: number, rotation: number): void;
    _rotateFigure({ x, y, size, rotation, draw }: RotateFigureArgs): void;
    _basicDot(args: BasicFigureDrawArgs): void;
    _basicSquare(args: BasicFigureDrawArgs): void;
    _drawDot({ x, y, size, rotation }: DrawArgs): void;
    _drawSquare({ x, y, size, rotation }: DrawArgs): void;
}
