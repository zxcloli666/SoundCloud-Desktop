import * as React$1 from "react";
import { ReactNode } from "react";

//#region src/types.d.ts
type BundleType = 0 | 1;
type Flags = number;
type Lanes = number;
type TypeOfMode = number;
type RootTag = 0 | 1 | 2;
type LanePriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
type WorkTag = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;
type HookType = "useState" | "useReducer" | "useContext" | "useRef" | "useEffect" | "useLayoutEffect" | "useCallback" | "useMemo" | "useImperativeHandle" | "useDebugValue" | "useDeferredValue" | "useTransition" | "useMutableSource" | "useOpaqueIdentifier" | "useCacheRefresh";
type FiberRoot = any;
type MutableSource = any;
type OpaqueHandle = any;
type OpaqueRoot = any;
type React$AbstractComponent<_Config, _Instance = unknown> = any;
type HostConfig = Record<string, any>;
interface Source {
  fileName: string;
  lineNumber: number;
}
interface RefObject {
  current: any;
}
interface Thenable<T> {
  then(resolve: () => T, reject?: () => T): T;
}
interface ReactContext<T> {
  $$typeof: symbol | number;
  Consumer: ReactContext<T>;
  Provider: ReactProviderType<T>;
  _calculateChangedBits: ((a: T, b: T) => number) | null;
  _currentValue: T;
  _currentValue2: T;
  _threadCount: number;
  _currentRenderer?: Record<string, any> | null;
  _currentRenderer2?: Record<string, any> | null;
  displayName?: string;
}
interface ReactProviderType<T> {
  $$typeof: symbol | number;
  _context: ReactContext<T>;
}
interface ReactProvider<T> {
  $$typeof: symbol | number;
  type: ReactProviderType<T>;
  key: null | string;
  ref: null;
  props: {
    value: T;
    children?: ReactNode;
  };
}
interface ReactConsumer<T> {
  $$typeof: symbol | number;
  type: ReactContext<T>;
  key: null | string;
  ref: null;
  props: {
    children: (value: T) => ReactNode;
    unstable_observedBits?: number;
  };
}
interface ReactPortal {
  $$typeof: symbol | number;
  key: null | string;
  containerInfo: any;
  children: ReactNode;
  implementation: any;
}
interface ComponentSelector {
  $$typeof: symbol | number;
  value: React$AbstractComponent<never, unknown>;
}
interface HasPseudoClassSelector {
  $$typeof: symbol | number;
  value: Selector[];
}
interface RoleSelector {
  $$typeof: symbol | number;
  value: string;
}
interface TextSelector {
  $$typeof: symbol | number;
  value: string;
}
interface TestNameSelector {
  $$typeof: symbol | number;
  value: string;
}
type Selector = ComponentSelector | HasPseudoClassSelector | RoleSelector | TextSelector | TestNameSelector;
interface DevToolsConfig<Instance = any, TextInstance = any, RendererInspectionConfig = any> {
  bundleType: BundleType;
  version: string;
  rendererPackageName: string;
  findFiberByHostInstance?: (instance: Instance | TextInstance) => ReactFiber | null;
  rendererConfig?: RendererInspectionConfig;
}
interface SuspenseHydrationCallbacks<SuspenseInstance = unknown> {
  onHydrated?: (suspenseInstance: SuspenseInstance) => void;
  onDeleted?: (suspenseInstance: SuspenseInstance) => void;
}
interface TransitionTracingCallbacks {
  onTransitionStart?: (transitionName: string, startTime: number) => void;
  onTransitionProgress?: (transitionName: string, startTime: number, currentTime: number, pending: Array<{
    name: null | string;
  }>) => void;
  onTransitionIncomplete?: (transitionName: string, startTime: number, deletions: Array<{
    type: string;
    name?: string;
    newName?: string;
    endTime: number;
  }>) => void;
  onTransitionComplete?: (transitionName: string, startTime: number, endTime: number) => void;
  onMarkerProgress?: (transitionName: string, marker: string, startTime: number, currentTime: number, pending: Array<{
    name: null | string;
  }>) => void;
  onMarkerIncomplete?: (transitionName: string, marker: string, startTime: number, deletions: Array<{
    type: string;
    name?: string;
    newName?: string;
    endTime: number;
  }>) => void;
  onMarkerComplete?: (transitionName: string, marker: string, startTime: number, endTime: number) => void;
}
interface ReactFiber {
  tag: WorkTag;
  key: null | string;
  elementType: any;
  type: any;
  stateNode: any;
  return: ReactFiber | null;
  child: ReactFiber | null;
  sibling: ReactFiber | null;
  index: number;
  ref: null | (((handle: unknown) => void) & {
    _stringRef?: string | null;
  }) | RefObject;
  pendingProps: any;
  memoizedProps: any;
  updateQueue: unknown;
  memoizedState: any;
  dependencies: Dependencies | null;
  mode: TypeOfMode;
  flags: Flags;
  subtreeFlags: Flags;
  deletions: ReactFiber[] | null;
  nextEffect: ReactFiber | null;
  firstEffect: ReactFiber | null;
  lastEffect: ReactFiber | null;
  lanes: Lanes;
  childLanes: Lanes;
  alternate: ReactFiber | null;
  actualDuration?: number;
  actualStartTime?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;
  _debugID?: number;
  _debugSource?: Source | null;
  _debugOwner?: ReactFiber | null;
  _debugIsCurrentlyTiming?: boolean;
  _debugNeedsRemount?: boolean;
  _debugHookTypes?: HookType[] | null;
}
interface ContextDependency<T> {
  context: ReactContext<T>;
  memoizedValue: T;
  next: ContextDependency<unknown> | null;
  observedBits: number;
}
interface Dependencies {
  firstContext: ContextDependency<unknown> | null;
  lanes: Lanes;
}
interface Effect {
  [key: string]: unknown;
  create: (...args: unknown[]) => unknown;
  deps: null | unknown[];
  destroy: ((...args: unknown[]) => unknown) | null;
  next: Effect | null;
  tag: number;
}
interface Family {
  current: unknown;
}
/**
 * Represents a react-internal Fiber node.
 */
