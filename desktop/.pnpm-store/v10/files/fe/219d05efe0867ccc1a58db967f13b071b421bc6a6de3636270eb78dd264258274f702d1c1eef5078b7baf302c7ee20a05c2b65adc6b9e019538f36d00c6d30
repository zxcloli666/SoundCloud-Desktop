import * as preact from 'preact';
import { ComponentType } from 'preact';
import { Signal } from '@preact/signals';
import { Fiber, FiberRoot } from 'bippy';
import { ReactNode } from 'preact/compat';

declare enum RenderPhase {
    Mount = 1,
    Update = 2,
    Unmount = 4
}
declare const enum ChangeReason {
    Props = 1,
    FunctionalState = 2,
    ClassState = 3,
    Context = 4
}
interface Render {
    phase: RenderPhase;
    componentName: string | null;
    time: number | null;
    count: number;
    forget: boolean;
    changes: Array<Change>;
    unnecessary: boolean | null;
    didCommit: boolean;
    fps: number;
}
type OnRenderHandler = (fiber: Fiber, renders: Array<Render>) => void;
type OnCommitStartHandler = () => void;
type OnCommitFinishHandler = () => void;
type OnErrorHandler = (error: unknown) => void;
type IsValidFiberHandler = (fiber: Fiber) => boolean;
type OnActiveHandler = () => void;
interface InstrumentationConfig {
    onCommitStart: OnCommitStartHandler;
    isValidFiber: IsValidFiberHandler;
    onRender: OnRenderHandler;
    onCommitFinish: OnCommitFinishHandler;
    onError: OnErrorHandler;
    onActive?: OnActiveHandler;
    onPostCommitFiberRoot: () => void;
    trackChanges: boolean;
    forceAlwaysTrackRenders?: boolean;
}
interface Instrumentation {
    isPaused: Signal<boolean>;
    fiberRoots: WeakSet<FiberRoot>;
}
declare const createInstrumentation: (instanceKey: string, config: InstrumentationConfig) => Instrumentation;

interface RenderData {
    count: number;
    time: number;
    renders: Array<Render>;
    displayName: string | null;
    type: unknown;
    changes?: Array<RenderChange>;
}

type States = {
    kind: 'inspecting';
    hoveredDomElement: Element | null;
} | {
    kind: 'inspect-off';
} | {
    kind: 'focused';
    focusedDomElement: Element;
    fiber: Fiber;
} | {
    kind: 'uninitialized';
};

