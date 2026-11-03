'use client';
(function (exports) {
  'use strict';

  /**
   * Copyright 2025 Aiden Bai, Million Software, Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
   * and associated documentation files (the “Software”), to deal in the Software without restriction,
   * including without limitation the rights to use, copy, modify, merge, publish, distribute,
   * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all copies or
   * substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
   * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
   * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   */

  // ../../node_modules/.pnpm/bippy@0.5.30_@types+react@18.3.23_react@19.0.0/node_modules/bippy/dist/rdt-hook-BvBEbB9n.js
  var e = `0.5.30`;
  var t = `bippy-${e}`;
  var n = Object.defineProperty;
  var r = Object.prototype.hasOwnProperty;
  var i = () => {
  };
  var a = (e2) => {
    try {
      let t2 = Function.prototype.toString.call(e2);
      t2.indexOf(`^_^`) > -1 && setTimeout(() => {
        throw Error(`React is running in production mode, but dead code elimination has not been applied. Read how to correctly configure React for production: https://reactjs.org/link/perf-use-production-build`);
      });
    } catch {
    }
  };
  var o = (e2 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) => !!(e2 && `getFiberRoots` in e2);
  var s = false;
  var c;
  var l = (e2 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) => s ? true : (e2 && typeof e2.inject == `function` && (c = e2.inject.toString()), !!c?.includes(`(injected)`));
  var u = /* @__PURE__ */ new Set();
  var d = /* @__PURE__ */ new Set();
  var f = (e2) => {
    let r2 = /* @__PURE__ */ new Map(), o3 = 0, s3 = { _instrumentationIsActive: false, _instrumentationSource: t, checkDCE: a, hasUnsupportedRendererAttached: false, inject(e3) {
      let t2 = ++o3;
      return r2.set(t2, e3), d.add(e3), s3._instrumentationIsActive || (s3._instrumentationIsActive = true, u.forEach((e4) => e4())), t2;
    }, on: i, onCommitFiberRoot: i, onCommitFiberUnmount: i, onPostCommitFiberRoot: i, renderers: r2, supportsFiber: true, supportsFlight: true };
    try {
      n(globalThis, `__REACT_DEVTOOLS_GLOBAL_HOOK__`, { configurable: true, enumerable: true, get() {
        return s3;
      }, set(t3) {
        if (t3 && typeof t3 == `object`) {
          let n2 = s3.renderers;
          s3 = t3, n2.size > 0 && (n2.forEach((e3, n3) => {
            d.add(e3), t3.renderers.set(n3, e3);
          }), p(e2));
        }
      } });
      let t2 = window.hasOwnProperty, r3 = false;
      n(window, `hasOwnProperty`, { configurable: true, value: function(...e3) {
        try {
          if (!r3 && e3[0] === `__REACT_DEVTOOLS_GLOBAL_HOOK__`) return globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = void 0, r3 = true, -0;
        } catch {
        }
        return t2.apply(this, e3);
      }, writable: true });
    } catch {
      p(e2);
    }
    return s3;
  };
  var p = (e2) => {
    e2 && u.add(e2);
    try {
      let n2 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!n2) return;
      if (!n2._instrumentationSource) {
        n2.checkDCE = a, n2.supportsFiber = true, n2.supportsFlight = true, n2.hasUnsupportedRendererAttached = false, n2._instrumentationSource = t, n2._instrumentationIsActive = false;
        let e3 = o(n2);
        if (e3 || (n2.on = i), n2.renderers.size) {
          n2._instrumentationIsActive = true, u.forEach((e4) => e4());
          return;
        }
        let r2 = n2.inject, c3 = l(n2);
        if (c3 && !e3) {
          s = true;
          let e4 = n2.inject({ scheduleRefresh() {
          } });
          e4 && (n2._instrumentationIsActive = true);
        }
        n2.inject = (e4) => {
          let t2 = r2(e4);
          return d.add(e4), c3 && n2.renderers.set(t2, e4), n2._instrumentationIsActive = true, u.forEach((e5) => e5()), t2;
        };
      }
      (n2.renderers.size || n2._instrumentationIsActive || l()) && e2?.();
    } catch {
    }
  };
  var m = () => r.call(globalThis, `__REACT_DEVTOOLS_GLOBAL_HOOK__`);
  var h = (e2) => m() ? (p(e2), globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) : f(e2);
  var g = () => !!(typeof window < `u` && (window.document?.createElement || window.navigator?.product === `ReactNative`));
  var _ = () => {
    try {
      g() && h();
    } catch {
    }
  };

  // ../../node_modules/.pnpm/bippy@0.5.30_@types+react@18.3.23_react@19.0.0/node_modules/bippy/dist/install-hook-only-TrTYr6LK.js
  _();
  /*! Bundled license information:

  bippy/dist/rdt-hook-BvBEbB9n.js:
  bippy/dist/install-hook-only-TrTYr6LK.js:
  bippy/dist/core-DrcMh8Kr.js:
  bippy/dist/index.js:
    (**
     * @license bippy
     *
     * Copyright (c) Aiden Bai
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     *)
  */

  exports.init = h;

  return exports;

})({});