type Fiber<T = any> = Omit<ReactFiber, "alternate" | "child" | "dependencies" | "memoizedProps" | "memoizedState" | "pendingProps" | "return" | "sibling" | "stateNode" | "updateQueue"> & {
  _debugInfo?: Array<{
    debugLocation?: unknown;
    env?: string;
    name?: string;
  }>;
  _debugOwner?: Fiber;
  _debugSource?: {
    columnNumber?: number;
    fileName: string;
    lineNumber: number;
  };
  _debugStack?: Error & {
    stack: string;
  };
  alternate: Fiber | null;
  child: Fiber | null;
  dependencies: Dependencies | null;
  memoizedProps: Props;
  memoizedState: MemoizedState;
  pendingProps: Props;
  return: Fiber | null;
  sibling: Fiber | null;
  stateNode: T;
  updateQueue: {
    [key: string]: unknown;
    lastEffect: Effect | null;
  };
};
interface MemoizedState {
  [key: string]: unknown;
  memoizedState: unknown;
  next: MemoizedState | null;
}
interface Props {
  [key: string]: unknown;
}
interface ReactDevToolsGlobalHook {
  _instrumentationIsActive?: boolean;
  _instrumentationSource?: string;
  checkDCE: (fn: unknown) => void;
  hasUnsupportedRendererAttached: boolean;
  inject: (renderer: ReactRenderer) => number;
  on: () => void;
  onCommitFiberRoot: (rendererID: number, root: FiberRoot, priority: number | void) => void;
  onCommitFiberUnmount: (rendererID: number, fiber: Fiber) => void;
  onPostCommitFiberRoot: (rendererID: number, root: FiberRoot) => void;
  renderers: Map<number, ReactRenderer>;
  supportsFiber: boolean;
  supportsFlight: boolean;
}
interface ReactRenderer {
  bundleType: 0 | 1;
  currentDispatcherRef: any;
  findFiberByHostInstance?: (hostInstance: unknown) => Fiber | null;
  getCurrentFiber?: (fiber: Fiber) => Fiber | null;
  overrideContext?: (fiber: Fiber, contextType: unknown, path: string[], value: unknown) => void;
  overrideHookState?: (fiber: Fiber, id: string, path: string[], value: unknown) => void;
  overrideHookStateDeletePath?: (fiber: Fiber, id: number, path: Array<number | string>) => void;
  overrideHookStateRenamePath?: (fiber: Fiber, id: number, oldPath: Array<number | string>, newPath: Array<number | string>) => void;
  overrideProps?: (fiber: Fiber, path: string[], value: unknown) => void;
  overridePropsDeletePath?: (fiber: Fiber, path: Array<number | string>) => void;
  overridePropsRenamePath?: (fiber: Fiber, oldPath: Array<number | string>, newPath: Array<number | string>) => void;
  reconcilerVersion: string;
  rendererPackageName: string;
  scheduleRefresh?: (root: FiberRoot, update: {
    staleFamilies: Set<Family>;
    updatedFamilies: Set<Family>;
  }) => void;
  scheduleRoot?: (root: FiberRoot, element: React.ReactNode) => void;
  scheduleUpdate?: (fiber: Fiber) => void;
  setErrorHandler?: (newShouldErrorImpl: (fiber: Fiber) => boolean) => void;
  setRefreshHandler?: (handler: ((fiber: Fiber) => Family | null) | null) => void;
  setSuspenseHandler?: (newShouldSuspendImpl: (suspenseInstance: unknown) => void) => void;
  version: string;
}
declare global {
  var __REACT_DEVTOOLS_GLOBAL_HOOK__: ReactDevToolsGlobalHook | undefined;
}
//#endregion
//#region src/rdt-hook.d.ts
declare const version: string | undefined;
declare const BIPPY_INSTRUMENTATION_STRING: string;
declare const isRealReactDevtools: (rdtHook?: ReactDevToolsGlobalHook | undefined | null) => boolean;
declare const isReactRefresh: (rdtHook?: ReactDevToolsGlobalHook | undefined | null) => boolean;
declare const _renderers: Set<ReactRenderer>;
declare const installRDTHook: (onActive?: () => unknown) => ReactDevToolsGlobalHook;
declare const patchRDTHook: (onActive?: () => unknown) => void;
declare const hasRDTHook: () => boolean;
/**
 * Returns the current React DevTools global hook.
 */
