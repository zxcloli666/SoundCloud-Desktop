import { It as Fiber } from "./core.js";

//#region src/source/parse-stack.d.ts
interface StackFrame {
  args?: unknown[];
  columnNumber?: number;
  lineNumber?: number;
  fileName?: string;
  functionName?: string;
  source?: string;
  isServer?: boolean;
  isSymbolicated?: boolean;
}
interface ParseOptions {
  slice?: number | [number, number];
  allowEmpty?: boolean;
  includeInElement?: boolean;
}
declare const parseStack: (stackString: string, options?: ParseOptions) => StackFrame[];
declare const extractLocation: (urlLike: string) => [string, string | undefined, string | undefined];
declare const parseV8OrIE: (error: Error, options?: ParseOptions) => StackFrame[];
declare const parseV8OrIeString: (stack: string, options?: ParseOptions) => StackFrame[];
declare const parseFFOrSafari: (error: Error, options?: ParseOptions) => StackFrame[];
declare const parseFFOrSafariString: (stack: string, options?: ParseOptions) => StackFrame[];
declare const parseOpera: (error: Error, options?: ParseOptions) => StackFrame[];
declare const parseOpera9: (error: Error, options?: ParseOptions) => StackFrame[];
declare const parseOpera10: (error: Error, options?: ParseOptions) => StackFrame[];
declare const parseOpera11: (error: Error, options?: ParseOptions) => StackFrame[];
//#endregion
//#region src/source/owner-stack.d.ts
declare const hasDebugStack: (fiber: Fiber) => fiber is Fiber & {
  _debugStack: NonNullable<Fiber["_debugStack"]>;
};
declare const describeDebugInfoFrame: (name: string, env?: string) => string;
declare const describeFiber: (fiber: Fiber, childFiber: Fiber | null) => string;
/**
 * react 19 introduces the _debugStack property, which we can use to grab the stack.
 * however, for versions that don't have this property, we need to construct
 * a "fake" version of the owner stack
 */
declare const getFallbackOwnerStack: (thisFiber: Fiber) => string;
/**
 * takes Error.stack and formats it to only the React owner stack
 *
 * before:
 * ```
 * Error: react-stack-top-frame
 * at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/<chunk-name>._.js:17665:16)
 * at TodoItem (rsc://React/Server/file:///path/to/project/.next/server/chunks/ssr/<chunk-name>._.js)
 * at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/<chunk-name>._.js:17984:89)
 * ```
 *
 * after:
 * ```
 * at TodoItem (rsc://React/Server/file:///path/to/project/.next/server/chunks/ssr/<chunk-name>._.js)
 * ```
 *
 * @see https://github.com/facebook/react/blob/main/packages/react-devtools-shared/src/backend/shared/DevToolsOwnerStack.js#L12
 */
declare const formatOwnerStack: (stack: string) => string;
declare const getOwnerStack: (fiber: Fiber, shouldCache?: boolean, fetchFunction?: (url: string) => Promise<Response>) => Promise<StackFrame[]>;
//#endregion
//#region src/source/types.d.ts
interface FiberSource {
  columnNumber?: number;
  fileName: string;
  lineNumber?: number;
  functionName?: string;
}
//#endregion
//#region src/source/get-source.d.ts
declare const hasDebugSource: (fiber: Fiber) => fiber is Fiber & {
  _debugSource: NonNullable<Fiber["_debugSource"]>;
};
/**
 * Returns the source of where the component is used. Available only in dev, for composite {@link Fiber}s.
 *
 * @example
 * ```ts
 * function Parent() {
 *   const data = useData();
 *   return <Child name={data.name} />; // <-- captures THIS line
 * }
 *
 * function Child({ name }) {
 *   return <div>{name}</div>;
 * }
 *
 * const source = await getSource(fiber);
 * console.log(source.fileName, source.lineNumber);
 * ```
 */
declare const getSource: (fiber: Fiber, cache?: boolean, fetchFn?: (url: string) => Promise<Response>) => Promise<FiberSource | null>;
declare const normalizeFileName: (fileName: string) => string;
declare const isSourceFile: (fileName: string) => boolean;
//#endregion
//#region ../../node_modules/@jridgewell/sourcemap-codec/types/sourcemap-codec.d.mts
type SourceMapSegment = [number] | [number, number, number, number] | [number, number, number, number, number];
//#endregion
//#region src/source/symbolication.d.ts
interface DecodedSourceMapSection {
  map: {
    file?: string;
    mappings: SourceMapSegment[][];
    names?: string[];
    sourceRoot?: string;
    sources: string[];
    sourcesContent?: string[];
    version: 3;
  };
  offset: {
    column: number;
    line: number;
  };
}
interface IndexSourceMap {
  file?: string;
  sections: Array<{
    map: StandardSourceMap;
    offset: {
      column: number;
      line: number;
    };
  }>;
  version: 3;
}
type RawSourceMap = IndexSourceMap | StandardSourceMap;
interface SourceMap {
  file?: string;
  mappings: SourceMapSegment[][];
  names?: string[];
  sections?: DecodedSourceMapSection[];
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: string[];
  version: 3;
}
interface StandardSourceMap {
  file?: string;
  mappings: string;
  names?: string[];
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: string[];
  version: 3;
}
declare const sourceMapCache: Map<string, SourceMap | WeakRef<SourceMap> | null>;
declare const getSourceFromSourceMap: (sourceMap: SourceMap, line: number, column: number) => StackFrame | null;
declare const getSourceMapImpl: (bundleUrl: string, fetchFn?: (url: string) => Promise<Response>) => Promise<null | SourceMap>;
declare const getSourceMap: (file: string, useCache?: boolean, fetchFn?: (url: string) => Promise<Response>) => Promise<null | SourceMap>;
declare const symbolicateStack: (stack: StackFrame[], cache?: boolean, fetchFn?: (url: string) => Promise<Response>) => Promise<StackFrame[]>;
//#endregion
//#region src/source/get-display-name-from-source.d.ts
declare const getDisplayNameFromSource: (fiber: Fiber, cache?: boolean, fetchFn?: (url: string) => Promise<Response>) => Promise<string | null>;
//#endregion
export { DecodedSourceMapSection, FiberSource, IndexSourceMap, ParseOptions, RawSourceMap, SourceMap, StackFrame, StandardSourceMap, describeDebugInfoFrame, describeFiber, extractLocation, formatOwnerStack, getDisplayNameFromSource, getFallbackOwnerStack, getOwnerStack, getSource, getSourceFromSourceMap, getSourceMap, getSourceMapImpl, hasDebugSource, hasDebugStack, isSourceFile, normalizeFileName, parseFFOrSafari, parseFFOrSafariString, parseOpera, parseOpera10, parseOpera11, parseOpera9, parseStack, parseV8OrIE, parseV8OrIeString, sourceMapCache, symbolicateStack };