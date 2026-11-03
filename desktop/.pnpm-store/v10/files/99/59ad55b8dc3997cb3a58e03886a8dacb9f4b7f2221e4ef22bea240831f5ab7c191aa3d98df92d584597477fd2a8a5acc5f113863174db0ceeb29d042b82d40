import { CornerSquareType, DrawArgs, BasicFigureDrawArgs, RotateFigureArgs, Window } from "../../types";
export declare const availableCornerSquareTypes: CornerSquareType[];
export default class QRCornerSquare {
    _element?: SVGElement;
    _svg: SVGElement;
    _type: CornerSquareType;
    _window: Window;
    constructor({ svg, type, window }: {
        svg: SVGElement;
        type: CornerSquareType;
        window: Window;
    });
    draw(x: number, y: number, size: number, rotation: number): void;
    _rotateFigure({ x, y, size, rotation, draw }: RotateFigureArgs): void;
    _basicDot(args: BasicFigureDrawArgs): void;
    _basicSquare(args: BasicFigureDrawArgs): void;
    _basicExtraRounded(args: BasicFigureDrawArgs): void;
    _drawDot({ x, y, size, rotation }: DrawArgs): void;
    _drawSquare({ x, y, size, rotation }: DrawArgs): void;
    _drawExtraRounded({ x, y, size, rotation }: DrawArgs): void;
}