declare const getRDTHook: (onActive?: () => unknown) => ReactDevToolsGlobalHook;
declare const isClientEnvironment: () => boolean;
/**
 * Usually used purely for side effect
 */
declare const safelyInstallRDTHook: () => void;
//#endregion
//#region src/core.d.ts
declare const FunctionComponentTag = 0;
declare const ClassComponentTag = 1;
declare const HostRootTag = 3;
declare const HostComponentTag = 5;
declare const HostTextTag = 6;
declare const FragmentTag = 7;
declare const ContextConsumerTag = 9;
declare const ForwardRefTag = 11;
declare const SuspenseComponentTag = 13;
declare const MemoComponentTag = 14;
declare const SimpleMemoComponentTag = 15;
declare const LazyComponentTag = 16;
declare const DehydratedSuspenseComponentTag = 18;
declare const SuspenseListComponentTag = 19;
declare const OffscreenComponentTag = 22;
declare const LegacyHiddenComponentTag = 23;
declare const HostHoistableTag = 26;
declare const HostSingletonTag = 27;
declare const ActivityComponentTag = 28;
declare const ViewTransitionComponentTag = 30;
declare const CONCURRENT_MODE_NUMBER = 60111;
declare const ELEMENT_TYPE_SYMBOL_STRING = "Symbol(react.element)";
declare const TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING = "Symbol(react.transitional.element)";
declare const CONCURRENT_MODE_SYMBOL_STRING = "Symbol(react.concurrent_mode)";
declare const DEPRECATED_ASYNC_MODE_SYMBOL_STRING = "Symbol(react.async_mode)";
/**
 * Returns `true` if object is a React Element.
 *
 * @see https://react.dev/reference/react/isValidElement
 */
