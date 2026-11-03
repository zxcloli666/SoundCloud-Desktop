/**
 * Configuration of a proxy that a Client should pass requests to.
 *
 * @since 2.0.0
 */
export interface Proxy {
    /**
     * Proxy all traffic to the passed URL.
     */
    all?: string | ProxyConfig;
    /**
     * Proxy all HTTP traffic to the passed URL.
     */
    http?: string | ProxyConfig;
    /**
     * Proxy all HTTPS traffic to the passed URL.
     */
    https?: string | ProxyConfig;
}
/**
 * Detailed configuration of a single proxy server, used when a plain URL string is not enough.
 *
 * @since 2.0.0
 */
export interface ProxyConfig {
    /**
     * The URL of the proxy server.
     */
    url: string;
    /**
     * Set the `Proxy-Authorization` header using Basic auth.
     */
    basicAuth?: {
        /**
         * The user name sent to the proxy server.
         */
        username: string;
        /**
         * The password sent to the proxy server.
         */
        password: string;
    };
    /**
     * A configuration for filtering out requests that shouldn't be proxied.
     * Entries are expected to be comma-separated (whitespace between entries is ignored)
     */
    noProxy?: string;
}
/**
 * Options to configure the Rust client used to make fetch requests
 *
 * @since 2.0.0
 */
export interface ClientOptions {
    /**
     * Defines the maximum number of redirects the client should follow.
     * If set to 0, no redirects will be followed.
     *
     * When the `scopeRedirects` plugin configuration is enabled, every redirect must
     * also be allowed by the configured scope, otherwise the request fails
     * instead of being followed.
     */
    maxRedirections?: number;
    /** Timeout in milliseconds */
    connectTimeout?: number;
    /**
     * Configuration of a proxy that a Client should pass requests to.
     */
    proxy?: Proxy;
    /**
     * Configuration for dangerous settings on the client such as disabling SSL verification.
     */
    danger?: DangerousSettings;
}
/**
 * Configuration for dangerous settings on the client such as disabling SSL verification.
 *
 * @since 2.3.0
 */
export interface DangerousSettings {
    /**
     * Disables SSL verification.
     */
    acceptInvalidCerts?: boolean;
    /**
     * Disables hostname verification.
     */
    acceptInvalidHostnames?: boolean;
}
/**
 * Fetch a resource from the network. It returns a `Promise` that resolves to the
 * `Response` to that `Request`, whether it is successful or not.
 *
 * The request is performed by the Rust backend instead of the webview, so it is not subject to
 * CORS, but the URL must be allowed by the plugin scope.
 *
 * @example
 * ```typescript
 * import { fetch } from '@tauri-apps/plugin-http';
 * const response = await fetch("http://my.json.host/data.json");
 * console.log(response.status);  // e.g. 200
 * console.log(response.statusText); // e.g. "OK"
 * const jsonData = await response.json();
 * ```
 *
 * @param input The resource to fetch, as a URL, a string or a `Request` object.
 * @param init The standard `fetch` request options, extended with the Rust client options from
 * {@linkcode ClientOptions}: `maxRedirections`, `connectTimeout`, `proxy` and `danger`. The
 * `signal` option can be used to abort the request.
 * @returns A promise resolving to the `Response` of the request.
 *
 * @since 2.0.0
 */
export declare function fetch(input: URL | Request | string, init?: RequestInit & ClientOptions): Promise<Response>;