interface Options {
    /**
     * Enable/disable scanning
     *
     * Please use the recommended way:
     * enabled: process.env.NODE_ENV === 'development',
     *
     * @default true
     */
    enabled?: boolean;
    /**
     * Force React Scan to run in production (not recommended)
     *
     * @default false
     */
    dangerouslyForceRunInProduction?: boolean;
    /**
     * Log renders to the console
     *
     * WARNING: This can add significant overhead when the app re-renders frequently
     *
     * @default false
     */
    log?: boolean;
    /**
     * Show toolbar bar
     *
     * If you set this to true, and set {@link enabled} to false, the toolbar will still show, but scanning will be disabled.
     *
     * @default true
     */
    showToolbar?: boolean;
    /**
     * Animation speed
     *
     * @default "fast"
     */
    animationSpeed?: 'slow' | 'fast' | 'off';
    /**
     * Track unnecessary renders, and mark their outlines gray when detected
     *
     * An unnecessary render is defined as the component re-rendering with no change to the component's
     * corresponding dom subtree
     *
     *  @default false
     *  @warning tracking unnecessary renders can add meaningful overhead to react-scan
     */
    trackUnnecessaryRenders?: boolean;
    /**
     * Should the FPS meter show in the toolbar
     *
     *  @default true
     */
    showFPS?: boolean;
    /**
     * Should the number of slowdown notifications be shown in the toolbar
     *
     *  @default true
     */
    showNotificationCount?: boolean;
    /**
     * Allow React Scan to run inside iframes
     *
     * @default false
     */
    allowInIframe?: boolean;
    /**
     * Should react scan log internal errors to the console.
     *
     * Useful if react scan is not behaving expected and you want to provide information to maintainers when submitting an issue https://github.com/aidenybai/react-scan/issues
     *
     *  @default false
     */
    _debug?: 'verbose' | false;
    onCommitStart?: () => void;
    onRender?: (fiber: Fiber, renders: Array<Render>) => void;
    onCommitFinish?: () => void;
}
interface StoreType {
    inspectState: Signal<States>;
    wasDetailsOpen: Signal<boolean>;
    lastReportTime: Signal<number>;
    isInIframe: Signal<boolean>;
    fiberRoots: WeakSet<Fiber>;
    reportData: Map<number, RenderData>;
    legacyReportData: Map<string, RenderData>;
    changesListeners: Map<number, Array<ChangesListener>>;
    interactionListeningForRenders: ((fiber: Fiber, renders: Array<Render>) => void) | null;
}
type OutlineKey = `${string}-${string}`;
interface Internals {
    instrumentation: ReturnType<typeof createInstrumentation> | null;
    componentAllowList: WeakMap<ComponentType<unknown>, Options> | null;
    options: Signal<Options>;
    onRender: ((fiber: Fiber, renders: Array<Render>) => void) | null;
    Store: StoreType;
    version: string;
    runInAllEnvironments: boolean;
}
type FunctionalComponentStateChange = {
    type: ChangeReason.FunctionalState;
    value: unknown;
    prevValue?: unknown;
    count?: number | undefined;
    name: string;
};
type ClassComponentStateChange = {
    type: ChangeReason.ClassState;
    value: unknown;
    prevValue?: unknown;
    count?: number | undefined;
    name: 'state';
};
type StateChange = FunctionalComponentStateChange | ClassComponentStateChange;
type PropsChange = {
    type: ChangeReason.Props;
    name: string;
    value: unknown;
    prevValue?: unknown;
    count?: number | undefined;
};
type ContextChange = {
    type: ChangeReason.Context;
    name: string;
    value: unknown;
    prevValue?: unknown;
    count?: number | undefined;
    contextType: number;
};
type Change = StateChange | PropsChange | ContextChange;
type ChangesPayload = {
    propsChanges: Array<PropsChange>;
    stateChanges: Array<FunctionalComponentStateChange | ClassComponentStateChange>;
    contextChanges: Array<ContextChange>;
};
type ChangesListener = (changes: ChangesPayload) => void;
declare const Store: StoreType;
declare const ReactScanInternals: Internals;
type LocalStorageOptions = Omit<Options, 'onCommitStart' | 'onRender' | 'onCommitFinish'>;
declare const getReport: (type?: ComponentType<unknown>) => RenderData | Map<string, RenderData> | null;
declare const setOptions: (userOptions: Partial<Options>) => {
    enabled?: boolean;
    dangerouslyForceRunInProduction?: boolean;
    log?: boolean;
    showToolbar?: boolean;
    animationSpeed?: "slow" | "fast" | "off";
    trackUnnecessaryRenders?: boolean;
    showFPS?: boolean;
    showNotificationCount?: boolean;
    allowInIframe?: boolean;
    _debug?: "verbose" | false;
    onCommitStart?: () => void;
    onRender?: (fiber: Fiber, renders: Array<Render>) => void;
    onCommitFinish?: () => void;
} | undefined;
declare const getOptions: () => Signal<Options>;
declare const getIsProduction: () => boolean | null;
declare const start: () => void;
declare const scan: (options?: Options) => void;
declare const useScan: (options?: Options) => void;
declare const onRender: (type: unknown, _onRender: (fiber: Fiber, renders: Array<Render>) => void) => void;
declare const ignoredProps: WeakSet<object | preact.VNode<any>>;
declare const ignoreScan: (node: ReactNode) => void;

export { type Change, type ChangesListener, type ChangesPayload, type ClassComponentStateChange, type ContextChange, type FunctionalComponentStateChange, type Internals, type LocalStorageOptions, type Options, type OutlineKey, type PropsChange, ReactScanInternals, type StateChange, Store, type StoreType, getIsProduction, getOptions, getReport, ignoreScan, ignoredProps, onRender, scan, setOptions, start, useScan };