declare const isValidElement: (element: unknown) => element is React$1.ReactElement;
/**
 * Returns `true` if object is a React Fiber.
 */
declare const isValidFiber: (fiber: unknown) => fiber is Fiber;
/**
 * Returns `true` if fiber is a host fiber. Host fibers are DOM nodes in react-dom, `View` in react-native, etc.
 *
 * @see https://reactnative.dev/architecture/glossary#host-view-tree-and-host-view
 */
declare const isHostFiber: (fiber: Fiber) => boolean;
/**
 * Returns `true` if fiber is a composite fiber. Composite fibers are fibers that can render (like functional components, class components, etc.)
 *
 * @see https://reactnative.dev/architecture/glossary#react-composite-components
 */
declare const isCompositeFiber: (fiber: Fiber) => boolean;
/**
 * Returns `true` if the object is a {@link Fiber}
 */
declare const isFiber: (maybeFiber: unknown) => maybeFiber is Fiber;
/**
 * Returns `true` if the two {@link Fiber}s are the same reference
 */
declare const areFiberEqual: (fiberA: Fiber, fiberB: Fiber) => boolean;
/**
 * Traverses up or down a {@link Fiber}'s contexts, return `true` to stop and select the current and previous context value.
 */
declare const traverseContexts: (fiber: Fiber, selector: (nextValue: ContextDependency<unknown> | null | undefined, prevValue: ContextDependency<unknown> | null | undefined) => boolean | void) => boolean;
/**
 * Traverses up or down a {@link Fiber}'s states, return `true` to stop and select the current and previous state value. This stores both state values and effects.
 */
declare const traverseState: (fiber: Fiber, selector: (nextValue: MemoizedState | null | undefined, prevValue: MemoizedState | null | undefined) => boolean | void) => boolean;
/**
 * Traverses up or down a {@link Fiber}'s props, return `true` to stop and select the current and previous props value.
 */
declare const traverseProps: (fiber: Fiber, selector: (propName: string, nextValue: unknown, prevValue: unknown) => boolean | void) => boolean;
/**
 * Returns `true` if the {@link Fiber} has rendered. Note that this does not mean the fiber has rendered in the current commit, just that it has rendered in the past.
 */
declare const didFiberRender: (fiber: Fiber) => boolean;
/**
 * Returns `true` if the {@link Fiber} has committed. Note that this does not mean the fiber has committed in the current commit, just that it has committed in the past.
 */
declare const didFiberCommit: (fiber: Fiber) => boolean;
/**
 * Returns all host {@link Fiber}s that have committed and rendered.
 */
declare const getMutatedHostFibers: (fiber: Fiber) => Fiber[];
/**
 * Returns the stack of {@link Fiber}s from the current fiber to the root fiber.
 *
 * @example
 * ```ts
 * [fiber, fiber.return, fiber.return.return, ...]
 * ```
 */
declare const getFiberStack: (fiber: Fiber) => Fiber[];
/**
 * Returns `true` if the {@link Fiber} should be filtered out during reconciliation.
 */
declare const shouldFilterFiber: (fiber: Fiber) => boolean;
/**
 * Returns the nearest host {@link Fiber} to the current {@link Fiber}.
 */
declare const getNearestHostFiber: (fiber: Fiber, ascending?: boolean) => Fiber | null;
/**
 * Returns all host {@link Fiber}s in the tree that are associated with the current {@link Fiber}.
 */
declare const getNearestHostFibers: (fiber: Fiber) => Fiber[];
/**
 * Traverses up or down a {@link Fiber}, return `true` to stop and select a node.
 */
declare function traverseFiber(fiber: Fiber | null, selector: (node: Fiber) => boolean | void, ascending?: boolean): Fiber | null;
declare function traverseFiber(fiber: Fiber | null, selector: (node: Fiber) => Promise<boolean | void>, ascending?: boolean): Promise<Fiber | null>;
declare const traverseFiberSync: (fiber: Fiber | null, selector: (node: Fiber) => boolean | void, ascending?: boolean) => Fiber | null;
declare const traverseFiberAsync: (fiber: Fiber | null, selector: (node: Fiber) => Promise<boolean | void>, ascending?: boolean) => Promise<Fiber | null>;
/**
 * Returns the timings of the {@link Fiber}.
 *
 * @example
 * ```ts
 * const { selfTime, totalTime } = getTimings(fiber);
 * console.log(selfTime, totalTime);
 * ```
 */
declare const getTimings: (fiber?: Fiber | null) => {
  selfTime: number;
  totalTime: number;
};
/**
 * Returns `true` if the {@link Fiber} uses React Compiler's memo cache.
 */
declare const hasMemoCache: (fiber: Fiber) => boolean;
/**
 * Returns the type (e.g. component definition) of the {@link Fiber}
 */
declare const getType: (type: unknown) => null | React$1.ComponentType<unknown>;
/**
 * Returns the display name of the {@link Fiber} type.
 */
declare const getDisplayName: (type: unknown) => null | string;
/**
 * Returns the build type of the React renderer.
 */
declare const detectReactBuildType: (renderer: ReactRenderer) => "development" | "production";
/**
 * Returns `true` if bippy's instrumentation is active.
 */
declare const isInstrumentationActive: () => boolean;
/**
 * Returns the latest fiber (since it may be double-buffered).
 */
declare const getLatestFiber: (fiber: Fiber) => Fiber;
type RenderHandler = <S>(fiber: Fiber, phase: RenderPhase, state?: S) => unknown;
type RenderPhase = "mount" | "unmount" | "update";
declare const fiberIdMap: WeakMap<Fiber, number>;
declare const setFiberId: (fiber: Fiber, id?: number) => void;
declare const getFiberId: (fiber: Fiber) => number;
declare const mountFiberRecursively: (onRender: RenderHandler, firstChild: Fiber, traverseSiblings: boolean) => void;
declare const updateFiberRecursively: (onRender: RenderHandler, nextFiber: Fiber, prevFiber: Fiber, parentFiber: Fiber | null) => void;
declare const unmountFiber: (onRender: RenderHandler, fiber: Fiber) => void;
declare const unmountFiberChildrenRecursively: (onRender: RenderHandler, fiber: Fiber) => void;
/**
 * Creates a fiber visitor function. Must pass a fiber root and a render handler.
 * @example
 * traverseRenderedFibers(root, (fiber, phase) => {
 *   console.log(phase)
 * })
 */
declare const traverseRenderedFibers: (root: FiberRoot, onRender: RenderHandler) => void;
declare const injectOverrideMethods: () => {
  overrideContext: ((fiber: Fiber, contextType: unknown, path: string[], value: unknown) => void) | null | undefined;
  overrideHookState: ((fiber: Fiber, id: string, path: string[], value: unknown) => void) | null | undefined;
  overrideProps: ((fiber: Fiber, path: string[], value: unknown) => void) | null | undefined;
} | null | undefined;
declare const overrideProps: (fiber: Fiber, partialValue: Record<string, unknown>) => void;
declare const overrideHookState: (fiber: Fiber, id: number, partialValue: Record<string, unknown>) => void;
declare const overrideContext: (fiber: Fiber, contextType: unknown, partialValue: Record<string, unknown>) => void;
interface InstrumentationOptions {
  name?: string;
  onActive?: () => unknown;
  onCommitFiberRoot?: (rendererID: number, root: FiberRoot, priority: number | void) => unknown;
  onCommitFiberUnmount?: (rendererID: number, fiber: Fiber) => unknown;
  onPostCommitFiberRoot?: (rendererID: number, root: FiberRoot) => unknown;
  onScheduleFiberRoot?: (rendererID: number, root: FiberRoot, children: React$1.ReactNode) => unknown;
}
/**
 * Instruments the DevTools hook.
 * @example
 * const hook = instrument({
 *   onActive() {
 *     console.log('initialized');
 *   },
 *   onCommitFiberRoot(rendererID, root) {
 *     console.log('fiberRoot', root.current)
 *   },
 * });
 */
declare const instrument: (options: InstrumentationOptions) => ReactDevToolsGlobalHook;
declare const getFiberFromHostInstance: <T>(hostInstance: T) => Fiber | null;
declare const INSTALL_ERROR: Error;
declare const _fiberRoots: Set<any>;
declare const secure: (options: InstrumentationOptions, secureOptions?: {
  dangerouslyRunInProduction?: boolean;
  installCheckTimeout?: number;
  isProduction?: boolean;
  minReactMajorVersion?: number;
  onError?: (error?: unknown) => unknown;
}) => InstrumentationOptions;
//#endregion
export { isValidElement as $, ReactPortal as $t, _fiberRoots as A, ComponentSelector as At, getLatestFiber as B, HookType as Bt, RenderHandler as C, isClientEnvironment as Ct, SuspenseListComponentTag as D, safelyInstallRDTHook as Dt, SuspenseComponentTag as E, patchRDTHook as Et, fiberIdMap as F, Family as Ft, getType as G, MutableSource as Gt, getNearestHostFiber as H, LanePriority as Ht, getDisplayName as I, Fiber as It, instrument as J, Props as Jt, hasMemoCache as K, OpaqueHandle as Kt, getFiberFromHostInstance as L, FiberRoot as Lt, detectReactBuildType as M, Dependencies as Mt, didFiberCommit as N, DevToolsConfig as Nt, TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING as O, version as Ot, didFiberRender as P, Effect as Pt, isInstrumentationActive as Q, ReactDevToolsGlobalHook as Qt, getFiberId as R, Flags as Rt, OffscreenComponentTag as S, installRDTHook as St, SimpleMemoComponentTag as T, isRealReactDevtools as Tt, getNearestHostFibers as U, Lanes as Ut, getMutatedHostFibers as V, HostConfig as Vt, getTimings as W, MemoizedState as Wt, isFiber as X, ReactConsumer as Xt, isCompositeFiber as Y, React$AbstractComponent as Yt, isHostFiber as Z, ReactContext as Zt, INSTALL_ERROR as _, updateFiberRecursively as _t, ContextConsumerTag as a, RootTag as an, secure as at, LegacyHiddenComponentTag as b, getRDTHook as bt, ELEMENT_TYPE_SYMBOL_STRING as c, SuspenseHydrationCallbacks as cn, traverseContexts as ct, FunctionComponentTag as d, Thenable as dn, traverseFiberSync as dt, ReactProvider as en, isValidFiber as et, HostComponentTag as f, TransitionTracingCallbacks as fn, traverseProps as ft, HostTextTag as g, unmountFiberChildrenRecursively as gt, HostSingletonTag as h, unmountFiber as ht, ClassComponentTag as i, RoleSelector as in, overrideProps as it, areFiberEqual as j, ContextDependency as jt, ViewTransitionComponentTag as k, BundleType as kt, ForwardRefTag as l, TestNameSelector as ln, traverseFiber as lt, HostRootTag as m, WorkTag as mn, traverseState as mt, CONCURRENT_MODE_NUMBER as n, ReactRenderer as nn, overrideContext as nt, DEPRECATED_ASYNC_MODE_SYMBOL_STRING as o, Selector as on, setFiberId as ot, HostHoistableTag as p, TypeOfMode as pn, traverseRenderedFibers as pt, injectOverrideMethods as q, OpaqueRoot as qt, CONCURRENT_MODE_SYMBOL_STRING as r, RefObject as rn, overrideHookState as rt, DehydratedSuspenseComponentTag as s, Source as sn, shouldFilterFiber as st, ActivityComponentTag as t, ReactProviderType as tn, mountFiberRecursively as tt, FragmentTag as u, TextSelector as un, traverseFiberAsync as ut, InstrumentationOptions as v, BIPPY_INSTRUMENTATION_STRING as vt, RenderPhase as w, isReactRefresh as wt, MemoComponentTag as x, hasRDTHook as xt, LazyComponentTag as y, _renderers as yt, getFiberStack as z, HasPseudoClassSelector as zt };