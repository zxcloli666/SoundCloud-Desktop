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

  // src/polyfills.ts
  if (!Array.prototype.toSorted) {
    Object.defineProperty(Array.prototype, "toSorted", {
      value: function(compareFn) {
        return [...this].sort(compareFn);
      },
      writable: true,
      configurable: true
    });
  }

  // ../../node_modules/.pnpm/bippy@0.5.30_@types+react@18.3.23_react@19.0.0/node_modules/bippy/dist/rdt-hook-BvBEbB9n.js
  var e = `0.5.30`;
  var t = `bippy-${e}`;
  var n = Object.defineProperty;
  var r = Object.prototype.hasOwnProperty;
  var i = () => {
  };
  var a = (e5) => {
    try {
      let t5 = Function.prototype.toString.call(e5);
      t5.indexOf(`^_^`) > -1 && setTimeout(() => {
        throw Error(`React is running in production mode, but dead code elimination has not been applied. Read how to correctly configure React for production: https://reactjs.org/link/perf-use-production-build`);
      });
    } catch {
    }
  };
  var o = (e5 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) => !!(e5 && `getFiberRoots` in e5);
  var s = false;
  var c;
  var l = (e5 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) => s ? true : (e5 && typeof e5.inject == `function` && (c = e5.inject.toString()), !!c?.includes(`(injected)`));
  var u = /* @__PURE__ */ new Set();
  var d = /* @__PURE__ */ new Set();
  var f = (e5) => {
    let r6 = /* @__PURE__ */ new Map(), o6 = 0, s7 = { _instrumentationIsActive: false, _instrumentationSource: t, checkDCE: a, hasUnsupportedRendererAttached: false, inject(e6) {
      let t5 = ++o6;
      return r6.set(t5, e6), d.add(e6), s7._instrumentationIsActive || (s7._instrumentationIsActive = true, u.forEach((e7) => e7())), t5;
    }, on: i, onCommitFiberRoot: i, onCommitFiberUnmount: i, onPostCommitFiberRoot: i, renderers: r6, supportsFiber: true, supportsFlight: true };
    try {
      n(globalThis, `__REACT_DEVTOOLS_GLOBAL_HOOK__`, { configurable: true, enumerable: true, get() {
        return s7;
      }, set(t6) {
        if (t6 && typeof t6 == `object`) {
          let n4 = s7.renderers;
          s7 = t6, n4.size > 0 && (n4.forEach((e6, n5) => {
            d.add(e6), t6.renderers.set(n5, e6);
          }), p(e5));
        }
      } });
      let t5 = window.hasOwnProperty, r7 = false;
      n(window, `hasOwnProperty`, { configurable: true, value: function(...e6) {
        try {
          if (!r7 && e6[0] === `__REACT_DEVTOOLS_GLOBAL_HOOK__`) return globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = void 0, r7 = true, -0;
        } catch {
        }
        return t5.apply(this, e6);
      }, writable: true });
    } catch {
      p(e5);
    }
    return s7;
  };
  var p = (e5) => {
    e5 && u.add(e5);
    try {
      let n4 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!n4) return;
      if (!n4._instrumentationSource) {
        n4.checkDCE = a, n4.supportsFiber = true, n4.supportsFlight = true, n4.hasUnsupportedRendererAttached = false, n4._instrumentationSource = t, n4._instrumentationIsActive = false;
        let e6 = o(n4);
        if (e6 || (n4.on = i), n4.renderers.size) {
          n4._instrumentationIsActive = true, u.forEach((e7) => e7());
          return;
        }
        let r6 = n4.inject, c6 = l(n4);
        if (c6 && !e6) {
          s = true;
          let e7 = n4.inject({ scheduleRefresh() {
          } });
          e7 && (n4._instrumentationIsActive = true);
        }
        n4.inject = (e7) => {
          let t5 = r6(e7);
          return d.add(e7), c6 && n4.renderers.set(t5, e7), n4._instrumentationIsActive = true, u.forEach((e8) => e8()), t5;
        };
      }
      (n4.renderers.size || n4._instrumentationIsActive || l()) && e5?.();
    } catch {
    }
  };
  var m = () => r.call(globalThis, `__REACT_DEVTOOLS_GLOBAL_HOOK__`);
  var h = (e5) => m() ? (p(e5), globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) : f(e5);
  var g = () => !!(typeof window < `u` && (window.document?.createElement || window.navigator?.product === `ReactNative`));
  var _ = () => {
    try {
      g() && h();
    } catch {
    }
  };

  // ../../node_modules/.pnpm/bippy@0.5.30_@types+react@18.3.23_react@19.0.0/node_modules/bippy/dist/install-hook-only-TrTYr6LK.js
  _();

  // ../../node_modules/.pnpm/bippy@0.5.30_@types+react@18.3.23_react@19.0.0/node_modules/bippy/dist/core-DrcMh8Kr.js
  var a2 = 0;
  var o2 = 1;
  var s2 = 3;
  var c2 = 5;
  var l2 = 6;
  var u2 = 7;
  var d2 = 9;
  var f2 = 11;
  var p2 = 13;
  var m2 = 14;
  var h2 = 15;
  var g2 = 18;
  var _2 = 22;
  var v = 23;
  var y = 26;
  var b = 27;
  var x = 60111;
  var w = `Symbol(react.concurrent_mode)`;
  var T = `Symbol(react.async_mode)`;
  var E = 1;
  var ie = 2;
  var ae = 4096;
  var oe = 4;
  var D = 8;
  var se = 16;
  var ce = 32;
  var le = 1024;
  var ue = 8192;
  var O = ie | oe | se | ce | ae | ue | le;
  var k = (e5) => {
    switch (e5.tag) {
      case c2:
      case y:
      case b:
        return true;
      default:
        return typeof e5.type == `string`;
    }
  };
  var pe = (e5) => {
    switch (e5.tag) {
      case o2:
      case f2:
      case a2:
      case m2:
      case h2:
        return true;
      default:
        return false;
    }
  };
  var ge = (e5, t5) => {
    try {
      let n4 = e5.dependencies, r6 = e5.alternate?.dependencies;
      if (!n4 || !r6 || typeof n4 != `object` || !(`firstContext` in n4) || typeof r6 != `object` || !(`firstContext` in r6)) return false;
      let i6 = n4.firstContext, a6 = r6.firstContext;
      for (; i6 && typeof i6 == `object` && `memoizedValue` in i6 || a6 && typeof a6 == `object` && `memoizedValue` in a6; ) {
        if (t5(i6, a6) === true) return true;
        i6 = i6?.next, a6 = a6?.next;
      }
    } catch {
    }
    return false;
  };
  var A = (e5) => {
    let t5 = e5.memoizedProps, n4 = e5.alternate?.memoizedProps || {}, r6 = e5.flags ?? e5.effectTag ?? 0;
    switch (e5.tag) {
      case o2:
      case d2:
      case f2:
      case a2:
      case m2:
      case h2:
        return (r6 & E) === E;
      default:
        return e5.alternate ? n4 !== t5 || e5.alternate.memoizedState !== e5.memoizedState || e5.alternate.ref !== e5.ref : true;
    }
  };
  var j = (e5) => (e5.flags & (O | D)) !== 0 || (e5.subtreeFlags & (O | D)) !== 0;
  var ye = (e5) => {
    let t5 = [], n4 = [e5];
    for (; n4.length; ) {
      let e6 = n4.pop();
      e6 && (k(e6) && j(e6) && A(e6) && t5.push(e6), e6.child && n4.push(e6.child), e6.sibling && n4.push(e6.sibling));
    }
    return t5;
  };
  var M = (e5) => {
    switch (e5.tag) {
      case g2:
        return true;
      case u2:
      case l2:
      case v:
      case _2:
        return true;
      case s2:
        return false;
      default: {
        let t5 = typeof e5.type == `object` && e5.type !== null ? e5.type.$$typeof : e5.type, n4 = typeof t5 == `symbol` ? t5.toString() : t5;
        switch (n4) {
          case x:
          case w:
          case T:
            return true;
          default:
            return false;
        }
      }
    }
  };
  var Se = (e5) => {
    let t5 = [], n4 = [];
    for (k(e5) ? t5.push(e5) : e5.child && n4.push(e5.child); n4.length; ) {
      let e6 = n4.pop();
      if (!e6) break;
      k(e6) ? t5.push(e6) : e6.child && n4.push(e6.child), e6.sibling && n4.push(e6.sibling);
    }
    return t5;
  };
  function N(e5, t5, n4 = false) {
    if (!e5) return null;
    let r6 = t5(e5);
    if (r6 instanceof Promise) return (async () => {
      if (await r6 === true) return e5;
      let i7 = n4 ? e5.return : e5.child;
      for (; i7; ) {
        let e6 = await F(i7, t5, n4);
        if (e6) return e6;
        i7 = n4 ? null : i7.sibling;
      }
      return null;
    })();
    if (r6 === true) return e5;
    let i6 = n4 ? e5.return : e5.child;
    for (; i6; ) {
      let e6 = P(i6, t5, n4);
      if (e6) return e6;
      i6 = n4 ? null : i6.sibling;
    }
    return null;
  }
  var P = (e5, t5, n4 = false) => {
    if (!e5) return null;
    if (t5(e5) === true) return e5;
    let r6 = n4 ? e5.return : e5.child;
    for (; r6; ) {
      let e6 = P(r6, t5, n4);
      if (e6) return e6;
      r6 = n4 ? null : r6.sibling;
    }
    return null;
  };
  var F = async (e5, t5, n4 = false) => {
    if (!e5) return null;
    if (await t5(e5) === true) return e5;
    let r6 = n4 ? e5.return : e5.child;
    for (; r6; ) {
      let e6 = await F(r6, t5, n4);
      if (e6) return e6;
      r6 = n4 ? null : r6.sibling;
    }
    return null;
  };
  var Ce = (e5) => {
    let t5 = e5?.actualDuration ?? 0, n4 = t5, r6 = e5?.child ?? null;
    for (; t5 > 0 && r6 != null; ) n4 -= r6.actualDuration ?? 0, r6 = r6.sibling;
    return { selfTime: n4, totalTime: t5 };
  };
  var we = (e5) => !!e5.updateQueue?.memoCache;
  var I = (e5) => {
    let t5 = e5;
    return typeof t5 == `function` ? t5 : typeof t5 == `object` && t5 ? I(t5.type || t5.render) : null;
  };
  var Te = (e5) => {
    let t5 = e5;
    if (typeof t5 == `string`) return t5;
    if (typeof t5 != `function` && !(typeof t5 == `object` && t5)) return null;
    let n4 = t5.displayName || t5.name || null;
    if (n4) return n4;
    let r6 = I(t5);
    return r6 && (r6.displayName || r6.name) || null;
  };
  var L = (e5) => {
    try {
      if (typeof e5.version == `string` && e5.bundleType > 0) return `development`;
    } catch {
    }
    return `production`;
  };
  var Ee = () => {
    let e5 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    return !!e5?._instrumentationIsActive || o(e5) || l(e5);
  };
  var R = 0;
  var z = /* @__PURE__ */ new WeakMap();
  var B = (e5, t5 = R++) => {
    z.set(e5, t5);
  };
  var V = (e5) => {
    let t5 = z.get(e5);
    return !t5 && e5.alternate && (t5 = z.get(e5.alternate)), t5 || (t5 = R++, B(e5, t5)), t5;
  };
  var H = (e5, t5, n4) => {
    let r6 = t5;
    for (; r6 != null; ) {
      z.has(r6) || V(r6);
      let t6 = !M(r6);
      if (t6 && A(r6) && e5(r6, `mount`), r6.tag === p2) {
        let t7 = r6.memoizedState !== null;
        if (t7) {
          let t8 = r6.child, n5 = t8 ? t8.sibling : null;
          if (n5) {
            let t9 = n5.child;
            t9 !== null && H(e5, t9, false);
          }
        } else {
          let t8 = null;
          r6.child !== null && (t8 = r6.child.child), t8 !== null && H(e5, t8, false);
        }
      } else r6.child != null && H(e5, r6.child, true);
      r6 = n4 ? r6.sibling : null;
    }
  };
  var U = (e5, t5, n4, r6) => {
    if (z.has(t5) || V(t5), !n4) return;
    z.has(n4) || V(n4);
    let i6 = t5.tag === p2, a6 = !M(t5);
    a6 && A(t5) && e5(t5, `update`);
    let o6 = i6 && n4.memoizedState !== null, s7 = i6 && t5.memoizedState !== null;
    if (o6 && s7) {
      let r7 = t5.child?.sibling ?? null, i7 = n4.child?.sibling ?? null;
      r7 !== null && i7 !== null && U(e5, r7, i7);
    } else if (o6 && !s7) {
      let n5 = t5.child;
      n5 !== null && H(e5, n5, true);
    } else if (!o6 && s7) {
      G(e5, n4);
      let r7 = t5.child?.sibling ?? null;
      r7 !== null && H(e5, r7, true);
    } else if (t5.child !== n4.child) {
      let n5 = t5.child;
      for (; n5; ) {
        if (n5.alternate) {
          let i7 = n5.alternate;
          U(e5, n5, i7);
        } else H(e5, n5, false);
        n5 = n5.sibling;
      }
    }
  };
  var W = (e5, t5) => {
    let n4 = t5.tag === s2;
    (n4 || !M(t5)) && e5(t5, `unmount`);
  };
  var G = (e5, t5) => {
    let n4 = t5.tag === p2 && t5.memoizedState !== null, r6 = t5.child;
    if (n4) {
      let e6 = t5.child, n5 = e6?.sibling ?? null;
      r6 = n5?.child ?? null;
    }
    for (; r6 !== null; ) r6.return !== null && (W(e5, r6), G(e5, r6)), r6 = r6.sibling;
  };
  var Oe = 0;
  var K = /* @__PURE__ */ new WeakMap();
  var ke = (e5, t5) => {
    let n4 = `current` in e5 ? e5.current : e5, r6 = K.get(e5);
    r6 || (r6 = { id: Oe++, prevFiber: null }, K.set(e5, r6));
    let { prevFiber: i6 } = r6;
    if (!n4) W(t5, n4);
    else if (i6 !== null) {
      let e6 = i6 && i6.memoizedState != null && i6.memoizedState.element != null && i6.memoizedState.isDehydrated !== true, r7 = n4.memoizedState != null && n4.memoizedState.element != null && n4.memoizedState.isDehydrated !== true;
      !e6 && r7 ? H(t5, n4, false) : e6 && r7 ? U(t5, n4, n4.alternate) : e6 && !r7 && W(t5, n4);
    } else H(t5, n4, true);
    r6.prevFiber = n4;
  };
  var Ne = (n4) => {
    let r6 = h(n4.onActive);
    r6._instrumentationSource = n4.name ?? t;
    let i6 = r6.onCommitFiberRoot;
    if (n4.onCommitFiberRoot) {
      let e5 = (t5, r7, a7) => {
        i6 !== e5 && (i6?.(t5, r7, a7), n4.onCommitFiberRoot?.(t5, r7, a7));
      };
      r6.onCommitFiberRoot = e5;
    }
    let a6 = r6.onCommitFiberUnmount;
    if (n4.onCommitFiberUnmount) {
      let e5 = (t5, i7) => {
        r6.onCommitFiberUnmount === e5 && (a6?.(t5, i7), n4.onCommitFiberUnmount?.(t5, i7));
      };
      r6.onCommitFiberUnmount = e5;
    }
    let o6 = r6.onPostCommitFiberRoot;
    if (n4.onPostCommitFiberRoot) {
      let e5 = (t5, i7) => {
        r6.onPostCommitFiberRoot === e5 && (o6?.(t5, i7), n4.onPostCommitFiberRoot?.(t5, i7));
      };
      r6.onPostCommitFiberRoot = e5;
    }
    return r6;
  };

  // src/web/utils/constants.ts
  var IS_CLIENT = typeof window !== "undefined";

  // ../../node_modules/.pnpm/preact@10.26.9/node_modules/preact/dist/preact.module.js
  var n2;
  var l3;
  var u3;
  var t2;
  var i2;
  var r2;
  var o3;
  var e2;
  var f3;
  var c3;
  var s3;
  var a3;
  var h3;
  var p3 = {};
  var v2 = [];
  var y2 = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  var w2 = Array.isArray;
  function d3(n4, l7) {
    for (var u7 in l7) n4[u7] = l7[u7];
    return n4;
  }
  function g3(n4) {
    n4 && n4.parentNode && n4.parentNode.removeChild(n4);
  }
  function _3(l7, u7, t5) {
    var i6, r6, o6, e5 = {};
    for (o6 in u7) "key" == o6 ? i6 = u7[o6] : "ref" == o6 ? r6 = u7[o6] : e5[o6] = u7[o6];
    if (arguments.length > 2 && (e5.children = arguments.length > 3 ? n2.call(arguments, 2) : t5), "function" == typeof l7 && null != l7.defaultProps) for (o6 in l7.defaultProps) void 0 === e5[o6] && (e5[o6] = l7.defaultProps[o6]);
    return m3(l7, e5, i6, r6, null);
  }
  function m3(n4, t5, i6, r6, o6) {
    var e5 = { type: n4, props: t5, key: i6, ref: r6, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o6 ? ++u3 : o6, __i: -1, __u: 0 };
    return null == o6 && null != l3.vnode && l3.vnode(e5), e5;
  }
  function k2(n4) {
    return n4.children;
  }
  function x2(n4, l7) {
    this.props = n4, this.context = l7;
  }
  function S2(n4, l7) {
    if (null == l7) return n4.__ ? S2(n4.__, n4.__i + 1) : null;
    for (var u7; l7 < n4.__k.length; l7++) if (null != (u7 = n4.__k[l7]) && null != u7.__e) return u7.__e;
    return "function" == typeof n4.type ? S2(n4) : null;
  }
  function C2(n4) {
    var l7, u7;
    if (null != (n4 = n4.__) && null != n4.__c) {
      for (n4.__e = n4.__c.base = null, l7 = 0; l7 < n4.__k.length; l7++) if (null != (u7 = n4.__k[l7]) && null != u7.__e) {
        n4.__e = n4.__c.base = u7.__e;
        break;
      }
      return C2(n4);
    }
  }
  function M2(n4) {
    (!n4.__d && (n4.__d = true) && i2.push(n4) && !$2.__r++ || r2 != l3.debounceRendering) && ((r2 = l3.debounceRendering) || o3)($2);
  }
  function $2() {
    for (var n4, u7, t5, r6, o6, f7, c6, s7 = 1; i2.length; ) i2.length > s7 && i2.sort(e2), n4 = i2.shift(), s7 = i2.length, n4.__d && (t5 = void 0, o6 = (r6 = (u7 = n4).__v).__e, f7 = [], c6 = [], u7.__P && ((t5 = d3({}, r6)).__v = r6.__v + 1, l3.vnode && l3.vnode(t5), O2(u7.__P, t5, r6, u7.__n, u7.__P.namespaceURI, 32 & r6.__u ? [o6] : null, f7, null == o6 ? S2(r6) : o6, !!(32 & r6.__u), c6), t5.__v = r6.__v, t5.__.__k[t5.__i] = t5, z2(f7, t5, c6), t5.__e != o6 && C2(t5)));
    $2.__r = 0;
  }
  function I2(n4, l7, u7, t5, i6, r6, o6, e5, f7, c6, s7) {
    var a6, h7, y5, w5, d7, g7, _6 = t5 && t5.__k || v2, m5 = l7.length;
    for (f7 = P2(u7, l7, _6, f7, m5), a6 = 0; a6 < m5; a6++) null != (y5 = u7.__k[a6]) && (h7 = -1 == y5.__i ? p3 : _6[y5.__i] || p3, y5.__i = a6, g7 = O2(n4, y5, h7, i6, r6, o6, e5, f7, c6, s7), w5 = y5.__e, y5.ref && h7.ref != y5.ref && (h7.ref && q(h7.ref, null, y5), s7.push(y5.ref, y5.__c || w5, y5)), null == d7 && null != w5 && (d7 = w5), 4 & y5.__u || h7.__k === y5.__k ? f7 = A2(y5, f7, n4) : "function" == typeof y5.type && void 0 !== g7 ? f7 = g7 : w5 && (f7 = w5.nextSibling), y5.__u &= -7);
    return u7.__e = d7, f7;
  }
  function P2(n4, l7, u7, t5, i6) {
    var r6, o6, e5, f7, c6, s7 = u7.length, a6 = s7, h7 = 0;
    for (n4.__k = new Array(i6), r6 = 0; r6 < i6; r6++) null != (o6 = l7[r6]) && "boolean" != typeof o6 && "function" != typeof o6 ? (f7 = r6 + h7, (o6 = n4.__k[r6] = "string" == typeof o6 || "number" == typeof o6 || "bigint" == typeof o6 || o6.constructor == String ? m3(null, o6, null, null, null) : w2(o6) ? m3(k2, { children: o6 }, null, null, null) : null == o6.constructor && o6.__b > 0 ? m3(o6.type, o6.props, o6.key, o6.ref ? o6.ref : null, o6.__v) : o6).__ = n4, o6.__b = n4.__b + 1, e5 = null, -1 != (c6 = o6.__i = L2(o6, u7, f7, a6)) && (a6--, (e5 = u7[c6]) && (e5.__u |= 2)), null == e5 || null == e5.__v ? (-1 == c6 && (i6 > s7 ? h7-- : i6 < s7 && h7++), "function" != typeof o6.type && (o6.__u |= 4)) : c6 != f7 && (c6 == f7 - 1 ? h7-- : c6 == f7 + 1 ? h7++ : (c6 > f7 ? h7-- : h7++, o6.__u |= 4))) : n4.__k[r6] = null;
    if (a6) for (r6 = 0; r6 < s7; r6++) null != (e5 = u7[r6]) && 0 == (2 & e5.__u) && (e5.__e == t5 && (t5 = S2(e5)), B2(e5, e5));
    return t5;
  }
  function A2(n4, l7, u7) {
    var t5, i6;
    if ("function" == typeof n4.type) {
      for (t5 = n4.__k, i6 = 0; t5 && i6 < t5.length; i6++) t5[i6] && (t5[i6].__ = n4, l7 = A2(t5[i6], l7, u7));
      return l7;
    }
    n4.__e != l7 && (l7 && n4.type && !u7.contains(l7) && (l7 = S2(n4)), u7.insertBefore(n4.__e, l7 || null), l7 = n4.__e);
    do {
      l7 = l7 && l7.nextSibling;
    } while (null != l7 && 8 == l7.nodeType);
    return l7;
  }
  function H2(n4, l7) {
    return l7 = l7 || [], null == n4 || "boolean" == typeof n4 || (w2(n4) ? n4.some(function(n5) {
      H2(n5, l7);
    }) : l7.push(n4)), l7;
  }
  function L2(n4, l7, u7, t5) {
    var i6, r6, o6 = n4.key, e5 = n4.type, f7 = l7[u7];
    if (null === f7 && null == n4.key || f7 && o6 == f7.key && e5 == f7.type && 0 == (2 & f7.__u)) return u7;
    if (t5 > (null != f7 && 0 == (2 & f7.__u) ? 1 : 0)) for (i6 = u7 - 1, r6 = u7 + 1; i6 >= 0 || r6 < l7.length; ) {
      if (i6 >= 0) {
        if ((f7 = l7[i6]) && 0 == (2 & f7.__u) && o6 == f7.key && e5 == f7.type) return i6;
        i6--;
      }
      if (r6 < l7.length) {
        if ((f7 = l7[r6]) && 0 == (2 & f7.__u) && o6 == f7.key && e5 == f7.type) return r6;
        r6++;
      }
    }
    return -1;
  }
  function T2(n4, l7, u7) {
    "-" == l7[0] ? n4.setProperty(l7, null == u7 ? "" : u7) : n4[l7] = null == u7 ? "" : "number" != typeof u7 || y2.test(l7) ? u7 : u7 + "px";
  }
  function j2(n4, l7, u7, t5, i6) {
    var r6, o6;
    n: if ("style" == l7) if ("string" == typeof u7) n4.style.cssText = u7;
    else {
      if ("string" == typeof t5 && (n4.style.cssText = t5 = ""), t5) for (l7 in t5) u7 && l7 in u7 || T2(n4.style, l7, "");
      if (u7) for (l7 in u7) t5 && u7[l7] == t5[l7] || T2(n4.style, l7, u7[l7]);
    }
    else if ("o" == l7[0] && "n" == l7[1]) r6 = l7 != (l7 = l7.replace(f3, "$1")), o6 = l7.toLowerCase(), l7 = o6 in n4 || "onFocusOut" == l7 || "onFocusIn" == l7 ? o6.slice(2) : l7.slice(2), n4.l || (n4.l = {}), n4.l[l7 + r6] = u7, u7 ? t5 ? u7.u = t5.u : (u7.u = c3, n4.addEventListener(l7, r6 ? a3 : s3, r6)) : n4.removeEventListener(l7, r6 ? a3 : s3, r6);
    else {
      if ("http://www.w3.org/2000/svg" == i6) l7 = l7.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if ("width" != l7 && "height" != l7 && "href" != l7 && "list" != l7 && "form" != l7 && "tabIndex" != l7 && "download" != l7 && "rowSpan" != l7 && "colSpan" != l7 && "role" != l7 && "popover" != l7 && l7 in n4) try {
        n4[l7] = null == u7 ? "" : u7;
        break n;
      } catch (n5) {
      }
      "function" == typeof u7 || (null == u7 || false === u7 && "-" != l7[4] ? n4.removeAttribute(l7) : n4.setAttribute(l7, "popover" == l7 && 1 == u7 ? "" : u7));
    }
  }
  function F2(n4) {
    return function(u7) {
      if (this.l) {
        var t5 = this.l[u7.type + n4];
        if (null == u7.t) u7.t = c3++;
        else if (u7.t < t5.u) return;
        return t5(l3.event ? l3.event(u7) : u7);
      }
    };
  }
  function O2(n4, u7, t5, i6, r6, o6, e5, f7, c6, s7) {
    var a6, h7, p7, v6, y5, _6, m5, b4, S3, C5, M4, $4, P5, A5, H4, L3, T5, j5 = u7.type;
    if (null != u7.constructor) return null;
    128 & t5.__u && (c6 = !!(32 & t5.__u), o6 = [f7 = u7.__e = t5.__e]), (a6 = l3.__b) && a6(u7);
    n: if ("function" == typeof j5) try {
      if (b4 = u7.props, S3 = "prototype" in j5 && j5.prototype.render, C5 = (a6 = j5.contextType) && i6[a6.__c], M4 = a6 ? C5 ? C5.props.value : a6.__ : i6, t5.__c ? m5 = (h7 = u7.__c = t5.__c).__ = h7.__E : (S3 ? u7.__c = h7 = new j5(b4, M4) : (u7.__c = h7 = new x2(b4, M4), h7.constructor = j5, h7.render = D2), C5 && C5.sub(h7), h7.props = b4, h7.state || (h7.state = {}), h7.context = M4, h7.__n = i6, p7 = h7.__d = true, h7.__h = [], h7._sb = []), S3 && null == h7.__s && (h7.__s = h7.state), S3 && null != j5.getDerivedStateFromProps && (h7.__s == h7.state && (h7.__s = d3({}, h7.__s)), d3(h7.__s, j5.getDerivedStateFromProps(b4, h7.__s))), v6 = h7.props, y5 = h7.state, h7.__v = u7, p7) S3 && null == j5.getDerivedStateFromProps && null != h7.componentWillMount && h7.componentWillMount(), S3 && null != h7.componentDidMount && h7.__h.push(h7.componentDidMount);
      else {
        if (S3 && null == j5.getDerivedStateFromProps && b4 !== v6 && null != h7.componentWillReceiveProps && h7.componentWillReceiveProps(b4, M4), !h7.__e && null != h7.shouldComponentUpdate && false === h7.shouldComponentUpdate(b4, h7.__s, M4) || u7.__v == t5.__v) {
          for (u7.__v != t5.__v && (h7.props = b4, h7.state = h7.__s, h7.__d = false), u7.__e = t5.__e, u7.__k = t5.__k, u7.__k.some(function(n5) {
            n5 && (n5.__ = u7);
          }), $4 = 0; $4 < h7._sb.length; $4++) h7.__h.push(h7._sb[$4]);
          h7._sb = [], h7.__h.length && e5.push(h7);
          break n;
        }
        null != h7.componentWillUpdate && h7.componentWillUpdate(b4, h7.__s, M4), S3 && null != h7.componentDidUpdate && h7.__h.push(function() {
          h7.componentDidUpdate(v6, y5, _6);
        });
      }
      if (h7.context = M4, h7.props = b4, h7.__P = n4, h7.__e = false, P5 = l3.__r, A5 = 0, S3) {
        for (h7.state = h7.__s, h7.__d = false, P5 && P5(u7), a6 = h7.render(h7.props, h7.state, h7.context), H4 = 0; H4 < h7._sb.length; H4++) h7.__h.push(h7._sb[H4]);
        h7._sb = [];
      } else do {
        h7.__d = false, P5 && P5(u7), a6 = h7.render(h7.props, h7.state, h7.context), h7.state = h7.__s;
      } while (h7.__d && ++A5 < 25);
      h7.state = h7.__s, null != h7.getChildContext && (i6 = d3(d3({}, i6), h7.getChildContext())), S3 && !p7 && null != h7.getSnapshotBeforeUpdate && (_6 = h7.getSnapshotBeforeUpdate(v6, y5)), L3 = a6, null != a6 && a6.type === k2 && null == a6.key && (L3 = N2(a6.props.children)), f7 = I2(n4, w2(L3) ? L3 : [L3], u7, t5, i6, r6, o6, e5, f7, c6, s7), h7.base = u7.__e, u7.__u &= -161, h7.__h.length && e5.push(h7), m5 && (h7.__E = h7.__ = null);
    } catch (n5) {
      if (u7.__v = null, c6 || null != o6) if (n5.then) {
        for (u7.__u |= c6 ? 160 : 128; f7 && 8 == f7.nodeType && f7.nextSibling; ) f7 = f7.nextSibling;
        o6[o6.indexOf(f7)] = null, u7.__e = f7;
      } else for (T5 = o6.length; T5--; ) g3(o6[T5]);
      else u7.__e = t5.__e, u7.__k = t5.__k;
      l3.__e(n5, u7, t5);
    }
    else null == o6 && u7.__v == t5.__v ? (u7.__k = t5.__k, u7.__e = t5.__e) : f7 = u7.__e = V2(t5.__e, u7, t5, i6, r6, o6, e5, c6, s7);
    return (a6 = l3.diffed) && a6(u7), 128 & u7.__u ? void 0 : f7;
  }
  function z2(n4, u7, t5) {
    for (var i6 = 0; i6 < t5.length; i6++) q(t5[i6], t5[++i6], t5[++i6]);
    l3.__c && l3.__c(u7, n4), n4.some(function(u8) {
      try {
        n4 = u8.__h, u8.__h = [], n4.some(function(n5) {
          n5.call(u8);
        });
      } catch (n5) {
        l3.__e(n5, u8.__v);
      }
    });
  }
  function N2(n4) {
    return "object" != typeof n4 || null == n4 || n4.__b && n4.__b > 0 ? n4 : w2(n4) ? n4.map(N2) : d3({}, n4);
  }
  function V2(u7, t5, i6, r6, o6, e5, f7, c6, s7) {
    var a6, h7, v6, y5, d7, _6, m5, b4 = i6.props, k4 = t5.props, x5 = t5.type;
    if ("svg" == x5 ? o6 = "http://www.w3.org/2000/svg" : "math" == x5 ? o6 = "http://www.w3.org/1998/Math/MathML" : o6 || (o6 = "http://www.w3.org/1999/xhtml"), null != e5) {
      for (a6 = 0; a6 < e5.length; a6++) if ((d7 = e5[a6]) && "setAttribute" in d7 == !!x5 && (x5 ? d7.localName == x5 : 3 == d7.nodeType)) {
        u7 = d7, e5[a6] = null;
        break;
      }
    }
    if (null == u7) {
      if (null == x5) return document.createTextNode(k4);
      u7 = document.createElementNS(o6, x5, k4.is && k4), c6 && (l3.__m && l3.__m(t5, e5), c6 = false), e5 = null;
    }
    if (null == x5) b4 === k4 || c6 && u7.data == k4 || (u7.data = k4);
    else {
      if (e5 = e5 && n2.call(u7.childNodes), b4 = i6.props || p3, !c6 && null != e5) for (b4 = {}, a6 = 0; a6 < u7.attributes.length; a6++) b4[(d7 = u7.attributes[a6]).name] = d7.value;
      for (a6 in b4) if (d7 = b4[a6], "children" == a6) ;
      else if ("dangerouslySetInnerHTML" == a6) v6 = d7;
      else if (!(a6 in k4)) {
        if ("value" == a6 && "defaultValue" in k4 || "checked" == a6 && "defaultChecked" in k4) continue;
        j2(u7, a6, null, d7, o6);
      }
      for (a6 in k4) d7 = k4[a6], "children" == a6 ? y5 = d7 : "dangerouslySetInnerHTML" == a6 ? h7 = d7 : "value" == a6 ? _6 = d7 : "checked" == a6 ? m5 = d7 : c6 && "function" != typeof d7 || b4[a6] === d7 || j2(u7, a6, d7, b4[a6], o6);
      if (h7) c6 || v6 && (h7.__html == v6.__html || h7.__html == u7.innerHTML) || (u7.innerHTML = h7.__html), t5.__k = [];
      else if (v6 && (u7.innerHTML = ""), I2("template" == t5.type ? u7.content : u7, w2(y5) ? y5 : [y5], t5, i6, r6, "foreignObject" == x5 ? "http://www.w3.org/1999/xhtml" : o6, e5, f7, e5 ? e5[0] : i6.__k && S2(i6, 0), c6, s7), null != e5) for (a6 = e5.length; a6--; ) g3(e5[a6]);
      c6 || (a6 = "value", "progress" == x5 && null == _6 ? u7.removeAttribute("value") : null != _6 && (_6 !== u7[a6] || "progress" == x5 && !_6 || "option" == x5 && _6 != b4[a6]) && j2(u7, a6, _6, b4[a6], o6), a6 = "checked", null != m5 && m5 != u7[a6] && j2(u7, a6, m5, b4[a6], o6));
    }
    return u7;
  }
  function q(n4, u7, t5) {
    try {
      if ("function" == typeof n4) {
        var i6 = "function" == typeof n4.__u;
        i6 && n4.__u(), i6 && null == u7 || (n4.__u = n4(u7));
      } else n4.current = u7;
    } catch (n5) {
      l3.__e(n5, t5);
    }
  }
  function B2(n4, u7, t5) {
    var i6, r6;
    if (l3.unmount && l3.unmount(n4), (i6 = n4.ref) && (i6.current && i6.current != n4.__e || q(i6, null, u7)), null != (i6 = n4.__c)) {
      if (i6.componentWillUnmount) try {
        i6.componentWillUnmount();
      } catch (n5) {
        l3.__e(n5, u7);
      }
      i6.base = i6.__P = null;
    }
    if (i6 = n4.__k) for (r6 = 0; r6 < i6.length; r6++) i6[r6] && B2(i6[r6], u7, t5 || "function" != typeof n4.type);
    t5 || g3(n4.__e), n4.__c = n4.__ = n4.__e = void 0;
  }
  function D2(n4, l7, u7) {
    return this.constructor(n4, u7);
  }
  function E2(u7, t5, i6) {
    var r6, o6, e5, f7;
    t5 == document && (t5 = document.documentElement), l3.__ && l3.__(u7, t5), o6 = (r6 = "function" == "undefined") ? null : t5.__k, e5 = [], f7 = [], O2(t5, u7 = (t5).__k = _3(k2, null, [u7]), o6 || p3, p3, t5.namespaceURI, o6 ? null : t5.firstChild ? n2.call(t5.childNodes) : null, e5, o6 ? o6.__e : t5.firstChild, r6, f7), z2(e5, u7, f7);
  }
  function K2(n4) {
    function l7(n5) {
      var u7, t5;
      return this.getChildContext || (u7 = /* @__PURE__ */ new Set(), (t5 = {})[l7.__c] = this, this.getChildContext = function() {
        return t5;
      }, this.componentWillUnmount = function() {
        u7 = null;
      }, this.shouldComponentUpdate = function(n6) {
        this.props.value != n6.value && u7.forEach(function(n7) {
          n7.__e = true, M2(n7);
        });
      }, this.sub = function(n6) {
        u7.add(n6);
        var l8 = n6.componentWillUnmount;
        n6.componentWillUnmount = function() {
          u7 && u7.delete(n6), l8 && l8.call(n6);
        };
      }), n5.children;
    }
    return l7.__c = "__cC" + h3++, l7.__ = n4, l7.Provider = l7.__l = (l7.Consumer = function(n5, l8) {
      return n5.children(l8);
    }).contextType = l7, l7;
  }
  n2 = v2.slice, l3 = { __e: function(n4, l7, u7, t5) {
    for (var i6, r6, o6; l7 = l7.__; ) if ((i6 = l7.__c) && !i6.__) try {
      if ((r6 = i6.constructor) && null != r6.getDerivedStateFromError && (i6.setState(r6.getDerivedStateFromError(n4)), o6 = i6.__d), null != i6.componentDidCatch && (i6.componentDidCatch(n4, t5 || {}), o6 = i6.__d), o6) return i6.__E = i6;
    } catch (l8) {
      n4 = l8;
    }
    throw n4;
  } }, u3 = 0, t2 = function(n4) {
    return null != n4 && null == n4.constructor;
  }, x2.prototype.setState = function(n4, l7) {
    var u7;
    u7 = null != this.__s && this.__s != this.state ? this.__s : this.__s = d3({}, this.state), "function" == typeof n4 && (n4 = n4(d3({}, u7), this.props)), n4 && d3(u7, n4), null != n4 && this.__v && (l7 && this._sb.push(l7), M2(this));
  }, x2.prototype.forceUpdate = function(n4) {
    this.__v && (this.__e = true, n4 && this.__h.push(n4), M2(this));
  }, x2.prototype.render = k2, i2 = [], o3 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e2 = function(n4, l7) {
    return n4.__v.__b - l7.__v.__b;
  }, $2.__r = 0, f3 = /(PointerCapture)$|Capture$/i, c3 = 0, s3 = F2(false), a3 = F2(true), h3 = 0;

  // ../../node_modules/.pnpm/preact@10.26.9/node_modules/preact/hooks/dist/hooks.module.js
  var t3;
  var r3;
  var u4;
  var i3;
  var o4 = 0;
  var f4 = [];
  var c4 = l3;
  var e3 = c4.__b;
  var a4 = c4.__r;
  var v3 = c4.diffed;
  var l4 = c4.__c;
  var m4 = c4.unmount;
  var s4 = c4.__;
  function p4(n4, t5) {
    c4.__h && c4.__h(r3, n4, o4 || t5), o4 = 0;
    var u7 = r3.__H || (r3.__H = { __: [], __h: [] });
    return n4 >= u7.__.length && u7.__.push({}), u7.__[n4];
  }
  function d4(n4) {
    return o4 = 1, h4(D3, n4);
  }
  function h4(n4, u7, i6) {
    var o6 = p4(t3++, 2);
    if (o6.t = n4, !o6.__c && (o6.__ = [D3(void 0, u7), function(n5) {
      var t5 = o6.__N ? o6.__N[0] : o6.__[0], r6 = o6.t(t5, n5);
      t5 !== r6 && (o6.__N = [r6, o6.__[1]], o6.__c.setState({}));
    }], o6.__c = r3, !r3.__f)) {
      var f7 = function(n5, t5, r6) {
        if (!o6.__c.__H) return true;
        var u8 = o6.__c.__H.__.filter(function(n6) {
          return !!n6.__c;
        });
        if (u8.every(function(n6) {
          return !n6.__N;
        })) return !c6 || c6.call(this, n5, t5, r6);
        var i7 = o6.__c.props !== n5;
        return u8.forEach(function(n6) {
          if (n6.__N) {
            var t6 = n6.__[0];
            n6.__ = n6.__N, n6.__N = void 0, t6 !== n6.__[0] && (i7 = true);
          }
        }), c6 && c6.call(this, n5, t5, r6) || i7;
      };
      r3.__f = true;
      var c6 = r3.shouldComponentUpdate, e5 = r3.componentWillUpdate;
      r3.componentWillUpdate = function(n5, t5, r6) {
        if (this.__e) {
          var u8 = c6;
          c6 = void 0, f7(n5, t5, r6), c6 = u8;
        }
        e5 && e5.call(this, n5, t5, r6);
      }, r3.shouldComponentUpdate = f7;
    }
    return o6.__N || o6.__;
  }
  function y3(n4, u7) {
    var i6 = p4(t3++, 3);
    !c4.__s && C3(i6.__H, u7) && (i6.__ = n4, i6.u = u7, r3.__H.__h.push(i6));
  }
  function _4(n4, u7) {
    var i6 = p4(t3++, 4);
    !c4.__s && C3(i6.__H, u7) && (i6.__ = n4, i6.u = u7, r3.__h.push(i6));
  }
  function A3(n4) {
    return o4 = 5, T3(function() {
      return { current: n4 };
    }, []);
  }
  function T3(n4, r6) {
    var u7 = p4(t3++, 7);
    return C3(u7.__H, r6) && (u7.__ = n4(), u7.__H = r6, u7.__h = n4), u7.__;
  }
  function q2(n4, t5) {
    return o4 = 8, T3(function() {
      return n4;
    }, t5);
  }
  function x3(n4) {
    var u7 = r3.context[n4.__c], i6 = p4(t3++, 9);
    return i6.c = n4, u7 ? (null == i6.__ && (i6.__ = true, u7.sub(r3)), u7.props.value) : n4.__;
  }
  function j3() {
    for (var n4; n4 = f4.shift(); ) if (n4.__P && n4.__H) try {
      n4.__H.__h.forEach(z3), n4.__H.__h.forEach(B3), n4.__H.__h = [];
    } catch (t5) {
      n4.__H.__h = [], c4.__e(t5, n4.__v);
    }
  }
  c4.__b = function(n4) {
    r3 = null, e3 && e3(n4);
  }, c4.__ = function(n4, t5) {
    n4 && t5.__k && t5.__k.__m && (n4.__m = t5.__k.__m), s4 && s4(n4, t5);
  }, c4.__r = function(n4) {
    a4 && a4(n4), t3 = 0;
    var i6 = (r3 = n4.__c).__H;
    i6 && (u4 === r3 ? (i6.__h = [], r3.__h = [], i6.__.forEach(function(n5) {
      n5.__N && (n5.__ = n5.__N), n5.u = n5.__N = void 0;
    })) : (i6.__h.forEach(z3), i6.__h.forEach(B3), i6.__h = [], t3 = 0)), u4 = r3;
  }, c4.diffed = function(n4) {
    v3 && v3(n4);
    var t5 = n4.__c;
    t5 && t5.__H && (t5.__H.__h.length && (1 !== f4.push(t5) && i3 === c4.requestAnimationFrame || ((i3 = c4.requestAnimationFrame) || w3)(j3)), t5.__H.__.forEach(function(n5) {
      n5.u && (n5.__H = n5.u), n5.u = void 0;
    })), u4 = r3 = null;
  }, c4.__c = function(n4, t5) {
    t5.some(function(n5) {
      try {
        n5.__h.forEach(z3), n5.__h = n5.__h.filter(function(n6) {
          return !n6.__ || B3(n6);
        });
      } catch (r6) {
        t5.some(function(n6) {
          n6.__h && (n6.__h = []);
        }), t5 = [], c4.__e(r6, n5.__v);
      }
    }), l4 && l4(n4, t5);
  }, c4.unmount = function(n4) {
    m4 && m4(n4);
    var t5, r6 = n4.__c;
    r6 && r6.__H && (r6.__H.__.forEach(function(n5) {
      try {
        z3(n5);
      } catch (n6) {
        t5 = n6;
      }
    }), r6.__H = void 0, t5 && c4.__e(t5, r6.__v));
  };
  var k3 = "function" == typeof requestAnimationFrame;
  function w3(n4) {
    var t5, r6 = function() {
      clearTimeout(u7), k3 && cancelAnimationFrame(t5), setTimeout(n4);
    }, u7 = setTimeout(r6, 35);
    k3 && (t5 = requestAnimationFrame(r6));
  }
  function z3(n4) {
    var t5 = r3, u7 = n4.__c;
    "function" == typeof u7 && (n4.__c = void 0, u7()), r3 = t5;
  }
  function B3(n4) {
    var t5 = r3;
    n4.__c = n4.__(), r3 = t5;
  }
  function C3(n4, t5) {
    return !n4 || n4.length !== t5.length || t5.some(function(t6, r6) {
      return t6 !== n4[r6];
    });
  }
  function D3(n4, t5) {
    return "function" == typeof t5 ? t5(n4) : t5;
  }

  // ../../node_modules/.pnpm/@preact+signals-core@1.11.0/node_modules/@preact/signals-core/dist/signals-core.module.js
  var i4 = Symbol.for("preact-signals");
  function t4() {
    if (!(s5 > 1)) {
      var i6, t5 = false;
      while (void 0 !== h5) {
        var r6 = h5;
        h5 = void 0;
        f5++;
        while (void 0 !== r6) {
          var o6 = r6.o;
          r6.o = void 0;
          r6.f &= -3;
          if (!(8 & r6.f) && c5(r6)) try {
            r6.c();
          } catch (r7) {
            if (!t5) {
              i6 = r7;
              t5 = true;
            }
          }
          r6 = o6;
        }
      }
      f5 = 0;
      s5--;
      if (t5) throw i6;
    } else s5--;
  }
  var o5 = void 0;
  function n3(i6) {
    var t5 = o5;
    o5 = void 0;
    try {
      return i6();
    } finally {
      o5 = t5;
    }
  }
  var h5 = void 0;
  var s5 = 0;
  var f5 = 0;
  var v4 = 0;
  function e4(i6) {
    if (void 0 !== o5) {
      var t5 = i6.n;
      if (void 0 === t5 || t5.t !== o5) {
        t5 = { i: 0, S: i6, p: o5.s, n: void 0, t: o5, e: void 0, x: void 0, r: t5 };
        if (void 0 !== o5.s) o5.s.n = t5;
        o5.s = t5;
        i6.n = t5;
        if (32 & o5.f) i6.S(t5);
        return t5;
      } else if (-1 === t5.i) {
        t5.i = 0;
        if (void 0 !== t5.n) {
          t5.n.p = t5.p;
          if (void 0 !== t5.p) t5.p.n = t5.n;
          t5.p = o5.s;
          t5.n = void 0;
          o5.s.n = t5;
          o5.s = t5;
        }
        return t5;
      }
    }
  }
  function u5(i6, t5) {
    this.v = i6;
    this.i = 0;
    this.n = void 0;
    this.t = void 0;
    this.W = null == t5 ? void 0 : t5.watched;
    this.Z = null == t5 ? void 0 : t5.unwatched;
  }
  u5.prototype.brand = i4;
  u5.prototype.h = function() {
    return true;
  };
  u5.prototype.S = function(i6) {
    var t5 = this, r6 = this.t;
    if (r6 !== i6 && void 0 === i6.e) {
      i6.x = r6;
      this.t = i6;
      if (void 0 !== r6) r6.e = i6;
      else n3(function() {
        var i7;
        null == (i7 = t5.W) || i7.call(t5);
      });
    }
  };
  u5.prototype.U = function(i6) {
    var t5 = this;
    if (void 0 !== this.t) {
      var r6 = i6.e, o6 = i6.x;
      if (void 0 !== r6) {
        r6.x = o6;
        i6.e = void 0;
      }
      if (void 0 !== o6) {
        o6.e = r6;
        i6.x = void 0;
      }
      if (i6 === this.t) {
        this.t = o6;
        if (void 0 === o6) n3(function() {
          var i7;
          null == (i7 = t5.Z) || i7.call(t5);
        });
      }
    }
  };
  u5.prototype.subscribe = function(i6) {
    var t5 = this;
    return E3(function() {
      var r6 = t5.value, n4 = o5;
      o5 = void 0;
      try {
        i6(r6);
      } finally {
        o5 = n4;
      }
    });
  };
  u5.prototype.valueOf = function() {
    return this.value;
  };
  u5.prototype.toString = function() {
    return this.value + "";
  };
  u5.prototype.toJSON = function() {
    return this.value;
  };
  u5.prototype.peek = function() {
    var i6 = o5;
    o5 = void 0;
    try {
      return this.value;
    } finally {
      o5 = i6;
    }
  };
  Object.defineProperty(u5.prototype, "value", { get: function() {
    var i6 = e4(this);
    if (void 0 !== i6) i6.i = this.i;
    return this.v;
  }, set: function(i6) {
    if (i6 !== this.v) {
      if (f5 > 100) throw new Error("Cycle detected");
      this.v = i6;
      this.i++;
      v4++;
      s5++;
      try {
        for (var r6 = this.t; void 0 !== r6; r6 = r6.x) r6.t.N();
      } finally {
        t4();
      }
    }
  } });
  function d5(i6, t5) {
    return new u5(i6, t5);
  }
  function c5(i6) {
    for (var t5 = i6.s; void 0 !== t5; t5 = t5.n) if (t5.S.i !== t5.i || !t5.S.h() || t5.S.i !== t5.i) return true;
    return false;
  }
  function a5(i6) {
    for (var t5 = i6.s; void 0 !== t5; t5 = t5.n) {
      var r6 = t5.S.n;
      if (void 0 !== r6) t5.r = r6;
      t5.S.n = t5;
      t5.i = -1;
      if (void 0 === t5.n) {
        i6.s = t5;
        break;
      }
    }
  }
  function l5(i6) {
    var t5 = i6.s, r6 = void 0;
    while (void 0 !== t5) {
      var o6 = t5.p;
      if (-1 === t5.i) {
        t5.S.U(t5);
        if (void 0 !== o6) o6.n = t5.n;
        if (void 0 !== t5.n) t5.n.p = o6;
      } else r6 = t5;
      t5.S.n = t5.r;
      if (void 0 !== t5.r) t5.r = void 0;
      t5 = o6;
    }
    i6.s = r6;
  }
  function y4(i6, t5) {
    u5.call(this, void 0);
    this.x = i6;
    this.s = void 0;
    this.g = v4 - 1;
    this.f = 4;
    this.W = null == t5 ? void 0 : t5.watched;
    this.Z = null == t5 ? void 0 : t5.unwatched;
  }
  y4.prototype = new u5();
  y4.prototype.h = function() {
    this.f &= -3;
    if (1 & this.f) return false;
    if (32 == (36 & this.f)) return true;
    this.f &= -5;
    if (this.g === v4) return true;
    this.g = v4;
    this.f |= 1;
    if (this.i > 0 && !c5(this)) {
      this.f &= -2;
      return true;
    }
    var i6 = o5;
    try {
      a5(this);
      o5 = this;
      var t5 = this.x();
      if (16 & this.f || this.v !== t5 || 0 === this.i) {
        this.v = t5;
        this.f &= -17;
        this.i++;
      }
    } catch (i7) {
      this.v = i7;
      this.f |= 16;
      this.i++;
    }
    o5 = i6;
    l5(this);
    this.f &= -2;
    return true;
  };
  y4.prototype.S = function(i6) {
    if (void 0 === this.t) {
      this.f |= 36;
      for (var t5 = this.s; void 0 !== t5; t5 = t5.n) t5.S.S(t5);
    }
    u5.prototype.S.call(this, i6);
  };
  y4.prototype.U = function(i6) {
    if (void 0 !== this.t) {
      u5.prototype.U.call(this, i6);
      if (void 0 === this.t) {
        this.f &= -33;
        for (var t5 = this.s; void 0 !== t5; t5 = t5.n) t5.S.U(t5);
      }
    }
  };
  y4.prototype.N = function() {
    if (!(2 & this.f)) {
      this.f |= 6;
      for (var i6 = this.t; void 0 !== i6; i6 = i6.x) i6.t.N();
    }
  };
  Object.defineProperty(y4.prototype, "value", { get: function() {
    if (1 & this.f) throw new Error("Cycle detected");
    var i6 = e4(this);
    this.h();
    if (void 0 !== i6) i6.i = this.i;
    if (16 & this.f) throw this.v;
    return this.v;
  } });
  function w4(i6, t5) {
    return new y4(i6, t5);
  }
  function _5(i6) {
    var r6 = i6.u;
    i6.u = void 0;
    if ("function" == typeof r6) {
      s5++;
      var n4 = o5;
      o5 = void 0;
      try {
        r6();
      } catch (t5) {
        i6.f &= -2;
        i6.f |= 8;
        b2(i6);
        throw t5;
      } finally {
        o5 = n4;
        t4();
      }
    }
  }
  function b2(i6) {
    for (var t5 = i6.s; void 0 !== t5; t5 = t5.n) t5.S.U(t5);
    i6.x = void 0;
    i6.s = void 0;
    _5(i6);
  }
  function g4(i6) {
    if (o5 !== this) throw new Error("Out-of-order effect");
    l5(this);
    o5 = i6;
    this.f &= -2;
    if (8 & this.f) b2(this);
    t4();
  }
  function p5(i6) {
    this.x = i6;
    this.u = void 0;
    this.s = void 0;
    this.o = void 0;
    this.f = 32;
  }
  p5.prototype.c = function() {
    var i6 = this.S();
    try {
      if (8 & this.f) return;
      if (void 0 === this.x) return;
      var t5 = this.x();
      if ("function" == typeof t5) this.u = t5;
    } finally {
      i6();
    }
  };
  p5.prototype.S = function() {
    if (1 & this.f) throw new Error("Cycle detected");
    this.f |= 1;
    this.f &= -9;
    _5(this);
    a5(this);
    s5++;
    var i6 = o5;
    o5 = this;
    return g4.bind(this, i6);
  };
  p5.prototype.N = function() {
    if (!(2 & this.f)) {
      this.f |= 2;
      this.o = h5;
      h5 = this;
    }
  };
  p5.prototype.d = function() {
    this.f |= 8;
    if (!(1 & this.f)) b2(this);
  };
  p5.prototype.dispose = function() {
    this.d();
  };
  function E3(i6) {
    var t5 = new p5(i6);
    try {
      t5.c();
    } catch (i7) {
      t5.d();
      throw i7;
    }
    var r6 = t5.d.bind(t5);
    r6[Symbol.dispose] = r6;
    return r6;
  }
  var s6;
  function l6(i6, n4) {
    l3[i6] = n4.bind(null, l3[i6] || function() {
    });
  }
  function d6(i6) {
    if (s6) s6();
    s6 = i6 && i6.S();
  }
  function h6(i6) {
    var r6 = this, f7 = i6.data, o6 = useSignal(f7);
    o6.value = f7;
    var e5 = T3(function() {
      var i7 = r6.__v;
      while (i7 = i7.__) if (i7.__c) {
        i7.__c.__$f |= 4;
        break;
      }
      r6.__$u.c = function() {
        var i8, t5 = r6.__$u.S(), f8 = e5.value;
        t5();
        if (t2(f8) || 3 !== (null == (i8 = r6.base) ? void 0 : i8.nodeType)) {
          r6.__$f |= 1;
          r6.setState({});
        } else r6.base.data = f8;
      };
      return w4(function() {
        var i8 = o6.value.value;
        return 0 === i8 ? 0 : true === i8 ? "" : i8 || "";
      });
    }, []);
    return e5.value;
  }
  h6.displayName = "_st";
  Object.defineProperties(u5.prototype, { constructor: { configurable: true, value: void 0 }, type: { configurable: true, value: h6 }, props: { configurable: true, get: function() {
    return { data: this };
  } }, __b: { configurable: true, value: 1 } });
  l6("__b", function(i6, r6) {
    if ("string" == typeof r6.type) {
      var n4, t5 = r6.props;
      for (var f7 in t5) if ("children" !== f7) {
        var o6 = t5[f7];
        if (o6 instanceof u5) {
          if (!n4) r6.__np = n4 = {};
          n4[f7] = o6;
          t5[f7] = o6.peek();
        }
      }
    }
    i6(r6);
  });
  l6("__r", function(i6, r6) {
    d6();
    var n4, t5 = r6.__c;
    if (t5) {
      t5.__$f &= -2;
      if (void 0 === (n4 = t5.__$u)) t5.__$u = n4 = function(i7) {
        var r7;
        E3(function() {
          r7 = this;
        });
        r7.c = function() {
          t5.__$f |= 1;
          t5.setState({});
        };
        return r7;
      }();
    }
    d6(n4);
    i6(r6);
  });
  l6("__e", function(i6, r6, n4, t5) {
    d6();
    i6(r6, n4, t5);
  });
  l6("diffed", function(i6, r6) {
    d6();
    var n4;
    if ("string" == typeof r6.type && (n4 = r6.__e)) {
      var t5 = r6.__np, f7 = r6.props;
      if (t5) {
        var o6 = n4.U;
        if (o6) for (var e5 in o6) {
          var u7 = o6[e5];
          if (void 0 !== u7 && !(e5 in t5)) {
            u7.d();
            o6[e5] = void 0;
          }
        }
        else n4.U = o6 = {};
        for (var a6 in t5) {
          var c6 = o6[a6], s7 = t5[a6];
          if (void 0 === c6) {
            c6 = p6(n4, a6, s7, f7);
            o6[a6] = c6;
          } else c6.o(s7, f7);
        }
      }
    }
    i6(r6);
  });
  function p6(i6, r6, n4, t5) {
    var f7 = r6 in i6 && void 0 === i6.ownerSVGElement, o6 = d5(n4);
    return { o: function(i7, r7) {
      o6.value = i7;
      t5 = r7;
    }, d: E3(function() {
      var n5 = o6.value.value;
      if (t5[r6] !== n5) {
        t5[r6] = n5;
        if (f7) i6[r6] = n5;
        else if (n5) i6.setAttribute(r6, n5);
        else i6.removeAttribute(r6);
      }
    }) };
  }
  l6("unmount", function(i6, r6) {
    if ("string" == typeof r6.type) {
      var n4 = r6.__e;
      if (n4) {
        var t5 = n4.U;
        if (t5) {
          n4.U = void 0;
          for (var f7 in t5) {
            var o6 = t5[f7];
            if (o6) o6.d();
          }
        }
      }
    } else {
      var e5 = r6.__c;
      if (e5) {
        var u7 = e5.__$u;
        if (u7) {
          e5.__$u = void 0;
          u7.d();
        }
      }
    }
    i6(r6);
  });
  l6("__h", function(i6, r6, n4, t5) {
    if (t5 < 3 || 9 === t5) r6.__$f |= 2;
    i6(r6, n4, t5);
  });
  x2.prototype.shouldComponentUpdate = function(i6, r6) {
    var n4 = this.__$u, t5 = n4 && void 0 !== n4.s;
    for (var f7 in r6) return true;
    if (this.__f || "boolean" == typeof this.u && true === this.u) {
      if (!(t5 || 2 & this.__$f || 4 & this.__$f)) return true;
      if (1 & this.__$f) return true;
    } else {
      if (!(t5 || 4 & this.__$f)) return true;
      if (3 & this.__$f) return true;
    }
    for (var o6 in i6) if ("__source" !== o6 && i6[o6] !== this.props[o6]) return true;
    for (var e5 in this.props) if (!(e5 in i6)) return true;
    return false;
  };
  function useSignal(i6) {
    return T3(function() {
      return d5(i6);
    }, []);
  }
  function useSignalEffect(i6) {
    var r6 = A3(i6);
    r6.current = i6;
    y3(function() {
      return E3(function() {
        return r6.current();
      });
    }, []);
  }

  // src/core/utils.ts
  function descending(a6, b4) {
    return b4 - a6;
  }
  function getComponentGroupNames(group) {
    let result = group[0].name;
    const len = group.length;
    const max = Math.min(4, len);
    for (let i6 = 1; i6 < max; i6++) {
      result += `, ${group[i6].name}`;
    }
    return result;
  }
  function getComponentGroupTotalTime(group) {
    let result = group[0].time;
    for (let i6 = 1, len = group.length; i6 < len; i6++) {
      result += group[i6].time;
    }
    return result;
  }
  function componentGroupHasForget(group) {
    for (let i6 = 0, len = group.length; i6 < len; i6++) {
      if (group[i6].forget) {
        return true;
      }
    }
    return false;
  }
  var getLabelText = (groupedAggregatedRenders) => {
    let labelText = "";
    const componentsByCount = /* @__PURE__ */ new Map();
    for (const aggregatedRender of groupedAggregatedRenders) {
      const { forget, time, aggregatedCount, name } = aggregatedRender;
      if (!componentsByCount.has(aggregatedCount)) {
        componentsByCount.set(aggregatedCount, []);
      }
      const components = componentsByCount.get(aggregatedCount);
      if (components) {
        components.push({ name, forget, time: time ?? 0 });
      }
    }
    const sortedCounts = Array.from(componentsByCount.keys()).sort(descending);
    const parts = [];
    let cumulativeTime = 0;
    for (const count of sortedCounts) {
      const componentGroup = componentsByCount.get(count);
      if (!componentGroup) continue;
      let text = getComponentGroupNames(componentGroup);
      const totalTime = getComponentGroupTotalTime(componentGroup);
      const hasForget = componentGroupHasForget(componentGroup);
      cumulativeTime += totalTime;
      if (componentGroup.length > 4) {
        text += "\u2026";
      }
      if (count > 1) {
        text += ` \xD7 ${count}`;
      }
      if (hasForget) {
        text = `\u2728${text}`;
      }
      parts.push(text);
    }
    labelText = parts.join(", ");
    if (!labelText.length) return null;
    if (labelText.length > 40) {
      labelText = `${labelText.slice(0, 40)}\u2026`;
    }
    if (cumulativeTime >= 0.01) {
      labelText += ` (${Number(cumulativeTime.toFixed(2))}ms)`;
    }
    return labelText;
  };
  function isEqual(a6, b4) {
    return a6 === b4 || a6 !== a6 && b4 !== b4;
  }
  var not_globally_unique_generateId = () => {
    if (!IS_CLIENT) {
      return "0";
    }
    if (window.reactScanIdCounter === void 0) {
      window.reactScanIdCounter = 0;
    }
    return `${++window.reactScanIdCounter}`;
  };
  var playNotificationSound = (audioContext) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    const options = {
      type: "sine",
      freq: [
        392,
        //  523.25,
        600
        //  659.25
      ],
      duration: 0.3,
      gain: 0.12
    };
    const frequencies = options.freq;
    const timePerNote = options.duration / frequencies.length;
    frequencies.forEach((freq, i6) => {
      oscillator.frequency.setValueAtTime(
        freq,
        audioContext.currentTime + i6 * timePerNote
      );
    });
    oscillator.type = options.type;
    gainNode.gain.setValueAtTime(options.gain, audioContext.currentTime);
    gainNode.gain.setTargetAtTime(
      0,
      audioContext.currentTime + options.duration * 0.7,
      0.05
    );
    oscillator.start();
    oscillator.stop(audioContext.currentTime + options.duration);
  };

  // ../../node_modules/.pnpm/preact@10.26.9/node_modules/preact/compat/dist/compat.module.js
  function g6(n4, t5) {
    for (var e5 in t5) n4[e5] = t5[e5];
    return n4;
  }
  function E4(n4, t5) {
    for (var e5 in n4) if ("__source" !== e5 && !(e5 in t5)) return true;
    for (var r6 in t5) if ("__source" !== r6 && n4[r6] !== t5[r6]) return true;
    return false;
  }
  function C4(n4, t5) {
    var e5 = t5(), r6 = d4({ t: { __: e5, u: t5 } }), u7 = r6[0].t, o6 = r6[1];
    return _4(function() {
      u7.__ = e5, u7.u = t5, x4(u7) && o6({ t: u7 });
    }, [n4, e5, t5]), y3(function() {
      return x4(u7) && o6({ t: u7 }), n4(function() {
        x4(u7) && o6({ t: u7 });
      });
    }, [n4]), e5;
  }
  function x4(n4) {
    var t5, e5, r6 = n4.u, u7 = n4.__;
    try {
      var o6 = r6();
      return !((t5 = u7) === (e5 = o6) && (0 !== t5 || 1 / t5 == 1 / e5) || t5 != t5 && e5 != e5);
    } catch (n5) {
      return true;
    }
  }
  function N3(n4, t5) {
    this.props = n4, this.context = t5;
  }
  function M3(n4, e5) {
    function r6(n5) {
      var t5 = this.props.ref, r7 = t5 == n5.ref;
      return !r7 && t5 && (t5.call ? t5(null) : t5.current = null), E4(this.props, n5);
    }
    function u7(e6) {
      return this.shouldComponentUpdate = r6, _3(n4, e6);
    }
    return u7.displayName = "Memo(" + (n4.displayName || n4.name) + ")", u7.prototype.isReactComponent = true, u7.__f = true, u7;
  }
  (N3.prototype = new x2()).isPureReactComponent = true, N3.prototype.shouldComponentUpdate = function(n4, t5) {
    return E4(this.props, n4) || E4(this.state, t5);
  };
  var T4 = l3.__b;
  l3.__b = function(n4) {
    n4.type && n4.type.__f && n4.ref && (n4.props.ref = n4.ref, n4.ref = null), T4 && T4(n4);
  };
  var A4 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.forward_ref") || 3911;
  function D4(n4) {
    function t5(t6) {
      var e5 = g6({}, t6);
      return delete e5.ref, n4(e5, t6.ref || null);
    }
    return t5.$$typeof = A4, t5.render = t5, t5.prototype.isReactComponent = t5.__f = true, t5.displayName = "ForwardRef(" + (n4.displayName || n4.name) + ")", t5;
  }
  var F4 = l3.__e;
  l3.__e = function(n4, t5, e5, r6) {
    if (n4.then) {
      for (var u7, o6 = t5; o6 = o6.__; ) if ((u7 = o6.__c) && u7.__c) return null == t5.__e && (t5.__e = e5.__e, t5.__k = e5.__k), u7.__c(n4, t5);
    }
    F4(n4, t5, e5, r6);
  };
  var U2 = l3.unmount;
  function V3(n4, t5, e5) {
    return n4 && (n4.__c && n4.__c.__H && (n4.__c.__H.__.forEach(function(n5) {
      "function" == typeof n5.__c && n5.__c();
    }), n4.__c.__H = null), null != (n4 = g6({}, n4)).__c && (n4.__c.__P === e5 && (n4.__c.__P = t5), n4.__c.__e = true, n4.__c = null), n4.__k = n4.__k && n4.__k.map(function(n5) {
      return V3(n5, t5, e5);
    })), n4;
  }
  function W2(n4, t5, e5) {
    return n4 && e5 && (n4.__v = null, n4.__k = n4.__k && n4.__k.map(function(n5) {
      return W2(n5, t5, e5);
    }), n4.__c && n4.__c.__P === t5 && (n4.__e && e5.appendChild(n4.__e), n4.__c.__e = true, n4.__c.__P = e5)), n4;
  }
  function P4() {
    this.__u = 0, this.o = null, this.__b = null;
  }
  function j4(n4) {
    var t5 = n4.__.__c;
    return t5 && t5.__a && t5.__a(n4);
  }
  function B4() {
    this.i = null, this.l = null;
  }
  l3.unmount = function(n4) {
    var t5 = n4.__c;
    t5 && t5.__R && t5.__R(), t5 && 32 & n4.__u && (n4.type = null), U2 && U2(n4);
  }, (P4.prototype = new x2()).__c = function(n4, t5) {
    var e5 = t5.__c, r6 = this;
    null == r6.o && (r6.o = []), r6.o.push(e5);
    var u7 = j4(r6.__v), o6 = false, i6 = function() {
      o6 || (o6 = true, e5.__R = null, u7 ? u7(l7) : l7());
    };
    e5.__R = i6;
    var l7 = function() {
      if (!--r6.__u) {
        if (r6.state.__a) {
          var n5 = r6.state.__a;
          r6.__v.__k[0] = W2(n5, n5.__c.__P, n5.__c.__O);
        }
        var t6;
        for (r6.setState({ __a: r6.__b = null }); t6 = r6.o.pop(); ) t6.forceUpdate();
      }
    };
    r6.__u++ || 32 & t5.__u || r6.setState({ __a: r6.__b = r6.__v.__k[0] }), n4.then(i6, i6);
  }, P4.prototype.componentWillUnmount = function() {
    this.o = [];
  }, P4.prototype.render = function(n4, e5) {
    if (this.__b) {
      if (this.__v.__k) {
        var r6 = document.createElement("div"), o6 = this.__v.__k[0].__c;
        this.__v.__k[0] = V3(this.__b, r6, o6.__O = o6.__P);
      }
      this.__b = null;
    }
    var i6 = e5.__a && _3(k2, null, n4.fallback);
    return i6 && (i6.__u &= -33), [_3(k2, null, e5.__a ? null : n4.children), i6];
  };
  var H3 = function(n4, t5, e5) {
    if (++e5[1] === e5[0] && n4.l.delete(t5), n4.props.revealOrder && ("t" !== n4.props.revealOrder[0] || !n4.l.size)) for (e5 = n4.i; e5; ) {
      for (; e5.length > 3; ) e5.pop()();
      if (e5[1] < e5[0]) break;
      n4.i = e5 = e5[2];
    }
  };
  function Z(n4) {
    return this.getChildContext = function() {
      return n4.context;
    }, n4.children;
  }
  function Y(n4) {
    var e5 = this, r6 = n4.h;
    if (e5.componentWillUnmount = function() {
      E2(null, e5.v), e5.v = null, e5.h = null;
    }, e5.h && e5.h !== r6 && e5.componentWillUnmount(), !e5.v) {
      for (var u7 = e5.__v; null !== u7 && !u7.__m && null !== u7.__; ) u7 = u7.__;
      e5.h = r6, e5.v = { nodeType: 1, parentNode: r6, childNodes: [], __k: { __m: u7.__m }, contains: function() {
        return true;
      }, insertBefore: function(n5, t5) {
        this.childNodes.push(n5), e5.h.insertBefore(n5, t5);
      }, removeChild: function(n5) {
        this.childNodes.splice(this.childNodes.indexOf(n5) >>> 1, 1), e5.h.removeChild(n5);
      } };
    }
    E2(_3(Z, { context: e5.context }, n4.__v), e5.v);
  }
  function $3(n4, e5) {
    var r6 = _3(Y, { __v: n4, h: e5 });
    return r6.containerInfo = e5, r6;
  }
  (B4.prototype = new x2()).__a = function(n4) {
    var t5 = this, e5 = j4(t5.__v), r6 = t5.l.get(n4);
    return r6[0]++, function(u7) {
      var o6 = function() {
        t5.props.revealOrder ? (r6.push(u7), H3(t5, n4, r6)) : u7();
      };
      e5 ? e5(o6) : o6();
    };
  }, B4.prototype.render = function(n4) {
    this.i = null, this.l = /* @__PURE__ */ new Map();
    var t5 = H2(n4.children);
    n4.revealOrder && "b" === n4.revealOrder[0] && t5.reverse();
    for (var e5 = t5.length; e5--; ) this.l.set(t5[e5], this.i = [1, 0, this.i]);
    return n4.children;
  }, B4.prototype.componentDidUpdate = B4.prototype.componentDidMount = function() {
    var n4 = this;
    this.l.forEach(function(t5, e5) {
      H3(n4, e5, t5);
    });
  };
  var q3 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103;
  var G3 = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
  var J2 = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
  var K3 = /[A-Z0-9]/g;
  var Q = "undefined" != typeof document;
  var X2 = function(n4) {
    return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n4);
  };
  x2.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t5) {
    Object.defineProperty(x2.prototype, t5, { configurable: true, get: function() {
      return this["UNSAFE_" + t5];
    }, set: function(n4) {
      Object.defineProperty(this, t5, { configurable: true, writable: true, value: n4 });
    } });
  });
  var en = l3.event;
  function rn() {
  }
  function un() {
    return this.cancelBubble;
  }
  function on() {
    return this.defaultPrevented;
  }
  l3.event = function(n4) {
    return en && (n4 = en(n4)), n4.persist = rn, n4.isPropagationStopped = un, n4.isDefaultPrevented = on, n4.nativeEvent = n4;
  };
  var cn = { enumerable: false, configurable: true, get: function() {
    return this.class;
  } };
  var fn = l3.vnode;
  l3.vnode = function(n4) {
    "string" == typeof n4.type && function(n5) {
      var t5 = n5.props, e5 = n5.type, u7 = {}, o6 = -1 === e5.indexOf("-");
      for (var i6 in t5) {
        var l7 = t5[i6];
        if (!("value" === i6 && "defaultValue" in t5 && null == l7 || Q && "children" === i6 && "noscript" === e5 || "class" === i6 || "className" === i6)) {
          var c6 = i6.toLowerCase();
          "defaultValue" === i6 && "value" in t5 && null == t5.value ? i6 = "value" : "download" === i6 && true === l7 ? l7 = "" : "translate" === c6 && "no" === l7 ? l7 = false : "o" === c6[0] && "n" === c6[1] ? "ondoubleclick" === c6 ? i6 = "ondblclick" : "onchange" !== c6 || "input" !== e5 && "textarea" !== e5 || X2(t5.type) ? "onfocus" === c6 ? i6 = "onfocusin" : "onblur" === c6 ? i6 = "onfocusout" : J2.test(i6) && (i6 = c6) : c6 = i6 = "oninput" : o6 && G3.test(i6) ? i6 = i6.replace(K3, "-$&").toLowerCase() : null === l7 && (l7 = void 0), "oninput" === c6 && u7[i6 = c6] && (i6 = "oninputCapture"), u7[i6] = l7;
        }
      }
      "select" == e5 && u7.multiple && Array.isArray(u7.value) && (u7.value = H2(t5.children).forEach(function(n6) {
        n6.props.selected = -1 != u7.value.indexOf(n6.props.value);
      })), "select" == e5 && null != u7.defaultValue && (u7.value = H2(t5.children).forEach(function(n6) {
        n6.props.selected = u7.multiple ? -1 != u7.defaultValue.indexOf(n6.props.value) : u7.defaultValue == n6.props.value;
      })), t5.class && !t5.className ? (u7.class = t5.class, Object.defineProperty(u7, "className", cn)) : (t5.className && !t5.class || t5.class && t5.className) && (u7.class = u7.className = t5.className), n5.props = u7;
    }(n4), n4.$$typeof = q3, fn && fn(n4);
  };
  var an = l3.__r;
  l3.__r = function(n4) {
    an && an(n4), n4.__c;
  };
  var sn = l3.diffed;
  l3.diffed = function(n4) {
    sn && sn(n4);
    var t5 = n4.props, e5 = n4.__e;
    null != e5 && "textarea" === n4.type && "value" in t5 && t5.value !== e5.value && (e5.value = null == t5.value ? "" : t5.value);
  };

  // ../../node_modules/.pnpm/preact@10.26.9/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
  var f6 = 0;
  function u6(e5, t5, n4, o6, i6, u7) {
    t5 || (t5 = {});
    var a6, c6, p7 = t5;
    if ("ref" in p7) for (c6 in p7 = {}, t5) "ref" == c6 ? a6 = t5[c6] : p7[c6] = t5[c6];
    var l7 = { type: e5, props: p7, key: n4, ref: a6, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f6, __i: -1, __u: 0, __source: i6, __self: u7 };
    if ("function" == typeof e5 && (a6 = e5.defaultProps)) for (c6 in a6) void 0 === p7[c6] && (p7[c6] = a6[c6]);
    return l3.vnode && l3.vnode(l7), l7;
  }

  // src/web/components/icon/index.tsx
  var Icon = D4(({
    size = 15,
    name,
    fill = "currentColor",
    stroke = "currentColor",
    className,
    externalURL = "",
    style
  }, ref) => {
    const width = Array.isArray(size) ? size[0] : size;
    const height = Array.isArray(size) ? size[1] || size[0] : size;
    const path = `${externalURL}#${name}`;
    return /* @__PURE__ */ u6(
      "svg",
      {
        ref,
        width: `${width}px`,
        height: `${height}px`,
        fill,
        stroke,
        className,
        style: {
          ...style,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
          minHeight: `${height}px`,
          maxHeight: `${height}px`
        },
        children: [
          /* @__PURE__ */ u6("title", { children: name }),
          /* @__PURE__ */ u6("use", { href: path })
        ]
      }
    );
  });

  // src/web/constants.ts
  var SAFE_AREA = 24;
  var MIN_SIZE = {
    width: 550,
    height: 350,
    initialHeight: 400
  };
  var MIN_CONTAINER_WIDTH = 240;
  var LOCALSTORAGE_KEY = "react-scan-widget-settings-v2";
  var LOCALSTORAGE_COLLAPSED_KEY = "react-scan-widget-collapsed-v1";
  var LOCALSTORAGE_LAST_VIEW_KEY = "react-scan-widget-last-view-v1";

  // ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
  function r5(e5) {
    var t5, f7, n4 = "";
    if ("string" == typeof e5 || "number" == typeof e5) n4 += e5;
    else if ("object" == typeof e5) if (Array.isArray(e5)) {
      var o6 = e5.length;
      for (t5 = 0; t5 < o6; t5++) e5[t5] && (f7 = r5(e5[t5])) && (n4 && (n4 += " "), n4 += f7);
    } else for (f7 in e5) e5[f7] && (n4 && (n4 += " "), n4 += f7);
    return n4;
  }
  function clsx() {
    for (var e5, t5, f7 = 0, n4 = "", o6 = arguments.length; f7 < o6; f7++) (e5 = arguments[f7]) && (t5 = r5(e5)) && (n4 && (n4 += " "), n4 += t5);
    return n4;
  }

  // ../../node_modules/.pnpm/tailwind-merge@2.6.0/node_modules/tailwind-merge/dist/bundle-mjs.mjs
  var CLASS_PART_SEPARATOR = "-";
  var createClassGroupUtils = (config) => {
    const classMap = createClassMap(config);
    const {
      conflictingClassGroups,
      conflictingClassGroupModifiers
    } = config;
    const getClassGroupId = (className) => {
      const classParts = className.split(CLASS_PART_SEPARATOR);
      if (classParts[0] === "" && classParts.length !== 1) {
        classParts.shift();
      }
      return getGroupRecursive(classParts, classMap) || getGroupIdForArbitraryProperty(className);
    };
    const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
      const conflicts = conflictingClassGroups[classGroupId] || [];
      if (hasPostfixModifier && conflictingClassGroupModifiers[classGroupId]) {
        return [...conflicts, ...conflictingClassGroupModifiers[classGroupId]];
      }
      return conflicts;
    };
    return {
      getClassGroupId,
      getConflictingClassGroupIds
    };
  };
  var getGroupRecursive = (classParts, classPartObject) => {
    if (classParts.length === 0) {
      return classPartObject.classGroupId;
    }
    const currentClassPart = classParts[0];
    const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
    const classGroupFromNextClassPart = nextClassPartObject ? getGroupRecursive(classParts.slice(1), nextClassPartObject) : void 0;
    if (classGroupFromNextClassPart) {
      return classGroupFromNextClassPart;
    }
    if (classPartObject.validators.length === 0) {
      return void 0;
    }
    const classRest = classParts.join(CLASS_PART_SEPARATOR);
    return classPartObject.validators.find(({
      validator
    }) => validator(classRest))?.classGroupId;
  };
  var arbitraryPropertyRegex = /^\[(.+)\]$/;
  var getGroupIdForArbitraryProperty = (className) => {
    if (arbitraryPropertyRegex.test(className)) {
      const arbitraryPropertyClassName = arbitraryPropertyRegex.exec(className)[1];
      const property = arbitraryPropertyClassName?.substring(0, arbitraryPropertyClassName.indexOf(":"));
      if (property) {
        return "arbitrary.." + property;
      }
    }
  };
  var createClassMap = (config) => {
    const {
      theme,
      prefix
    } = config;
    const classMap = {
      nextPart: /* @__PURE__ */ new Map(),
      validators: []
    };
    const prefixedClassGroupEntries = getPrefixedClassGroupEntries(Object.entries(config.classGroups), prefix);
    prefixedClassGroupEntries.forEach(([classGroupId, classGroup]) => {
      processClassesRecursively(classGroup, classMap, classGroupId, theme);
    });
    return classMap;
  };
  var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
    classGroup.forEach((classDefinition) => {
      if (typeof classDefinition === "string") {
        const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
        classPartObjectToEdit.classGroupId = classGroupId;
        return;
      }
      if (typeof classDefinition === "function") {
        if (isThemeGetter(classDefinition)) {
          processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
          return;
        }
        classPartObject.validators.push({
          validator: classDefinition,
          classGroupId
        });
        return;
      }
      Object.entries(classDefinition).forEach(([key, classGroup2]) => {
        processClassesRecursively(classGroup2, getPart(classPartObject, key), classGroupId, theme);
      });
    });
  };
  var getPart = (classPartObject, path) => {
    let currentClassPartObject = classPartObject;
    path.split(CLASS_PART_SEPARATOR).forEach((pathPart) => {
      if (!currentClassPartObject.nextPart.has(pathPart)) {
        currentClassPartObject.nextPart.set(pathPart, {
          nextPart: /* @__PURE__ */ new Map(),
          validators: []
        });
      }
      currentClassPartObject = currentClassPartObject.nextPart.get(pathPart);
    });
    return currentClassPartObject;
  };
  var isThemeGetter = (func) => func.isThemeGetter;
  var getPrefixedClassGroupEntries = (classGroupEntries, prefix) => {
    if (!prefix) {
      return classGroupEntries;
    }
    return classGroupEntries.map(([classGroupId, classGroup]) => {
      const prefixedClassGroup = classGroup.map((classDefinition) => {
        if (typeof classDefinition === "string") {
          return prefix + classDefinition;
        }
        if (typeof classDefinition === "object") {
          return Object.fromEntries(Object.entries(classDefinition).map(([key, value]) => [prefix + key, value]));
        }
        return classDefinition;
      });
      return [classGroupId, prefixedClassGroup];
    });
  };
  var createLruCache = (maxCacheSize) => {
    if (maxCacheSize < 1) {
      return {
        get: () => void 0,
        set: () => {
        }
      };
    }
    let cacheSize = 0;
    let cache2 = /* @__PURE__ */ new Map();
    let previousCache = /* @__PURE__ */ new Map();
    const update = (key, value) => {
      cache2.set(key, value);
      cacheSize++;
      if (cacheSize > maxCacheSize) {
        cacheSize = 0;
        previousCache = cache2;
        cache2 = /* @__PURE__ */ new Map();
      }
    };
    return {
      get(key) {
        let value = cache2.get(key);
        if (value !== void 0) {
          return value;
        }
        if ((value = previousCache.get(key)) !== void 0) {
          update(key, value);
          return value;
        }
      },
      set(key, value) {
        if (cache2.has(key)) {
          cache2.set(key, value);
        } else {
          update(key, value);
        }
      }
    };
  };
  var IMPORTANT_MODIFIER = "!";
  var createParseClassName = (config) => {
    const {
      separator,
      experimentalParseClassName
    } = config;
    const isSeparatorSingleCharacter = separator.length === 1;
    const firstSeparatorCharacter = separator[0];
    const separatorLength = separator.length;
    const parseClassName = (className) => {
      const modifiers = [];
      let bracketDepth = 0;
      let modifierStart = 0;
      let postfixModifierPosition;
      for (let index = 0; index < className.length; index++) {
        let currentCharacter = className[index];
        if (bracketDepth === 0) {
          if (currentCharacter === firstSeparatorCharacter && (isSeparatorSingleCharacter || className.slice(index, index + separatorLength) === separator)) {
            modifiers.push(className.slice(modifierStart, index));
            modifierStart = index + separatorLength;
            continue;
          }
          if (currentCharacter === "/") {
            postfixModifierPosition = index;
            continue;
          }
        }
        if (currentCharacter === "[") {
          bracketDepth++;
        } else if (currentCharacter === "]") {
          bracketDepth--;
        }
      }
      const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.substring(modifierStart);
      const hasImportantModifier = baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER);
      const baseClassName = hasImportantModifier ? baseClassNameWithImportantModifier.substring(1) : baseClassNameWithImportantModifier;
      const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
      return {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      };
    };
    if (experimentalParseClassName) {
      return (className) => experimentalParseClassName({
        className,
        parseClassName
      });
    }
    return parseClassName;
  };
  var sortModifiers = (modifiers) => {
    if (modifiers.length <= 1) {
      return modifiers;
    }
    const sortedModifiers = [];
    let unsortedModifiers = [];
    modifiers.forEach((modifier) => {
      const isArbitraryVariant = modifier[0] === "[";
      if (isArbitraryVariant) {
        sortedModifiers.push(...unsortedModifiers.sort(), modifier);
        unsortedModifiers = [];
      } else {
        unsortedModifiers.push(modifier);
      }
    });
    sortedModifiers.push(...unsortedModifiers.sort());
    return sortedModifiers;
  };
  var createConfigUtils = (config) => ({
    cache: createLruCache(config.cacheSize),
    parseClassName: createParseClassName(config),
    ...createClassGroupUtils(config)
  });
  var SPLIT_CLASSES_REGEX = /\s+/;
  var mergeClassList = (classList, configUtils) => {
    const {
      parseClassName,
      getClassGroupId,
      getConflictingClassGroupIds
    } = configUtils;
    const classGroupsInConflict = [];
    const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
    let result = "";
    for (let index = classNames.length - 1; index >= 0; index -= 1) {
      const originalClassName = classNames[index];
      const {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      } = parseClassName(originalClassName);
      let hasPostfixModifier = Boolean(maybePostfixModifierPosition);
      let classGroupId = getClassGroupId(hasPostfixModifier ? baseClassName.substring(0, maybePostfixModifierPosition) : baseClassName);
      if (!classGroupId) {
        if (!hasPostfixModifier) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        classGroupId = getClassGroupId(baseClassName);
        if (!classGroupId) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        hasPostfixModifier = false;
      }
      const variantModifier = sortModifiers(modifiers).join(":");
      const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
      const classId = modifierId + classGroupId;
      if (classGroupsInConflict.includes(classId)) {
        continue;
      }
      classGroupsInConflict.push(classId);
      const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
      for (let i6 = 0; i6 < conflictGroups.length; ++i6) {
        const group = conflictGroups[i6];
        classGroupsInConflict.push(modifierId + group);
      }
      result = originalClassName + (result.length > 0 ? " " + result : result);
    }
    return result;
  };
  function twJoin() {
    let index = 0;
    let argument;
    let resolvedValue;
    let string = "";
    while (index < arguments.length) {
      if (argument = arguments[index++]) {
        if (resolvedValue = toValue(argument)) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  }
  var toValue = (mix) => {
    if (typeof mix === "string") {
      return mix;
    }
    let resolvedValue;
    let string = "";
    for (let k4 = 0; k4 < mix.length; k4++) {
      if (mix[k4]) {
        if (resolvedValue = toValue(mix[k4])) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  function createTailwindMerge(createConfigFirst, ...createConfigRest) {
    let configUtils;
    let cacheGet;
    let cacheSet;
    let functionToCall = initTailwindMerge;
    function initTailwindMerge(classList) {
      const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
      configUtils = createConfigUtils(config);
      cacheGet = configUtils.cache.get;
      cacheSet = configUtils.cache.set;
      functionToCall = tailwindMerge;
      return tailwindMerge(classList);
    }
    function tailwindMerge(classList) {
      const cachedResult = cacheGet(classList);
      if (cachedResult) {
        return cachedResult;
      }
      const result = mergeClassList(classList, configUtils);
      cacheSet(classList, result);
      return result;
    }
    return function callTailwindMerge() {
      return functionToCall(twJoin.apply(null, arguments));
    };
  }
  var fromTheme = (key) => {
    const themeGetter = (theme) => theme[key] || [];
    themeGetter.isThemeGetter = true;
    return themeGetter;
  };
  var arbitraryValueRegex = /^\[(?:([a-z-]+):)?(.+)\]$/i;
  var fractionRegex = /^\d+\/\d+$/;
  var stringLengths = /* @__PURE__ */ new Set(["px", "full", "screen"]);
  var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/;
  var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  var isLength = (value) => isNumber(value) || stringLengths.has(value) || fractionRegex.test(value);
  var isArbitraryLength = (value) => getIsArbitraryValue(value, "length", isLengthOnly);
  var isNumber = (value) => Boolean(value) && !Number.isNaN(Number(value));
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, "number", isNumber);
  var isInteger = (value) => Boolean(value) && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
  var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
  var isTshirtSize = (value) => tshirtUnitRegex.test(value);
  var sizeLabels = /* @__PURE__ */ new Set(["length", "size", "percentage"]);
  var isArbitrarySize = (value) => getIsArbitraryValue(value, sizeLabels, isNever);
  var isArbitraryPosition = (value) => getIsArbitraryValue(value, "position", isNever);
  var imageLabels = /* @__PURE__ */ new Set(["image", "url"]);
  var isArbitraryImage = (value) => getIsArbitraryValue(value, imageLabels, isImage);
  var isArbitraryShadow = (value) => getIsArbitraryValue(value, "", isShadow);
  var isAny = () => true;
  var getIsArbitraryValue = (value, label, testValue) => {
    const result = arbitraryValueRegex.exec(value);
    if (result) {
      if (result[1]) {
        return typeof label === "string" ? result[1] === label : label.has(result[1]);
      }
      return testValue(result[2]);
    }
    return false;
  };
  var isLengthOnly = (value) => (
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
  );
  var isNever = () => false;
  var isShadow = (value) => shadowRegex.test(value);
  var isImage = (value) => imageRegex.test(value);
  var getDefaultConfig = () => {
    const colors = fromTheme("colors");
    const spacing = fromTheme("spacing");
    const blur = fromTheme("blur");
    const brightness = fromTheme("brightness");
    const borderColor = fromTheme("borderColor");
    const borderRadius = fromTheme("borderRadius");
    const borderSpacing = fromTheme("borderSpacing");
    const borderWidth = fromTheme("borderWidth");
    const contrast = fromTheme("contrast");
    const grayscale = fromTheme("grayscale");
    const hueRotate = fromTheme("hueRotate");
    const invert = fromTheme("invert");
    const gap = fromTheme("gap");
    const gradientColorStops = fromTheme("gradientColorStops");
    const gradientColorStopPositions = fromTheme("gradientColorStopPositions");
    const inset = fromTheme("inset");
    const margin = fromTheme("margin");
    const opacity = fromTheme("opacity");
    const padding = fromTheme("padding");
    const saturate = fromTheme("saturate");
    const scale = fromTheme("scale");
    const sepia = fromTheme("sepia");
    const skew = fromTheme("skew");
    const space = fromTheme("space");
    const translate = fromTheme("translate");
    const getOverscroll = () => ["auto", "contain", "none"];
    const getOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
    const getSpacingWithAutoAndArbitrary = () => ["auto", isArbitraryValue, spacing];
    const getSpacingWithArbitrary = () => [isArbitraryValue, spacing];
    const getLengthWithEmptyAndArbitrary = () => ["", isLength, isArbitraryLength];
    const getNumberWithAutoAndArbitrary = () => ["auto", isNumber, isArbitraryValue];
    const getPositions = () => ["bottom", "center", "left", "left-bottom", "left-top", "right", "right-bottom", "right-top", "top"];
    const getLineStyles = () => ["solid", "dashed", "dotted", "double", "none"];
    const getBlendModes = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const getAlign = () => ["start", "end", "center", "between", "around", "evenly", "stretch"];
    const getZeroAndEmpty = () => ["", "0", isArbitraryValue];
    const getBreaks = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
    const getNumberAndArbitrary = () => [isNumber, isArbitraryValue];
    return {
      cacheSize: 500,
      separator: ":",
      theme: {
        colors: [isAny],
        spacing: [isLength, isArbitraryLength],
        blur: ["none", "", isTshirtSize, isArbitraryValue],
        brightness: getNumberAndArbitrary(),
        borderColor: [colors],
        borderRadius: ["none", "", "full", isTshirtSize, isArbitraryValue],
        borderSpacing: getSpacingWithArbitrary(),
        borderWidth: getLengthWithEmptyAndArbitrary(),
        contrast: getNumberAndArbitrary(),
        grayscale: getZeroAndEmpty(),
        hueRotate: getNumberAndArbitrary(),
        invert: getZeroAndEmpty(),
        gap: getSpacingWithArbitrary(),
        gradientColorStops: [colors],
        gradientColorStopPositions: [isPercent, isArbitraryLength],
        inset: getSpacingWithAutoAndArbitrary(),
        margin: getSpacingWithAutoAndArbitrary(),
        opacity: getNumberAndArbitrary(),
        padding: getSpacingWithArbitrary(),
        saturate: getNumberAndArbitrary(),
        scale: getNumberAndArbitrary(),
        sepia: getZeroAndEmpty(),
        skew: getNumberAndArbitrary(),
        space: getSpacingWithArbitrary(),
        translate: getSpacingWithArbitrary()
      },
      classGroups: {
        // Layout
        /**
         * Aspect Ratio
         * @see https://tailwindcss.com/docs/aspect-ratio
         */
        aspect: [{
          aspect: ["auto", "square", "video", isArbitraryValue]
        }],
        /**
         * Container
         * @see https://tailwindcss.com/docs/container
         */
        container: ["container"],
        /**
         * Columns
         * @see https://tailwindcss.com/docs/columns
         */
        columns: [{
          columns: [isTshirtSize]
        }],
        /**
         * Break After
         * @see https://tailwindcss.com/docs/break-after
         */
        "break-after": [{
          "break-after": getBreaks()
        }],
        /**
         * Break Before
         * @see https://tailwindcss.com/docs/break-before
         */
        "break-before": [{
          "break-before": getBreaks()
        }],
        /**
         * Break Inside
         * @see https://tailwindcss.com/docs/break-inside
         */
        "break-inside": [{
          "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
        }],
        /**
         * Box Decoration Break
         * @see https://tailwindcss.com/docs/box-decoration-break
         */
        "box-decoration": [{
          "box-decoration": ["slice", "clone"]
        }],
        /**
         * Box Sizing
         * @see https://tailwindcss.com/docs/box-sizing
         */
        box: [{
          box: ["border", "content"]
        }],
        /**
         * Display
         * @see https://tailwindcss.com/docs/display
         */
        display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
        /**
         * Floats
         * @see https://tailwindcss.com/docs/float
         */
        float: [{
          float: ["right", "left", "none", "start", "end"]
        }],
        /**
         * Clear
         * @see https://tailwindcss.com/docs/clear
         */
        clear: [{
          clear: ["left", "right", "both", "none", "start", "end"]
        }],
        /**
         * Isolation
         * @see https://tailwindcss.com/docs/isolation
         */
        isolation: ["isolate", "isolation-auto"],
        /**
         * Object Fit
         * @see https://tailwindcss.com/docs/object-fit
         */
        "object-fit": [{
          object: ["contain", "cover", "fill", "none", "scale-down"]
        }],
        /**
         * Object Position
         * @see https://tailwindcss.com/docs/object-position
         */
        "object-position": [{
          object: [...getPositions(), isArbitraryValue]
        }],
        /**
         * Overflow
         * @see https://tailwindcss.com/docs/overflow
         */
        overflow: [{
          overflow: getOverflow()
        }],
        /**
         * Overflow X
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-x": [{
          "overflow-x": getOverflow()
        }],
        /**
         * Overflow Y
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-y": [{
          "overflow-y": getOverflow()
        }],
        /**
         * Overscroll Behavior
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        overscroll: [{
          overscroll: getOverscroll()
        }],
        /**
         * Overscroll Behavior X
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-x": [{
          "overscroll-x": getOverscroll()
        }],
        /**
         * Overscroll Behavior Y
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-y": [{
          "overscroll-y": getOverscroll()
        }],
        /**
         * Position
         * @see https://tailwindcss.com/docs/position
         */
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        /**
         * Top / Right / Bottom / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        inset: [{
          inset: [inset]
        }],
        /**
         * Right / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-x": [{
          "inset-x": [inset]
        }],
        /**
         * Top / Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-y": [{
          "inset-y": [inset]
        }],
        /**
         * Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        start: [{
          start: [inset]
        }],
        /**
         * End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        end: [{
          end: [inset]
        }],
        /**
         * Top
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        top: [{
          top: [inset]
        }],
        /**
         * Right
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        right: [{
          right: [inset]
        }],
        /**
         * Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        bottom: [{
          bottom: [inset]
        }],
        /**
         * Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        left: [{
          left: [inset]
        }],
        /**
         * Visibility
         * @see https://tailwindcss.com/docs/visibility
         */
        visibility: ["visible", "invisible", "collapse"],
        /**
         * Z-Index
         * @see https://tailwindcss.com/docs/z-index
         */
        z: [{
          z: ["auto", isInteger, isArbitraryValue]
        }],
        // Flexbox and Grid
        /**
         * Flex Basis
         * @see https://tailwindcss.com/docs/flex-basis
         */
        basis: [{
          basis: getSpacingWithAutoAndArbitrary()
        }],
        /**
         * Flex Direction
         * @see https://tailwindcss.com/docs/flex-direction
         */
        "flex-direction": [{
          flex: ["row", "row-reverse", "col", "col-reverse"]
        }],
        /**
         * Flex Wrap
         * @see https://tailwindcss.com/docs/flex-wrap
         */
        "flex-wrap": [{
          flex: ["wrap", "wrap-reverse", "nowrap"]
        }],
        /**
         * Flex
         * @see https://tailwindcss.com/docs/flex
         */
        flex: [{
          flex: ["1", "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: getZeroAndEmpty()
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: getZeroAndEmpty()
        }],
        /**
         * Order
         * @see https://tailwindcss.com/docs/order
         */
        order: [{
          order: ["first", "last", "none", isInteger, isArbitraryValue]
        }],
        /**
         * Grid Template Columns
         * @see https://tailwindcss.com/docs/grid-template-columns
         */
        "grid-cols": [{
          "grid-cols": [isAny]
        }],
        /**
         * Grid Column Start / End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start-end": [{
          col: ["auto", {
            span: ["full", isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Column Start
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start": [{
          "col-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Column End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-end": [{
          "col-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Template Rows
         * @see https://tailwindcss.com/docs/grid-template-rows
         */
        "grid-rows": [{
          "grid-rows": [isAny]
        }],
        /**
         * Grid Row Start / End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start-end": [{
          row: ["auto", {
            span: [isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Row Start
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start": [{
          "row-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Row End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-end": [{
          "row-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Auto Flow
         * @see https://tailwindcss.com/docs/grid-auto-flow
         */
        "grid-flow": [{
          "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
        }],
        /**
         * Grid Auto Columns
         * @see https://tailwindcss.com/docs/grid-auto-columns
         */
        "auto-cols": [{
          "auto-cols": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Grid Auto Rows
         * @see https://tailwindcss.com/docs/grid-auto-rows
         */
        "auto-rows": [{
          "auto-rows": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Gap
         * @see https://tailwindcss.com/docs/gap
         */
        gap: [{
          gap: [gap]
        }],
        /**
         * Gap X
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-x": [{
          "gap-x": [gap]
        }],
        /**
         * Gap Y
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-y": [{
          "gap-y": [gap]
        }],
        /**
         * Justify Content
         * @see https://tailwindcss.com/docs/justify-content
         */
        "justify-content": [{
          justify: ["normal", ...getAlign()]
        }],
        /**
         * Justify Items
         * @see https://tailwindcss.com/docs/justify-items
         */
        "justify-items": [{
          "justify-items": ["start", "end", "center", "stretch"]
        }],
        /**
         * Justify Self
         * @see https://tailwindcss.com/docs/justify-self
         */
        "justify-self": [{
          "justify-self": ["auto", "start", "end", "center", "stretch"]
        }],
        /**
         * Align Content
         * @see https://tailwindcss.com/docs/align-content
         */
        "align-content": [{
          content: ["normal", ...getAlign(), "baseline"]
        }],
        /**
         * Align Items
         * @see https://tailwindcss.com/docs/align-items
         */
        "align-items": [{
          items: ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Align Self
         * @see https://tailwindcss.com/docs/align-self
         */
        "align-self": [{
          self: ["auto", "start", "end", "center", "stretch", "baseline"]
        }],
        /**
         * Place Content
         * @see https://tailwindcss.com/docs/place-content
         */
        "place-content": [{
          "place-content": [...getAlign(), "baseline"]
        }],
        /**
         * Place Items
         * @see https://tailwindcss.com/docs/place-items
         */
        "place-items": [{
          "place-items": ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Place Self
         * @see https://tailwindcss.com/docs/place-self
         */
        "place-self": [{
          "place-self": ["auto", "start", "end", "center", "stretch"]
        }],
        // Spacing
        /**
         * Padding
         * @see https://tailwindcss.com/docs/padding
         */
        p: [{
          p: [padding]
        }],
        /**
         * Padding X
         * @see https://tailwindcss.com/docs/padding
         */
        px: [{
          px: [padding]
        }],
        /**
         * Padding Y
         * @see https://tailwindcss.com/docs/padding
         */
        py: [{
          py: [padding]
        }],
        /**
         * Padding Start
         * @see https://tailwindcss.com/docs/padding
         */
        ps: [{
          ps: [padding]
        }],
        /**
         * Padding End
         * @see https://tailwindcss.com/docs/padding
         */
        pe: [{
          pe: [padding]
        }],
        /**
         * Padding Top
         * @see https://tailwindcss.com/docs/padding
         */
        pt: [{
          pt: [padding]
        }],
        /**
         * Padding Right
         * @see https://tailwindcss.com/docs/padding
         */
        pr: [{
          pr: [padding]
        }],
        /**
         * Padding Bottom
         * @see https://tailwindcss.com/docs/padding
         */
        pb: [{
          pb: [padding]
        }],
        /**
         * Padding Left
         * @see https://tailwindcss.com/docs/padding
         */
        pl: [{
          pl: [padding]
        }],
        /**
         * Margin
         * @see https://tailwindcss.com/docs/margin
         */
        m: [{
          m: [margin]
        }],
        /**
         * Margin X
         * @see https://tailwindcss.com/docs/margin
         */
        mx: [{
          mx: [margin]
        }],
        /**
         * Margin Y
         * @see https://tailwindcss.com/docs/margin
         */
        my: [{
          my: [margin]
        }],
        /**
         * Margin Start
         * @see https://tailwindcss.com/docs/margin
         */
        ms: [{
          ms: [margin]
        }],
        /**
         * Margin End
         * @see https://tailwindcss.com/docs/margin
         */
        me: [{
          me: [margin]
        }],
        /**
         * Margin Top
         * @see https://tailwindcss.com/docs/margin
         */
        mt: [{
          mt: [margin]
        }],
        /**
         * Margin Right
         * @see https://tailwindcss.com/docs/margin
         */
        mr: [{
          mr: [margin]
        }],
        /**
         * Margin Bottom
         * @see https://tailwindcss.com/docs/margin
         */
        mb: [{
          mb: [margin]
        }],
        /**
         * Margin Left
         * @see https://tailwindcss.com/docs/margin
         */
        ml: [{
          ml: [margin]
        }],
        /**
         * Space Between X
         * @see https://tailwindcss.com/docs/space
         */
        "space-x": [{
          "space-x": [space]
        }],
        /**
         * Space Between X Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-x-reverse": ["space-x-reverse"],
        /**
         * Space Between Y
         * @see https://tailwindcss.com/docs/space
         */
        "space-y": [{
          "space-y": [space]
        }],
        /**
         * Space Between Y Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-y-reverse": ["space-y-reverse"],
        // Sizing
        /**
         * Width
         * @see https://tailwindcss.com/docs/width
         */
        w: [{
          w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", isArbitraryValue, spacing]
        }],
        /**
         * Min-Width
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-w": [{
          "min-w": [isArbitraryValue, spacing, "min", "max", "fit"]
        }],
        /**
         * Max-Width
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-w": [{
          "max-w": [isArbitraryValue, spacing, "none", "full", "min", "max", "fit", "prose", {
            screen: [isTshirtSize]
          }, isTshirtSize]
        }],
        /**
         * Height
         * @see https://tailwindcss.com/docs/height
         */
        h: [{
          h: [isArbitraryValue, spacing, "auto", "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Min-Height
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-h": [{
          "min-h": [isArbitraryValue, spacing, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Max-Height
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-h": [{
          "max-h": [isArbitraryValue, spacing, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Size
         * @see https://tailwindcss.com/docs/size
         */
        size: [{
          size: [isArbitraryValue, spacing, "auto", "min", "max", "fit"]
        }],
        // Typography
        /**
         * Font Size
         * @see https://tailwindcss.com/docs/font-size
         */
        "font-size": [{
          text: ["base", isTshirtSize, isArbitraryLength]
        }],
        /**
         * Font Smoothing
         * @see https://tailwindcss.com/docs/font-smoothing
         */
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        /**
         * Font Style
         * @see https://tailwindcss.com/docs/font-style
         */
        "font-style": ["italic", "not-italic"],
        /**
         * Font Weight
         * @see https://tailwindcss.com/docs/font-weight
         */
        "font-weight": [{
          font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", isArbitraryNumber]
        }],
        /**
         * Font Family
         * @see https://tailwindcss.com/docs/font-family
         */
        "font-family": [{
          font: [isAny]
        }],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-normal": ["normal-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-ordinal": ["ordinal"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-slashed-zero": ["slashed-zero"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        /**
         * Letter Spacing
         * @see https://tailwindcss.com/docs/letter-spacing
         */
        tracking: [{
          tracking: ["tighter", "tight", "normal", "wide", "wider", "widest", isArbitraryValue]
        }],
        /**
         * Line Clamp
         * @see https://tailwindcss.com/docs/line-clamp
         */
        "line-clamp": [{
          "line-clamp": ["none", isNumber, isArbitraryNumber]
        }],
        /**
         * Line Height
         * @see https://tailwindcss.com/docs/line-height
         */
        leading: [{
          leading: ["none", "tight", "snug", "normal", "relaxed", "loose", isLength, isArbitraryValue]
        }],
        /**
         * List Style Image
         * @see https://tailwindcss.com/docs/list-style-image
         */
        "list-image": [{
          "list-image": ["none", isArbitraryValue]
        }],
        /**
         * List Style Type
         * @see https://tailwindcss.com/docs/list-style-type
         */
        "list-style-type": [{
          list: ["none", "disc", "decimal", isArbitraryValue]
        }],
        /**
         * List Style Position
         * @see https://tailwindcss.com/docs/list-style-position
         */
        "list-style-position": [{
          list: ["inside", "outside"]
        }],
        /**
         * Placeholder Color
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/placeholder-color
         */
        "placeholder-color": [{
          placeholder: [colors]
        }],
        /**
         * Placeholder Opacity
         * @see https://tailwindcss.com/docs/placeholder-opacity
         */
        "placeholder-opacity": [{
          "placeholder-opacity": [opacity]
        }],
        /**
         * Text Alignment
         * @see https://tailwindcss.com/docs/text-align
         */
        "text-alignment": [{
          text: ["left", "center", "right", "justify", "start", "end"]
        }],
        /**
         * Text Color
         * @see https://tailwindcss.com/docs/text-color
         */
        "text-color": [{
          text: [colors]
        }],
        /**
         * Text Opacity
         * @see https://tailwindcss.com/docs/text-opacity
         */
        "text-opacity": [{
          "text-opacity": [opacity]
        }],
        /**
         * Text Decoration
         * @see https://tailwindcss.com/docs/text-decoration
         */
        "text-decoration": ["underline", "overline", "line-through", "no-underline"],
        /**
         * Text Decoration Style
         * @see https://tailwindcss.com/docs/text-decoration-style
         */
        "text-decoration-style": [{
          decoration: [...getLineStyles(), "wavy"]
        }],
        /**
         * Text Decoration Thickness
         * @see https://tailwindcss.com/docs/text-decoration-thickness
         */
        "text-decoration-thickness": [{
          decoration: ["auto", "from-font", isLength, isArbitraryLength]
        }],
        /**
         * Text Underline Offset
         * @see https://tailwindcss.com/docs/text-underline-offset
         */
        "underline-offset": [{
          "underline-offset": ["auto", isLength, isArbitraryValue]
        }],
        /**
         * Text Decoration Color
         * @see https://tailwindcss.com/docs/text-decoration-color
         */
        "text-decoration-color": [{
          decoration: [colors]
        }],
        /**
         * Text Transform
         * @see https://tailwindcss.com/docs/text-transform
         */
        "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
        /**
         * Text Overflow
         * @see https://tailwindcss.com/docs/text-overflow
         */
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        /**
         * Text Wrap
         * @see https://tailwindcss.com/docs/text-wrap
         */
        "text-wrap": [{
          text: ["wrap", "nowrap", "balance", "pretty"]
        }],
        /**
         * Text Indent
         * @see https://tailwindcss.com/docs/text-indent
         */
        indent: [{
          indent: getSpacingWithArbitrary()
        }],
        /**
         * Vertical Alignment
         * @see https://tailwindcss.com/docs/vertical-align
         */
        "vertical-align": [{
          align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryValue]
        }],
        /**
         * Whitespace
         * @see https://tailwindcss.com/docs/whitespace
         */
        whitespace: [{
          whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
        }],
        /**
         * Word Break
         * @see https://tailwindcss.com/docs/word-break
         */
        break: [{
          break: ["normal", "words", "all", "keep"]
        }],
        /**
         * Hyphens
         * @see https://tailwindcss.com/docs/hyphens
         */
        hyphens: [{
          hyphens: ["none", "manual", "auto"]
        }],
        /**
         * Content
         * @see https://tailwindcss.com/docs/content
         */
        content: [{
          content: ["none", isArbitraryValue]
        }],
        // Backgrounds
        /**
         * Background Attachment
         * @see https://tailwindcss.com/docs/background-attachment
         */
        "bg-attachment": [{
          bg: ["fixed", "local", "scroll"]
        }],
        /**
         * Background Clip
         * @see https://tailwindcss.com/docs/background-clip
         */
        "bg-clip": [{
          "bg-clip": ["border", "padding", "content", "text"]
        }],
        /**
         * Background Opacity
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/background-opacity
         */
        "bg-opacity": [{
          "bg-opacity": [opacity]
        }],
        /**
         * Background Origin
         * @see https://tailwindcss.com/docs/background-origin
         */
        "bg-origin": [{
          "bg-origin": ["border", "padding", "content"]
        }],
        /**
         * Background Position
         * @see https://tailwindcss.com/docs/background-position
         */
        "bg-position": [{
          bg: [...getPositions(), isArbitraryPosition]
        }],
        /**
         * Background Repeat
         * @see https://tailwindcss.com/docs/background-repeat
         */
        "bg-repeat": [{
          bg: ["no-repeat", {
            repeat: ["", "x", "y", "round", "space"]
          }]
        }],
        /**
         * Background Size
         * @see https://tailwindcss.com/docs/background-size
         */
        "bg-size": [{
          bg: ["auto", "cover", "contain", isArbitrarySize]
        }],
        /**
         * Background Image
         * @see https://tailwindcss.com/docs/background-image
         */
        "bg-image": [{
          bg: ["none", {
            "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, isArbitraryImage]
        }],
        /**
         * Background Color
         * @see https://tailwindcss.com/docs/background-color
         */
        "bg-color": [{
          bg: [colors]
        }],
        /**
         * Gradient Color Stops From Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from-pos": [{
          from: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops Via Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via-pos": [{
          via: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops To Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to-pos": [{
          to: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops From
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from": [{
          from: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops Via
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via": [{
          via: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops To
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to": [{
          to: [gradientColorStops]
        }],
        // Borders
        /**
         * Border Radius
         * @see https://tailwindcss.com/docs/border-radius
         */
        rounded: [{
          rounded: [borderRadius]
        }],
        /**
         * Border Radius Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-s": [{
          "rounded-s": [borderRadius]
        }],
        /**
         * Border Radius End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-e": [{
          "rounded-e": [borderRadius]
        }],
        /**
         * Border Radius Top
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-t": [{
          "rounded-t": [borderRadius]
        }],
        /**
         * Border Radius Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-r": [{
          "rounded-r": [borderRadius]
        }],
        /**
         * Border Radius Bottom
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-b": [{
          "rounded-b": [borderRadius]
        }],
        /**
         * Border Radius Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-l": [{
          "rounded-l": [borderRadius]
        }],
        /**
         * Border Radius Start Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ss": [{
          "rounded-ss": [borderRadius]
        }],
        /**
         * Border Radius Start End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-se": [{
          "rounded-se": [borderRadius]
        }],
        /**
         * Border Radius End End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ee": [{
          "rounded-ee": [borderRadius]
        }],
        /**
         * Border Radius End Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-es": [{
          "rounded-es": [borderRadius]
        }],
        /**
         * Border Radius Top Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tl": [{
          "rounded-tl": [borderRadius]
        }],
        /**
         * Border Radius Top Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tr": [{
          "rounded-tr": [borderRadius]
        }],
        /**
         * Border Radius Bottom Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-br": [{
          "rounded-br": [borderRadius]
        }],
        /**
         * Border Radius Bottom Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-bl": [{
          "rounded-bl": [borderRadius]
        }],
        /**
         * Border Width
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w": [{
          border: [borderWidth]
        }],
        /**
         * Border Width X
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-x": [{
          "border-x": [borderWidth]
        }],
        /**
         * Border Width Y
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-y": [{
          "border-y": [borderWidth]
        }],
        /**
         * Border Width Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-s": [{
          "border-s": [borderWidth]
        }],
        /**
         * Border Width End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-e": [{
          "border-e": [borderWidth]
        }],
        /**
         * Border Width Top
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-t": [{
          "border-t": [borderWidth]
        }],
        /**
         * Border Width Right
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-r": [{
          "border-r": [borderWidth]
        }],
        /**
         * Border Width Bottom
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-b": [{
          "border-b": [borderWidth]
        }],
        /**
         * Border Width Left
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-l": [{
          "border-l": [borderWidth]
        }],
        /**
         * Border Opacity
         * @see https://tailwindcss.com/docs/border-opacity
         */
        "border-opacity": [{
          "border-opacity": [opacity]
        }],
        /**
         * Border Style
         * @see https://tailwindcss.com/docs/border-style
         */
        "border-style": [{
          border: [...getLineStyles(), "hidden"]
        }],
        /**
         * Divide Width X
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x": [{
          "divide-x": [borderWidth]
        }],
        /**
         * Divide Width X Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x-reverse": ["divide-x-reverse"],
        /**
         * Divide Width Y
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y": [{
          "divide-y": [borderWidth]
        }],
        /**
         * Divide Width Y Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y-reverse": ["divide-y-reverse"],
        /**
         * Divide Opacity
         * @see https://tailwindcss.com/docs/divide-opacity
         */
        "divide-opacity": [{
          "divide-opacity": [opacity]
        }],
        /**
         * Divide Style
         * @see https://tailwindcss.com/docs/divide-style
         */
        "divide-style": [{
          divide: getLineStyles()
        }],
        /**
         * Border Color
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color": [{
          border: [borderColor]
        }],
        /**
         * Border Color X
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-x": [{
          "border-x": [borderColor]
        }],
        /**
         * Border Color Y
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-y": [{
          "border-y": [borderColor]
        }],
        /**
         * Border Color S
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-s": [{
          "border-s": [borderColor]
        }],
        /**
         * Border Color E
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-e": [{
          "border-e": [borderColor]
        }],
        /**
         * Border Color Top
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-t": [{
          "border-t": [borderColor]
        }],
        /**
         * Border Color Right
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-r": [{
          "border-r": [borderColor]
        }],
        /**
         * Border Color Bottom
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-b": [{
          "border-b": [borderColor]
        }],
        /**
         * Border Color Left
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-l": [{
          "border-l": [borderColor]
        }],
        /**
         * Divide Color
         * @see https://tailwindcss.com/docs/divide-color
         */
        "divide-color": [{
          divide: [borderColor]
        }],
        /**
         * Outline Style
         * @see https://tailwindcss.com/docs/outline-style
         */
        "outline-style": [{
          outline: ["", ...getLineStyles()]
        }],
        /**
         * Outline Offset
         * @see https://tailwindcss.com/docs/outline-offset
         */
        "outline-offset": [{
          "outline-offset": [isLength, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: [isLength, isArbitraryLength]
        }],
        /**
         * Outline Color
         * @see https://tailwindcss.com/docs/outline-color
         */
        "outline-color": [{
          outline: [colors]
        }],
        /**
         * Ring Width
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w": [{
          ring: getLengthWithEmptyAndArbitrary()
        }],
        /**
         * Ring Width Inset
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w-inset": ["ring-inset"],
        /**
         * Ring Color
         * @see https://tailwindcss.com/docs/ring-color
         */
        "ring-color": [{
          ring: [colors]
        }],
        /**
         * Ring Opacity
         * @see https://tailwindcss.com/docs/ring-opacity
         */
        "ring-opacity": [{
          "ring-opacity": [opacity]
        }],
        /**
         * Ring Offset Width
         * @see https://tailwindcss.com/docs/ring-offset-width
         */
        "ring-offset-w": [{
          "ring-offset": [isLength, isArbitraryLength]
        }],
        /**
         * Ring Offset Color
         * @see https://tailwindcss.com/docs/ring-offset-color
         */
        "ring-offset-color": [{
          "ring-offset": [colors]
        }],
        // Effects
        /**
         * Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow
         */
        shadow: [{
          shadow: ["", "inner", "none", isTshirtSize, isArbitraryShadow]
        }],
        /**
         * Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow-color
         */
        "shadow-color": [{
          shadow: [isAny]
        }],
        /**
         * Opacity
         * @see https://tailwindcss.com/docs/opacity
         */
        opacity: [{
          opacity: [opacity]
        }],
        /**
         * Mix Blend Mode
         * @see https://tailwindcss.com/docs/mix-blend-mode
         */
        "mix-blend": [{
          "mix-blend": [...getBlendModes(), "plus-lighter", "plus-darker"]
        }],
        /**
         * Background Blend Mode
         * @see https://tailwindcss.com/docs/background-blend-mode
         */
        "bg-blend": [{
          "bg-blend": getBlendModes()
        }],
        // Filters
        /**
         * Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/filter
         */
        filter: [{
          filter: ["", "none"]
        }],
        /**
         * Blur
         * @see https://tailwindcss.com/docs/blur
         */
        blur: [{
          blur: [blur]
        }],
        /**
         * Brightness
         * @see https://tailwindcss.com/docs/brightness
         */
        brightness: [{
          brightness: [brightness]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [contrast]
        }],
        /**
         * Drop Shadow
         * @see https://tailwindcss.com/docs/drop-shadow
         */
        "drop-shadow": [{
          "drop-shadow": ["", "none", isTshirtSize, isArbitraryValue]
        }],
        /**
         * Grayscale
         * @see https://tailwindcss.com/docs/grayscale
         */
        grayscale: [{
          grayscale: [grayscale]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [hueRotate]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: [invert]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [saturate]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: [sepia]
        }],
        /**
         * Backdrop Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/backdrop-filter
         */
        "backdrop-filter": [{
          "backdrop-filter": ["", "none"]
        }],
        /**
         * Backdrop Blur
         * @see https://tailwindcss.com/docs/backdrop-blur
         */
        "backdrop-blur": [{
          "backdrop-blur": [blur]
        }],
        /**
         * Backdrop Brightness
         * @see https://tailwindcss.com/docs/backdrop-brightness
         */
        "backdrop-brightness": [{
          "backdrop-brightness": [brightness]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [contrast]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": [grayscale]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [hueRotate]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": [invert]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [opacity]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [saturate]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": [sepia]
        }],
        // Tables
        /**
         * Border Collapse
         * @see https://tailwindcss.com/docs/border-collapse
         */
        "border-collapse": [{
          border: ["collapse", "separate"]
        }],
        /**
         * Border Spacing
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing": [{
          "border-spacing": [borderSpacing]
        }],
        /**
         * Border Spacing X
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-x": [{
          "border-spacing-x": [borderSpacing]
        }],
        /**
         * Border Spacing Y
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-y": [{
          "border-spacing-y": [borderSpacing]
        }],
        /**
         * Table Layout
         * @see https://tailwindcss.com/docs/table-layout
         */
        "table-layout": [{
          table: ["auto", "fixed"]
        }],
        /**
         * Caption Side
         * @see https://tailwindcss.com/docs/caption-side
         */
        caption: [{
          caption: ["top", "bottom"]
        }],
        // Transitions and Animation
        /**
         * Tranisition Property
         * @see https://tailwindcss.com/docs/transition-property
         */
        transition: [{
          transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", isArbitraryValue]
        }],
        /**
         * Transition Duration
         * @see https://tailwindcss.com/docs/transition-duration
         */
        duration: [{
          duration: getNumberAndArbitrary()
        }],
        /**
         * Transition Timing Function
         * @see https://tailwindcss.com/docs/transition-timing-function
         */
        ease: [{
          ease: ["linear", "in", "out", "in-out", isArbitraryValue]
        }],
        /**
         * Transition Delay
         * @see https://tailwindcss.com/docs/transition-delay
         */
        delay: [{
          delay: getNumberAndArbitrary()
        }],
        /**
         * Animation
         * @see https://tailwindcss.com/docs/animation
         */
        animate: [{
          animate: ["none", "spin", "ping", "pulse", "bounce", isArbitraryValue]
        }],
        // Transforms
        /**
         * Transform
         * @see https://tailwindcss.com/docs/transform
         */
        transform: [{
          transform: ["", "gpu", "none"]
        }],
        /**
         * Scale
         * @see https://tailwindcss.com/docs/scale
         */
        scale: [{
          scale: [scale]
        }],
        /**
         * Scale X
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-x": [{
          "scale-x": [scale]
        }],
        /**
         * Scale Y
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-y": [{
          "scale-y": [scale]
        }],
        /**
         * Rotate
         * @see https://tailwindcss.com/docs/rotate
         */
        rotate: [{
          rotate: [isInteger, isArbitraryValue]
        }],
        /**
         * Translate X
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-x": [{
          "translate-x": [translate]
        }],
        /**
         * Translate Y
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-y": [{
          "translate-y": [translate]
        }],
        /**
         * Skew X
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-x": [{
          "skew-x": [skew]
        }],
        /**
         * Skew Y
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-y": [{
          "skew-y": [skew]
        }],
        /**
         * Transform Origin
         * @see https://tailwindcss.com/docs/transform-origin
         */
        "transform-origin": [{
          origin: ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left", isArbitraryValue]
        }],
        // Interactivity
        /**
         * Accent Color
         * @see https://tailwindcss.com/docs/accent-color
         */
        accent: [{
          accent: ["auto", colors]
        }],
        /**
         * Appearance
         * @see https://tailwindcss.com/docs/appearance
         */
        appearance: [{
          appearance: ["none", "auto"]
        }],
        /**
         * Cursor
         * @see https://tailwindcss.com/docs/cursor
         */
        cursor: [{
          cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryValue]
        }],
        /**
         * Caret Color
         * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
         */
        "caret-color": [{
          caret: [colors]
        }],
        /**
         * Pointer Events
         * @see https://tailwindcss.com/docs/pointer-events
         */
        "pointer-events": [{
          "pointer-events": ["none", "auto"]
        }],
        /**
         * Resize
         * @see https://tailwindcss.com/docs/resize
         */
        resize: [{
          resize: ["none", "y", "x", ""]
        }],
        /**
         * Scroll Behavior
         * @see https://tailwindcss.com/docs/scroll-behavior
         */
        "scroll-behavior": [{
          scroll: ["auto", "smooth"]
        }],
        /**
         * Scroll Margin
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-m": [{
          "scroll-m": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin X
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mx": [{
          "scroll-mx": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Y
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-my": [{
          "scroll-my": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ms": [{
          "scroll-ms": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-me": [{
          "scroll-me": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Top
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mt": [{
          "scroll-mt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Right
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mr": [{
          "scroll-mr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Bottom
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mb": [{
          "scroll-mb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Left
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ml": [{
          "scroll-ml": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-p": [{
          "scroll-p": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding X
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-px": [{
          "scroll-px": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Y
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-py": [{
          "scroll-py": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-ps": [{
          "scroll-ps": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pe": [{
          "scroll-pe": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Top
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pt": [{
          "scroll-pt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Right
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pr": [{
          "scroll-pr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Bottom
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pb": [{
          "scroll-pb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Left
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pl": [{
          "scroll-pl": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Snap Align
         * @see https://tailwindcss.com/docs/scroll-snap-align
         */
        "snap-align": [{
          snap: ["start", "end", "center", "align-none"]
        }],
        /**
         * Scroll Snap Stop
         * @see https://tailwindcss.com/docs/scroll-snap-stop
         */
        "snap-stop": [{
          snap: ["normal", "always"]
        }],
        /**
         * Scroll Snap Type
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-type": [{
          snap: ["none", "x", "y", "both"]
        }],
        /**
         * Scroll Snap Type Strictness
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-strictness": [{
          snap: ["mandatory", "proximity"]
        }],
        /**
         * Touch Action
         * @see https://tailwindcss.com/docs/touch-action
         */
        touch: [{
          touch: ["auto", "none", "manipulation"]
        }],
        /**
         * Touch Action X
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-x": [{
          "touch-pan": ["x", "left", "right"]
        }],
        /**
         * Touch Action Y
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-y": [{
          "touch-pan": ["y", "up", "down"]
        }],
        /**
         * Touch Action Pinch Zoom
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-pz": ["touch-pinch-zoom"],
        /**
         * User Select
         * @see https://tailwindcss.com/docs/user-select
         */
        select: [{
          select: ["none", "text", "all", "auto"]
        }],
        /**
         * Will Change
         * @see https://tailwindcss.com/docs/will-change
         */
        "will-change": [{
          "will-change": ["auto", "scroll", "contents", "transform", isArbitraryValue]
        }],
        // SVG
        /**
         * Fill
         * @see https://tailwindcss.com/docs/fill
         */
        fill: [{
          fill: [colors, "none"]
        }],
        /**
         * Stroke Width
         * @see https://tailwindcss.com/docs/stroke-width
         */
        "stroke-w": [{
          stroke: [isLength, isArbitraryLength, isArbitraryNumber]
        }],
        /**
         * Stroke
         * @see https://tailwindcss.com/docs/stroke
         */
        stroke: [{
          stroke: [colors, "none"]
        }],
        // Accessibility
        /**
         * Screen Readers
         * @see https://tailwindcss.com/docs/screen-readers
         */
        sr: ["sr-only", "not-sr-only"],
        /**
         * Forced Color Adjust
         * @see https://tailwindcss.com/docs/forced-color-adjust
         */
        "forced-color-adjust": [{
          "forced-color-adjust": ["auto", "none"]
        }]
      },
      conflictingClassGroups: {
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": ["border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": ["border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"]
      },
      conflictingClassGroupModifiers: {
        "font-size": ["leading"]
      }
    };
  };
  var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);

  // src/web/utils/helpers.ts
  var cn2 = (...inputs) => {
    return twMerge(clsx(inputs));
  };
  typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
  var throttle = (callback, delay) => {
    let lastCall = 0;
    return (e5) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return callback(e5);
      }
      return void 0;
    };
  };
  var readLocalStorage = (storageKey) => {
    if (!IS_CLIENT) return null;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  var saveLocalStorage = (storageKey, state) => {
    if (!IS_CLIENT) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
    }
  };
  var removeLocalStorage = (storageKey) => {
    if (!IS_CLIENT) return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
    }
  };
  var LazyComponentTag = 24;
  var ProfilerTag = 12;
  var getExtendedDisplayName = (fiber) => {
    if (!fiber) {
      return {
        name: "Unknown",
        wrappers: [],
        wrapperTypes: []
      };
    }
    const { tag, type, elementType } = fiber;
    let name = Te(type);
    const wrappers = [];
    const wrapperTypes = [];
    if (we(fiber) || tag === h2 || tag === m2 || type?.$$typeof === Symbol.for("react.memo") || elementType?.$$typeof === Symbol.for("react.memo")) {
      const compiler = we(fiber);
      wrapperTypes.push({
        type: "memo",
        title: compiler ? "This component has been auto-memoized by the React Compiler." : "Memoized component that skips re-renders if props are the same",
        compiler
      });
    }
    if (tag === LazyComponentTag) {
      wrapperTypes.push({
        type: "lazy",
        title: "Lazily loaded component that supports code splitting"
      });
    }
    if (tag === p2) {
      wrapperTypes.push({
        type: "suspense",
        title: "Component that can suspend while content is loading"
      });
    }
    if (tag === ProfilerTag) {
      wrapperTypes.push({
        type: "profiler",
        title: "Component that measures rendering performance"
      });
    }
    if (typeof name === "string") {
      const wrapperRegex = /^(\w+)\((.*)\)$/;
      let currentName = name;
      while (wrapperRegex.test(currentName)) {
        const match = currentName.match(wrapperRegex);
        if (match?.[1] && match?.[2]) {
          wrappers.unshift(match[1]);
          currentName = match[2];
        } else {
          break;
        }
      }
      name = currentName;
    }
    return {
      name: name || "Unknown",
      wrappers,
      wrapperTypes
    };
  };

  // src/web/state.ts
  var signalIsSettingsOpen = /* @__PURE__ */ d5(false);
  var signalRefWidget = /* @__PURE__ */ d5(
    null
  );
  var defaultWidgetConfig = {
    corner: "bottom-right",
    dimensions: {
      isFullWidth: false,
      isFullHeight: false,
      width: MIN_SIZE.width,
      height: MIN_SIZE.height,
      position: { x: SAFE_AREA, y: SAFE_AREA }
    },
    lastDimensions: {
      isFullWidth: false,
      isFullHeight: false,
      width: MIN_SIZE.width,
      height: MIN_SIZE.height,
      position: { x: SAFE_AREA, y: SAFE_AREA }
    },
    componentsTree: {
      width: MIN_CONTAINER_WIDTH
    }
  };
  var getInitialWidgetConfig = () => {
    const stored = readLocalStorage(LOCALSTORAGE_KEY);
    if (!stored) {
      saveLocalStorage(LOCALSTORAGE_KEY, {
        corner: defaultWidgetConfig.corner,
        dimensions: defaultWidgetConfig.dimensions,
        lastDimensions: defaultWidgetConfig.lastDimensions,
        componentsTree: defaultWidgetConfig.componentsTree
      });
      return defaultWidgetConfig;
    }
    return {
      corner: stored.corner ?? defaultWidgetConfig.corner,
      dimensions: stored.dimensions ?? defaultWidgetConfig.dimensions,
      lastDimensions: stored.lastDimensions ?? stored.dimensions ?? defaultWidgetConfig.lastDimensions,
      componentsTree: stored.componentsTree ?? defaultWidgetConfig.componentsTree
    };
  };
  var signalWidget = d5(getInitialWidgetConfig());
  var updateDimensions = () => {
    if (!IS_CLIENT) return;
    const { dimensions } = signalWidget.value;
    const { width, height, position } = dimensions;
    signalWidget.value = {
      ...signalWidget.value,
      dimensions: {
        isFullWidth: width >= window.innerWidth - SAFE_AREA * 2,
        isFullHeight: height >= window.innerHeight - SAFE_AREA * 2,
        width,
        height,
        position
      }
    };
  };
  var signalWidgetViews = d5({
    view: "none"
  });
  var storedCollapsed = readLocalStorage(
    LOCALSTORAGE_COLLAPSED_KEY
  );
  var signalWidgetCollapsed = /* @__PURE__ */ d5(storedCollapsed ?? null);

  // src/web/utils/preact/constant.ts
  function CONSTANT_UPDATE() {
    return false;
  }
  function constant(Component) {
    function Memoed(props) {
      this.shouldComponentUpdate = CONSTANT_UPDATE;
      return _3(Component, props);
    }
    Memoed.displayName = `Memo(${Component.displayName || Component.name})`;
    Memoed.prototype.isReactComponent = true;
    Memoed._forwarded = true;
    return Memoed;
  }

  // src/web/hooks/use-virtual-list.ts
  var useVirtualList = (options) => {
    const { count, getScrollElement, estimateSize, overscan = 5 } = options;
    const [scrollTop, setScrollTop] = d4(0);
    const [containerHeight, setContainerHeight] = d4(0);
    const refResizeObserver = A3();
    const refScrollElement = A3(null);
    const refRafId = A3(null);
    const itemHeight = estimateSize();
    const updateContainer = q2((entries) => {
      if (!refScrollElement.current) return;
      const height = entries?.[0]?.contentRect.height ?? refScrollElement.current.getBoundingClientRect().height;
      setContainerHeight(height);
    }, []);
    const debouncedUpdateContainer = q2(() => {
      if (refRafId.current !== null) {
        cancelAnimationFrame(refRafId.current);
      }
      refRafId.current = requestAnimationFrame(() => {
        updateContainer();
        refRafId.current = null;
      });
    }, [updateContainer]);
    y3(() => {
      const element = getScrollElement();
      if (!element) return;
      refScrollElement.current = element;
      const handleScroll = () => {
        if (!refScrollElement.current) return;
        setScrollTop(refScrollElement.current.scrollTop);
      };
      updateContainer();
      if (!refResizeObserver.current) {
        refResizeObserver.current = new ResizeObserver(() => {
          debouncedUpdateContainer();
        });
      }
      refResizeObserver.current.observe(element);
      element.addEventListener("scroll", handleScroll, { passive: true });
      const mutationObserver = new MutationObserver(debouncedUpdateContainer);
      mutationObserver.observe(element, {
        attributes: true,
        childList: true,
        subtree: true
      });
      return () => {
        element.removeEventListener("scroll", handleScroll);
        if (refResizeObserver.current) {
          refResizeObserver.current.disconnect();
        }
        mutationObserver.disconnect();
        if (refRafId.current !== null) {
          cancelAnimationFrame(refRafId.current);
        }
      };
    }, [getScrollElement, updateContainer, debouncedUpdateContainer]);
    const visibleRange = T3(() => {
      const start2 = Math.floor(scrollTop / itemHeight);
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      return {
        start: Math.max(0, start2 - overscan),
        end: Math.min(count, start2 + visibleCount + overscan)
      };
    }, [scrollTop, itemHeight, containerHeight, count, overscan]);
    const items = T3(() => {
      const virtualItems = [];
      for (let index = visibleRange.start; index < visibleRange.end; index++) {
        virtualItems.push({
          key: index,
          index,
          start: index * itemHeight
        });
      }
      return virtualItems;
    }, [visibleRange, itemHeight]);
    return {
      virtualItems: items,
      totalSize: count * itemHeight,
      scrollTop,
      containerHeight
    };
  };

  // src/web/utils/pin.ts
  var getFiberPath = (fiber) => {
    const pathSegments = [];
    let currentFiber = fiber;
    while (currentFiber) {
      const elementType = currentFiber.elementType;
      const name = typeof elementType === "function" ? elementType.displayName || elementType.name : typeof elementType === "string" ? elementType : "Unknown";
      const index = currentFiber.index !== void 0 ? `[${currentFiber.index}]` : "";
      pathSegments.unshift(`${name}${index}`);
      currentFiber = currentFiber.return ?? null;
    }
    return pathSegments.join("::");
  };

  // src/web/views/inspector/flash-overlay.ts
  var fadeOutTimers = /* @__PURE__ */ new WeakMap();
  var trackElementPosition = (element, callback) => {
    const handleScroll = callback.bind(null, element);
    document.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true
    });
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  };
  var flashManager = {
    activeFlashes: /* @__PURE__ */ new Map(),
    create(container) {
      const existingOverlay = container.querySelector(
        ".react-scan-flash-overlay"
      );
      const overlay = existingOverlay instanceof HTMLElement ? existingOverlay : (() => {
        const newOverlay = document.createElement("div");
        newOverlay.className = "react-scan-flash-overlay";
        container.appendChild(newOverlay);
        const scrollCleanup = trackElementPosition(container, () => {
          if (container.querySelector(".react-scan-flash-overlay")) {
            this.create(container);
          }
        });
        this.activeFlashes.set(container, {
          element: container,
          overlay: newOverlay,
          scrollCleanup
        });
        return newOverlay;
      })();
      const existingTimer = fadeOutTimers.get(overlay);
      if (existingTimer) {
        clearTimeout(existingTimer);
        fadeOutTimers.delete(overlay);
      }
      requestAnimationFrame(() => {
        overlay.style.transition = "none";
        overlay.style.opacity = "0.9";
        const timerId = setTimeout(() => {
          overlay.style.transition = "opacity 150ms ease-out";
          overlay.style.opacity = "0";
          const cleanupTimer = setTimeout(() => {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
            const entry = this.activeFlashes.get(container);
            if (entry?.scrollCleanup) {
              entry.scrollCleanup();
            }
            this.activeFlashes.delete(container);
            fadeOutTimers.delete(overlay);
          }, 150);
          fadeOutTimers.set(overlay, cleanupTimer);
        }, 300);
        fadeOutTimers.set(overlay, timerId);
      });
    },
    cleanup(container) {
      const entry = this.activeFlashes.get(container);
      if (entry) {
        const existingTimer = fadeOutTimers.get(entry.overlay);
        if (existingTimer) {
          clearTimeout(existingTimer);
          fadeOutTimers.delete(entry.overlay);
        }
        if (entry.overlay.parentNode) {
          entry.overlay.parentNode.removeChild(entry.overlay);
        }
        if (entry.scrollCleanup) {
          entry.scrollCleanup();
        }
        this.activeFlashes.delete(container);
      }
    },
    cleanupAll() {
      for (const [, entry] of this.activeFlashes) {
        this.cleanup(entry.element);
      }
    }
  };

  // src/web/views/inspector/states.ts
  var TIMELINE_MAX_UPDATES = 1e3;
  var timelineStateDefault = {
    updates: [],
    currentFiber: null,
    totalUpdates: 0,
    windowOffset: 0,
    currentIndex: 0,
    isViewingHistory: false,
    latestFiber: null,
    isVisible: false,
    playbackSpeed: 1
  };
  var timelineState = d5(timelineStateDefault);
  var inspectorUpdateSignal = d5(0);
  var pendingUpdates = [];
  var batchTimeout = null;
  var batchUpdates = () => {
    if (pendingUpdates.length === 0) return;
    const batchedUpdates = [...pendingUpdates];
    const { updates, totalUpdates, currentIndex, isViewingHistory } = timelineState.value;
    const newUpdates = [...updates];
    let newTotalUpdates = totalUpdates;
    for (const { update } of batchedUpdates) {
      if (newUpdates.length >= TIMELINE_MAX_UPDATES) {
        newUpdates.shift();
      }
      newUpdates.push(update);
      newTotalUpdates++;
    }
    const newWindowOffset = Math.max(0, newTotalUpdates - TIMELINE_MAX_UPDATES);
    let newCurrentIndex;
    if (isViewingHistory) {
      if (currentIndex === totalUpdates - 1) {
        newCurrentIndex = newUpdates.length - 1;
      } else if (currentIndex === 0) {
        newCurrentIndex = 0;
      } else {
        if (newWindowOffset === 0) {
          newCurrentIndex = currentIndex;
        } else {
          newCurrentIndex = currentIndex - 1;
        }
      }
    } else {
      newCurrentIndex = newUpdates.length - 1;
    }
    const lastUpdate = batchedUpdates[batchedUpdates.length - 1];
    timelineState.value = {
      ...timelineState.value,
      latestFiber: lastUpdate.fiber,
      updates: newUpdates,
      totalUpdates: newTotalUpdates,
      windowOffset: newWindowOffset,
      currentIndex: newCurrentIndex,
      isViewingHistory
    };
    pendingUpdates = pendingUpdates.slice(batchedUpdates.length);
  };
  var timelineActions = {
    showTimeline: () => {
      timelineState.value = {
        ...timelineState.value,
        isVisible: true
      };
    },
    hideTimeline: () => {
      timelineState.value = {
        ...timelineState.value,
        isVisible: false,
        currentIndex: timelineState.value.updates.length - 1
      };
    },
    updateFrame: (index, isViewingHistory) => {
      timelineState.value = {
        ...timelineState.value,
        currentIndex: index,
        isViewingHistory
      };
    },
    updatePlaybackSpeed: (speed) => {
      timelineState.value = {
        ...timelineState.value,
        playbackSpeed: speed
      };
    },
    addUpdate: (update, latestFiber) => {
      pendingUpdates.push({ update, fiber: latestFiber });
      if (!batchTimeout) {
        const processBatch = () => {
          batchUpdates();
          batchTimeout = null;
          if (pendingUpdates.length > 0) {
            batchTimeout = setTimeout(processBatch, 96);
          }
        };
        batchTimeout = setTimeout(processBatch, 96);
      }
    },
    reset: () => {
      if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
      }
      pendingUpdates = [];
      timelineState.value = timelineStateDefault;
    }
  };

  // src/web/views/inspector/components-tree/state.ts
  var searchState = d5({
    query: "",
    matches: [],
    currentMatchIndex: -1
  });
  var signalSkipTreeUpdate = /* @__PURE__ */ d5(false);

  // src/web/views/inspector/components-tree/index.tsx
  var flattenTree = (nodes, depth = 0, parentPath = null) => {
    return nodes.reduce((acc, node, index) => {
      const nodePath = node.element ? getFiberPath(node.fiber) : `${parentPath}-${index}`;
      const renderData = node.fiber?.type ? getRenderData(node.fiber) : void 0;
      const flatNode = {
        ...node,
        depth,
        nodeId: nodePath,
        parentId: parentPath,
        fiber: node.fiber,
        renderData
      };
      acc.push(flatNode);
      if (node.children?.length) {
        acc.push(...flattenTree(node.children, depth + 1, nodePath));
      }
      return acc;
    }, []);
  };
  var getMaxDepth = (nodes) => {
    return nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  };
  var calculateIndentSize = (containerWidth, maxDepth) => {
    const MIN_INDENT = 0;
    const MAX_INDENT = 24;
    const MIN_TOTAL_INDENT = 24;
    if (maxDepth <= 0) return MAX_INDENT;
    const availableSpace = Math.max(0, containerWidth - MIN_CONTAINER_WIDTH);
    if (availableSpace < MIN_TOTAL_INDENT) return MIN_INDENT;
    const targetTotalIndent = Math.min(
      availableSpace * 0.3,
      maxDepth * MAX_INDENT
    );
    const baseIndent = targetTotalIndent / maxDepth;
    return Math.max(MIN_INDENT, Math.min(MAX_INDENT, baseIndent));
  };
  var VALID_TYPES = ["memo", "forwardRef", "lazy", "suspense"];
  var parseTypeSearch = (query) => {
    const typeMatch = query.match(/\[(.*?)\]/);
    if (!typeMatch) return null;
    const typeSearches = [];
    const parts = typeMatch[1].split(",");
    for (const part of parts) {
      const trimmed = part.trim().toLowerCase();
      if (trimmed) typeSearches.push(trimmed);
    }
    return typeSearches;
  };
  var isValidTypeSearch = (typeSearches) => {
    if (typeSearches.length === 0) return false;
    for (const search of typeSearches) {
      let isValid = false;
      for (const validType of VALID_TYPES) {
        if (validType.toLowerCase().includes(search)) {
          isValid = true;
          break;
        }
      }
      if (!isValid) return false;
    }
    return true;
  };
  var matchesTypeSearch = (typeSearches, wrapperTypes) => {
    if (typeSearches.length === 0) return true;
    if (!wrapperTypes.length) return false;
    for (const search of typeSearches) {
      let foundMatch = false;
      for (const wrapper of wrapperTypes) {
        if (wrapper.type.toLowerCase().includes(search)) {
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) return false;
    }
    return true;
  };
  var useNodeHighlighting = (node, searchValue) => {
    return T3(() => {
      const { query, matches } = searchValue;
      const isMatch = matches.some((match) => match.nodeId === node.nodeId);
      const typeSearches = parseTypeSearch(query) || [];
      const searchQuery = query ? query.replace(/\[.*?\]/, "").trim() : "";
      if (!query || !isMatch) {
        return {
          highlightedText: /* @__PURE__ */ u6("span", { className: "truncate", children: node.label }),
          typeHighlight: false
        };
      }
      let matchesType = true;
      if (typeSearches.length > 0) {
        if (!node.fiber) {
          matchesType = false;
        } else {
          const { wrapperTypes } = getExtendedDisplayName(node.fiber);
          matchesType = matchesTypeSearch(typeSearches, wrapperTypes);
        }
      }
      let textContent = /* @__PURE__ */ u6("span", { className: "truncate", children: node.label });
      if (searchQuery) {
        try {
          if (searchQuery.startsWith("/") && searchQuery.endsWith("/")) {
            const pattern = searchQuery.slice(1, -1);
            const regex = new RegExp(`(${pattern})`, "i");
            const parts = node.label.split(regex);
            textContent = /* @__PURE__ */ u6("span", { className: "tree-node-search-highlight", children: parts.map(
              (part, index) => regex.test(part) ? /* @__PURE__ */ u6(
                "span",
                {
                  className: cn2("regex", {
                    start: regex.test(part) && index === 0,
                    middle: regex.test(part) && index % 2 === 1,
                    end: regex.test(part) && index === parts.length - 1,
                    "!ml-0": index === 1
                  }),
                  children: part
                },
                `${node.nodeId}-${part}`
              ) : part
            ) });
          } else {
            const lowerLabel = node.label.toLowerCase();
            const lowerQuery = searchQuery.toLowerCase();
            const index = lowerLabel.indexOf(lowerQuery);
            if (index >= 0) {
              textContent = /* @__PURE__ */ u6("span", { className: "tree-node-search-highlight", children: [
                node.label.slice(0, index),
                /* @__PURE__ */ u6("span", { className: "single", children: node.label.slice(index, index + searchQuery.length) }),
                node.label.slice(index + searchQuery.length)
              ] });
            }
          }
        } catch {
        }
      }
      return {
        highlightedText: textContent,
        typeHighlight: matchesType && typeSearches.length > 0
      };
    }, [node.label, node.nodeId, node.fiber, searchValue]);
  };
  var formatTime = (time) => {
    if (time > 0) {
      if (time < 0.1 - Number.EPSILON) {
        return "< 0.1";
      }
      if (time < 1e3) {
        return Number(time.toFixed(1)).toString();
      }
      return `${(time / 1e3).toFixed(1)}k`;
    }
    return "0";
  };
  var TreeNodeItem = ({
    node,
    nodeIndex,
    hasChildren,
    isCollapsed,
    handleTreeNodeClick,
    handleTreeNodeToggle,
    searchValue
  }) => {
    const refRenderCount = A3(null);
    const refPrevRenderCount = A3(node.renderData?.renderCount ?? 0);
    const { highlightedText, typeHighlight } = useNodeHighlighting(
      node,
      searchValue
    );
    y3(() => {
      const currentRenderCount = node.renderData?.renderCount;
      const element = refRenderCount.current;
      if (!element || !refPrevRenderCount.current || !currentRenderCount || refPrevRenderCount.current === currentRenderCount) {
        return;
      }
      element.classList.remove("count-flash");
      void element.offsetWidth;
      element.classList.add("count-flash");
      refPrevRenderCount.current = currentRenderCount;
    }, [node.renderData?.renderCount]);
    const renderTimeInfo = T3(() => {
      if (!node.renderData) return null;
      const { selfTime, totalTime, renderCount } = node.renderData;
      if (!renderCount) {
        return null;
      }
      return /* @__PURE__ */ u6(
        "span",
        {
          className: cn2(
            "flex items-center gap-x-0.5 ml-1.5",
            "text-[10px] text-neutral-400"
          ),
          children: /* @__PURE__ */ u6(
            "span",
            {
              ref: refRenderCount,
              title: `Self time: ${formatTime(selfTime)}ms
Total time: ${formatTime(totalTime)}ms`,
              className: "count-badge",
              children: [
                "\xD7",
                renderCount
              ]
            }
          )
        }
      );
    }, [node.renderData]);
    const componentTypes = T3(() => {
      if (!node.fiber) return null;
      const { wrapperTypes } = getExtendedDisplayName(node.fiber);
      const firstWrapperType = wrapperTypes[0];
      return /* @__PURE__ */ u6(
        "span",
        {
          className: cn2(
            "flex items-center gap-x-1",
            "text-[10px] text-neutral-400 tracking-wide",
            "overflow-hidden"
          ),
          children: [
            firstWrapperType && /* @__PURE__ */ u6(k2, { children: [
              /* @__PURE__ */ u6(
                "span",
                {
                  title: firstWrapperType?.title,
                  className: cn2(
                    "rounded py-[1px] px-1",
                    "bg-neutral-700 text-neutral-300",
                    "truncate",
                    firstWrapperType.type === "memo" && "bg-[#8e61e3] text-white",
                    typeHighlight && "bg-yellow-300 text-black"
                  ),
                  children: firstWrapperType.type
                },
                firstWrapperType.type
              ),
              firstWrapperType.compiler && /* @__PURE__ */ u6("span", { className: "text-yellow-300 ml-1", children: "\u2728" })
            ] }),
            wrapperTypes.length > 1 && `\xD7${wrapperTypes.length}`,
            renderTimeInfo
          ]
        }
      );
    }, [node.fiber, typeHighlight, renderTimeInfo]);
    return /* @__PURE__ */ u6(
      "button",
      {
        type: "button",
        title: node.title,
        "data-index": nodeIndex,
        className: cn2(
          "flex items-center gap-x-1",
          "pl-1 pr-2",
          "w-full h-7",
          "text-left",
          "rounded",
          "cursor-pointer select-none"
        ),
        onClick: handleTreeNodeClick,
        children: [
          /* @__PURE__ */ u6(
            "button",
            {
              type: "button",
              "data-index": nodeIndex,
              onClick: handleTreeNodeToggle,
              className: cn2("w-6 h-6 flex items-center justify-center", "text-left"),
              children: hasChildren && /* @__PURE__ */ u6(
                Icon,
                {
                  name: "icon-chevron-right",
                  size: 12,
                  className: cn2("transition-transform", !isCollapsed && "rotate-90")
                }
              )
            }
          ),
          highlightedText,
          componentTypes
        ]
      }
    );
  };
  var ComponentsTree = () => {
    const refContainer = A3(null);
    const refMainContainer = A3(null);
    const refSearchInputContainer = A3(null);
    const refSearchInput = A3(null);
    const refSelectedElement = A3(null);
    const refMaxTreeDepth = A3(0);
    const refIsHovering = A3(false);
    const refIsResizing = A3(false);
    const refResizeHandle = A3(null);
    const [flattenedNodes, setFlattenedNodes] = d4([]);
    const [collapsedNodes, setCollapsedNodes] = d4(/* @__PURE__ */ new Set());
    const [selectedIndex, setSelectedIndex] = d4(
      void 0
    );
    const [searchValue, setSearchValue] = d4(searchState.value);
    const visibleNodes = T3(() => {
      const visible = [];
      const nodes = flattenedNodes;
      const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
      for (const node of nodes) {
        let isVisible = true;
        let currentNode = node;
        while (currentNode.parentId) {
          const parent = nodeMap.get(currentNode.parentId);
          if (!parent) break;
          if (collapsedNodes.has(parent.nodeId)) {
            isVisible = false;
            break;
          }
          currentNode = parent;
        }
        if (isVisible) {
          visible.push(node);
        }
      }
      return visible;
    }, [collapsedNodes, flattenedNodes]);
    const ITEM_HEIGHT = 28;
    const { virtualItems, totalSize } = useVirtualList({
      count: visibleNodes.length,
      getScrollElement: () => refContainer.current,
      estimateSize: () => ITEM_HEIGHT,
      overscan: 5
    });
    const handleElementClick = q2(
      (element) => {
        refIsHovering.current = true;
        refSearchInput.current?.blur();
        signalSkipTreeUpdate.value = true;
        const { parentCompositeFiber } = getCompositeComponentFromElement(element);
        if (!parentCompositeFiber) return;
        Store.inspectState.value = {
          kind: "focused",
          focusedDomElement: element,
          fiber: parentCompositeFiber
        };
        const nodeIndex = visibleNodes.findIndex(
          (node) => node.element === element
        );
        if (nodeIndex !== -1) {
          setSelectedIndex(nodeIndex);
          const itemTop = nodeIndex * ITEM_HEIGHT;
          const container = refContainer.current;
          if (container) {
            const containerHeight = container.clientHeight;
            const scrollTop = container.scrollTop;
            if (itemTop < scrollTop || itemTop + ITEM_HEIGHT > scrollTop + containerHeight) {
              container.scrollTo({
                top: Math.max(0, itemTop - containerHeight / 2),
                behavior: "instant"
              });
            }
          }
        }
      },
      [visibleNodes]
    );
    const handleTreeNodeClick = q2(
      (e5) => {
        const target = e5.currentTarget;
        const index = Number(target.dataset.index);
        if (Number.isNaN(index)) return;
        const element = visibleNodes[index].element;
        if (!element) return;
        handleElementClick(element);
      },
      [visibleNodes, handleElementClick]
    );
    const handleToggle = q2((nodeId) => {
      setCollapsedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    }, []);
    const handleTreeNodeToggle = q2(
      (e5) => {
        e5.stopPropagation();
        const target = e5.target;
        const index = Number(target.dataset.index);
        if (Number.isNaN(index)) return;
        const nodeId = visibleNodes[index].nodeId;
        handleToggle(nodeId);
      },
      [visibleNodes, handleToggle]
    );
    const handleOnChangeSearch = q2(
      (query) => {
        refSearchInputContainer.current?.classList.remove("!border-red-500");
        const matches = [];
        if (!query) {
          searchState.value = { query, matches, currentMatchIndex: -1 };
          return;
        }
        if (query.includes("[") && !query.includes("]")) {
          if (query.length > query.indexOf("[") + 1) {
            refSearchInputContainer.current?.classList.add("!border-red-500");
            return;
          }
        }
        const typeSearches = parseTypeSearch(query) || [];
        if (query.includes("[")) {
          if (!isValidTypeSearch(typeSearches)) {
            refSearchInputContainer.current?.classList.add("!border-red-500");
            return;
          }
        }
        const searchQuery = query.replace(/\[.*?\]/, "").trim();
        const isRegex = /^\/.*\/$/.test(searchQuery);
        let matchesLabel = (_label) => false;
        if (searchQuery.startsWith("/") && !isRegex) {
          if (searchQuery.length > 1) {
            refSearchInputContainer.current?.classList.add("!border-red-500");
            return;
          }
        }
        if (isRegex) {
          try {
            const pattern = searchQuery.slice(1, -1);
            const regex = new RegExp(pattern, "i");
            matchesLabel = (label) => regex.test(label);
          } catch {
            refSearchInputContainer.current?.classList.add("!border-red-500");
            return;
          }
        } else if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          matchesLabel = (label) => label.toLowerCase().includes(lowerQuery);
        }
        for (const node of flattenedNodes) {
          let matchesSearch = true;
          if (searchQuery) {
            matchesSearch = matchesLabel(node.label);
          }
          if (matchesSearch && typeSearches.length > 0) {
            if (!node.fiber) {
              matchesSearch = false;
            } else {
              const { wrapperTypes } = getExtendedDisplayName(node.fiber);
              matchesSearch = matchesTypeSearch(typeSearches, wrapperTypes);
            }
          }
          if (matchesSearch) {
            matches.push(node);
          }
        }
        searchState.value = {
          query,
          matches,
          currentMatchIndex: matches.length > 0 ? 0 : -1
        };
        if (matches.length > 0) {
          const firstMatch = matches[0];
          const nodeIndex = visibleNodes.findIndex(
            (node) => node.nodeId === firstMatch.nodeId
          );
          if (nodeIndex !== -1) {
            const itemTop = nodeIndex * ITEM_HEIGHT;
            const container = refContainer.current;
            if (container) {
              const containerHeight = container.clientHeight;
              container.scrollTo({
                top: Math.max(0, itemTop - containerHeight / 2),
                behavior: "instant"
              });
            }
          }
        }
      },
      [flattenedNodes, visibleNodes]
    );
    const handleInputChange = q2(
      (e5) => {
        const target = e5.currentTarget;
        if (!target) return;
        handleOnChangeSearch(target.value);
      },
      [handleOnChangeSearch]
    );
    const navigateSearch = q2(
      (direction) => {
        const { matches, currentMatchIndex } = searchState.value;
        if (matches.length === 0) return;
        const newIndex = direction === "next" ? (currentMatchIndex + 1) % matches.length : (currentMatchIndex - 1 + matches.length) % matches.length;
        searchState.value = {
          ...searchState.value,
          currentMatchIndex: newIndex
        };
        const currentMatch = matches[newIndex];
        const nodeIndex = visibleNodes.findIndex(
          (node) => node.nodeId === currentMatch.nodeId
        );
        if (nodeIndex !== -1) {
          setSelectedIndex(nodeIndex);
          const itemTop = nodeIndex * ITEM_HEIGHT;
          const container = refContainer.current;
          if (container) {
            const containerHeight = container.clientHeight;
            container.scrollTo({
              top: Math.max(0, itemTop - containerHeight / 2),
              behavior: "instant"
            });
          }
        }
      },
      [visibleNodes]
    );
    const updateContainerWidths = q2((width) => {
      if (refMainContainer.current) {
        refMainContainer.current.style.width = `${width}px`;
      }
      if (refContainer.current) {
        refContainer.current.style.width = `${width}px`;
        const indentSize = calculateIndentSize(width, refMaxTreeDepth.current);
        refContainer.current.style.setProperty(
          "--indentation-size",
          `${indentSize}px`
        );
      }
    }, []);
    const updateResizeDirection = q2((width) => {
      if (!refResizeHandle.current) return;
      const parentWidth = signalWidget.value.dimensions.width;
      const maxWidth = Math.floor(parentWidth - MIN_CONTAINER_WIDTH / 2);
      refResizeHandle.current.classList.remove(
        "cursor-ew-resize",
        "cursor-w-resize",
        "cursor-e-resize"
      );
      if (width <= MIN_CONTAINER_WIDTH) {
        refResizeHandle.current.classList.add("cursor-w-resize");
      } else if (width >= maxWidth) {
        refResizeHandle.current.classList.add("cursor-e-resize");
      } else {
        refResizeHandle.current.classList.add("cursor-ew-resize");
      }
    }, []);
    const handleResize = q2(
      (e5) => {
        e5.preventDefault();
        e5.stopPropagation();
        if (!refContainer.current) return;
        refContainer.current.style.setProperty("pointer-events", "none");
        refIsResizing.current = true;
        const startX = e5.clientX;
        const startWidth = refContainer.current.offsetWidth;
        const parentWidth = signalWidget.value.dimensions.width;
        const maxWidth = Math.floor(parentWidth - MIN_CONTAINER_WIDTH / 2);
        updateResizeDirection(startWidth);
        const handlePointerMove = (e6) => {
          const delta = startX - e6.clientX;
          const newWidth = startWidth + delta;
          updateResizeDirection(newWidth);
          const clampedWidth = Math.min(
            maxWidth,
            Math.max(MIN_CONTAINER_WIDTH, newWidth)
          );
          updateContainerWidths(clampedWidth);
        };
        const handlePointerUp = () => {
          if (!refContainer.current) return;
          refContainer.current.style.removeProperty("pointer-events");
          document.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("pointerup", handlePointerUp);
          signalWidget.value = {
            ...signalWidget.value,
            componentsTree: {
              ...signalWidget.value.componentsTree,
              width: refContainer.current.offsetWidth
            }
          };
          saveLocalStorage(LOCALSTORAGE_KEY, signalWidget.value);
          refIsResizing.current = false;
        };
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
      },
      [updateContainerWidths, updateResizeDirection]
    );
    y3(() => {
      if (!refContainer.current) return;
      const currentWidth = refContainer.current.offsetWidth;
      updateResizeDirection(currentWidth);
      return signalWidget.subscribe(() => {
        if (!refContainer.current) return;
        updateResizeDirection(refContainer.current.offsetWidth);
      });
    }, [updateResizeDirection]);
    const onPointerLeave = q2(() => {
      refIsHovering.current = false;
    }, []);
    y3(() => {
      let isInitialTreeBuild = true;
      const buildTreeFromElements = (elements) => {
        const nodeMap = /* @__PURE__ */ new Map();
        const rootNodes = [];
        for (const { element, name, fiber } of elements) {
          if (!element) continue;
          let title = name;
          const { name: componentName, wrappers } = getExtendedDisplayName(fiber);
          if (componentName) {
            if (wrappers.length > 0) {
              title = `${wrappers.join("(")}(${componentName})${")".repeat(wrappers.length)}`;
            } else {
              title = componentName;
            }
          }
          nodeMap.set(element, {
            label: componentName || name,
            title,
            children: [],
            element,
            fiber
          });
        }
        for (const { element, depth } of elements) {
          if (!element) continue;
          const node = nodeMap.get(element);
          if (!node) continue;
          if (depth === 0) {
            rootNodes.push(node);
          } else {
            let parent = element.parentElement;
            while (parent) {
              const parentNode = nodeMap.get(parent);
              if (parentNode) {
                parentNode.children = parentNode.children || [];
                parentNode.children.push(node);
                break;
              }
              parent = parent.parentElement;
            }
          }
        }
        return rootNodes;
      };
      const updateTree = () => {
        const element = refSelectedElement.current;
        if (!element) return;
        const inspectableElements = getInspectableElements();
        const tree = buildTreeFromElements(inspectableElements);
        if (tree.length > 0) {
          const flattened = flattenTree(tree);
          const newMaxDepth = getMaxDepth(flattened);
          refMaxTreeDepth.current = newMaxDepth;
          updateContainerWidths(signalWidget.value.componentsTree.width);
          setFlattenedNodes(flattened);
          if (isInitialTreeBuild) {
            isInitialTreeBuild = false;
            const focusedIndex = flattened.findIndex(
              (node) => node.element === element
            );
            if (focusedIndex !== -1) {
              const itemTop = focusedIndex * ITEM_HEIGHT;
              const container = refContainer.current;
              if (container) {
                setTimeout(() => {
                  container.scrollTo({
                    top: itemTop,
                    behavior: "instant"
                  });
                }, 96);
              }
            }
          }
        }
      };
      const unsubscribeStore = Store.inspectState.subscribe((state) => {
        if (state.kind === "focused") {
          if (signalSkipTreeUpdate.value) {
            return;
          }
          handleOnChangeSearch("");
          refSelectedElement.current = state.focusedDomElement;
          updateTree();
        }
      });
      let rafId = 0;
      const unsubscribeUpdates = inspectorUpdateSignal.subscribe(() => {
        if (Store.inspectState.value.kind === "focused") {
          cancelAnimationFrame(rafId);
          if (refIsResizing.current) return;
          rafId = requestAnimationFrame(() => {
            signalSkipTreeUpdate.value = false;
            updateTree();
          });
        }
      });
      return () => {
        unsubscribeStore();
        unsubscribeUpdates();
        searchState.value = {
          query: "",
          matches: [],
          currentMatchIndex: -1
        };
      };
    }, []);
    y3(() => {
      const handleKeyDown = (e5) => {
        if (!refIsHovering.current) return;
        if (!selectedIndex) return;
        switch (e5.key) {
          case "ArrowUp": {
            e5.preventDefault();
            e5.stopPropagation();
            if (selectedIndex > 0) {
              const currentNode = visibleNodes[selectedIndex - 1];
              if (currentNode?.element) {
                handleElementClick(currentNode.element);
              }
            }
            return;
          }
          case "ArrowDown": {
            e5.preventDefault();
            e5.stopPropagation();
            if (selectedIndex < visibleNodes.length - 1) {
              const currentNode = visibleNodes[selectedIndex + 1];
              if (currentNode?.element) {
                handleElementClick(currentNode.element);
              }
            }
            return;
          }
          case "ArrowLeft": {
            e5.preventDefault();
            e5.stopPropagation();
            const currentNode = visibleNodes[selectedIndex];
            if (currentNode?.nodeId) {
              handleToggle(currentNode.nodeId);
            }
            return;
          }
          case "ArrowRight": {
            e5.preventDefault();
            e5.stopPropagation();
            const currentNode = visibleNodes[selectedIndex];
            if (currentNode?.nodeId) {
              handleToggle(currentNode.nodeId);
            }
            return;
          }
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [selectedIndex, visibleNodes, handleElementClick, handleToggle]);
    y3(() => {
      return searchState.subscribe(setSearchValue);
    }, []);
    y3(() => {
      const unsubscribe = signalWidget.subscribe((state) => {
        refMainContainer.current?.style.setProperty("transition", "width 0.1s");
        updateContainerWidths(state.componentsTree.width);
        setTimeout(() => {
          refMainContainer.current?.style.removeProperty("transition");
        }, 500);
      });
      return unsubscribe;
    }, []);
    return /* @__PURE__ */ u6("div", { className: "react-scan-components-tree flex", children: [
      /* @__PURE__ */ u6(
        "div",
        {
          ref: refResizeHandle,
          onPointerDown: handleResize,
          className: "relative resize-v-line",
          children: /* @__PURE__ */ u6("span", { children: /* @__PURE__ */ u6(Icon, { name: "icon-ellipsis", size: 18 }) })
        }
      ),
      /* @__PURE__ */ u6("div", { ref: refMainContainer, className: "flex flex-col h-full", children: [
        /* @__PURE__ */ u6("div", { className: "p-2 border-b border-[#1e1e1e]", children: /* @__PURE__ */ u6(
          "div",
          {
            ref: refSearchInputContainer,
            title: `Search components by:

\u2022 Name (e.g., "Button") \u2014 Case insensitive, matches any part

\u2022 Regular Expression (e.g., "/^Button/") \u2014 Use forward slashes

\u2022 Wrapper Type (e.g., "[memo,forwardRef]"):
   - Available types: memo, forwardRef, lazy, suspense
   - Matches any part of type name (e.g., "mo" matches "memo")
   - Use commas for multiple types

\u2022 Combined Search:
   - Mix name/regex with type: "button [for]"
   - Will match components satisfying both conditions

\u2022 Navigation:
   - Enter \u2192 Next match
   - Shift + Enter \u2192 Previous match
   - Cmd/Ctrl + Enter \u2192 Select and focus match
`,
            className: cn2(
              "relative",
              "flex items-center gap-x-1 px-2",
              "rounded",
              "border border-transparent",
              "focus-within:border-[#454545]",
              "bg-[#1e1e1e] text-neutral-300",
              "transition-colors",
              "whitespace-nowrap",
              "overflow-hidden"
            ),
            children: [
              /* @__PURE__ */ u6(Icon, { name: "icon-search", size: 12, className: " text-neutral-500" }),
              /* @__PURE__ */ u6("div", { className: "relative flex-1 h-7 overflow-hidden", children: /* @__PURE__ */ u6(
                "input",
                {
                  ref: refSearchInput,
                  type: "text",
                  value: searchState.value.query,
                  onClick: (e5) => {
                    e5.stopPropagation();
                    e5.currentTarget.focus();
                  },
                  onPointerDown: (e5) => {
                    e5.stopPropagation();
                  },
                  onKeyDown: (e5) => {
                    if (e5.key === "Escape") {
                      e5.currentTarget.blur();
                    }
                    if (searchState.value.matches.length) {
                      if (e5.key === "Enter" && e5.shiftKey) {
                        navigateSearch("prev");
                      } else if (e5.key === "Enter") {
                        if (e5.metaKey || e5.ctrlKey) {
                          e5.preventDefault();
                          e5.stopPropagation();
                          handleElementClick(
                            searchState.value.matches[searchState.value.currentMatchIndex].element
                          );
                          e5.currentTarget.focus();
                        } else {
                          navigateSearch("next");
                        }
                      }
                    }
                  },
                  onChange: handleInputChange,
                  className: "absolute inset-y-0 inset-x-1",
                  placeholder: "Component name, /regex/, or [type]"
                }
              ) }),
              searchState.value.query ? /* @__PURE__ */ u6(k2, { children: [
                /* @__PURE__ */ u6("span", { className: "flex items-center gap-x-0.5 text-xs text-neutral-500", children: [
                  searchState.value.currentMatchIndex + 1,
                  "|",
                  searchState.value.matches.length
                ] }),
                !!searchState.value.matches.length && /* @__PURE__ */ u6(k2, { children: [
                  /* @__PURE__ */ u6(
                    "button",
                    {
                      type: "button",
                      onClick: (e5) => {
                        e5.stopPropagation();
                        navigateSearch("prev");
                      },
                      className: "button rounded w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-300",
                      children: /* @__PURE__ */ u6(
                        Icon,
                        {
                          name: "icon-chevron-right",
                          className: "-rotate-90",
                          size: 12
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ u6(
                    "button",
                    {
                      type: "button",
                      onClick: (e5) => {
                        e5.stopPropagation();
                        navigateSearch("next");
                      },
                      className: "button rounded w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-300",
                      children: /* @__PURE__ */ u6(
                        Icon,
                        {
                          name: "icon-chevron-right",
                          className: "rotate-90",
                          size: 12
                        }
                      )
                    }
                  )
                ] }),
                /* @__PURE__ */ u6(
                  "button",
                  {
                    type: "button",
                    onClick: (e5) => {
                      e5.stopPropagation();
                      handleOnChangeSearch("");
                    },
                    className: "button rounded w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-300",
                    children: /* @__PURE__ */ u6(Icon, { name: "icon-close", size: 12 })
                  }
                )
              ] }) : !!flattenedNodes.length && /* @__PURE__ */ u6("span", { className: "text-xs text-neutral-500", children: flattenedNodes.length })
            ]
          }
        ) }),
        /* @__PURE__ */ u6("div", { className: "flex-1 overflow-hidden", children: /* @__PURE__ */ u6(
          "div",
          {
            ref: refContainer,
            onPointerLeave,
            className: "tree h-full overflow-auto will-change-transform",
            children: /* @__PURE__ */ u6(
              "div",
              {
                className: "relative w-full",
                style: {
                  height: totalSize
                },
                children: virtualItems.map((virtualItem) => {
                  const node = visibleNodes[virtualItem.index];
                  if (!node) return null;
                  const isSelected = Store.inspectState.value.kind === "focused" && node.element === Store.inspectState.value.focusedDomElement;
                  const isKeyboardSelected = virtualItem.index === selectedIndex;
                  return /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2(
                        "absolute left-0 w-full overflow-hidden",
                        "text-neutral-400 hover:text-neutral-300",
                        "bg-transparent hover:bg-[#5f3f9a]/20",
                        (isSelected || isKeyboardSelected) && "text-neutral-300 bg-[#5f3f9a]/40 hover:bg-[#5f3f9a]/40"
                      ),
                      style: {
                        top: virtualItem.start,
                        height: ITEM_HEIGHT
                      },
                      children: /* @__PURE__ */ u6(
                        "div",
                        {
                          className: "w-full h-full",
                          style: {
                            paddingLeft: `calc(${node.depth} * var(--indentation-size))`
                          },
                          children: /* @__PURE__ */ u6(
                            TreeNodeItem,
                            {
                              node,
                              nodeIndex: virtualItem.index,
                              hasChildren: !!node.children?.length,
                              isCollapsed: collapsedNodes.has(node.nodeId),
                              handleTreeNodeClick,
                              handleTreeNodeToggle,
                              searchValue
                            }
                          )
                        }
                      )
                    },
                    node.nodeId
                  );
                })
              }
            )
          }
        ) })
      ] })
    ] });
  };

  // src/web/components/copy-to-clipboard/index.tsx
  var CopyToClipboard = /* @__PURE__ */ M3(
    ({
      text,
      children,
      onCopy,
      className,
      iconSize = 14
    }) => {
      const [isCopied, setIsCopied] = d4(false);
      y3(() => {
        if (isCopied) {
          const timeout2 = setTimeout(() => setIsCopied(false), 600);
          return () => {
            clearTimeout(timeout2);
          };
        }
      }, [isCopied]);
      const copyToClipboard = q2(
        (e5) => {
          e5.preventDefault();
          e5.stopPropagation();
          navigator.clipboard.writeText(text).then(
            () => {
              setIsCopied(true);
              onCopy?.(true, text);
            },
            () => {
              onCopy?.(false, text);
            }
          );
        },
        [text, onCopy]
      );
      const ClipboardIcon = /* @__PURE__ */ u6(
        "button",
        {
          onClick: copyToClipboard,
          type: "button",
          className: cn2(
            "z-10",
            "flex items-center justify-center",
            "hover:text-dev-pink-400",
            "transition-colors duration-200 ease-in-out",
            "cursor-pointer",
            `size-[${iconSize}px]`,
            className
          ),
          children: /* @__PURE__ */ u6(
            Icon,
            {
              name: `icon-${isCopied ? "check" : "copy"}`,
              size: [iconSize],
              className: cn2(isCopied && "text-green-500")
            }
          )
        }
      );
      if (!children) {
        return ClipboardIcon;
      }
      return children({
        ClipboardIcon,
        onClick: copyToClipboard
      });
    }
  );

  // src/web/views/inspector/diff-value.tsx
  var ArrayHeader = ({
    length,
    expanded,
    onToggle,
    isNegative
  }) => /* @__PURE__ */ u6("div", { className: "flex items-center gap-1", children: [
    /* @__PURE__ */ u6(
      "button",
      {
        type: "button",
        onClick: onToggle,
        className: "flex items-center p-0 opacity-50",
        children: /* @__PURE__ */ u6(
          Icon,
          {
            name: "icon-chevron-right",
            size: 12,
            className: cn2(
              "transition-[color,transform]",
              isNegative ? "text-[#f87171]" : "text-[#4ade80]",
              expanded && "rotate-90"
            )
          }
        )
      }
    ),
    /* @__PURE__ */ u6("span", { children: [
      "Array(",
      length,
      ")"
    ] })
  ] });
  var TreeNode = ({
    value,
    path,
    isNegative
  }) => {
    const [isExpanded, setIsExpanded] = d4(false);
    const canExpand = value !== null && typeof value === "object" && !(value instanceof Date);
    if (!canExpand) {
      return /* @__PURE__ */ u6("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ u6("span", { className: "text-gray-500", children: [
          path,
          ":"
        ] }),
        /* @__PURE__ */ u6("span", { className: "truncate", children: formatValuePreview(value) })
      ] });
    }
    const entries = Object.entries(value);
    return /* @__PURE__ */ u6("div", { className: "flex flex-col", children: [
      /* @__PURE__ */ u6("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ u6(
          "button",
          {
            type: "button",
            onClick: () => setIsExpanded(!isExpanded),
            className: "flex items-center p-0 opacity-50",
            children: /* @__PURE__ */ u6(
              Icon,
              {
                name: "icon-chevron-right",
                size: 12,
                className: cn2(
                  "transition-[color,transform]",
                  isNegative ? "text-[#f87171]" : "text-[#4ade80]",
                  isExpanded && "rotate-90"
                )
              }
            )
          }
        ),
        /* @__PURE__ */ u6("span", { className: "text-gray-500", children: [
          path,
          ":"
        ] }),
        !isExpanded && /* @__PURE__ */ u6("span", { className: "truncate", children: value instanceof Date ? formatValuePreview(value) : `{${Object.keys(value).join(", ")}}` })
      ] }),
      isExpanded && /* @__PURE__ */ u6("div", { className: "pl-5 border-l border-[#333] mt-0.5 ml-1 flex flex-col gap-0.5", children: entries.map(([key, val]) => /* @__PURE__ */ u6(
        TreeNode,
        {
          value: val,
          path: key,
          isNegative
        },
        key
      )) })
    ] });
  };
  var DiffValueView = ({
    value,
    expanded,
    onToggle,
    isNegative
  }) => {
    const { value: safeValue, error } = safeGetValue(value);
    if (error) {
      return /* @__PURE__ */ u6("span", { className: "text-gray-500 font-italic", children: error });
    }
    const isExpandable = safeValue !== null && typeof safeValue === "object" && !(safeValue instanceof Promise);
    if (!isExpandable) {
      return /* @__PURE__ */ u6("span", { children: formatValuePreview(safeValue) });
    }
    if (Array.isArray(safeValue)) {
      return /* @__PURE__ */ u6("div", { className: "flex flex-col gap-1 relative", children: [
        /* @__PURE__ */ u6(
          ArrayHeader,
          {
            length: safeValue.length,
            expanded,
            onToggle,
            isNegative
          }
        ),
        expanded && /* @__PURE__ */ u6("div", { className: "pl-2 border-l border-[#333] mt-0.5 ml-1 flex flex-col gap-0.5", children: safeValue.map((item, index) => /* @__PURE__ */ u6(
          TreeNode,
          {
            value: item,
            path: index.toString(),
            isNegative
          },
          index.toString()
        )) }),
        /* @__PURE__ */ u6(
          CopyToClipboard,
          {
            text: formatForClipboard(safeValue),
            className: "absolute top-0.5 right-0.5 opacity-0 transition-opacity group-hover:opacity-100 self-end",
            children: ({ ClipboardIcon }) => /* @__PURE__ */ u6(k2, { children: ClipboardIcon })
          }
        )
      ] });
    }
    return /* @__PURE__ */ u6("div", { className: "flex items-start gap-1 relative", children: [
      /* @__PURE__ */ u6(
        "button",
        {
          type: "button",
          onClick: onToggle,
          className: cn2("flex items-center", "p-0 mt-0.5 mr-1", "opacity-50"),
          children: /* @__PURE__ */ u6(
            Icon,
            {
              name: "icon-chevron-right",
              size: 12,
              className: cn2(
                "transition-[color,transform]",
                isNegative ? "text-[#f87171]" : "text-[#4ade80]",
                expanded && "rotate-90"
              )
            }
          )
        }
      ),
      /* @__PURE__ */ u6("div", { className: "flex-1", children: !expanded ? /* @__PURE__ */ u6("span", { children: formatValuePreview(safeValue) }) : /* @__PURE__ */ u6("div", { className: "pl-2 border-l border-[#333] mt-0.5 ml-1 flex flex-col gap-0.5", children: Object.entries(safeValue).map(([key, val]) => /* @__PURE__ */ u6(
        TreeNode,
        {
          value: val,
          path: key,
          isNegative
        },
        key
      )) }) }),
      /* @__PURE__ */ u6(
        CopyToClipboard,
        {
          text: formatForClipboard(safeValue),
          className: "absolute top-0.5 right-0.5 opacity-0 transition-opacity group-hover:opacity-100 self-end",
          children: ({ ClipboardIcon }) => /* @__PURE__ */ u6(k2, { children: ClipboardIcon })
        }
      )
    ] });
  };

  // src/web/views/inspector/whats-changed/use-change-store.ts
  var CHANGES_QUEUE_INTERVAL = 50;
  d5({
    fiber: null,
    fiberProps: { current: [], changes: /* @__PURE__ */ new Set() },
    fiberState: { current: [], changes: /* @__PURE__ */ new Set() },
    fiberContext: { current: [], changes: /* @__PURE__ */ new Set() }
  });
  var getContextChangesValue = (discriminated) => {
    switch (discriminated.kind) {
      case "initialized": {
        return discriminated.changes.currentValue;
      }
      case "partially-initialized": {
        return discriminated.value;
      }
    }
  };
  var processChanges = (changes, targetMap) => {
    for (const change of changes) {
      const existing = targetMap.get(change.name);
      if (existing) {
        targetMap.set(existing.name, {
          count: existing.count + 1,
          currentValue: change.value,
          id: existing.name,
          lastUpdated: Date.now(),
          name: existing.name,
          previousValue: change.prevValue
        });
        continue;
      }
      targetMap.set(change.name, {
        count: 1,
        currentValue: change.value,
        id: change.name,
        lastUpdated: Date.now(),
        name: change.name,
        previousValue: change.prevValue
      });
    }
  };
  var processContextChanges = (contextChanges, aggregatedChanges) => {
    for (const change of contextChanges) {
      const existing = aggregatedChanges.contextChanges.get(change.contextType);
      if (existing) {
        if (isEqual(getContextChangesValue(existing), change.value)) {
          continue;
        }
        if (existing.kind === "partially-initialized") {
          aggregatedChanges.contextChanges.set(change.contextType, {
            kind: "initialized",
            changes: {
              count: 1,
              currentValue: change.value,
              id: change.contextType.toString(),
              // come back to this why was this ever expected to be a number?
              lastUpdated: Date.now(),
              name: change.name,
              previousValue: existing.value
            }
          });
          continue;
        }
        aggregatedChanges.contextChanges.set(change.contextType, {
          kind: "initialized",
          changes: {
            count: existing.changes.count + 1,
            currentValue: change.value,
            id: change.contextType.toString(),
            lastUpdated: Date.now(),
            name: change.name,
            previousValue: existing.changes.currentValue
          }
        });
        continue;
      }
      aggregatedChanges.contextChanges.set(change.contextType, {
        kind: "partially-initialized",
        id: change.contextType.toString(),
        lastUpdated: Date.now(),
        name: change.name,
        value: change.value
      });
    }
  };
  var collapseQueue = (queue) => {
    const localAggregatedChanges = {
      contextChanges: /* @__PURE__ */ new Map(),
      propsChanges: /* @__PURE__ */ new Map(),
      stateChanges: /* @__PURE__ */ new Map()
    };
    queue.forEach((changes) => {
      processContextChanges(changes.contextChanges, localAggregatedChanges);
      processChanges(changes.stateChanges, localAggregatedChanges.stateChanges);
      processChanges(changes.propsChanges, localAggregatedChanges.propsChanges);
    });
    return localAggregatedChanges;
  };
  var mergeSimpleChanges = (existingChanges, incomingChanges) => {
    const mergedChanges = /* @__PURE__ */ new Map();
    existingChanges.forEach((value, key) => {
      mergedChanges.set(key, value);
    });
    incomingChanges.forEach((incomingChange, key) => {
      const existing = mergedChanges.get(key);
      if (!existing) {
        mergedChanges.set(key, incomingChange);
        return;
      }
      mergedChanges.set(key, {
        count: existing.count + incomingChange.count,
        currentValue: incomingChange.currentValue,
        id: incomingChange.id,
        lastUpdated: incomingChange.lastUpdated,
        name: incomingChange.name,
        previousValue: incomingChange.previousValue
      });
    });
    return mergedChanges;
  };
  var mergeContextChanges = (existing, incoming) => {
    const contextChanges = /* @__PURE__ */ new Map();
    existing.contextChanges.forEach((value, key) => {
      contextChanges.set(key, value);
    });
    incoming.contextChanges.forEach((incomingChange, key) => {
      const existingChange = contextChanges.get(key);
      if (!existingChange) {
        contextChanges.set(key, incomingChange);
        return;
      }
      if (getContextChangesValue(incomingChange) === getContextChangesValue(existingChange)) {
        return;
      }
      switch (existingChange.kind) {
        case "initialized": {
          switch (incomingChange.kind) {
            case "initialized": {
              const preInitEntryOffset = 1;
              contextChanges.set(key, {
                kind: "initialized",
                changes: {
                  ...incomingChange.changes,
                  // if existing was initialized, the pre-initialization done by the collapsed queue was not necessary, so we need to increment count to account for the preInit entry
                  count: incomingChange.changes.count + existingChange.changes.count + preInitEntryOffset,
                  currentValue: incomingChange.changes.currentValue,
                  previousValue: incomingChange.changes.previousValue
                  // we always want to show this value, since this will be the true state transition (if you make the previousValue the last seen currentValue, u will have weird behavior with primitive state updates)
                }
              });
              return;
            }
            case "partially-initialized": {
              contextChanges.set(key, {
                kind: "initialized",
                changes: {
                  count: existingChange.changes.count + 1,
                  currentValue: incomingChange.value,
                  id: incomingChange.id,
                  lastUpdated: incomingChange.lastUpdated,
                  name: incomingChange.name,
                  previousValue: existingChange.changes.currentValue
                }
              });
              return;
            }
          }
        }
        case "partially-initialized": {
          switch (incomingChange.kind) {
            case "initialized": {
              contextChanges.set(key, {
                kind: "initialized",
                changes: {
                  count: incomingChange.changes.count + 1,
                  currentValue: incomingChange.changes.currentValue,
                  id: incomingChange.changes.id,
                  lastUpdated: incomingChange.changes.lastUpdated,
                  name: incomingChange.changes.name,
                  previousValue: existingChange.value
                }
              });
              return;
            }
            case "partially-initialized": {
              contextChanges.set(key, {
                kind: "initialized",
                changes: {
                  count: 1,
                  currentValue: incomingChange.value,
                  id: incomingChange.id,
                  lastUpdated: incomingChange.lastUpdated,
                  name: incomingChange.name,
                  previousValue: existingChange.value
                }
              });
              return;
            }
          }
        }
      }
    });
    return contextChanges;
  };
  var mergeChanges = (existing, incoming) => {
    const contextChanges = mergeContextChanges(existing, incoming);
    const propChanges = mergeSimpleChanges(
      existing.propsChanges,
      incoming.propsChanges
    );
    const stateChanges = mergeSimpleChanges(
      existing.stateChanges,
      incoming.stateChanges
    );
    return {
      contextChanges,
      propsChanges: propChanges,
      stateChanges
    };
  };
  var calculateTotalChanges = (changes) => {
    return Array.from(changes.propsChanges.values()).reduce(
      (acc, change) => acc + change.count,
      0
    ) + Array.from(changes.stateChanges.values()).reduce(
      (acc, change) => acc + change.count,
      0
    ) + Array.from(changes.contextChanges.values()).filter(
      (change) => change.kind === "initialized"
    ).reduce((acc, change) => acc + change.changes.count, 0);
  };
  var useInspectedFiberChangeStore = (opts) => {
    const pendingChanges = A3({ queue: [] });
    const [aggregatedChanges, setAggregatedChanges] = d4({
      propsChanges: /* @__PURE__ */ new Map(),
      stateChanges: /* @__PURE__ */ new Map(),
      contextChanges: /* @__PURE__ */ new Map()
    });
    const fiber = Store.inspectState.value.kind === "focused" ? Store.inspectState.value.fiber : null;
    const fiberId = fiber ? V(fiber) : null;
    y3(() => {
      const interval = setInterval(() => {
        if (pendingChanges.current.queue.length === 0) return;
        setAggregatedChanges((prevAggregatedChanges) => {
          const queueChanges = collapseQueue(pendingChanges.current.queue);
          const merged = mergeChanges(prevAggregatedChanges, queueChanges);
          calculateTotalChanges(prevAggregatedChanges);
          calculateTotalChanges(merged);
          return merged;
        });
        pendingChanges.current.queue = [];
      }, CHANGES_QUEUE_INTERVAL);
      return () => {
        clearInterval(interval);
      };
    }, [fiber]);
    y3(() => {
      if (!fiberId) {
        return;
      }
      const listener = (change) => {
        pendingChanges.current?.queue.push(change);
      };
      let listeners = Store.changesListeners.get(fiberId);
      if (!listeners) {
        listeners = [];
        Store.changesListeners.set(fiberId, listeners);
      }
      listeners.push(listener);
      return () => {
        setAggregatedChanges({
          propsChanges: /* @__PURE__ */ new Map(),
          stateChanges: /* @__PURE__ */ new Map(),
          contextChanges: /* @__PURE__ */ new Map()
        });
        pendingChanges.current.queue = [];
        Store.changesListeners.set(
          fiberId,
          Store.changesListeners.get(fiberId)?.filter((l7) => l7 !== listener) ?? []
        );
      };
    }, [fiberId]);
    y3(() => {
      return () => {
        setAggregatedChanges({
          propsChanges: /* @__PURE__ */ new Map(),
          stateChanges: /* @__PURE__ */ new Map(),
          contextChanges: /* @__PURE__ */ new Map()
        });
        pendingChanges.current.queue = [];
      };
    }, [fiberId]);
    return aggregatedChanges;
  };

  // src/web/views/inspector/what-changed.tsx
  var WhatChanged = /* @__PURE__ */ M3(() => {
    const [isExpanded, setIsExpanded] = d4(true);
    const aggregatedChanges = useInspectedFiberChangeStore();
    const [hasInitialized, setHasInitialized] = d4(false);
    const hasAnyChanges = calculateTotalChanges(aggregatedChanges) > 0;
    y3(() => {
      if (!hasInitialized && hasAnyChanges) {
        const timer = setTimeout(() => {
          setHasInitialized(true);
          requestAnimationFrame(() => {
            setIsExpanded(true);
          });
        }, 0);
        return () => clearTimeout(timer);
      }
    }, [hasInitialized, hasAnyChanges]);
    const initializedContextChanges = new Map(
      Array.from(aggregatedChanges.contextChanges.entries()).filter(([, value]) => value.kind === "initialized").map(([key, value]) => [
        key,
        // oxlint-disable-next-line typescript/no-non-null-assertion
        value.kind === "partially-initialized" ? null : value.changes
      ])
    );
    const fiber = Store.inspectState.value.kind === "focused" ? Store.inspectState.value.fiber : null;
    if (!fiber) {
      return;
    }
    return /* @__PURE__ */ u6(k2, { children: [
      /* @__PURE__ */ u6(WhatsChangedHeader, {}),
      /* @__PURE__ */ u6("div", { className: "overflow-hidden h-full flex flex-col gap-y-2", children: [
        /* @__PURE__ */ u6("div", { className: "flex flex-col gap-2 px-3 pt-2", children: [
          /* @__PURE__ */ u6("span", { className: "text-sm font-medium text-[#888]", children: [
            "Why did",
            " ",
            /* @__PURE__ */ u6("span", { className: "text-[#A855F7]", children: Te(fiber) }),
            " ",
            "render?"
          ] }),
          !hasAnyChanges && /* @__PURE__ */ u6("div", { className: "text-sm text-[#737373] bg-[#1E1E1E] rounded-md p-4 flex flex-col gap-4", children: [
            /* @__PURE__ */ u6("div", { children: "No changes detected since selecting" }),
            /* @__PURE__ */ u6("div", { children: "The props, state, and context changes within your component will be reported here" })
          ] })
        ] }),
        /* @__PURE__ */ u6(
          "div",
          {
            className: cn2(
              "flex flex-col gap-y-2 pl-3 relative overflow-y-auto h-full"
            ),
            children: [
              /* @__PURE__ */ u6(
                Section,
                {
                  changes: aggregatedChanges.propsChanges,
                  title: "Changed Props",
                  isExpanded
                }
              ),
              /* @__PURE__ */ u6(
                Section,
                {
                  renderName: (name) => renderStateName(
                    name,
                    Te(I(fiber)) ?? "Unknown Component"
                  ),
                  changes: aggregatedChanges.stateChanges,
                  title: "Changed State",
                  isExpanded
                }
              ),
              /* @__PURE__ */ u6(
                Section,
                {
                  changes: initializedContextChanges,
                  title: "Changed Context",
                  isExpanded
                }
              )
            ]
          }
        )
      ] })
    ] });
  });
  var renderStateName = (key, componentName) => {
    if (Number.isNaN(Number(key))) {
      return key;
    }
    const n4 = Number.parseInt(key);
    const getOrdinalSuffix = (num) => {
      const lastDigit = num % 10;
      const lastTwoDigits = num % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return "th";
      }
      switch (lastDigit) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };
    return /* @__PURE__ */ u6("span", { className: "truncate", children: [
      /* @__PURE__ */ u6("span", { className: "text-white", children: [
        n4,
        getOrdinalSuffix(n4),
        " hook",
        " "
      ] }),
      /* @__PURE__ */ u6("span", { style: { color: "#666" }, children: [
        "called in ",
        /* @__PURE__ */ u6("i", { className: "text-[#A855F7] truncate", children: componentName })
      ] })
    ] });
  };
  var WhatsChangedHeader = M3(() => {
    const refProps = A3(null);
    const refState = A3(null);
    const refContext = A3(null);
    const refStats = A3({
      isPropsChanged: false,
      isStateChanged: false,
      isContextChanged: false
    });
    y3(() => {
      const flash = throttle(() => {
        const flashElements = [];
        if (refProps.current?.dataset.flash === "true") {
          flashElements.push(refProps.current);
        }
        if (refState.current?.dataset.flash === "true") {
          flashElements.push(refState.current);
        }
        if (refContext.current?.dataset.flash === "true") {
          flashElements.push(refContext.current);
        }
        for (const element of flashElements) {
          element.classList.remove("count-flash-white");
          void element.offsetWidth;
          element.classList.add("count-flash-white");
        }
      }, 400);
      const unsubscribe = timelineState.subscribe((state) => {
        if (!refProps.current || !refState.current || !refContext.current) {
          return;
        }
        const { currentIndex, updates } = state;
        const currentUpdate = updates[currentIndex];
        if (!currentUpdate || currentIndex === 0) {
          return;
        }
        flash();
        refStats.current = {
          isPropsChanged: (currentUpdate.props?.changes?.size ?? 0) > 0,
          isStateChanged: (currentUpdate.state?.changes?.size ?? 0) > 0,
          isContextChanged: (currentUpdate.context?.changes?.size ?? 0) > 0
        };
        if (refProps.current.dataset.flash !== "true") {
          refProps.current.dataset.flash = refStats.current.isPropsChanged.toString();
        }
        if (refState.current.dataset.flash !== "true") {
          refState.current.dataset.flash = refStats.current.isStateChanged.toString();
        }
        if (refContext.current.dataset.flash !== "true") {
          refContext.current.dataset.flash = refStats.current.isContextChanged.toString();
        }
      });
      return unsubscribe;
    }, []);
    return /* @__PURE__ */ u6(
      "button",
      {
        type: "button",
        className: cn2(
          "react-section-header",
          "overflow-hidden",
          "max-h-0",
          "transition-[max-height]"
        ),
        children: /* @__PURE__ */ u6("div", { className: cn2("flex-1 react-scan-expandable"), children: /* @__PURE__ */ u6("div", { className: "overflow-hidden", children: /* @__PURE__ */ u6("div", { className: "flex items-center whitespace-nowrap", children: [
          /* @__PURE__ */ u6("div", { className: "flex items-center gap-x-2", children: "What changed?" }),
          /* @__PURE__ */ u6(
            "div",
            {
              className: cn2(
                "ml-auto",
                "change-scope",
                "transition-opacity duration-300 delay-150"
              ),
              children: [
                /* @__PURE__ */ u6("div", { ref: refProps, children: "props" }),
                /* @__PURE__ */ u6("div", { ref: refState, children: "state" }),
                /* @__PURE__ */ u6("div", { ref: refContext, children: "context" })
              ]
            }
          )
        ] }) }) })
      }
    );
  });
  var identity = (x5) => x5;
  var Section = /* @__PURE__ */ M3(
    ({ title, changes, renderName = identity }) => {
      const [expandedFns, setExpandedFns] = d4(/* @__PURE__ */ new Set());
      const [expandedEntries, setExpandedEntries] = d4(/* @__PURE__ */ new Set());
      const entries = Array.from(changes.entries());
      if (changes.size === 0) {
        return null;
      }
      return /* @__PURE__ */ u6("div", { children: [
        /* @__PURE__ */ u6("div", { className: "text-xs text-[#888] mb-1.5", children: title }),
        /* @__PURE__ */ u6("div", { className: "flex flex-col gap-2", children: entries.map(([entryKey, change]) => {
          const isEntryExpanded = expandedEntries.has(String(entryKey));
          const { value: prevValue, error: prevError } = safeGetValue(
            change.previousValue
          );
          const { value: currValue, error: currError } = safeGetValue(
            change.currentValue
          );
          const diff = getObjectDiff(prevValue, currValue);
          return /* @__PURE__ */ u6("div", { children: [
            /* @__PURE__ */ u6(
              "button",
              {
                onClick: () => {
                  setExpandedEntries((prev) => {
                    const next = new Set(prev);
                    if (next.has(String(entryKey))) {
                      next.delete(String(entryKey));
                    } else {
                      next.add(String(entryKey));
                    }
                    return next;
                  });
                },
                className: "flex items-center gap-2 w-full bg-transparent border-none p-0 cursor-pointer text-white text-xs",
                children: /* @__PURE__ */ u6("div", { className: "flex items-center gap-1.5 flex-1", children: [
                  /* @__PURE__ */ u6(
                    Icon,
                    {
                      name: "icon-chevron-right",
                      size: 12,
                      className: cn2(
                        "text-[#666] transition-transform duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                        {
                          "rotate-90": isEntryExpanded
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ u6("div", { className: "whitespace-pre-wrap break-words text-left font-medium flex items-center gap-x-1.5", children: [
                    renderName(change.name),
                    /* @__PURE__ */ u6(
                      CountBadge,
                      {
                        count: change.count,
                        isFunction: typeof change.currentValue === "function",
                        showWarning: diff.changes.length === 0,
                        forceFlash: true
                      }
                    )
                  ] })
                ] })
              }
            ),
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2("react-scan-expandable", {
                  "react-scan-expanded": isEntryExpanded
                }),
                children: /* @__PURE__ */ u6("div", { className: "pl-3 text-xs font-mono border-l-1 border-[#333]", children: /* @__PURE__ */ u6("div", { className: "flex flex-col gap-0.5", children: prevError || currError ? /* @__PURE__ */ u6(
                  AccessError,
                  {
                    currError,
                    prevError
                  }
                ) : diff.changes.length > 0 ? /* @__PURE__ */ u6(
                  DiffChange,
                  {
                    change,
                    diff,
                    expandedFns,
                    renderName,
                    setExpandedFns,
                    title
                  }
                ) : /* @__PURE__ */ u6(
                  ReferenceOnlyChange,
                  {
                    currValue,
                    entryKey,
                    expandedFns,
                    prevValue,
                    setExpandedFns
                  }
                ) }) })
              }
            )
          ] }, entryKey);
        }) })
      ] });
    }
  );
  var AccessError = ({
    prevError,
    currError
  }) => {
    return /* @__PURE__ */ u6(k2, { children: [
      prevError && /* @__PURE__ */ u6("div", { className: "text-[#f87171] bg-[#2a1515] pr-1.5 py-[3px] rounded italic", children: prevError }),
      currError && /* @__PURE__ */ u6("div", { className: "text-[#4ade80] bg-[#1a2a1a] pr-1.5 py-[3px] rounded italic mt-0.5", children: currError })
    ] });
  };
  var DiffChange = ({
    diff,
    title,
    renderName,
    change,
    expandedFns,
    setExpandedFns
  }) => {
    return diff.changes.map((diffChange, i6) => {
      const { value: prevDiffValue, error: prevDiffError } = safeGetValue(
        diffChange.prevValue
      );
      const { value: currDiffValue, error: currDiffError } = safeGetValue(
        diffChange.currentValue
      );
      const isFunction = typeof prevDiffValue === "function" || typeof currDiffValue === "function";
      let path;
      if (title === "Props") {
        path = diffChange.path.length > 0 ? `${renderName(String(change.name))}.${formatPath(diffChange.path)}` : void 0;
      }
      if (title === "State" && diffChange.path.length > 0) {
        path = `state.${formatPath(diffChange.path)}`;
      }
      if (!path) {
        path = formatPath(diffChange.path);
      }
      return /* @__PURE__ */ u6(
        "div",
        {
          className: cn2(
            "flex flex-col gap-y-1",
            i6 < diff.changes.length - 1 && "mb-4"
          ),
          children: [
            path && /* @__PURE__ */ u6("div", { className: "text-[#666] text-[10px]", children: path }),
            /* @__PURE__ */ u6(
              "button",
              {
                type: "button",
                className: cn2(
                  "group",
                  "flex items-start",
                  "py-[3px] px-1.5",
                  "text-left text-[#f87171] bg-[#2a1515]",
                  "rounded",
                  "overflow-hidden break-all",
                  isFunction && "cursor-pointer"
                ),
                onClick: isFunction ? () => {
                  const fnKey = `${formatPath(diffChange.path)}-prev`;
                  setExpandedFns((prev) => {
                    const next = new Set(prev);
                    if (next.has(fnKey)) {
                      next.delete(fnKey);
                    } else {
                      next.add(fnKey);
                    }
                    return next;
                  });
                } : void 0,
                children: [
                  /* @__PURE__ */ u6("span", { className: "w-3 flex items-center justify-center opacity-50", children: "-" }),
                  /* @__PURE__ */ u6("span", { className: "flex-1 whitespace-nowrap font-mono", children: prevDiffError ? /* @__PURE__ */ u6("span", { className: "italic text-[#f87171]", children: prevDiffError }) : isFunction ? /* @__PURE__ */ u6("div", { className: "flex gap-1 items-start flex-col", children: [
                    /* @__PURE__ */ u6("div", { className: "flex gap-1 items-start w-full", children: [
                      /* @__PURE__ */ u6("span", { className: "flex-1 max-h-40", children: formatFunctionPreview(
                        prevDiffValue,
                        expandedFns.has(`${formatPath(diffChange.path)}-prev`)
                      ) }),
                      typeof prevDiffValue === "function" && /* @__PURE__ */ u6(
                        CopyToClipboard,
                        {
                          text: prevDiffValue.toString(),
                          className: "opacity-0 transition-opacity group-hover:opacity-100",
                          children: ({ ClipboardIcon }) => /* @__PURE__ */ u6(k2, { children: ClipboardIcon })
                        }
                      )
                    ] }),
                    prevDiffValue?.toString() === currDiffValue?.toString() && /* @__PURE__ */ u6("div", { className: "text-[10px] text-[#666] italic", children: "Function reference changed" })
                  ] }) : /* @__PURE__ */ u6(
                    DiffValueView,
                    {
                      value: prevDiffValue,
                      expanded: expandedFns.has(
                        `${formatPath(diffChange.path)}-prev`
                      ),
                      onToggle: () => {
                        const key = `${formatPath(diffChange.path)}-prev`;
                        setExpandedFns((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        });
                      },
                      isNegative: true
                    }
                  ) })
                ]
              }
            ),
            /* @__PURE__ */ u6(
              "button",
              {
                type: "button",
                className: cn2(
                  "group",
                  "flex items-start",
                  "py-[3px] px-1.5",
                  "text-left text-[#4ade80] bg-[#1a2a1a]",
                  "rounded",
                  "overflow-hidden break-all",
                  isFunction && "cursor-pointer"
                ),
                onClick: isFunction ? () => {
                  const fnKey = `${formatPath(diffChange.path)}-current`;
                  setExpandedFns((prev) => {
                    const next = new Set(prev);
                    if (next.has(fnKey)) {
                      next.delete(fnKey);
                    } else {
                      next.add(fnKey);
                    }
                    return next;
                  });
                } : void 0,
                children: [
                  /* @__PURE__ */ u6("span", { className: "w-3 flex items-center justify-center opacity-50", children: "+" }),
                  /* @__PURE__ */ u6("span", { className: "flex-1 whitespace-pre-wrap font-mono", children: currDiffError ? /* @__PURE__ */ u6("span", { className: "italic text-[#4ade80]", children: currDiffError }) : isFunction ? /* @__PURE__ */ u6("div", { className: "flex gap-1 items-start flex-col", children: [
                    /* @__PURE__ */ u6("div", { className: "flex gap-1 items-start w-full", children: [
                      /* @__PURE__ */ u6("span", { className: "flex-1", children: formatFunctionPreview(
                        currDiffValue,
                        expandedFns.has(`${formatPath(diffChange.path)}-current`)
                      ) }),
                      typeof currDiffValue === "function" && /* @__PURE__ */ u6(
                        CopyToClipboard,
                        {
                          text: currDiffValue.toString(),
                          className: "opacity-0 transition-opacity group-hover:opacity-100",
                          children: ({ ClipboardIcon }) => /* @__PURE__ */ u6(k2, { children: ClipboardIcon })
                        }
                      )
                    ] }),
                    prevDiffValue?.toString() === currDiffValue?.toString() && /* @__PURE__ */ u6("div", { className: "text-[10px] text-[#666] italic", children: "Function reference changed" })
                  ] }) : /* @__PURE__ */ u6(
                    DiffValueView,
                    {
                      value: currDiffValue,
                      expanded: expandedFns.has(
                        `${formatPath(diffChange.path)}-current`
                      ),
                      onToggle: () => {
                        const key = `${formatPath(diffChange.path)}-current`;
                        setExpandedFns((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        });
                      },
                      isNegative: false
                    }
                  ) })
                ]
              }
            )
          ]
        },
        `${path}-${change.name}-${i6}`
      );
    });
  };
  var ReferenceOnlyChange = ({
    prevValue,
    currValue,
    entryKey,
    expandedFns,
    setExpandedFns
  }) => {
    return /* @__PURE__ */ u6(k2, { children: [
      /* @__PURE__ */ u6("div", { className: "group flex gap-0.5 items-start text-[#f87171] bg-[#2a1515] py-[3px] px-1.5 rounded", children: [
        /* @__PURE__ */ u6("span", { className: "w-3 flex items-center justify-center opacity-50", children: "-" }),
        /* @__PURE__ */ u6("span", { className: "flex-1 overflow-hidden whitespace-pre-wrap font-mono", children: /* @__PURE__ */ u6(
          DiffValueView,
          {
            value: prevValue,
            expanded: expandedFns.has(`${String(entryKey)}-prev`),
            onToggle: () => {
              const key = `${String(entryKey)}-prev`;
              setExpandedFns((prev) => {
                const next = new Set(prev);
                if (next.has(key)) {
                  next.delete(key);
                } else {
                  next.add(key);
                }
                return next;
              });
            },
            isNegative: true
          }
        ) })
      ] }),
      /* @__PURE__ */ u6("div", { className: "group flex gap-0.5 items-start text-[#4ade80] bg-[#1a2a1a] py-[3px] px-1.5 rounded mt-0.5", children: [
        /* @__PURE__ */ u6("span", { className: "w-3 flex items-center justify-center opacity-50", children: "+" }),
        /* @__PURE__ */ u6("span", { className: "flex-1 overflow-hidden whitespace-pre-wrap font-mono", children: /* @__PURE__ */ u6(
          DiffValueView,
          {
            value: currValue,
            expanded: expandedFns.has(`${String(entryKey)}-current`),
            onToggle: () => {
              const key = `${String(entryKey)}-current`;
              setExpandedFns((prev) => {
                const next = new Set(prev);
                if (next.has(key)) {
                  next.delete(key);
                } else {
                  next.add(key);
                }
                return next;
              });
            },
            isNegative: false
          }
        ) })
      ] }),
      typeof currValue === "object" && currValue !== null && /* @__PURE__ */ u6("div", { className: "text-[#666] text-[10px] italic mt-1 flex items-center gap-x-1", children: [
        /* @__PURE__ */ u6(
          Icon,
          {
            name: "icon-triangle-alert",
            className: "text-yellow-500 mb-px",
            size: 14
          }
        ),
        /* @__PURE__ */ u6("span", { children: "Reference changed but objects are structurally the same" })
      ] })
    ] });
  };
  var CountBadge = ({
    count,
    forceFlash,
    isFunction,
    showWarning
  }) => {
    const refIsFirstRender = A3(true);
    const refBadge = A3(null);
    const refPrevCount = A3(count);
    y3(() => {
      const element = refBadge.current;
      if (!element || refPrevCount.current === count) {
        return;
      }
      element.classList.remove("count-flash");
      void element.offsetWidth;
      element.classList.add("count-flash");
      refPrevCount.current = count;
    }, [count]);
    y3(() => {
      if (refIsFirstRender.current) {
        refIsFirstRender.current = false;
        return;
      }
      if (forceFlash) {
        let timer = setTimeout(() => {
          refBadge.current?.classList.add("count-flash-white");
          timer = setTimeout(() => {
            refBadge.current?.classList.remove("count-flash-white");
          }, 300);
        }, 500);
        return () => {
          clearTimeout(timer);
        };
      }
    }, [forceFlash]);
    return /* @__PURE__ */ u6("div", { ref: refBadge, className: "count-badge", children: [
      showWarning && /* @__PURE__ */ u6(
        Icon,
        {
          name: "icon-triangle-alert",
          className: "text-yellow-500 mb-px",
          size: 14
        }
      ),
      isFunction && /* @__PURE__ */ u6(Icon, { name: "icon-function", className: "text-[#A855F7] mb-px", size: 14 }),
      "x",
      count
    ] });
  };

  // src/web/views/inspector/index.tsx
  var globalInspectorState = {
    lastRendered: /* @__PURE__ */ new Map(),
    expandedPaths: /* @__PURE__ */ new Set(),
    cleanup: () => {
      globalInspectorState.lastRendered.clear();
      globalInspectorState.expandedPaths.clear();
      flashManager.cleanupAll();
      resetTracking();
      timelineActions.reset();
    }
  };
  var InspectorErrorBoundary = class extends x2 {
    constructor() {
      super(...arguments);
      this.state = {
        hasError: false,
        error: null
      };
      this.handleReset = () => {
        this.setState({ hasError: false, error: null });
        globalInspectorState.cleanup();
      };
    }
    static getDerivedStateFromError(e5) {
      return { hasError: true, error: e5 };
    }
    render() {
      if (this.state.hasError) {
        return /* @__PURE__ */ u6("div", { className: "p-4 bg-red-950/50 h-screen backdrop-blur-sm", children: [
          /* @__PURE__ */ u6("div", { className: "flex items-center gap-2 mb-3 text-red-400 font-medium", children: [
            /* @__PURE__ */ u6(Icon, { name: "icon-flame", className: "text-red-500", size: 16 }),
            "Something went wrong in the inspector"
          ] }),
          /* @__PURE__ */ u6("div", { className: "p-3 bg-black/40 rounded font-mono text-xs text-red-300 mb-4 break-words", children: this.state.error?.message || JSON.stringify(this.state.error) }),
          /* @__PURE__ */ u6(
            "button",
            {
              type: "button",
              onClick: this.handleReset,
              className: "px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
              children: "Reset Inspector"
            }
          )
        ] });
      }
      return this.props.children;
    }
  };
  var inspectorContainerClassName = w4(
    () => cn2(
      "react-scan-inspector",
      "flex-1",
      "opacity-0",
      "overflow-y-auto overflow-x-hidden",
      "transition-opacity delay-0",
      "pointer-events-none",
      !signalIsSettingsOpen.value && "opacity-100 delay-300 pointer-events-auto"
    )
  );
  var Inspector = /* @__PURE__ */ constant(() => {
    const refLastInspectedFiber = A3(null);
    const processUpdate = (fiber) => {
      if (!fiber) return;
      refLastInspectedFiber.current = fiber;
      const { data: inspectorData, shouldUpdate } = collectInspectorData(fiber);
      if (shouldUpdate) {
        const update = {
          timestamp: Date.now(),
          fiberInfo: extractMinimalFiberInfo(fiber),
          props: inspectorData.fiberProps,
          state: inspectorData.fiberState,
          context: inspectorData.fiberContext,
          stateNames: getStateNames(fiber)
        };
        timelineActions.addUpdate(update, fiber);
      }
    };
    useSignalEffect(() => {
      const state = Store.inspectState.value;
      n3(() => {
        if (state.kind !== "focused" || !state.focusedDomElement) {
          refLastInspectedFiber.current = null;
          globalInspectorState.cleanup();
          return;
        }
        if (state.kind === "focused") {
          signalIsSettingsOpen.value = false;
        }
        const { parentCompositeFiber } = getCompositeFiberFromElement(
          state.focusedDomElement,
          state.fiber
        );
        if (!parentCompositeFiber) {
          Store.inspectState.value = {
            kind: "inspect-off"
          };
          signalWidgetViews.value = {
            view: "none"
          };
          return;
        }
        const isNewComponent = refLastInspectedFiber.current?.type !== parentCompositeFiber.type;
        if (isNewComponent) {
          refLastInspectedFiber.current = parentCompositeFiber;
          globalInspectorState.cleanup();
          processUpdate(parentCompositeFiber);
        }
      });
    });
    useSignalEffect(() => {
      inspectorUpdateSignal.value;
      n3(() => {
        const inspectState = Store.inspectState.value;
        if (inspectState.kind !== "focused" || !inspectState.focusedDomElement) {
          refLastInspectedFiber.current = null;
          globalInspectorState.cleanup();
          return;
        }
        const { parentCompositeFiber } = getCompositeFiberFromElement(
          inspectState.focusedDomElement,
          inspectState.fiber
        );
        if (!parentCompositeFiber) {
          Store.inspectState.value = {
            kind: "inspect-off"
          };
          signalWidgetViews.value = {
            view: "none"
          };
          return;
        }
        processUpdate(parentCompositeFiber);
        if (!inspectState.focusedDomElement.isConnected) {
          refLastInspectedFiber.current = null;
          globalInspectorState.cleanup();
          Store.inspectState.value = {
            kind: "inspecting",
            hoveredDomElement: null
          };
        }
      });
    });
    y3(() => {
      return () => {
        globalInspectorState.cleanup();
      };
    }, []);
    return /* @__PURE__ */ u6(InspectorErrorBoundary, { children: /* @__PURE__ */ u6("div", { className: inspectorContainerClassName, children: /* @__PURE__ */ u6("div", { className: "w-full h-full", children: /* @__PURE__ */ u6(WhatChanged, {}) }) }) });
  });
  var ViewInspector = /* @__PURE__ */ constant(() => {
    if (Store.inspectState.value.kind !== "focused") return null;
    return /* @__PURE__ */ u6(InspectorErrorBoundary, { children: [
      /* @__PURE__ */ u6(Inspector, {}),
      /* @__PURE__ */ u6(ComponentsTree, {})
    ] });
  });

  // src/web/views/inspector/utils.ts
  var getFiberFromElement = (element) => {
    if ("__REACT_DEVTOOLS_GLOBAL_HOOK__" in window) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook?.renderers) return null;
      for (const [, renderer] of Array.from(hook.renderers)) {
        try {
          const fiber = renderer.findFiberByHostInstance?.(element);
          if (fiber) return fiber;
        } catch {
        }
      }
    }
    if ("_reactRootContainer" in element) {
      const elementWithRoot = element;
      const rootContainer2 = elementWithRoot._reactRootContainer;
      return rootContainer2?._internalRoot?.current?.child ?? null;
    }
    for (const key in element) {
      if (key.startsWith("__reactInternalInstance$") || key.startsWith("__reactFiber")) {
        const elementWithFiber = element;
        return elementWithFiber[key];
      }
    }
    return null;
  };
  var getFirstStateNode = (fiber) => {
    let current = fiber;
    while (current) {
      if (current.stateNode instanceof Element) {
        return current.stateNode;
      }
      if (!current.child) {
        break;
      }
      current = current.child;
    }
    while (current) {
      if (current.stateNode instanceof Element) {
        return current.stateNode;
      }
      if (!current.return) {
        break;
      }
      current = current.return;
    }
    return null;
  };
  var getNearestFiberFromElement = (element) => {
    if (!element) return null;
    try {
      const fiber = getFiberFromElement(element);
      if (!fiber) return null;
      const res = getParentCompositeFiber(fiber);
      return res ? res[0] : null;
    } catch {
      return null;
    }
  };
  var getParentCompositeFiber = (fiber) => {
    let current = fiber;
    let prevHost = null;
    while (current) {
      if (pe(current)) return [current, prevHost];
      if (k(current) && !prevHost) prevHost = current;
      current = current.return;
    }
    return null;
  };
  var isFiberInTree = (fiber, root) => {
    {
      const res = !!N(root, (searchFiber) => searchFiber === fiber);
      return res;
    }
  };
  var getAssociatedFiberRect = async (element) => {
    const associatedFiber = getNearestFiberFromElement(element);
    if (!associatedFiber) return null;
    const stateNode = getFirstStateNode(associatedFiber);
    if (!stateNode) return null;
    const rect = await new Promise((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        observer.disconnect();
        resolve(entries[0]?.boundingClientRect ?? null);
      });
      observer.observe(stateNode);
    });
    return rect;
  };
  var getCompositeComponentFromElement = (element) => {
    const associatedFiber = getNearestFiberFromElement(element);
    if (!associatedFiber) return {};
    const stateNode = getFirstStateNode(associatedFiber);
    if (!stateNode) return {};
    const parentCompositeFiberInfo = getParentCompositeFiber(associatedFiber);
    if (!parentCompositeFiberInfo) {
      return {};
    }
    const [parentCompositeFiber] = parentCompositeFiberInfo;
    return {
      parentCompositeFiber
    };
  };
  var getCompositeFiberFromElement = (element, knownFiber) => {
    if (!element.isConnected) return {};
    let fiber = knownFiber ?? getNearestFiberFromElement(element);
    if (!fiber) return {};
    let curr = fiber;
    let rootFiber = null;
    let currentRootFiber = null;
    while (curr) {
      if (!curr.stateNode) {
        curr = curr.return;
        continue;
      }
      if (ReactScanInternals.instrumentation?.fiberRoots.has(curr.stateNode)) {
        rootFiber = curr;
        currentRootFiber = curr.stateNode.current;
        break;
      }
      curr = curr.return;
    }
    if (!rootFiber || !currentRootFiber) return {};
    fiber = isFiberInTree(fiber, currentRootFiber) ? fiber : fiber.alternate ?? fiber;
    if (!fiber) return {};
    if (!getFirstStateNode(fiber)) return {};
    const parentCompositeFiber = getParentCompositeFiber(fiber)?.[0];
    if (!parentCompositeFiber) return {};
    return {
      parentCompositeFiber: isFiberInTree(parentCompositeFiber, currentRootFiber) ? parentCompositeFiber : parentCompositeFiber.alternate ?? parentCompositeFiber
    };
  };
  var getChangedPropsDetailed = (fiber) => {
    const currentProps = fiber.memoizedProps ?? {};
    const previousProps = fiber.alternate?.memoizedProps ?? {};
    const changes = [];
    for (const key in currentProps) {
      if (key === "children") continue;
      const currentValue = currentProps[key];
      const prevValue = previousProps[key];
      if (!isEqual(currentValue, prevValue)) {
        changes.push({
          name: key,
          value: currentValue,
          prevValue,
          type: 1 /* Props */
        });
      }
    }
    return changes;
  };
  var nonVisualTags = /* @__PURE__ */ new Set([
    "HTML",
    "HEAD",
    "META",
    "TITLE",
    "BASE",
    "SCRIPT",
    "SCRIPT",
    "STYLE",
    "LINK",
    "NOSCRIPT",
    "SOURCE",
    "TRACK",
    "EMBED",
    "OBJECT",
    "PARAM",
    "TEMPLATE",
    "PORTAL",
    "SLOT",
    "AREA",
    "XML",
    "DOCTYPE",
    "COMMENT"
  ]);
  var findComponentDOMNode = (fiber, excludeNonVisualTags = true) => {
    if (fiber.stateNode && "nodeType" in fiber.stateNode) {
      const element = fiber.stateNode;
      if (excludeNonVisualTags && element.tagName && nonVisualTags.has(element.tagName.toLowerCase())) {
        return null;
      }
      return element;
    }
    let child = fiber.child;
    while (child) {
      const result = findComponentDOMNode(child, excludeNonVisualTags);
      if (result) return result;
      child = child.sibling;
    }
    return null;
  };
  var getInspectableElements = (root = document.body) => {
    const result = [];
    const findInspectableFiber = (element) => {
      if (!element) return null;
      const { parentCompositeFiber } = getCompositeComponentFromElement(element);
      if (!parentCompositeFiber) return null;
      const componentRoot = findComponentDOMNode(parentCompositeFiber);
      return componentRoot === element ? element : null;
    };
    const traverse = (element, depth = 0) => {
      const inspectable = findInspectableFiber(element);
      if (inspectable) {
        const { parentCompositeFiber } = getCompositeComponentFromElement(inspectable);
        if (!parentCompositeFiber) return;
        result.push({
          element: inspectable,
          depth,
          name: Te(parentCompositeFiber.type) ?? "Unknown",
          fiber: parentCompositeFiber
        });
      }
      for (const child of Array.from(element.children)) {
        traverse(child, inspectable ? depth + 1 : depth);
      }
    };
    traverse(root);
    return result;
  };
  var formatForClipboard = (value) => {
    try {
      if (value === null) return "null";
      if (value === void 0) return "undefined";
      if (isPromise(value)) return "Promise";
      if (typeof value === "function") {
        const fnStr = value.toString();
        try {
          const formatted = fnStr.replace(/\s+/g, " ").replace(/{\s+/g, "{\n  ").replace(/;\s+/g, ";\n  ").replace(/}\s*$/g, "\n}").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/,\s+/g, ", ");
          return formatted;
        } catch {
          return fnStr;
        }
      }
      switch (true) {
        case value instanceof Date:
          return value.toISOString();
        case value instanceof RegExp:
          return value.toString();
        case value instanceof Error:
          return `${value.name}: ${value.message}`;
        case value instanceof Map:
          return JSON.stringify(Array.from(value.entries()), null, 2);
        case value instanceof Set:
          return JSON.stringify(Array.from(value), null, 2);
        case value instanceof DataView:
          return JSON.stringify(
            Array.from(new Uint8Array(value.buffer)),
            null,
            2
          );
        case value instanceof ArrayBuffer:
          return JSON.stringify(Array.from(new Uint8Array(value)), null, 2);
        case (ArrayBuffer.isView(value) && "length" in value):
          return JSON.stringify(
            Array.from(value),
            null,
            2
          );
        case Array.isArray(value):
          return JSON.stringify(value, null, 2);
        case typeof value === "object":
          return JSON.stringify(value, null, 2);
        default:
          return String(value);
      }
    } catch {
      return String(value);
    }
  };
  var areFunctionsEqual = (prev, current) => {
    try {
      if (typeof prev !== "function" || typeof current !== "function") {
        return false;
      }
      return prev.toString() === current.toString();
    } catch {
      return false;
    }
  };
  var getObjectDiff = (prev, current, path = [], seen = /* @__PURE__ */ new WeakSet()) => {
    if (prev === current) {
      return { type: "primitive", changes: [], hasDeepChanges: false };
    }
    if (typeof prev === "function" && typeof current === "function") {
      const isSameFunction = areFunctionsEqual(prev, current);
      return {
        type: "primitive",
        changes: [
          {
            path,
            prevValue: prev,
            currentValue: current,
            sameFunction: isSameFunction
          }
        ],
        hasDeepChanges: !isSameFunction
      };
    }
    if (prev === null || current === null || prev === void 0 || current === void 0 || typeof prev !== "object" || typeof current !== "object") {
      return {
        type: "primitive",
        changes: [{ path, prevValue: prev, currentValue: current }],
        hasDeepChanges: true
      };
    }
    if (seen.has(prev) || seen.has(current)) {
      return {
        type: "object",
        changes: [{ path, prevValue: "[Circular]", currentValue: "[Circular]" }],
        hasDeepChanges: false
      };
    }
    seen.add(prev);
    seen.add(current);
    const prevObj = prev;
    const currentObj = current;
    const allKeys = /* @__PURE__ */ new Set([
      ...Object.keys(prevObj),
      ...Object.keys(currentObj)
    ]);
    const changes = [];
    let hasDeepChanges = false;
    for (const key of allKeys) {
      const prevValue = prevObj[key];
      const currentValue = currentObj[key];
      if (prevValue !== currentValue) {
        if (typeof prevValue === "object" && typeof currentValue === "object" && prevValue !== null && currentValue !== null) {
          const nestedDiff = getObjectDiff(
            prevValue,
            currentValue,
            [...path, key],
            seen
          );
          changes.push(...nestedDiff.changes);
          if (nestedDiff.hasDeepChanges) {
            hasDeepChanges = true;
          }
        } else {
          changes.push({
            path: [...path, key],
            prevValue,
            currentValue
          });
          hasDeepChanges = true;
        }
      }
    }
    return {
      type: "object",
      changes,
      hasDeepChanges
    };
  };
  var formatPath = (path) => {
    if (path.length === 0) return "";
    return path.reduce((acc, segment, i6) => {
      if (/^\d+$/.test(segment)) {
        return `${acc}[${segment}]`;
      }
      return i6 === 0 ? segment : `${acc}.${segment}`;
    }, "");
  };
  function hackyJsFormatter(code) {
    const normalizedCode = code.replace(/\s+/g, " ").trim();
    const rawTokens = [];
    let current = "";
    for (let i6 = 0; i6 < normalizedCode.length; i6++) {
      const c6 = normalizedCode[i6];
      if (c6 === "=" && normalizedCode[i6 + 1] === ">") {
        if (current.trim()) rawTokens.push(current.trim());
        rawTokens.push("=>");
        current = "";
        i6++;
        continue;
      }
      if (/[(){}[\];,<>:\?!]/.test(c6)) {
        if (current.trim()) {
          rawTokens.push(current.trim());
        }
        rawTokens.push(c6);
        current = "";
      } else if (/\s/.test(c6)) {
        if (current.trim()) {
          rawTokens.push(current.trim());
        }
        current = "";
      } else {
        current += c6;
      }
    }
    if (current.trim()) {
      rawTokens.push(current.trim());
    }
    const merged = [];
    for (let i6 = 0; i6 < rawTokens.length; i6++) {
      const t5 = rawTokens[i6];
      const n4 = rawTokens[i6 + 1];
      if (t5 === "(" && n4 === ")" || t5 === "[" && n4 === "]" || t5 === "{" && n4 === "}" || t5 === "<" && n4 === ">") {
        merged.push(t5 + n4);
        i6++;
      } else {
        merged.push(t5);
      }
    }
    const arrowParamSet = /* @__PURE__ */ new Set();
    const genericSet = /* @__PURE__ */ new Set();
    function findMatchingPair(openTok, closeTok, startIndex) {
      let depth = 0;
      for (let j5 = startIndex; j5 < merged.length; j5++) {
        const token = merged[j5];
        if (token === openTok) depth++;
        else if (token === closeTok) {
          depth--;
          if (depth === 0) return j5;
        }
      }
      return -1;
    }
    for (let i6 = 0; i6 < merged.length; i6++) {
      const t5 = merged[i6];
      if (t5 === "(") {
        const closeIndex = findMatchingPair("(", ")", i6);
        if (closeIndex !== -1 && merged[closeIndex + 1] === "=>") {
          for (let k4 = i6; k4 <= closeIndex; k4++) {
            arrowParamSet.add(k4);
          }
        }
      }
    }
    for (let i6 = 1; i6 < merged.length; i6++) {
      const prev = merged[i6 - 1];
      const t5 = merged[i6];
      if (/^[a-zA-Z0-9_$]+$/.test(prev) && t5 === "<") {
        const closeIndex = findMatchingPair("<", ">", i6);
        if (closeIndex !== -1) {
          for (let k4 = i6; k4 <= closeIndex; k4++) {
            genericSet.add(k4);
          }
        }
      }
    }
    let indentLevel = 0;
    const indentStr = "  ";
    const lines = [];
    let line = "";
    function pushLine() {
      if (line.trim()) {
        lines.push(line.replace(/\s+$/, ""));
      }
      line = "";
    }
    function newLine() {
      pushLine();
      line = indentStr.repeat(indentLevel);
    }
    const stack = [];
    function stackTop() {
      return stack.length ? stack[stack.length - 1] : null;
    }
    function placeToken(tok, noSpaceBefore = false) {
      if (!line.trim()) {
        line += tok;
      } else {
        if (noSpaceBefore || /^[),;:\].}>]$/.test(tok)) {
          line += tok;
        } else {
          line += ` ${tok}`;
        }
      }
    }
    for (let i6 = 0; i6 < merged.length; i6++) {
      const tok = merged[i6];
      const next = merged[i6 + 1] || "";
      if (["(", "{", "[", "<"].includes(tok)) {
        placeToken(tok);
        stack.push(tok);
        if (tok === "{") {
          indentLevel++;
          newLine();
        } else if (tok === "(" || tok === "[" || tok === "<") {
          if (arrowParamSet.has(i6) && tok === "(" || genericSet.has(i6) && tok === "<") ; else {
            const directClose = {
              "(": ")",
              "[": "]",
              "<": ">"
            }[tok];
            if (next !== directClose && next !== "()" && next !== "[]" && next !== "<>") {
              indentLevel++;
              newLine();
            }
          }
        }
      } else if ([")", "}", "]", ">"].includes(tok)) {
        const opening = stackTop();
        if (tok === ")" && opening === "(" || tok === "]" && opening === "[" || tok === ">" && opening === "<") {
          if (!(arrowParamSet.has(i6) && tok === ")") && !(genericSet.has(i6) && tok === ">")) {
            indentLevel = Math.max(indentLevel - 1, 0);
            newLine();
          }
        } else if (tok === "}" && opening === "{") {
          indentLevel = Math.max(indentLevel - 1, 0);
          newLine();
        }
        stack.pop();
        placeToken(tok);
        if (tok === "}") {
          newLine();
        }
      } else if (/^\(\)|\[\]|\{\}|\<\>$/.test(tok)) {
        placeToken(tok);
      } else if (tok === "=>") {
        placeToken(tok);
      } else if (tok === ";") {
        placeToken(tok, true);
        newLine();
      } else if (tok === ",") {
        placeToken(tok, true);
        const top = stackTop();
        if (!(arrowParamSet.has(i6) && top === "(") && !(genericSet.has(i6) && top === "<")) {
          if (top && ["{", "[", "(", "<"].includes(top)) {
            newLine();
          }
        }
      } else {
        placeToken(tok);
      }
    }
    pushLine();
    return lines.join("\n").replace(/\n\s*\n+/g, "\n").trim();
  }
  var formatFunctionPreview = (fn2, expanded = false) => {
    try {
      const fnStr = fn2.toString();
      const match = fnStr.match(
        /(?:function\s*)?(?:\(([^)]*)\)|([^=>\s]+))\s*=>?/
      );
      if (!match) return "\u0192";
      const params = match[1] || match[2] || "";
      const cleanParams = params.replace(/\s+/g, "");
      if (!expanded) {
        return `\u0192 (${cleanParams}) => ...`;
      }
      return hackyJsFormatter(fnStr);
    } catch {
      return "\u0192";
    }
  };
  var formatValuePreview = (value) => {
    if (value === null) return "null";
    if (value === void 0) return "undefined";
    if (typeof value === "string")
      return `"${value.length > 150 ? `${value.slice(0, 20)}...` : value}"`;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (typeof value === "function") return formatFunctionPreview(value);
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value instanceof Map) return `Map(${value.size})`;
    if (value instanceof Set) return `Set(${value.size})`;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === "object") {
      const keys = Object.keys(value);
      return `{${keys.length > 2 ? `${keys.slice(0, 2).join(", ")}, ...` : keys.join(", ")}}`;
    }
    return String(value);
  };
  var safeGetValue = (value) => {
    if (value === null || value === void 0) return { value };
    if (typeof value === "function") return { value };
    if (typeof value !== "object") return { value };
    if (isPromise(value)) {
      return { value: "Promise" };
    }
    try {
      const proto = Object.getPrototypeOf(value);
      if (proto === Promise.prototype || proto?.constructor?.name === "Promise") {
        return { value: "Promise" };
      }
      return { value };
    } catch {
      return { value: null, error: "Error accessing value" };
    }
  };
  var isPromise = (value) => {
    return !!value && (value instanceof Promise || typeof value === "object" && "then" in value);
  };
  var extractMinimalFiberInfo = (fiber) => {
    const timings = Ce(fiber);
    return {
      displayName: Te(fiber) || "Unknown",
      type: fiber.type,
      key: fiber.key,
      id: fiber.index,
      selfTime: timings?.selfTime ?? null,
      totalTime: timings?.totalTime ?? null
    };
  };

  // src/web/views/inspector/timeline/utils.ts
  var propsTracker = /* @__PURE__ */ new Map();
  var stateTracker = /* @__PURE__ */ new Map();
  var contextTracker = /* @__PURE__ */ new Map();
  var lastComponentType = null;
  var STATE_NAME_REGEX = /\[(?<name>\w+),\s*set\w+\]/g;
  var getStateNames = (fiber) => {
    const componentSource = fiber.type?.toString?.() || "";
    return componentSource ? Array.from(
      componentSource.matchAll(STATE_NAME_REGEX),
      (m5) => m5.groups?.name ?? ""
    ) : [];
  };
  var resetTracking = () => {
    propsTracker.clear();
    stateTracker.clear();
    contextTracker.clear();
    lastComponentType = null;
  };
  var isInitialComponentUpdate = (fiber) => {
    const isNewComponent = fiber.type !== lastComponentType;
    lastComponentType = fiber.type;
    return isNewComponent;
  };
  var trackChange = (tracker, key, currentValue, previousValue) => {
    const existing = tracker.get(key);
    const isInitialValue = tracker === propsTracker || tracker === contextTracker;
    const hasChanged = !isEqual(currentValue, previousValue);
    if (!existing) {
      tracker.set(key, {
        count: hasChanged && isInitialValue ? 1 : 0,
        currentValue,
        previousValue,
        lastUpdated: Date.now()
      });
      return {
        hasChanged,
        count: hasChanged && isInitialValue ? 1 : isInitialValue ? 0 : 1
      };
    }
    if (!isEqual(existing.currentValue, currentValue)) {
      const newCount = existing.count + 1;
      tracker.set(key, {
        count: newCount,
        currentValue,
        previousValue: existing.currentValue,
        lastUpdated: Date.now()
      });
      return { hasChanged: true, count: newCount };
    }
    return { hasChanged: false, count: existing.count };
  };
  var getStateFromFiber = (fiber) => {
    if (!fiber) return {};
    if (fiber.tag === a2 || fiber.tag === f2 || fiber.tag === h2 || fiber.tag === m2) {
      let memoizedState = fiber.memoizedState;
      const state = {};
      let index = 0;
      while (memoizedState) {
        if (memoizedState.queue && memoizedState.memoizedState !== void 0) {
          state[index] = memoizedState.memoizedState;
        }
        memoizedState = memoizedState.next;
        index++;
      }
      return state;
    }
    if (fiber.tag === o2) {
      return fiber.memoizedState || {};
    }
    return {};
  };
  var collectPropsChanges = (fiber) => {
    const currentProps = fiber.memoizedProps || {};
    const prevProps = fiber.alternate?.memoizedProps || {};
    const current = {};
    const prev = {};
    const allProps = Object.keys(currentProps);
    for (const key of allProps) {
      if (key in currentProps) {
        current[key] = currentProps[key];
        prev[key] = prevProps[key];
      }
    }
    const changes = getChangedPropsDetailed(fiber).map((change) => ({
      name: change.name,
      value: change.value,
      prevValue: change.prevValue
    }));
    return { current, prev, changes };
  };
  var collectStateChanges = (fiber) => {
    const current = getStateFromFiber(fiber);
    const prev = fiber.alternate ? getStateFromFiber(fiber.alternate) : {};
    const changes = [];
    for (const [index, value] of Object.entries(current)) {
      const stateKey = fiber.tag === o2 ? index : Number(index);
      if (fiber.alternate && !isEqual(prev[index], value)) {
        changes.push({
          name: stateKey,
          value,
          prevValue: prev[index]
        });
      }
    }
    return { current, prev, changes };
  };
  var collectContextChanges = (fiber) => {
    const currentContexts = getAllFiberContexts(fiber);
    const prevContexts = fiber.alternate ? getAllFiberContexts(fiber.alternate) : /* @__PURE__ */ new Map();
    const current = {};
    const prev = {};
    const changes = [];
    const seenContexts = /* @__PURE__ */ new Set();
    for (const [contextType, ctx2] of currentContexts) {
      const name = ctx2.displayName;
      const contextKey = contextType;
      if (seenContexts.has(contextKey)) continue;
      seenContexts.add(contextKey);
      current[name] = ctx2.value;
      const prevCtx = prevContexts.get(contextType);
      if (prevCtx) {
        prev[name] = prevCtx.value;
        if (!isEqual(prevCtx.value, ctx2.value)) {
          changes.push({
            name,
            value: ctx2.value,
            prevValue: prevCtx.value,
            contextType
          });
        }
      }
    }
    return { current, prev, changes };
  };
  var collectInspectorData = (fiber) => {
    const emptySection = () => ({
      current: [],
      changes: /* @__PURE__ */ new Set(),
      changesCounts: /* @__PURE__ */ new Map()
    });
    if (!fiber) {
      return {
        data: {
          fiberProps: emptySection(),
          fiberState: emptySection(),
          fiberContext: emptySection()
        },
        shouldUpdate: false
      };
    }
    let hasNewChanges = false;
    const isInitialUpdate = isInitialComponentUpdate(fiber);
    const propsData = emptySection();
    if (fiber.memoizedProps) {
      const { current, changes } = collectPropsChanges(fiber);
      for (const [key, value] of Object.entries(current)) {
        propsData.current.push({
          name: key,
          value: isPromise(value) ? { type: "promise", displayValue: "Promise" } : value
        });
      }
      for (const change of changes) {
        const { hasChanged, count } = trackChange(
          propsTracker,
          change.name,
          change.value,
          change.prevValue
        );
        if (hasChanged) {
          hasNewChanges = true;
          propsData.changes.add(change.name);
          propsData.changesCounts.set(change.name, count);
        }
      }
    }
    const stateData = emptySection();
    const { current: stateCurrent, changes: stateChanges } = collectStateChanges(fiber);
    for (const [index, value] of Object.entries(stateCurrent)) {
      const stateKey = fiber.tag === o2 ? index : Number(index);
      stateData.current.push({ name: stateKey, value });
    }
    for (const change of stateChanges) {
      const { hasChanged, count } = trackChange(
        stateTracker,
        change.name,
        change.value,
        change.prevValue
      );
      if (hasChanged) {
        hasNewChanges = true;
        stateData.changes.add(change.name);
        stateData.changesCounts.set(change.name, count);
      }
    }
    const contextData = emptySection();
    const { current: contextCurrent, changes: contextChanges } = collectContextChanges(fiber);
    for (const [name, value] of Object.entries(contextCurrent)) {
      contextData.current.push({ name, value });
    }
    if (!isInitialUpdate) {
      for (const change of contextChanges) {
        const { hasChanged, count } = trackChange(
          contextTracker,
          change.name,
          change.value,
          change.prevValue
        );
        if (hasChanged) {
          hasNewChanges = true;
          contextData.changes.add(change.name);
          contextData.changesCounts.set(change.name, count);
        }
      }
    }
    if (!hasNewChanges && !isInitialUpdate) {
      propsData.changes.clear();
      stateData.changes.clear();
      contextData.changes.clear();
    }
    return {
      data: {
        fiberProps: propsData,
        fiberState: stateData,
        fiberContext: contextData
      },
      shouldUpdate: hasNewChanges || isInitialUpdate
    };
  };
  var fiberContextsCache = /* @__PURE__ */ new WeakMap();
  var getAllFiberContexts = (fiber) => {
    if (!fiber) {
      return /* @__PURE__ */ new Map();
    }
    const cachedContexts = fiberContextsCache.get(fiber);
    if (cachedContexts) {
      return cachedContexts;
    }
    const contexts = /* @__PURE__ */ new Map();
    let currentFiber = fiber;
    while (currentFiber) {
      const dependencies = currentFiber.dependencies;
      if (dependencies?.firstContext) {
        let contextItem = dependencies.firstContext;
        while (contextItem) {
          const memoizedValue = contextItem.memoizedValue;
          const displayName = contextItem.context?.displayName;
          if (!contexts.has(memoizedValue)) {
            contexts.set(contextItem.context, {
              value: memoizedValue,
              displayName: displayName ?? "UnnamedContext",
              contextType: null
            });
          }
          if (contextItem === contextItem.next) {
            break;
          }
          contextItem = contextItem.next;
        }
      }
      currentFiber = currentFiber.return;
    }
    fiberContextsCache.set(fiber, contexts);
    return contexts;
  };
  var collectInspectorDataWithoutCounts = (fiber) => {
    const emptySection = () => ({
      current: [],
      changes: /* @__PURE__ */ new Set(),
      changesCounts: /* @__PURE__ */ new Map()
    });
    if (!fiber) {
      return {
        fiberProps: emptySection(),
        fiberState: emptySection(),
        fiberContext: emptySection()
      };
    }
    const propsData = emptySection();
    if (fiber.memoizedProps) {
      const { current: current2, changes: changes2 } = collectPropsChanges(fiber);
      for (const [key, value] of Object.entries(current2)) {
        propsData.current.push({
          name: key,
          value: isPromise(value) ? { type: "promise", displayValue: "Promise" } : value
        });
      }
      for (const change of changes2) {
        propsData.changes.add(change.name);
        propsData.changesCounts.set(change.name, 1);
      }
    }
    const stateData = emptySection();
    if (fiber.memoizedState) {
      const { current: current2, changes: changes2 } = collectStateChanges(fiber);
      for (const [key, value] of Object.entries(current2)) {
        stateData.current.push({
          name: key,
          value: isPromise(value) ? { type: "promise", displayValue: "Promise" } : value
        });
      }
      for (const change of changes2) {
        stateData.changes.add(change.name);
        stateData.changesCounts.set(change.name, 1);
      }
    }
    const contextData = emptySection();
    const { current, changes } = collectContextChanges(fiber);
    for (const [key, value] of Object.entries(current)) {
      contextData.current.push({
        name: key,
        value: isPromise(value) ? { type: "promise", displayValue: "Promise" } : value
      });
    }
    for (const change of changes) {
      contextData.changes.add(change.name);
      contextData.changesCounts.set(change.name, 1);
    }
    return {
      // data: {
      fiberProps: propsData,
      fiberState: stateData,
      fiberContext: contextData
      // },
    };
  };

  // src/core/instrumentation.ts
  var RENDER_PHASE_STRING_TO_ENUM = {
    mount: 1 /* Mount */,
    update: 2 /* Update */,
    unmount: 4 /* Unmount */
  };
  var fps = 0;
  var lastTime = performance.now();
  var frameCount = 0;
  var initedFps = false;
  var updateFPS = () => {
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1e3) {
      fps = frameCount;
      frameCount = 0;
      lastTime = now;
    }
    requestAnimationFrame(updateFPS);
  };
  var getFPS = () => {
    if (!initedFps) {
      initedFps = true;
      updateFPS();
      fps = 60;
    }
    return fps;
  };
  var getStateChanges = (fiber) => {
    if (!fiber) return [];
    const changes = [];
    if (fiber.tag === a2 || fiber.tag === f2 || fiber.tag === h2 || fiber.tag === m2) {
      let memoizedState = fiber.memoizedState;
      let prevState = fiber.alternate?.memoizedState;
      let index = 0;
      while (memoizedState) {
        if (memoizedState.queue && memoizedState.memoizedState !== void 0) {
          const change = {
            type: 2 /* FunctionalState */,
            name: index.toString(),
            value: memoizedState.memoizedState,
            prevValue: prevState?.memoizedState
          };
          if (!isEqual(change.prevValue, change.value)) {
            changes.push(change);
          }
        }
        memoizedState = memoizedState.next;
        prevState = prevState?.next;
        index++;
      }
      return changes;
    }
    if (fiber.tag === o2) {
      const change = {
        type: 3 /* ClassState */,
        name: "state",
        value: fiber.memoizedState,
        prevValue: fiber.alternate?.memoizedState
      };
      if (!isEqual(change.prevValue, change.value)) {
        changes.push(change);
      }
      return changes;
    }
    return changes;
  };
  var lastContextId = 0;
  var contextIdMap = /* @__PURE__ */ new WeakMap();
  var getContextId = (contextFiber) => {
    const existing = contextIdMap.get(contextFiber);
    if (existing) {
      return existing;
    }
    lastContextId++;
    contextIdMap.set(contextFiber, lastContextId);
    return lastContextId;
  };
  function getContextChangesTraversal(nextValue, prevValue) {
    if (!nextValue || !prevValue) return;
    const nextMemoizedValue = nextValue.memoizedValue;
    const change = {
      type: 4 /* Context */,
      name: nextValue.context.displayName ?? "Context.Provider",
      value: nextMemoizedValue,
      contextType: getContextId(nextValue.context)
      // unstable: false,
    };
    this.push(change);
  }
  var getContextChanges = (fiber) => {
    const changes = [];
    ge(fiber, getContextChangesTraversal.bind(changes));
    return changes;
  };
  var instrumentationInstances = /* @__PURE__ */ new Map();
  var inited = false;
  var getAllInstances = () => Array.from(instrumentationInstances.values());
  var RENDER_DEBOUNCE_MS = 16;
  var renderDataMap = /* @__PURE__ */ new WeakMap();
  function getFiberIdentifier(fiber) {
    return String(V(fiber));
  }
  function getRenderData(fiber) {
    const id = getFiberIdentifier(fiber);
    const keyMap = renderDataMap.get(I(fiber));
    if (keyMap) {
      return keyMap.get(id);
    }
    return void 0;
  }
  function setRenderData(fiber, value) {
    const type = I(fiber.type);
    const id = getFiberIdentifier(fiber);
    let keyMap = renderDataMap.get(type);
    if (!keyMap) {
      keyMap = /* @__PURE__ */ new Map();
      renderDataMap.set(type, keyMap);
    }
    keyMap.set(id, value);
  }
  var trackRender = (fiber, fiberSelfTime, fiberTotalTime, hasChanges, hasDomMutations) => {
    const currentTimestamp = Date.now();
    const existingData = getRenderData(fiber);
    if ((hasChanges || hasDomMutations) && (!existingData || currentTimestamp - (existingData.lastRenderTimestamp || 0) > RENDER_DEBOUNCE_MS)) {
      const renderData = existingData || {
        selfTime: 0,
        totalTime: 0,
        renderCount: 0,
        lastRenderTimestamp: currentTimestamp
      };
      renderData.renderCount = (renderData.renderCount || 0) + 1;
      renderData.selfTime = fiberSelfTime || 0;
      renderData.totalTime = fiberTotalTime || 0;
      renderData.lastRenderTimestamp = currentTimestamp;
      setRenderData(fiber, { ...renderData });
    }
  };
  var createInstrumentation = (instanceKey, config) => {
    const instrumentation = {
      // this will typically be false, but in cases where a user provides showToolbar: true, this will be true
      isPaused: d5(!ReactScanInternals.options.value.enabled),
      fiberRoots: /* @__PURE__ */ new WeakSet()
    };
    instrumentationInstances.set(instanceKey, {
      key: instanceKey,
      config,
      instrumentation
    });
    if (!inited) {
      inited = true;
      Ne({
        name: "react-scan",
        onActive: config.onActive,
        onCommitFiberRoot(_rendererID, root) {
          instrumentation.fiberRoots.add(root);
          const allInstances = getAllInstances();
          for (const instance of allInstances) {
            instance.config.onCommitStart();
          }
          ke(
            root.current,
            (fiber, phase) => {
              const type = I(fiber.type);
              if (!type) return null;
              const allInstances2 = getAllInstances();
              const validInstancesIndicies = [];
              for (let i6 = 0, len = allInstances2.length; i6 < len; i6++) {
                const instance = allInstances2[i6];
                if (!instance.config.isValidFiber(fiber)) continue;
                validInstancesIndicies.push(i6);
              }
              if (!validInstancesIndicies.length) return null;
              const changes = [];
              if (allInstances2.some((instance) => instance.config.trackChanges)) {
                const changesProps = collectPropsChanges(fiber).changes;
                const changesState = collectStateChanges(fiber).changes;
                const changesContext = collectContextChanges(fiber).changes;
                changes.push.apply(
                  null,
                  changesProps.map(
                    (change) => ({
                      type: 1 /* Props */,
                      name: change.name,
                      value: change.value
                    })
                  )
                );
                for (const change of changesState) {
                  if (fiber.tag === o2) {
                    changes.push({
                      type: 3 /* ClassState */,
                      name: change.name.toString(),
                      value: change.value
                    });
                  } else {
                    changes.push({
                      type: 2 /* FunctionalState */,
                      name: change.name.toString(),
                      value: change.value
                    });
                  }
                }
                changes.push.apply(
                  null,
                  changesContext.map(
                    (change) => ({
                      type: 4 /* Context */,
                      name: change.name,
                      value: change.value,
                      contextType: Number(change.contextType)
                    })
                  )
                );
              }
              const { selfTime: fiberSelfTime, totalTime: fiberTotalTime } = Ce(fiber);
              const fps2 = getFPS();
              const render = {
                phase: RENDER_PHASE_STRING_TO_ENUM[phase],
                componentName: Te(type),
                count: 1,
                changes,
                time: fiberSelfTime,
                forget: we(fiber),
                // todo: allow this to be toggle-able through toolbar
                // todo: performance optimization: if the last fiber measure was very off screen, do not run isRenderUnnecessary
                unnecessary: null,
                didCommit: j(fiber),
                fps: fps2
              };
              const hasChanges = changes.length > 0;
              const hasDomMutations = ye(fiber).length > 0;
              if (phase === "update") {
                trackRender(
                  fiber,
                  fiberSelfTime,
                  fiberTotalTime,
                  hasChanges,
                  hasDomMutations
                );
              }
              for (let i6 = 0, len = validInstancesIndicies.length; i6 < len; i6++) {
                const index = validInstancesIndicies[i6];
                const instance = allInstances2[index];
                instance.config.onRender(fiber, [render]);
              }
            }
          );
          for (const instance of allInstances) {
            instance.config.onCommitFinish();
          }
        },
        onPostCommitFiberRoot() {
          const allInstances = getAllInstances();
          for (const instance of allInstances) {
            instance.config.onPostCommitFiberRoot();
          }
        }
      });
    }
    return instrumentation;
  };

  // src/web/utils/log.ts
  var log = (renders) => {
    const logMap = /* @__PURE__ */ new Map();
    for (let i6 = 0, len = renders.length; i6 < len; i6++) {
      const render = renders[i6];
      if (!render.componentName) continue;
      const changeLog = logMap.get(render.componentName) ?? [];
      const labelText = getLabelText([
        {
          aggregatedCount: 1,
          computedKey: null,
          name: render.componentName,
          frame: null,
          ...render,
          changes: {
            // TODO(Alexis): use a faster reduction method
            type: render.changes.reduce((set, change) => set | change.type, 0),
            unstable: render.changes.some((change) => change.unstable)
          },
          phase: render.phase,
          computedCurrent: null
        }
      ]);
      if (!labelText) continue;
      let prevChangedProps = null;
      let nextChangedProps = null;
      if (render.changes) {
        for (let i7 = 0, len2 = render.changes.length; i7 < len2; i7++) {
          const { name, prevValue, nextValue, unstable, type } = render.changes[i7];
          if (type === 1 /* Props */) {
            prevChangedProps ??= {};
            nextChangedProps ??= {};
            prevChangedProps[`${unstable ? "\u26A0\uFE0F" : ""}${name} (prev)`] = prevValue;
            nextChangedProps[`${unstable ? "\u26A0\uFE0F" : ""}${name} (next)`] = nextValue;
          } else {
            changeLog.push({
              prev: prevValue,
              next: nextValue,
              type: type === 4 /* Context */ ? "context" : "state",
              unstable: unstable ?? false
            });
          }
        }
      }
      if (prevChangedProps && nextChangedProps) {
        changeLog.push({
          prev: prevChangedProps,
          next: nextChangedProps,
          type: "props",
          unstable: false
        });
      }
      logMap.set(labelText, changeLog);
    }
    for (const [name, changeLog] of Array.from(logMap.entries())) {
      console.group(
        `%c${name}`,
        "background: hsla(0,0%,70%,.3); border-radius:3px; padding: 0 2px;"
      );
      for (const { type, prev, next, unstable } of changeLog) {
        console.log(`${type}:`, unstable ? "\u26A0\uFE0F" : "", prev, "!==", next);
      }
      console.groupEnd();
    }
  };
  var logIntro = () => {
    if (window.hideIntro) {
      window.hideIntro = void 0;
      return;
    }
    console.log(
      "%c[\xB7] %cReact Scan",
      "font-weight:bold;color:#7a68e8;font-size:20px;",
      "font-weight:bold;font-size:14px;"
    );
  };

  // src/new-outlines/canvas.ts
  var OUTLINE_ARRAY_SIZE = 7;
  var MONO_FONT = "Menlo,Consolas,Monaco,Liberation Mono,Lucida Console,monospace";
  var INTERPOLATION_SPEED = 0.2;
  var SNAP_THRESHOLD = 0.5;
  var lerp = (start2, end) => {
    const delta = end - start2;
    if (Math.abs(delta) < SNAP_THRESHOLD) return end;
    return start2 + delta * INTERPOLATION_SPEED;
  };
  var MAX_PARTS_LENGTH = 4;
  var MAX_LABEL_LENGTH = 40;
  var TOTAL_FRAMES = 45;
  var PRIMARY_COLOR = "115,97,230";
  function sortEntry(prev, next) {
    return next[0] - prev[0];
  }
  function getSortedEntries(countByNames) {
    const entries = [...countByNames.entries()];
    return entries.sort(sortEntry);
  }
  function getLabelTextPart([count, names]) {
    let part = `${names.slice(0, MAX_PARTS_LENGTH).join(", ")} \xD7${count}`;
    if (part.length > MAX_LABEL_LENGTH) {
      part = `${part.slice(0, MAX_LABEL_LENGTH)}\u2026`;
    }
    return part;
  }
  var getLabelText2 = (outlines) => {
    const nameByCount = /* @__PURE__ */ new Map();
    for (const { name, count } of outlines) {
      nameByCount.set(name, (nameByCount.get(name) || 0) + count);
    }
    const countByNames = /* @__PURE__ */ new Map();
    for (const [name, count] of nameByCount) {
      const names = countByNames.get(count);
      if (names) {
        names.push(name);
      } else {
        countByNames.set(count, [name]);
      }
    }
    const partsEntries = getSortedEntries(countByNames);
    let labelText = getLabelTextPart(partsEntries[0]);
    for (let i6 = 1, len = partsEntries.length; i6 < len; i6++) {
      labelText += ", " + getLabelTextPart(partsEntries[i6]);
    }
    if (labelText.length > MAX_LABEL_LENGTH) {
      return `${labelText.slice(0, MAX_LABEL_LENGTH)}\u2026`;
    }
    return labelText;
  };
  var getAreaFromOutlines = (outlines) => {
    let area = 0;
    for (const outline of outlines) {
      area += outline.width * outline.height;
    }
    return area;
  };
  var updateOutlines = (activeOutlines2, outlines) => {
    for (const { id, name, count, x: x5, y: y5, width, height, didCommit } of outlines) {
      const outline = {
        id,
        name,
        count,
        x: x5,
        y: y5,
        width,
        height,
        frame: 0,
        targetX: x5,
        targetY: y5,
        targetWidth: width,
        targetHeight: height,
        didCommit
      };
      const key = String(outline.id);
      const existingOutline = activeOutlines2.get(key);
      if (existingOutline) {
        existingOutline.count++;
        existingOutline.frame = 0;
        existingOutline.targetX = x5;
        existingOutline.targetY = y5;
        existingOutline.targetWidth = width;
        existingOutline.targetHeight = height;
        existingOutline.didCommit = didCommit;
      } else {
        activeOutlines2.set(key, outline);
      }
    }
  };
  var updateScroll = (activeOutlines2, deltaX, deltaY) => {
    for (const outline of activeOutlines2.values()) {
      const newX = outline.x - deltaX;
      const newY = outline.y - deltaY;
      outline.targetX = newX;
      outline.targetY = newY;
    }
  };
  var initCanvas = (canvas2, dpr2) => {
    const ctx2 = canvas2.getContext("2d", { alpha: true });
    if (ctx2) {
      ctx2.scale(dpr2, dpr2);
    }
    return ctx2;
  };
  var drawCanvas = (ctx2, canvas2, dpr2, activeOutlines2) => {
    ctx2.clearRect(0, 0, canvas2.width / dpr2, canvas2.height / dpr2);
    const groupedOutlinesMap = /* @__PURE__ */ new Map();
    const rectMap = /* @__PURE__ */ new Map();
    for (const outline of activeOutlines2.values()) {
      const {
        x: x5,
        y: y5,
        width,
        height,
        targetX,
        targetY,
        targetWidth,
        targetHeight,
        frame
      } = outline;
      if (targetX !== x5) {
        outline.x = lerp(x5, targetX);
      }
      if (targetY !== y5) {
        outline.y = lerp(y5, targetY);
      }
      if (targetWidth !== width) {
        outline.width = lerp(width, targetWidth);
      }
      if (targetHeight !== height) {
        outline.height = lerp(height, targetHeight);
      }
      const labelKey = `${targetX ?? x5},${targetY ?? y5}`;
      const rectKey = `${labelKey},${targetWidth ?? width},${targetHeight ?? height}`;
      const outlines = groupedOutlinesMap.get(labelKey);
      if (outlines) {
        outlines.push(outline);
      } else {
        groupedOutlinesMap.set(labelKey, [outline]);
      }
      const alpha = 1 - frame / TOTAL_FRAMES;
      outline.frame++;
      const rect = rectMap.get(rectKey) || {
        x: x5,
        y: y5,
        width,
        height,
        alpha
      };
      if (alpha > rect.alpha) {
        rect.alpha = alpha;
      }
      rectMap.set(rectKey, rect);
    }
    for (const { x: x5, y: y5, width, height, alpha } of rectMap.values()) {
      ctx2.strokeStyle = `rgba(${PRIMARY_COLOR},${alpha})`;
      ctx2.lineWidth = 1;
      const rx = Math.round(x5) + 0.5;
      const ry = Math.round(y5) + 0.5;
      const rw = Math.round(width);
      const rh = Math.round(height);
      ctx2.beginPath();
      ctx2.rect(rx, ry, rw, rh);
      ctx2.stroke();
      ctx2.fillStyle = `rgba(${PRIMARY_COLOR},${alpha * 0.1})`;
      ctx2.fill();
    }
    ctx2.font = `11px ${MONO_FONT}`;
    const labelMap = /* @__PURE__ */ new Map();
    ctx2.textRendering = "optimizeSpeed";
    for (const outlines of groupedOutlinesMap.values()) {
      const first = outlines[0];
      const { x: x5, y: y5, frame } = first;
      const alpha = 1 - frame / TOTAL_FRAMES;
      const text = getLabelText2(outlines);
      const { width } = ctx2.measureText(text);
      const height = 11;
      labelMap.set(`${x5},${y5},${width},${text}`, {
        text,
        width,
        height,
        alpha,
        x: x5,
        y: y5,
        outlines
      });
      if (frame > TOTAL_FRAMES) {
        for (const outline of outlines) {
          activeOutlines2.delete(String(outline.id));
        }
      }
    }
    const sortedLabels = Array.from(labelMap.entries()).sort(
      ([_6, a6], [__, b4]) => {
        return getAreaFromOutlines(b4.outlines) - getAreaFromOutlines(a6.outlines);
      }
    );
    for (const [labelKey, label] of sortedLabels) {
      if (!labelMap.has(labelKey)) continue;
      for (const [otherKey, otherLabel] of labelMap.entries()) {
        if (labelKey === otherKey) continue;
        const { x: x5, y: y5, width, height } = label;
        const {
          x: otherX,
          y: otherY,
          width: otherWidth,
          height: otherHeight
        } = otherLabel;
        if (x5 + width > otherX && otherX + otherWidth > x5 && y5 + height > otherY && otherY + otherHeight > y5) {
          label.text = getLabelText2(label.outlines.concat(otherLabel.outlines));
          label.width = ctx2.measureText(label.text).width;
          labelMap.delete(otherKey);
        }
      }
    }
    for (const label of labelMap.values()) {
      const { x: x5, y: y5, alpha, width, height, text } = label;
      let labelY = y5 - height - 4;
      if (labelY < 0) {
        labelY = 0;
      }
      ctx2.fillStyle = `rgba(${PRIMARY_COLOR},${alpha})`;
      ctx2.fillRect(x5, labelY, width + 4, height + 4);
      ctx2.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx2.fillText(text, x5 + 2, labelY + height);
    }
    return activeOutlines2.size > 0;
  };

  // src/new-outlines/index.ts
  var workerCode = "\"use strict\";(()=>{var D=\"Menlo,Consolas,Monaco,Liberation Mono,Lucida Console,monospace\";var T=(t,n)=>{let r=n-t;return Math.abs(r)<.5?n:t+r*.2};var x=\"115,97,230\";function P(t,n){return n[0]-t[0]}function F(t){return[...t.entries()].sort(P)}function v([t,n]){let r=`${n.slice(0,4).join(\", \")} \\xD7${t}`;return r.length>40&&(r=`${r.slice(0,40)}\\u2026`),r}var $=t=>{let n=new Map;for(let{name:e,count:u}of t)n.set(e,(n.get(e)||0)+u);let r=new Map;for(let[e,u]of n){let A=r.get(u);A?A.push(e):r.set(u,[e])}let d=F(r),a=v(d[0]);for(let e=1,u=d.length;e<u;e++)a+=\", \"+v(d[e]);return a.length>40?`${a.slice(0,40)}\\u2026`:a},H=t=>{let n=0;for(let r of t)n+=r.width*r.height;return n};var N=(t,n)=>{let r=t.getContext(\"2d\",{alpha:!0});return r&&r.scale(n,n),r},X=(t,n,r,d)=>{t.clearRect(0,0,n.width/r,n.height/r);let a=new Map,e=new Map;for(let i of d.values()){let{x:o,y:c,width:l,height:g,targetX:s,targetY:f,targetWidth:h,targetHeight:m,frame:O}=i;s!==o&&(i.x=T(o,s)),f!==c&&(i.y=T(c,f)),h!==l&&(i.width=T(l,h)),m!==g&&(i.height=T(g,m));let M=`${s??o},${f??c}`,L=`${M},${h??l},${m??g}`,S=a.get(M);S?S.push(i):a.set(M,[i]);let C=1-O/45;i.frame++;let _=e.get(L)||{x:o,y:c,width:l,height:g,alpha:C};C>_.alpha&&(_.alpha=C),e.set(L,_)}for(let{x:i,y:o,width:c,height:l,alpha:g}of e.values()){t.strokeStyle=`rgba(${x},${g})`,t.lineWidth=1;let s=Math.round(i)+.5,f=Math.round(o)+.5,h=Math.round(c),m=Math.round(l);t.beginPath(),t.rect(s,f,h,m),t.stroke(),t.fillStyle=`rgba(${x},${g*.1})`,t.fill()}t.font=`11px ${D}`;let u=new Map;t.textRendering=\"optimizeSpeed\";for(let i of a.values()){let o=i[0],{x:c,y:l,frame:g}=o,s=1-g/45,f=$(i),{width:h}=t.measureText(f),m=11;u.set(`${c},${l},${h},${f}`,{text:f,width:h,height:m,alpha:s,x:c,y:l,outlines:i});let O=l-m-4;if(O<0&&(O=0),g>45)for(let M of i)d.delete(String(M.id))}let A=Array.from(u.entries()).sort(([i,o],[c,l])=>H(l.outlines)-H(o.outlines));for(let[i,o]of A)if(u.has(i))for(let[c,l]of u.entries()){if(i===c)continue;let{x:g,y:s,width:f,height:h}=o,{x:m,y:O,width:M,height:L}=l;g+f>m&&m+M>g&&s+h>O&&O+L>s&&(o.text=$(o.outlines.concat(l.outlines)),o.width=t.measureText(o.text).width,u.delete(c))}for(let i of u.values()){let{x:o,y:c,alpha:l,width:g,height:s,text:f}=i,h=c-s-4;h<0&&(h=0),t.fillStyle=`rgba(${x},${l})`,t.fillRect(o,h,g+4,s+4),t.fillStyle=`rgba(255,255,255,${l})`,t.fillText(f,o+2,h+s)}return d.size>0};var p=null,w=null,b=1,y=new Map,E=null,R=()=>{if(!w||!p)return;X(w,p,b,y)?E=requestAnimationFrame(R):E=null};self.onmessage=t=>{let{type:n}=t.data;if(n===\"init\"&&(p=t.data.canvas,b=t.data.dpr,p&&(p.width=t.data.width,p.height=t.data.height,w=N(p,b))),!(!p||!w)){if(n===\"resize\"){b=t.data.dpr,p.width=t.data.width*b,p.height=t.data.height*b,w.resetTransform(),w.scale(b,b),R();return}if(n===\"draw-outlines\"){let{data:r,names:d}=t.data,a=new Float32Array(r);for(let e=0;e<a.length;e+=7){let u=a[e+2],A=a[e+3],i=a[e+4],o=a[e+5],c=a[e+6],l={id:a[e],name:d[e/7],count:a[e+1],x:u,y:A,width:i,height:o,frame:0,targetX:u,targetY:A,targetWidth:i,targetHeight:o,didCommit:c},g=String(l.id),s=y.get(g);s?(s.count++,s.frame=0,s.targetX=u,s.targetY=A,s.targetWidth=i,s.targetHeight=o,s.didCommit=c):y.set(g,l)}E||(E=requestAnimationFrame(R));return}if(n===\"scroll\"){let{deltaX:r,deltaY:d}=t.data;for(let a of y.values()){let e=a.x-r,u=a.y-d;a.targetX=e,a.targetY=u}}}};})();\n";
  var worker = null;
  var canvas = null;
  var ctx = null;
  var dpr = 1;
  var animationFrameId = null;
  var activeOutlines = /* @__PURE__ */ new Map();
  var blueprintMap = /* @__PURE__ */ new Map();
  var blueprintMapKeys = /* @__PURE__ */ new Set();
  var outlineFiber = (fiber) => {
    if (!pe(fiber)) return;
    const name = typeof fiber.type === "string" ? fiber.type : Te(fiber);
    if (!name) return;
    const blueprint = blueprintMap.get(fiber);
    const nearestFibers = Se(fiber);
    const didCommit = j(fiber);
    if (!blueprint) {
      blueprintMap.set(fiber, {
        name,
        count: 1,
        elements: nearestFibers.map((fiber2) => fiber2.stateNode),
        didCommit: didCommit ? 1 : 0
      });
      blueprintMapKeys.add(fiber);
    } else {
      blueprint.count++;
    }
  };
  var mergeRects = (rects) => {
    const firstRect = rects[0];
    if (rects.length === 1) return firstRect;
    let minX;
    let minY;
    let maxX;
    let maxY;
    for (let i6 = 0, len = rects.length; i6 < len; i6++) {
      const rect = rects[i6];
      minX = minX == null ? rect.x : Math.min(minX, rect.x);
      minY = minY == null ? rect.y : Math.min(minY, rect.y);
      maxX = maxX == null ? rect.x + rect.width : Math.max(maxX, rect.x + rect.width);
      maxY = maxY == null ? rect.y + rect.height : Math.max(maxY, rect.y + rect.height);
    }
    if (minX == null || minY == null || maxX == null || maxY == null) {
      return rects[0];
    }
    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
  };
  function onIntersect(entries, observer) {
    const newEntries = [];
    for (const entry of entries) {
      const element = entry.target;
      if (!this.seenElements.has(element)) {
        this.seenElements.add(element);
        newEntries.push(entry);
      }
    }
    if (newEntries.length > 0 && this.resolveNext) {
      this.resolveNext(newEntries);
      this.resolveNext = null;
    }
    if (this.seenElements.size === this.uniqueElements.size) {
      observer.disconnect();
      this.done = true;
      if (this.resolveNext) {
        this.resolveNext([]);
      }
    }
  }
  var getBatchedRectMap = async function* (elements) {
    const state = {
      uniqueElements: new Set(elements),
      seenElements: /* @__PURE__ */ new Set(),
      resolveNext: null,
      done: false
    };
    const observer = new IntersectionObserver(onIntersect.bind(state));
    for (const element of state.uniqueElements) {
      observer.observe(element);
    }
    while (!state.done) {
      const entries = await new Promise(
        (resolve) => {
          state.resolveNext = resolve;
        }
      );
      if (entries.length > 0) {
        yield entries;
      }
    }
  };
  var SupportedArrayBuffer = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : ArrayBuffer;
  var flushOutlines = async () => {
    const elements = [];
    for (const fiber of blueprintMapKeys) {
      const blueprint = blueprintMap.get(fiber);
      if (!blueprint) continue;
      for (let i6 = 0; i6 < blueprint.elements.length; i6++) {
        if (!(blueprint.elements[i6] instanceof Element)) {
          continue;
        }
        elements.push(blueprint.elements[i6]);
      }
    }
    const rectsMap = /* @__PURE__ */ new Map();
    for await (const entries of getBatchedRectMap(elements)) {
      for (const entry of entries) {
        const element = entry.target;
        const rect = entry.intersectionRect;
        if (entry.isIntersecting && rect.width && rect.height) {
          rectsMap.set(element, rect);
        }
      }
      const blueprints = [];
      const blueprintRects = [];
      const blueprintIds = [];
      for (const fiber of blueprintMapKeys) {
        const blueprint = blueprintMap.get(fiber);
        if (!blueprint) continue;
        const rects = [];
        for (let i6 = 0; i6 < blueprint.elements.length; i6++) {
          const element = blueprint.elements[i6];
          const rect = rectsMap.get(element);
          if (!rect) continue;
          rects.push(rect);
        }
        if (!rects.length) continue;
        blueprints.push(blueprint);
        blueprintRects.push(mergeRects(rects));
        blueprintIds.push(V(fiber));
      }
      if (blueprints.length > 0) {
        const arrayBuffer = new SupportedArrayBuffer(
          blueprints.length * OUTLINE_ARRAY_SIZE * 4
        );
        const sharedView = new Float32Array(arrayBuffer);
        const blueprintNames = new Array(blueprints.length);
        let outlineData;
        for (let i6 = 0, len = blueprints.length; i6 < len; i6++) {
          const blueprint = blueprints[i6];
          const id = blueprintIds[i6];
          const { x: x5, y: y5, width, height } = blueprintRects[i6];
          const { count, name, didCommit } = blueprint;
          if (worker) {
            const scaledIndex = i6 * OUTLINE_ARRAY_SIZE;
            sharedView[scaledIndex] = id;
            sharedView[scaledIndex + 1] = count;
            sharedView[scaledIndex + 2] = x5;
            sharedView[scaledIndex + 3] = y5;
            sharedView[scaledIndex + 4] = width;
            sharedView[scaledIndex + 5] = height;
            sharedView[scaledIndex + 6] = didCommit;
            blueprintNames[i6] = name;
          } else {
            outlineData ||= new Array(blueprints.length);
            outlineData[i6] = {
              id,
              name,
              count,
              x: x5,
              y: y5,
              width,
              height,
              didCommit
            };
          }
        }
        if (worker) {
          worker.postMessage({
            type: "draw-outlines",
            data: arrayBuffer,
            names: blueprintNames
          });
        } else if (canvas && ctx && outlineData) {
          updateOutlines(activeOutlines, outlineData);
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(draw);
          }
        }
      }
    }
    for (const fiber of blueprintMapKeys) {
      blueprintMap.delete(fiber);
      blueprintMapKeys.delete(fiber);
    }
  };
  var draw = () => {
    if (!ctx || !canvas) return;
    const shouldContinue = drawCanvas(ctx, canvas, dpr, activeOutlines);
    if (shouldContinue) {
      animationFrameId = requestAnimationFrame(draw);
    } else {
      animationFrameId = null;
    }
  };
  var IS_OFFSCREEN_CANVAS_WORKER_SUPPORTED = typeof OffscreenCanvas !== "undefined" && typeof Worker !== "undefined";
  var getDpr = () => {
    return Math.min(window.devicePixelRatio || 1, 2);
  };
  var getCanvasEl = () => {
    cleanup();
    const host = document.createElement("div");
    host.setAttribute("data-react-scan", "true");
    const shadowRoot2 = host.attachShadow({ mode: "open" });
    const canvasEl = document.createElement("canvas");
    canvasEl.style.position = "fixed";
    canvasEl.style.top = "0";
    canvasEl.style.left = "0";
    canvasEl.style.pointerEvents = "none";
    canvasEl.style.zIndex = "2147483646";
    canvasEl.setAttribute("aria-hidden", "true");
    shadowRoot2.appendChild(canvasEl);
    if (!canvasEl) return null;
    dpr = getDpr();
    canvas = canvasEl;
    const { innerWidth, innerHeight } = window;
    canvasEl.style.width = `${innerWidth}px`;
    canvasEl.style.height = `${innerHeight}px`;
    const width = innerWidth * dpr;
    const height = innerHeight * dpr;
    canvasEl.width = width;
    canvasEl.height = height;
    if (IS_OFFSCREEN_CANVAS_WORKER_SUPPORTED && !window.__REACT_SCAN_EXTENSION__) {
      try {
        worker = new Worker(
          URL.createObjectURL(
            new Blob([workerCode], { type: "application/javascript" })
          )
        );
        const offscreenCanvas = canvasEl.transferControlToOffscreen();
        worker?.postMessage(
          {
            type: "init",
            canvas: offscreenCanvas,
            width: canvasEl.width,
            height: canvasEl.height,
            dpr
          },
          [offscreenCanvas]
        );
      } catch (e5) {
        console.warn("Failed to initialize OffscreenCanvas worker:", e5);
      }
    }
    if (!worker) {
      ctx = initCanvas(canvasEl, dpr);
    }
    let isResizeScheduled = false;
    window.addEventListener("resize", () => {
      if (!isResizeScheduled) {
        isResizeScheduled = true;
        setTimeout(() => {
          const width2 = window.innerWidth;
          const height2 = window.innerHeight;
          dpr = getDpr();
          canvasEl.style.width = `${width2}px`;
          canvasEl.style.height = `${height2}px`;
          if (worker) {
            worker.postMessage({
              type: "resize",
              width: width2,
              height: height2,
              dpr
            });
          } else {
            canvasEl.width = width2 * dpr;
            canvasEl.height = height2 * dpr;
            if (ctx) {
              ctx.resetTransform();
              ctx.scale(dpr, dpr);
            }
            draw();
          }
          isResizeScheduled = false;
        });
      }
    });
    let prevScrollX = window.scrollX;
    let prevScrollY = window.scrollY;
    let isScrollScheduled = false;
    window.addEventListener("scroll", () => {
      if (!isScrollScheduled) {
        isScrollScheduled = true;
        setTimeout(() => {
          const { scrollX, scrollY } = window;
          const deltaX = scrollX - prevScrollX;
          const deltaY = scrollY - prevScrollY;
          prevScrollX = scrollX;
          prevScrollY = scrollY;
          if (worker) {
            worker.postMessage({
              type: "scroll",
              deltaX,
              deltaY
            });
          } else {
            requestAnimationFrame(
              updateScroll.bind(null, activeOutlines, deltaX, deltaY)
            );
          }
          isScrollScheduled = false;
        }, 16 * 2);
      }
    });
    setInterval(() => {
      if (blueprintMapKeys.size) {
        requestAnimationFrame(flushOutlines);
      }
    }, 16 * 2);
    shadowRoot2.appendChild(canvasEl);
    return host;
  };
  var hasStopped = () => {
    return globalThis.__REACT_SCAN_STOP__;
  };
  var cleanup = () => {
    const host = document.querySelector("[data-react-scan]");
    if (host) {
      host.remove();
    }
  };
  var reportRenderToListeners = (fiber) => {
    if (pe(fiber)) {
      if (ReactScanInternals.options.value.showToolbar !== false && Store.inspectState.value.kind === "focused") {
        const reportFiber = fiber;
        const { selfTime } = Ce(fiber);
        const displayName = Te(fiber.type);
        const fiberId = V(reportFiber);
        const currentData = Store.reportData.get(fiberId);
        const existingCount = currentData?.count ?? 0;
        const existingTime = currentData?.time ?? 0;
        const changes = [];
        const listeners = Store.changesListeners.get(V(fiber));
        if (listeners?.length) {
          const propsChanges = getChangedPropsDetailed(
            fiber
          ).map((change) => ({
            type: 1 /* Props */,
            name: change.name,
            value: change.value,
            prevValue: change.prevValue,
            unstable: false
          }));
          const stateChanges = getStateChanges(fiber);
          const fiberContext = getContextChanges(fiber);
          const contextChanges = fiberContext.map(
            (info) => ({
              name: info.name,
              type: 4 /* Context */,
              value: info.value,
              contextType: info.contextType
            })
          );
          listeners.forEach((listener) => {
            listener({
              propsChanges,
              stateChanges,
              contextChanges
            });
          });
        }
        const fiberData = {
          count: existingCount + 1,
          time: existingTime + selfTime || 0,
          renders: [],
          displayName,
          type: I(fiber.type) || null,
          changes
        };
        Store.reportData.set(fiberId, fiberData);
        needsReport = true;
      }
    }
  };
  var needsReport = false;
  var reportInterval;
  var startReportInterval = () => {
    clearInterval(reportInterval);
    reportInterval = setInterval(() => {
      if (needsReport) {
        Store.lastReportTime.value = Date.now();
        needsReport = false;
      }
    }, 50);
  };
  var isValidFiber = (fiber) => {
    if (ignoredProps.has(fiber.memoizedProps)) {
      return false;
    }
    return true;
  };
  var isInstrumentationInitialized = false;
  var initReactScanInstrumentation = (setupToolbar) => {
    if (hasStopped()) return;
    if (isInstrumentationInitialized) return;
    isInstrumentationInitialized = true;
    let schedule;
    let mounted = false;
    const scheduleSetup = () => {
      if (mounted) {
        return;
      }
      if (schedule) {
        cancelAnimationFrame(schedule);
      }
      schedule = requestAnimationFrame(() => {
        mounted = true;
        const host = getCanvasEl();
        if (host) {
          document.documentElement.appendChild(host);
        }
        setupToolbar();
      });
    };
    const instrumentation = createInstrumentation("react-scan-devtools-0.1.0", {
      onCommitStart: () => {
        ReactScanInternals.options.value.onCommitStart?.();
      },
      onActive: /* @__PURE__ */ (() => {
        let didActivate = false;
        return () => {
          if (hasStopped()) return;
          if (didActivate) return;
          didActivate = true;
          scheduleSetup();
          if (!window.__REACT_SCAN_EXTENSION__) {
            globalThis.__REACT_SCAN__ = {
              ReactScanInternals
            };
          }
          startReportInterval();
          logIntro();
        };
      })(),
      onError: () => {
      },
      isValidFiber,
      onRender: (fiber, renders) => {
        if (pe(fiber)) {
          Store.interactionListeningForRenders?.(fiber, renders);
        }
        const isOverlayPaused = ReactScanInternals.instrumentation?.isPaused.value;
        const isInspectorInactive = Store.inspectState.value.kind === "inspect-off" || Store.inspectState.value.kind === "uninitialized";
        const shouldFullyAbort = isOverlayPaused && isInspectorInactive;
        if (shouldFullyAbort) {
          return;
        }
        if (!isOverlayPaused) {
          outlineFiber(fiber);
        }
        if (ReactScanInternals.options.value.log) {
          log(renders);
        }
        if (Store.inspectState.value.kind === "focused") {
          inspectorUpdateSignal.value = Date.now();
        }
        if (!isInspectorInactive) {
          reportRenderToListeners(fiber);
        }
        ReactScanInternals.options.value.onRender?.(fiber, renders);
      },
      onCommitFinish: () => {
        scheduleSetup();
        ReactScanInternals.options.value.onCommitFinish?.();
      },
      onPostCommitFiberRoot() {
        scheduleSetup();
      },
      trackChanges: false
    });
    ReactScanInternals.instrumentation = instrumentation;
  };

  // src/web/assets/css/styles.css
  var styles_default = "*, ::before, ::after {\n  --tw-border-spacing-x: 0;\n  --tw-border-spacing-y: 0;\n  --tw-translate-x: 0;\n  --tw-translate-y: 0;\n  --tw-rotate: 0;\n  --tw-skew-x: 0;\n  --tw-skew-y: 0;\n  --tw-scale-x: 1;\n  --tw-scale-y: 1;\n  --tw-pan-x:  ;\n  --tw-pan-y:  ;\n  --tw-pinch-zoom:  ;\n  --tw-scroll-snap-strictness: proximity;\n  --tw-gradient-from-position:  ;\n  --tw-gradient-via-position:  ;\n  --tw-gradient-to-position:  ;\n  --tw-ordinal:  ;\n  --tw-slashed-zero:  ;\n  --tw-numeric-figure:  ;\n  --tw-numeric-spacing:  ;\n  --tw-numeric-fraction:  ;\n  --tw-ring-inset:  ;\n  --tw-ring-offset-width: 0px;\n  --tw-ring-offset-color: #fff;\n  --tw-ring-color: rgb(59 130 246 / 0.5);\n  --tw-ring-offset-shadow: 0 0 #0000;\n  --tw-ring-shadow: 0 0 #0000;\n  --tw-shadow: 0 0 #0000;\n  --tw-shadow-colored: 0 0 #0000;\n  --tw-blur:  ;\n  --tw-brightness:  ;\n  --tw-contrast:  ;\n  --tw-grayscale:  ;\n  --tw-hue-rotate:  ;\n  --tw-invert:  ;\n  --tw-saturate:  ;\n  --tw-sepia:  ;\n  --tw-drop-shadow:  ;\n  --tw-backdrop-blur:  ;\n  --tw-backdrop-brightness:  ;\n  --tw-backdrop-contrast:  ;\n  --tw-backdrop-grayscale:  ;\n  --tw-backdrop-hue-rotate:  ;\n  --tw-backdrop-invert:  ;\n  --tw-backdrop-opacity:  ;\n  --tw-backdrop-saturate:  ;\n  --tw-backdrop-sepia:  ;\n  --tw-contain-size:  ;\n  --tw-contain-layout:  ;\n  --tw-contain-paint:  ;\n  --tw-contain-style:  ;\n}\n\n::backdrop {\n  --tw-border-spacing-x: 0;\n  --tw-border-spacing-y: 0;\n  --tw-translate-x: 0;\n  --tw-translate-y: 0;\n  --tw-rotate: 0;\n  --tw-skew-x: 0;\n  --tw-skew-y: 0;\n  --tw-scale-x: 1;\n  --tw-scale-y: 1;\n  --tw-pan-x:  ;\n  --tw-pan-y:  ;\n  --tw-pinch-zoom:  ;\n  --tw-scroll-snap-strictness: proximity;\n  --tw-gradient-from-position:  ;\n  --tw-gradient-via-position:  ;\n  --tw-gradient-to-position:  ;\n  --tw-ordinal:  ;\n  --tw-slashed-zero:  ;\n  --tw-numeric-figure:  ;\n  --tw-numeric-spacing:  ;\n  --tw-numeric-fraction:  ;\n  --tw-ring-inset:  ;\n  --tw-ring-offset-width: 0px;\n  --tw-ring-offset-color: #fff;\n  --tw-ring-color: rgb(59 130 246 / 0.5);\n  --tw-ring-offset-shadow: 0 0 #0000;\n  --tw-ring-shadow: 0 0 #0000;\n  --tw-shadow: 0 0 #0000;\n  --tw-shadow-colored: 0 0 #0000;\n  --tw-blur:  ;\n  --tw-brightness:  ;\n  --tw-contrast:  ;\n  --tw-grayscale:  ;\n  --tw-hue-rotate:  ;\n  --tw-invert:  ;\n  --tw-saturate:  ;\n  --tw-sepia:  ;\n  --tw-drop-shadow:  ;\n  --tw-backdrop-blur:  ;\n  --tw-backdrop-brightness:  ;\n  --tw-backdrop-contrast:  ;\n  --tw-backdrop-grayscale:  ;\n  --tw-backdrop-hue-rotate:  ;\n  --tw-backdrop-invert:  ;\n  --tw-backdrop-opacity:  ;\n  --tw-backdrop-saturate:  ;\n  --tw-backdrop-sepia:  ;\n  --tw-contain-size:  ;\n  --tw-contain-layout:  ;\n  --tw-contain-paint:  ;\n  --tw-contain-style:  ;\n}/*\n! tailwindcss v3.4.17 | MIT License | https://tailwindcss.com\n*//*\n1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)\n2. Allow adding a border to an element by just adding a border-width. (https://github.com/tailwindcss/tailwindcss/pull/116)\n*/\n\n*,\n::before,\n::after {\n  box-sizing: border-box; /* 1 */\n  border-width: 0; /* 2 */\n  border-style: solid; /* 2 */\n  border-color: #e5e7eb; /* 2 */\n}\n\n::before,\n::after {\n  --tw-content: '';\n}\n\n/*\n1. Use a consistent sensible line-height in all browsers.\n2. Prevent adjustments of font size after orientation changes in iOS.\n3. Use a more readable tab size.\n4. Use the user's configured `sans` font-family by default.\n5. Use the user's configured `sans` font-feature-settings by default.\n6. Use the user's configured `sans` font-variation-settings by default.\n7. Disable tap highlights on iOS\n*/\n\nhtml,\n:host {\n  line-height: 1.5; /* 1 */\n  -webkit-text-size-adjust: 100%; /* 2 */\n  -moz-tab-size: 4; /* 3 */\n  -o-tab-size: 4;\n     tab-size: 4; /* 3 */\n  font-family: ui-sans-serif, system-ui, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"; /* 4 */\n  font-feature-settings: normal; /* 5 */\n  font-variation-settings: normal; /* 6 */\n  -webkit-tap-highlight-color: transparent; /* 7 */\n}\n\n/*\n1. Remove the margin in all browsers.\n2. Inherit line-height from `html` so users can set them as a class directly on the `html` element.\n*/\n\nbody {\n  margin: 0; /* 1 */\n  line-height: inherit; /* 2 */\n}\n\n/*\n1. Add the correct height in Firefox.\n2. Correct the inheritance of border color in Firefox. (https://bugzilla.mozilla.org/show_bug.cgi?id=190655)\n3. Ensure horizontal rules are visible by default.\n*/\n\nhr {\n  height: 0; /* 1 */\n  color: inherit; /* 2 */\n  border-top-width: 1px; /* 3 */\n}\n\n/*\nAdd the correct text decoration in Chrome, Edge, and Safari.\n*/\n\nabbr:where([title]) {\n  -webkit-text-decoration: underline dotted;\n          text-decoration: underline dotted;\n}\n\n/*\nRemove the default font size and weight for headings.\n*/\n\nh1,\nh2,\nh3,\nh4,\nh5,\nh6 {\n  font-size: inherit;\n  font-weight: inherit;\n}\n\n/*\nReset links to optimize for opt-in styling instead of opt-out.\n*/\n\na {\n  color: inherit;\n  text-decoration: inherit;\n}\n\n/*\nAdd the correct font weight in Edge and Safari.\n*/\n\nb,\nstrong {\n  font-weight: bolder;\n}\n\n/*\n1. Use the user's configured `mono` font-family by default.\n2. Use the user's configured `mono` font-feature-settings by default.\n3. Use the user's configured `mono` font-variation-settings by default.\n4. Correct the odd `em` font sizing in all browsers.\n*/\n\ncode,\nkbd,\nsamp,\npre {\n  font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace; /* 1 */\n  font-feature-settings: normal; /* 2 */\n  font-variation-settings: normal; /* 3 */\n  font-size: 1em; /* 4 */\n}\n\n/*\nAdd the correct font size in all browsers.\n*/\n\nsmall {\n  font-size: 80%;\n}\n\n/*\nPrevent `sub` and `sup` elements from affecting the line height in all browsers.\n*/\n\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline;\n}\n\nsub {\n  bottom: -0.25em;\n}\n\nsup {\n  top: -0.5em;\n}\n\n/*\n1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)\n2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)\n3. Remove gaps between table borders by default.\n*/\n\ntable {\n  text-indent: 0; /* 1 */\n  border-color: inherit; /* 2 */\n  border-collapse: collapse; /* 3 */\n}\n\n/*\n1. Change the font styles in all browsers.\n2. Remove the margin in Firefox and Safari.\n3. Remove default padding in all browsers.\n*/\n\nbutton,\ninput,\noptgroup,\nselect,\ntextarea {\n  font-family: inherit; /* 1 */\n  font-feature-settings: inherit; /* 1 */\n  font-variation-settings: inherit; /* 1 */\n  font-size: 100%; /* 1 */\n  font-weight: inherit; /* 1 */\n  line-height: inherit; /* 1 */\n  letter-spacing: inherit; /* 1 */\n  color: inherit; /* 1 */\n  margin: 0; /* 2 */\n  padding: 0; /* 3 */\n}\n\n/*\nRemove the inheritance of text transform in Edge and Firefox.\n*/\n\nbutton,\nselect {\n  text-transform: none;\n}\n\n/*\n1. Correct the inability to style clickable types in iOS and Safari.\n2. Remove default button styles.\n*/\n\nbutton,\ninput:where([type='button']),\ninput:where([type='reset']),\ninput:where([type='submit']) {\n  -webkit-appearance: button; /* 1 */\n  background-color: transparent; /* 2 */\n  background-image: none; /* 2 */\n}\n\n/*\nUse the modern Firefox focus style for all focusable elements.\n*/\n\n:-moz-focusring {\n  outline: auto;\n}\n\n/*\nRemove the additional `:invalid` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)\n*/\n\n:-moz-ui-invalid {\n  box-shadow: none;\n}\n\n/*\nAdd the correct vertical alignment in Chrome and Firefox.\n*/\n\nprogress {\n  vertical-align: baseline;\n}\n\n/*\nCorrect the cursor style of increment and decrement buttons in Safari.\n*/\n\n::-webkit-inner-spin-button,\n::-webkit-outer-spin-button {\n  height: auto;\n}\n\n/*\n1. Correct the odd appearance in Chrome and Safari.\n2. Correct the outline style in Safari.\n*/\n\n[type='search'] {\n  -webkit-appearance: textfield; /* 1 */\n  outline-offset: -2px; /* 2 */\n}\n\n/*\nRemove the inner padding in Chrome and Safari on macOS.\n*/\n\n::-webkit-search-decoration {\n  -webkit-appearance: none;\n}\n\n/*\n1. Correct the inability to style clickable types in iOS and Safari.\n2. Change font properties to `inherit` in Safari.\n*/\n\n::-webkit-file-upload-button {\n  -webkit-appearance: button; /* 1 */\n  font: inherit; /* 2 */\n}\n\n/*\nAdd the correct display in Chrome and Safari.\n*/\n\nsummary {\n  display: list-item;\n}\n\n/*\nRemoves the default spacing and border for appropriate elements.\n*/\n\nblockquote,\ndl,\ndd,\nh1,\nh2,\nh3,\nh4,\nh5,\nh6,\nhr,\nfigure,\np,\npre {\n  margin: 0;\n}\n\nfieldset {\n  margin: 0;\n  padding: 0;\n}\n\nlegend {\n  padding: 0;\n}\n\nol,\nul,\nmenu {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n/*\nReset default styling for dialogs.\n*/\ndialog {\n  padding: 0;\n}\n\n/*\nPrevent resizing textareas horizontally by default.\n*/\n\ntextarea {\n  resize: vertical;\n}\n\n/*\n1. Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)\n2. Set the default placeholder color to the user's configured gray 400 color.\n*/\n\ninput::-moz-placeholder, textarea::-moz-placeholder {\n  opacity: 1; /* 1 */\n  color: #9ca3af; /* 2 */\n}\n\ninput::placeholder,\ntextarea::placeholder {\n  opacity: 1; /* 1 */\n  color: #9ca3af; /* 2 */\n}\n\n/*\nSet the default cursor for buttons.\n*/\n\nbutton,\n[role=\"button\"] {\n  cursor: pointer;\n}\n\n/*\nMake sure disabled buttons don't get the pointer cursor.\n*/\n:disabled {\n  cursor: default;\n}\n\n/*\n1. Make replaced elements `display: block` by default. (https://github.com/mozdevs/cssremedy/issues/14)\n2. Add `vertical-align: middle` to align replaced elements more sensibly by default. (https://github.com/jensimmons/cssremedy/issues/14#issuecomment-634934210)\n   This can trigger a poorly considered lint error in some tools but is included by design.\n*/\n\nimg,\nsvg,\nvideo,\ncanvas,\naudio,\niframe,\nembed,\nobject {\n  display: block; /* 1 */\n  vertical-align: middle; /* 2 */\n}\n\n/*\nConstrain images and videos to the parent width and preserve their intrinsic aspect ratio. (https://github.com/mozdevs/cssremedy/issues/14)\n*/\n\nimg,\nvideo {\n  max-width: 100%;\n  height: auto;\n}\n\n/* Make elements with the HTML hidden attribute stay hidden by default */\n[hidden]:where(:not([hidden=\"until-found\"])) {\n  display: none;\n}\n.\\!container {\n  width: 100% !important;\n}\n.container {\n  width: 100%;\n}\n@media (min-width: 640px) {\n\n  .\\!container {\n    max-width: 640px !important;\n  }\n\n  .container {\n    max-width: 640px;\n  }\n}\n@media (min-width: 768px) {\n\n  .\\!container {\n    max-width: 768px !important;\n  }\n\n  .container {\n    max-width: 768px;\n  }\n}\n@media (min-width: 1024px) {\n\n  .\\!container {\n    max-width: 1024px !important;\n  }\n\n  .container {\n    max-width: 1024px;\n  }\n}\n@media (min-width: 1280px) {\n\n  .\\!container {\n    max-width: 1280px !important;\n  }\n\n  .container {\n    max-width: 1280px;\n  }\n}\n@media (min-width: 1536px) {\n\n  .\\!container {\n    max-width: 1536px !important;\n  }\n\n  .container {\n    max-width: 1536px;\n  }\n}\n.pointer-events-none {\n  pointer-events: none;\n}\n.pointer-events-auto {\n  pointer-events: auto;\n}\n.visible {\n  visibility: visible;\n}\n.static {\n  position: static;\n}\n.fixed {\n  position: fixed;\n}\n.absolute {\n  position: absolute;\n}\n.relative {\n  position: relative;\n}\n.sticky {\n  position: sticky;\n}\n.inset-0 {\n  inset: 0px;\n}\n.inset-x-1 {\n  left: 4px;\n  right: 4px;\n}\n.inset-y-0 {\n  top: 0px;\n  bottom: 0px;\n}\n.-right-1 {\n  right: -4px;\n}\n.-right-2\\.5 {\n  right: -10px;\n}\n.-top-1 {\n  top: -4px;\n}\n.-top-2\\.5 {\n  top: -10px;\n}\n.bottom-0 {\n  bottom: 0px;\n}\n.bottom-4 {\n  bottom: 16px;\n}\n.left-0 {\n  left: 0px;\n}\n.left-3 {\n  left: 12px;\n}\n.right-0 {\n  right: 0px;\n}\n.right-0\\.5 {\n  right: 2px;\n}\n.right-2 {\n  right: 8px;\n}\n.right-4 {\n  right: 16px;\n}\n.top-0 {\n  top: 0px;\n}\n.top-0\\.5 {\n  top: 2px;\n}\n.top-1\\/2 {\n  top: 50%;\n}\n.top-2 {\n  top: 8px;\n}\n.z-10 {\n  z-index: 10;\n}\n.z-100 {\n  z-index: 100;\n}\n.z-50 {\n  z-index: 50;\n}\n.z-\\[124124124124\\] {\n  z-index: 124124124124;\n}\n.z-\\[214748365\\] {\n  z-index: 214748365;\n}\n.z-\\[214748367\\] {\n  z-index: 214748367;\n}\n.m-\\[2px\\] {\n  margin: 2px;\n}\n.mx-0\\.5 {\n  margin-left: 2px;\n  margin-right: 2px;\n}\n.\\!ml-0 {\n  margin-left: 0px !important;\n}\n.mb-1\\.5 {\n  margin-bottom: 6px;\n}\n.mb-2 {\n  margin-bottom: 8px;\n}\n.mb-3 {\n  margin-bottom: 12px;\n}\n.mb-4 {\n  margin-bottom: 16px;\n}\n.mb-px {\n  margin-bottom: 1px;\n}\n.ml-1 {\n  margin-left: 4px;\n}\n.ml-1\\.5 {\n  margin-left: 6px;\n}\n.ml-auto {\n  margin-left: auto;\n}\n.mr-0\\.5 {\n  margin-right: 2px;\n}\n.mr-1 {\n  margin-right: 4px;\n}\n.mr-1\\.5 {\n  margin-right: 6px;\n}\n.mr-16 {\n  margin-right: 64px;\n}\n.mr-auto {\n  margin-right: auto;\n}\n.mt-0\\.5 {\n  margin-top: 2px;\n}\n.mt-1 {\n  margin-top: 4px;\n}\n.mt-4 {\n  margin-top: 16px;\n}\n.block {\n  display: block;\n}\n.inline {\n  display: inline;\n}\n.flex {\n  display: flex;\n}\n.hidden {\n  display: none;\n}\n.aspect-square {\n  aspect-ratio: 1 / 1;\n}\n.h-1 {\n  height: 4px;\n}\n.h-1\\.5 {\n  height: 6px;\n}\n.h-10 {\n  height: 40px;\n}\n.h-12 {\n  height: 48px;\n}\n.h-4 {\n  height: 16px;\n}\n.h-4\\/5 {\n  height: 80%;\n}\n.h-6 {\n  height: 24px;\n}\n.h-7 {\n  height: 28px;\n}\n.h-8 {\n  height: 32px;\n}\n.h-\\[150px\\] {\n  height: 150px;\n}\n.h-\\[235px\\] {\n  height: 235px;\n}\n.h-\\[28px\\] {\n  height: 28px;\n}\n.h-\\[48px\\] {\n  height: 48px;\n}\n.h-\\[50px\\] {\n  height: 50px;\n}\n.h-\\[calc\\(100\\%-150px\\)\\] {\n  height: calc(100% - 150px);\n}\n.h-\\[calc\\(100\\%-200px\\)\\] {\n  height: calc(100% - 200px);\n}\n.h-\\[calc\\(100\\%-25px\\)\\] {\n  height: calc(100% - 25px);\n}\n.h-\\[calc\\(100\\%-40px\\)\\] {\n  height: calc(100% - 40px);\n}\n.h-\\[calc\\(100\\%-48px\\)\\] {\n  height: calc(100% - 48px);\n}\n.h-fit {\n  height: -moz-fit-content;\n  height: fit-content;\n}\n.h-full {\n  height: 100%;\n}\n.h-screen {\n  height: 100vh;\n}\n.max-h-0 {\n  max-height: 0px;\n}\n.max-h-40 {\n  max-height: 160px;\n}\n.max-h-9 {\n  max-height: 36px;\n}\n.min-h-9 {\n  min-height: 36px;\n}\n.min-h-\\[48px\\] {\n  min-height: 48px;\n}\n.min-h-fit {\n  min-height: -moz-fit-content;\n  min-height: fit-content;\n}\n.w-1 {\n  width: 4px;\n}\n.w-1\\/2 {\n  width: 50%;\n}\n.w-1\\/3 {\n  width: 33.333333%;\n}\n.w-2\\/4 {\n  width: 50%;\n}\n.w-3 {\n  width: 12px;\n}\n.w-4 {\n  width: 16px;\n}\n.w-4\\/5 {\n  width: 80%;\n}\n.w-6 {\n  width: 24px;\n}\n.w-80 {\n  width: 320px;\n}\n.w-\\[20px\\] {\n  width: 20px;\n}\n.w-\\[72px\\] {\n  width: 72px;\n}\n.w-\\[90\\%\\] {\n  width: 90%;\n}\n.w-\\[calc\\(100\\%-200px\\)\\] {\n  width: calc(100% - 200px);\n}\n.w-fit {\n  width: -moz-fit-content;\n  width: fit-content;\n}\n.w-full {\n  width: 100%;\n}\n.w-px {\n  width: 1px;\n}\n.w-screen {\n  width: 100vw;\n}\n.min-w-0 {\n  min-width: 0px;\n}\n.min-w-\\[200px\\] {\n  min-width: 200px;\n}\n.min-w-fit {\n  min-width: -moz-fit-content;\n  min-width: fit-content;\n}\n.max-w-md {\n  max-width: 448px;\n}\n.flex-1 {\n  flex: 1 1 0%;\n}\n.shrink-0 {\n  flex-shrink: 0;\n}\n.grow {\n  flex-grow: 1;\n}\n.-translate-y-1\\/2 {\n  --tw-translate-y: -50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.-translate-y-\\[200\\%\\] {\n  --tw-translate-y: -200%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.translate-y-0 {\n  --tw-translate-y: 0px;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.-rotate-90 {\n  --tw-rotate: -90deg;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.rotate-0 {\n  --tw-rotate: 0deg;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.rotate-180 {\n  --tw-rotate: 180deg;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.rotate-90 {\n  --tw-rotate: 90deg;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.scale-110 {\n  --tw-scale-x: 1.1;\n  --tw-scale-y: 1.1;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n.transform {\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n@keyframes fadeIn {\n\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n.animate-fade-in {\n  animation: fadeIn ease-in forwards;\n}\n.cursor-default {\n  cursor: default;\n}\n.cursor-e-resize {\n  cursor: e-resize;\n}\n.cursor-ew-resize {\n  cursor: ew-resize;\n}\n.cursor-move {\n  cursor: move;\n}\n.cursor-nesw-resize {\n  cursor: nesw-resize;\n}\n.cursor-ns-resize {\n  cursor: ns-resize;\n}\n.cursor-nwse-resize {\n  cursor: nwse-resize;\n}\n.cursor-pointer {\n  cursor: pointer;\n}\n.cursor-w-resize {\n  cursor: w-resize;\n}\n.select-none {\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n}\n.resize {\n  resize: both;\n}\n.appearance-none {\n  -webkit-appearance: none;\n     -moz-appearance: none;\n          appearance: none;\n}\n.flex-col {\n  flex-direction: column;\n}\n.items-start {\n  align-items: flex-start;\n}\n.items-end {\n  align-items: flex-end;\n}\n.items-center {\n  align-items: center;\n}\n.items-stretch {\n  align-items: stretch;\n}\n.justify-start {\n  justify-content: flex-start;\n}\n.justify-end {\n  justify-content: flex-end;\n}\n.justify-center {\n  justify-content: center;\n}\n.justify-between {\n  justify-content: space-between;\n}\n.gap-0\\.5 {\n  gap: 2px;\n}\n.gap-1 {\n  gap: 4px;\n}\n.gap-1\\.5 {\n  gap: 6px;\n}\n.gap-2 {\n  gap: 8px;\n}\n.gap-4 {\n  gap: 16px;\n}\n.gap-x-0\\.5 {\n  -moz-column-gap: 2px;\n       column-gap: 2px;\n}\n.gap-x-1 {\n  -moz-column-gap: 4px;\n       column-gap: 4px;\n}\n.gap-x-1\\.5 {\n  -moz-column-gap: 6px;\n       column-gap: 6px;\n}\n.gap-x-2 {\n  -moz-column-gap: 8px;\n       column-gap: 8px;\n}\n.gap-x-3 {\n  -moz-column-gap: 12px;\n       column-gap: 12px;\n}\n.gap-x-4 {\n  -moz-column-gap: 16px;\n       column-gap: 16px;\n}\n.gap-y-0\\.5 {\n  row-gap: 2px;\n}\n.gap-y-1 {\n  row-gap: 4px;\n}\n.gap-y-2 {\n  row-gap: 8px;\n}\n.gap-y-4 {\n  row-gap: 16px;\n}\n.space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(6px * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(6px * var(--tw-space-y-reverse));\n}\n.divide-y > :not([hidden]) ~ :not([hidden]) {\n  --tw-divide-y-reverse: 0;\n  border-top-width: calc(1px * calc(1 - var(--tw-divide-y-reverse)));\n  border-bottom-width: calc(1px * var(--tw-divide-y-reverse));\n}\n.divide-zinc-800 > :not([hidden]) ~ :not([hidden]) {\n  --tw-divide-opacity: 1;\n  border-color: rgb(39 39 42 / var(--tw-divide-opacity, 1));\n}\n.place-self-center {\n  place-self: center;\n}\n.self-end {\n  align-self: flex-end;\n}\n.overflow-auto {\n  overflow: auto;\n}\n.overflow-hidden {\n  overflow: hidden;\n}\n.\\!overflow-visible {\n  overflow: visible !important;\n}\n.overflow-x-auto {\n  overflow-x: auto;\n}\n.overflow-y-auto {\n  overflow-y: auto;\n}\n.overflow-x-hidden {\n  overflow-x: hidden;\n}\n.truncate {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.whitespace-nowrap {\n  white-space: nowrap;\n}\n.whitespace-pre-wrap {\n  white-space: pre-wrap;\n}\n.text-wrap {\n  text-wrap: wrap;\n}\n.break-words {\n  overflow-wrap: break-word;\n}\n.break-all {\n  word-break: break-all;\n}\n.rounded {\n  border-radius: 4px;\n}\n.rounded-full {\n  border-radius: 9999px;\n}\n.rounded-lg {\n  border-radius: 8px;\n}\n.rounded-md {\n  border-radius: 6px;\n}\n.rounded-sm {\n  border-radius: 2px;\n}\n.rounded-l-md {\n  border-top-left-radius: 6px;\n  border-bottom-left-radius: 6px;\n}\n.rounded-l-sm {\n  border-top-left-radius: 2px;\n  border-bottom-left-radius: 2px;\n}\n.rounded-r-md {\n  border-top-right-radius: 6px;\n  border-bottom-right-radius: 6px;\n}\n.rounded-r-sm {\n  border-top-right-radius: 2px;\n  border-bottom-right-radius: 2px;\n}\n.rounded-t-lg {\n  border-top-left-radius: 8px;\n  border-top-right-radius: 8px;\n}\n.rounded-t-sm {\n  border-top-left-radius: 2px;\n  border-top-right-radius: 2px;\n}\n.rounded-bl-lg {\n  border-bottom-left-radius: 8px;\n}\n.rounded-br-lg {\n  border-bottom-right-radius: 8px;\n}\n.rounded-tl-lg {\n  border-top-left-radius: 8px;\n}\n.rounded-tr-lg {\n  border-top-right-radius: 8px;\n}\n.border {\n  border-width: 1px;\n}\n.border-4 {\n  border-width: 4px;\n}\n.border-b {\n  border-bottom-width: 1px;\n}\n.border-l {\n  border-left-width: 1px;\n}\n.border-l-0 {\n  border-left-width: 0px;\n}\n.border-l-1 {\n  border-left-width: 1px;\n}\n.border-r {\n  border-right-width: 1px;\n}\n.border-t {\n  border-top-width: 1px;\n}\n.border-none {\n  border-style: none;\n}\n.\\!border-red-500 {\n  --tw-border-opacity: 1 !important;\n  border-color: rgb(239 68 68 / var(--tw-border-opacity, 1)) !important;\n}\n.border-\\[\\#1e1e1e\\] {\n  --tw-border-opacity: 1;\n  border-color: rgb(30 30 30 / var(--tw-border-opacity, 1));\n}\n.border-\\[\\#222\\] {\n  --tw-border-opacity: 1;\n  border-color: rgb(34 34 34 / var(--tw-border-opacity, 1));\n}\n.border-\\[\\#27272A\\] {\n  --tw-border-opacity: 1;\n  border-color: rgb(39 39 42 / var(--tw-border-opacity, 1));\n}\n.border-\\[\\#333\\] {\n  --tw-border-opacity: 1;\n  border-color: rgb(51 51 51 / var(--tw-border-opacity, 1));\n}\n.border-transparent {\n  border-color: transparent;\n}\n.border-zinc-800 {\n  --tw-border-opacity: 1;\n  border-color: rgb(39 39 42 / var(--tw-border-opacity, 1));\n}\n.bg-\\[\\#0A0A0A\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(10 10 10 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#141414\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(20 20 20 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#18181B\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(24 24 27 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#18181B\\]\\/50 {\n  background-color: rgb(24 24 27 / 0.5);\n}\n.bg-\\[\\#1D3A66\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(29 58 102 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#1E1E1E\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(30 30 30 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#1a2a1a\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(26 42 26 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#1e1e1e\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(30 30 30 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#214379d4\\] {\n  background-color: #214379d4;\n}\n.bg-\\[\\#27272A\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(39 39 42 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#2a1515\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(42 21 21 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#412162\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(65 33 98 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#44444a\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(68 68 74 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#4b4b4b\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(75 75 75 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#5f3f9a\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(95 63 154 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#5f3f9a\\]\\/40 {\n  background-color: rgb(95 63 154 / 0.4);\n}\n.bg-\\[\\#6a369e\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(106 54 158 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#7521c8\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(117 33 200 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#8e61e3\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(142 97 227 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#EFD81A\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(239 216 26 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#b77116\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(183 113 22 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#b94040\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(185 64 64 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#d36cff\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(211 108 255 / var(--tw-bg-opacity, 1));\n}\n.bg-\\[\\#efd81a6b\\] {\n  background-color: #efd81a6b;\n}\n.bg-black {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1));\n}\n.bg-black\\/40 {\n  background-color: rgb(0 0 0 / 0.4);\n}\n.bg-gray-200 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1));\n}\n.bg-green-500\\/50 {\n  background-color: rgb(34 197 94 / 0.5);\n}\n.bg-green-500\\/60 {\n  background-color: rgb(34 197 94 / 0.6);\n}\n.bg-neutral-700 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(64 64 64 / var(--tw-bg-opacity, 1));\n}\n.bg-purple-500 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(168 85 247 / var(--tw-bg-opacity, 1));\n}\n.bg-purple-500\\/90 {\n  background-color: rgb(168 85 247 / 0.9);\n}\n.bg-purple-800 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(107 33 168 / var(--tw-bg-opacity, 1));\n}\n.bg-red-500 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(239 68 68 / var(--tw-bg-opacity, 1));\n}\n.bg-red-500\\/90 {\n  background-color: rgb(239 68 68 / 0.9);\n}\n.bg-red-950\\/50 {\n  background-color: rgb(69 10 10 / 0.5);\n}\n.bg-transparent {\n  background-color: transparent;\n}\n.bg-white {\n  --tw-bg-opacity: 1;\n  background-color: rgb(255 255 255 / var(--tw-bg-opacity, 1));\n}\n.bg-yellow-300 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(253 224 71 / var(--tw-bg-opacity, 1));\n}\n.bg-zinc-800 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(39 39 42 / var(--tw-bg-opacity, 1));\n}\n.bg-zinc-900\\/30 {\n  background-color: rgb(24 24 27 / 0.3);\n}\n.bg-zinc-900\\/50 {\n  background-color: rgb(24 24 27 / 0.5);\n}\n.p-0 {\n  padding: 0px;\n}\n.p-1 {\n  padding: 4px;\n}\n.p-2 {\n  padding: 8px;\n}\n.p-3 {\n  padding: 12px;\n}\n.p-4 {\n  padding: 16px;\n}\n.p-5 {\n  padding: 20px;\n}\n.p-6 {\n  padding: 24px;\n}\n.px-1 {\n  padding-left: 4px;\n  padding-right: 4px;\n}\n.px-1\\.5 {\n  padding-left: 6px;\n  padding-right: 6px;\n}\n.px-2 {\n  padding-left: 8px;\n  padding-right: 8px;\n}\n.px-2\\.5 {\n  padding-left: 10px;\n  padding-right: 10px;\n}\n.px-3 {\n  padding-left: 12px;\n  padding-right: 12px;\n}\n.px-4 {\n  padding-left: 16px;\n  padding-right: 16px;\n}\n.py-0\\.5 {\n  padding-top: 2px;\n  padding-bottom: 2px;\n}\n.py-1 {\n  padding-top: 4px;\n  padding-bottom: 4px;\n}\n.py-1\\.5 {\n  padding-top: 6px;\n  padding-bottom: 6px;\n}\n.py-2 {\n  padding-top: 8px;\n  padding-bottom: 8px;\n}\n.py-3 {\n  padding-top: 12px;\n  padding-bottom: 12px;\n}\n.py-4 {\n  padding-top: 16px;\n  padding-bottom: 16px;\n}\n.py-\\[1px\\] {\n  padding-top: 1px;\n  padding-bottom: 1px;\n}\n.py-\\[3px\\] {\n  padding-top: 3px;\n  padding-bottom: 3px;\n}\n.py-\\[5px\\] {\n  padding-top: 5px;\n  padding-bottom: 5px;\n}\n.pb-2 {\n  padding-bottom: 8px;\n}\n.pl-1 {\n  padding-left: 4px;\n}\n.pl-2 {\n  padding-left: 8px;\n}\n.pl-2\\.5 {\n  padding-left: 10px;\n}\n.pl-3 {\n  padding-left: 12px;\n}\n.pl-5 {\n  padding-left: 20px;\n}\n.pl-6 {\n  padding-left: 24px;\n}\n.pr-1 {\n  padding-right: 4px;\n}\n.pr-1\\.5 {\n  padding-right: 6px;\n}\n.pr-2 {\n  padding-right: 8px;\n}\n.pr-2\\.5 {\n  padding-right: 10px;\n}\n.pt-0 {\n  padding-top: 0px;\n}\n.pt-2 {\n  padding-top: 8px;\n}\n.pt-5 {\n  padding-top: 20px;\n}\n.text-left {\n  text-align: left;\n}\n.font-mono {\n  font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;\n}\n.text-\\[10px\\] {\n  font-size: 10px;\n}\n.text-\\[11px\\] {\n  font-size: 11px;\n}\n.text-\\[13px\\] {\n  font-size: 13px;\n}\n.text-\\[14px\\] {\n  font-size: 14px;\n}\n.text-\\[17px\\] {\n  font-size: 17px;\n}\n.text-\\[8px\\] {\n  font-size: 8px;\n}\n.text-sm {\n  font-size: 14px;\n  line-height: 20px;\n}\n.text-xs {\n  font-size: 12px;\n  line-height: 16px;\n}\n.font-bold {\n  font-weight: 700;\n}\n.font-medium {\n  font-weight: 500;\n}\n.font-semibold {\n  font-weight: 600;\n}\n.uppercase {\n  text-transform: uppercase;\n}\n.capitalize {\n  text-transform: capitalize;\n}\n.italic {\n  font-style: italic;\n}\n.leading-6 {\n  line-height: 24px;\n}\n.leading-none {\n  line-height: 1;\n}\n.tracking-wide {\n  letter-spacing: 0.025em;\n}\n.text-\\[\\#4ade80\\] {\n  --tw-text-opacity: 1;\n  color: rgb(74 222 128 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#5a5a5a\\] {\n  --tw-text-opacity: 1;\n  color: rgb(90 90 90 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#65656D\\] {\n  --tw-text-opacity: 1;\n  color: rgb(101 101 109 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#666\\] {\n  --tw-text-opacity: 1;\n  color: rgb(102 102 102 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#6E6E77\\] {\n  --tw-text-opacity: 1;\n  color: rgb(110 110 119 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#6F6F78\\] {\n  --tw-text-opacity: 1;\n  color: rgb(111 111 120 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#7346a0\\] {\n  --tw-text-opacity: 1;\n  color: rgb(115 70 160 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#737373\\] {\n  --tw-text-opacity: 1;\n  color: rgb(115 115 115 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#888\\] {\n  --tw-text-opacity: 1;\n  color: rgb(136 136 136 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#8E61E3\\] {\n  --tw-text-opacity: 1;\n  color: rgb(142 97 227 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#999\\] {\n  --tw-text-opacity: 1;\n  color: rgb(153 153 153 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#A1A1AA\\] {\n  --tw-text-opacity: 1;\n  color: rgb(161 161 170 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#A855F7\\] {\n  --tw-text-opacity: 1;\n  color: rgb(168 85 247 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#E4E4E7\\] {\n  --tw-text-opacity: 1;\n  color: rgb(228 228 231 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#d36cff\\] {\n  --tw-text-opacity: 1;\n  color: rgb(211 108 255 / var(--tw-text-opacity, 1));\n}\n.text-\\[\\#f87171\\] {\n  --tw-text-opacity: 1;\n  color: rgb(248 113 113 / var(--tw-text-opacity, 1));\n}\n.text-black {\n  --tw-text-opacity: 1;\n  color: rgb(0 0 0 / var(--tw-text-opacity, 1));\n}\n.text-gray-100 {\n  --tw-text-opacity: 1;\n  color: rgb(243 244 246 / var(--tw-text-opacity, 1));\n}\n.text-gray-300 {\n  --tw-text-opacity: 1;\n  color: rgb(209 213 219 / var(--tw-text-opacity, 1));\n}\n.text-gray-400 {\n  --tw-text-opacity: 1;\n  color: rgb(156 163 175 / var(--tw-text-opacity, 1));\n}\n.text-gray-500 {\n  --tw-text-opacity: 1;\n  color: rgb(107 114 128 / var(--tw-text-opacity, 1));\n}\n.text-green-500 {\n  --tw-text-opacity: 1;\n  color: rgb(34 197 94 / var(--tw-text-opacity, 1));\n}\n.text-neutral-300 {\n  --tw-text-opacity: 1;\n  color: rgb(212 212 212 / var(--tw-text-opacity, 1));\n}\n.text-neutral-400 {\n  --tw-text-opacity: 1;\n  color: rgb(163 163 163 / var(--tw-text-opacity, 1));\n}\n.text-neutral-500 {\n  --tw-text-opacity: 1;\n  color: rgb(115 115 115 / var(--tw-text-opacity, 1));\n}\n.text-purple-400 {\n  --tw-text-opacity: 1;\n  color: rgb(192 132 252 / var(--tw-text-opacity, 1));\n}\n.text-red-300 {\n  --tw-text-opacity: 1;\n  color: rgb(252 165 165 / var(--tw-text-opacity, 1));\n}\n.text-red-400 {\n  --tw-text-opacity: 1;\n  color: rgb(248 113 113 / var(--tw-text-opacity, 1));\n}\n.text-red-500 {\n  --tw-text-opacity: 1;\n  color: rgb(239 68 68 / var(--tw-text-opacity, 1));\n}\n.text-white {\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n}\n.text-white\\/30 {\n  color: rgb(255 255 255 / 0.3);\n}\n.text-white\\/70 {\n  color: rgb(255 255 255 / 0.7);\n}\n.text-yellow-300 {\n  --tw-text-opacity: 1;\n  color: rgb(253 224 71 / var(--tw-text-opacity, 1));\n}\n.text-yellow-500 {\n  --tw-text-opacity: 1;\n  color: rgb(234 179 8 / var(--tw-text-opacity, 1));\n}\n.text-zinc-200 {\n  --tw-text-opacity: 1;\n  color: rgb(228 228 231 / var(--tw-text-opacity, 1));\n}\n.text-zinc-400 {\n  --tw-text-opacity: 1;\n  color: rgb(161 161 170 / var(--tw-text-opacity, 1));\n}\n.text-zinc-500 {\n  --tw-text-opacity: 1;\n  color: rgb(113 113 122 / var(--tw-text-opacity, 1));\n}\n.text-zinc-600 {\n  --tw-text-opacity: 1;\n  color: rgb(82 82 91 / var(--tw-text-opacity, 1));\n}\n.opacity-0 {\n  opacity: 0;\n}\n.opacity-100 {\n  opacity: 1;\n}\n.opacity-50 {\n  opacity: 0.5;\n}\n.shadow-lg {\n  --tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);\n  --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n}\n.outline {\n  outline-style: solid;\n}\n.ring-1 {\n  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);\n  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);\n  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);\n}\n.ring-white\\/\\[0\\.08\\] {\n  --tw-ring-color: rgb(255 255 255 / 0.08);\n}\n.blur {\n  --tw-blur: blur(8px);\n  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);\n}\n.\\!filter {\n  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow) !important;\n}\n.filter {\n  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);\n}\n.backdrop-blur-sm {\n  --tw-backdrop-blur: blur(4px);\n  -webkit-backdrop-filter: var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);\n  backdrop-filter: var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);\n}\n.transition {\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, -webkit-backdrop-filter;\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, -webkit-backdrop-filter;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-\\[border-radius\\] {\n  transition-property: border-radius;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-\\[color\\2c transform\\] {\n  transition-property: color,transform;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-\\[max-height\\] {\n  transition-property: max-height;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-\\[opacity\\] {\n  transition-property: opacity;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-all {\n  transition-property: all;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-colors {\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-none {\n  transition-property: none;\n}\n.transition-opacity {\n  transition-property: opacity;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.transition-transform {\n  transition-property: transform;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n.delay-0 {\n  transition-delay: 0s;\n}\n.delay-150 {\n  transition-delay: 150ms;\n}\n.delay-300 {\n  transition-delay: 300ms;\n}\n.\\!duration-0 {\n  transition-duration: 0s !important;\n}\n.duration-0 {\n  transition-duration: 0s;\n}\n.duration-200 {\n  transition-duration: 200ms;\n}\n.duration-300 {\n  transition-duration: 300ms;\n}\n.ease-\\[cubic-bezier\\(0\\.25\\2c 0\\.1\\2c 0\\.25\\2c 1\\)\\] {\n  transition-timing-function: cubic-bezier(0.25,0.1,0.25,1);\n}\n.ease-in-out {\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n}\n.ease-out {\n  transition-timing-function: cubic-bezier(0, 0, 0.2, 1);\n}\n.will-change-transform {\n  will-change: transform;\n}\n.animation-duration-300 {\n  animation-duration: .3s;\n}\n.animation-delay-300 {\n  animation-delay: .3s;\n}\n.\\[touch-action\\:none\\] {\n  touch-action: none;\n}\n\n* {\n  outline: none !important;\n  text-rendering: optimizeLegibility;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n\n  /* WebKit (Chrome, Safari, Edge) specific scrollbar styles */\n  &::-webkit-scrollbar {\n    width: 6px;\n    height: 6px;\n  }\n\n  &::-webkit-scrollbar-track {\n    border-radius: 10px;\n    background: transparent;\n  }\n\n  &::-webkit-scrollbar-thumb {\n    border-radius: 10px;\n    background: rgba(255, 255, 255, 0.3);\n  }\n\n  &::-webkit-scrollbar-thumb:hover {\n    background: rgba(255, 255, 255, 0.4);\n  }\n\n  &::-webkit-scrollbar-corner {\n    background: transparent;\n  }\n}\n\n@-moz-document url-prefix() {\n  * {\n    scrollbar-width: thin;\n    scrollbar-color: rgba(255, 255, 255, 0.4) transparent;\n    scrollbar-width: 6px;\n  }\n}\n\nbutton:hover {\n  background-image: none;\n}\n\nbutton {\n  outline: 2px solid transparent;\n  outline-offset: 2px;\n  border-style: none;\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n  transition-timing-function: cubic-bezier(0, 0, 0.2, 1);\n  cursor: pointer;\n}\n\ninput {\n  outline: 2px solid transparent;\n  outline-offset: 2px;\n  border-style: none;\n  background-color: transparent;\n  background-image: none;\n}\n\ninput::-moz-placeholder {\n  font-size: 12px;\n  line-height: 16px;\n  font-style: italic;\n  --tw-text-opacity: 1;\n  color: rgb(115 115 115 / var(--tw-text-opacity, 1));\n}\n\ninput::placeholder {\n  font-size: 12px;\n  line-height: 16px;\n  font-style: italic;\n  --tw-text-opacity: 1;\n  color: rgb(115 115 115 / var(--tw-text-opacity, 1));\n}\n\ninput:-moz-placeholder {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\ninput:placeholder-shown {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\nsvg {\n  height: auto;\n  width: auto;\n  pointer-events: none;\n}\n\n/*\n  Using CSS content with data attributes is more performant than:\n  1. React re-renders with JSX text content\n  2. Direct DOM manipulation methods:\n     - element.textContent (creates/updates text nodes, triggers repaint)\n     - element.innerText (triggers reflow by computing styles & layout)\n     - element.innerHTML (heavy parsing, triggers reflow, security risks)\n  3. Multiple data attributes with complex CSS concatenation\n\n  This approach:\n  - Avoids React reconciliation\n  - Uses browser's native CSS engine (optimized content updates)\n  - Minimizes main thread work\n  - Reduces DOM operations\n  - Avoids forced reflows (layout recalculation)\n  - Only triggers necessary repaints\n  - Keeps pseudo-element updates in render layer\n*/\n.with-data-text {\n  overflow: hidden;\n  &::before {\n    content: attr(data-text);\n  }\n  &::before {\n    display: block;\n  }\n  &::before {\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n  }\n}\n\n#react-scan-toolbar {\n  position: fixed;\n  left: 0px;\n  top: 0px;\n  display: flex;\n  flex-direction: column;\n  --tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);\n  --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n  font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;\n  font-size: 13px;\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1));\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  cursor: move;\n  opacity: 0;\n  z-index: 2147483678;\n}\n\n@keyframes fadeIn {\n\n  0% {\n    opacity: 0;\n  }\n\n  100% {\n    opacity: 1;\n  }\n}\n\n#react-scan-toolbar {\n  animation: fadeIn ease-in forwards;\n  animation-duration: .3s;\n  animation-delay: .3s;\n  --tw-shadow: 0 4px 12px rgba(0,0,0,0.2);\n  --tw-shadow-colored: 0 4px 12px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n  place-self: start;\n\n  will-change: transform;\n  backface-visibility: hidden;\n}\n\n.button {\n  &:hover {\n    background: rgba(255, 255, 255, 0.1);\n  }\n\n  &:active {\n    background: rgba(255, 255, 255, 0.15);\n  }\n}\n\n.resize-line-wrapper {\n  position: absolute;\n  overflow: hidden;\n}\n\n.resize-line {\n  position: absolute;\n  inset: 0px;\n  overflow: hidden;\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1));\n  transition-property: all;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n\n  svg {\n    position: absolute;\n  }\n\n  svg {\n    top: 50%;\n  }\n\n  svg {\n    left: 50%;\n  }\n\n  svg {\n    --tw-translate-x: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  svg {\n    --tw-translate-y: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.resize-right,\n.resize-left {\n  top: 0px;\n  bottom: 0px;\n  width: 24px;\n  cursor: ew-resize;\n\n  .resize-line-wrapper {\n    top: 0px;\n    bottom: 0px;\n  }\n\n  .resize-line-wrapper {\n    width: 50%;\n  }\n\n  &:hover {\n    .resize-line {\n      --tw-translate-x: 0px;\n      transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n    }\n  }\n}\n.resize-right {\n  right: 0px;\n  --tw-translate-x: 50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n\n  .resize-line-wrapper {\n    right: 0px;\n  }\n  .resize-line {\n    border-top-right-radius: 8px;\n    border-bottom-right-radius: 8px;\n  }\n  .resize-line {\n    --tw-translate-x: -100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.resize-left {\n  left: 0px;\n  --tw-translate-x: -50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n\n  .resize-line-wrapper {\n    left: 0px;\n  }\n  .resize-line {\n    border-top-left-radius: 8px;\n    border-bottom-left-radius: 8px;\n  }\n  .resize-line {\n    --tw-translate-x: 100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.resize-top,\n.resize-bottom {\n  left: 0px;\n  right: 0px;\n  height: 24px;\n  cursor: ns-resize;\n\n  .resize-line-wrapper {\n    left: 0px;\n    right: 0px;\n  }\n\n  .resize-line-wrapper {\n    height: 50%;\n  }\n\n  &:hover {\n    .resize-line {\n      --tw-translate-y: 0px;\n      transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n    }\n  }\n}\n.resize-top {\n  top: 0px;\n  --tw-translate-y: -50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n\n  .resize-line-wrapper {\n    top: 0px;\n  }\n  .resize-line {\n    border-top-left-radius: 8px;\n    border-top-right-radius: 8px;\n  }\n  .resize-line {\n    --tw-translate-y: 100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.resize-bottom {\n  bottom: 0px;\n  --tw-translate-y: 50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n\n  .resize-line-wrapper {\n    bottom: 0px;\n  }\n  .resize-line {\n    border-bottom-right-radius: 8px;\n    border-bottom-left-radius: 8px;\n  }\n  .resize-line {\n    --tw-translate-y: -100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.react-scan-header {\n  display: flex;\n  align-items: center;\n  -moz-column-gap: 8px;\n       column-gap: 8px;\n  padding-left: 12px;\n  padding-right: 8px;\n  min-height: 36px;\n  border-bottom-width: 1px;\n  --tw-border-opacity: 1;\n  border-color: rgb(34 34 34 / var(--tw-border-opacity, 1));\n  overflow: hidden;\n  white-space: nowrap;\n}\n\n.react-scan-replay-button,\n.react-scan-close-button {\n  display: flex;\n  align-items: center;\n  padding: 4px;\n  min-width: -moz-fit-content;\n  min-width: fit-content;\n  border-radius: 4px;\n  transition-property: all;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 300ms;\n}\n\n.react-scan-replay-button {\n  position: relative;\n  overflow: hidden;\n  background-color: rgb(168 85 247 / 0.5) !important;\n\n  &:hover {\n    background-color: rgb(168 85 247 / 0.25);\n  }\n\n  &.disabled {\n    opacity: 0.5;\n  }\n\n  &.disabled {\n    pointer-events: none;\n  }\n\n  &:before {\n    content: \"\";\n  }\n\n  &:before {\n    position: absolute;\n  }\n\n  &:before {\n    inset: 0px;\n  }\n\n  &:before {\n    --tw-translate-x: -100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  &:before {\n    animation: shimmer 2s infinite;\n    background: linear-gradient(\n      to right,\n      transparent,\n      rgba(142, 97, 227, 0.3),\n      transparent\n    );\n  }\n}\n\n.react-scan-close-button {\n  background-color: rgb(255 255 255 / 0.1);\n\n  &:hover {\n    background-color: rgb(255 255 255 / 0.15);\n  }\n}\n\n@keyframes shimmer {\n  100% {\n    --tw-translate-x: 100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.react-section-header {\n  position: sticky;\n  z-index: 100;\n  display: flex;\n  align-items: center;\n  -moz-column-gap: 8px;\n       column-gap: 8px;\n  padding-left: 12px;\n  padding-right: 12px;\n  height: 28px;\n  width: 100%;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  --tw-text-opacity: 1;\n  color: rgb(136 136 136 / var(--tw-text-opacity, 1));\n  border-bottom-width: 1px;\n  --tw-border-opacity: 1;\n  border-color: rgb(34 34 34 / var(--tw-border-opacity, 1));\n  --tw-bg-opacity: 1;\n  background-color: rgb(10 10 10 / var(--tw-bg-opacity, 1));\n}\n\n.react-scan-section {\n  display: flex;\n  flex-direction: column;\n  padding-left: 8px;\n  padding-right: 8px;\n  --tw-text-opacity: 1;\n  color: rgb(136 136 136 / var(--tw-text-opacity, 1));\n}\n\n.react-scan-section::before {\n  --tw-text-opacity: 1;\n  color: rgb(107 114 128 / var(--tw-text-opacity, 1));\n  --tw-content: attr(data-section);\n  content: var(--tw-content);\n}\n\n.react-scan-section {\n  font-size: 12px;\n  line-height: 16px;\n\n  > .react-scan-property {\n    margin-left: -14px;\n  }\n}\n\n.react-scan-property {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  padding-left: 32px;\n  border-left-width: 1px;\n  border-color: transparent;\n  overflow: hidden;\n}\n\n.react-scan-property-content {\n  display: flex;\n  flex: 1 1 0%;\n  flex-direction: column;\n  min-height: 28px;\n  max-width: 100%;\n  overflow: hidden;\n}\n\n.react-scan-string {\n  color: #9ecbff;\n}\n\n.react-scan-number {\n  color: #79c7ff;\n}\n\n.react-scan-boolean {\n  color: #56b6c2;\n}\n\n.react-scan-key {\n  width: -moz-fit-content;\n  width: fit-content;\n  max-width: 240px;\n  white-space: nowrap;\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n}\n\n.react-scan-input {\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1));\n}\n\n@keyframes blink {\n  from {\n    opacity: 1;\n  }\n  to {\n    opacity: 0;\n  }\n}\n\n.react-scan-arrow {\n  position: absolute;\n  top: 0px;\n  left: 28px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  height: 28px;\n  width: 24px;\n  --tw-translate-x: -100%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  z-index: 10;\n\n  > svg {\n    transition-property: transform;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n}\n\n.react-scan-nested {\n  position: relative;\n  overflow: hidden;\n\n  &:before {\n    content: \"\";\n  }\n\n  &:before {\n    position: absolute;\n  }\n\n  &:before {\n    top: 0px;\n  }\n\n  &:before {\n    left: 0px;\n  }\n\n  &:before {\n    height: 100%;\n  }\n\n  &:before {\n    width: 1px;\n  }\n\n  &:before {\n    background-color: rgb(107 114 128 / 0.3);\n  }\n}\n\n.react-scan-settings {\n  position: absolute;\n  inset: 0px;\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  padding-top: 8px;\n  padding-bottom: 8px;\n  padding-left: 16px;\n  padding-right: 16px;\n  --tw-text-opacity: 1;\n  color: rgb(136 136 136 / var(--tw-text-opacity, 1));\n\n  > div {\n    display: flex;\n  }\n\n  > div {\n    align-items: center;\n  }\n\n  > div {\n    justify-content: space-between;\n  }\n\n  > div {\n    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  > div {\n    transition-duration: 300ms;\n  }\n}\n\n.react-scan-preview-line {\n  position: relative;\n  display: flex;\n  min-height: 28px;\n  align-items: center;\n  -moz-column-gap: 8px;\n       column-gap: 8px;\n}\n\n.react-scan-flash-overlay {\n  position: absolute;\n  inset: 0px;\n  opacity: 0;\n  z-index: 50;\n  pointer-events: none;\n  transition-property: opacity;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n  mix-blend-mode: multiply;\n  background-color: rgb(168 85 247 / 0.9);\n}\n\n.react-scan-toggle {\n  position: relative;\n  display: inline-flex;\n  height: 24px;\n  width: 40px;\n\n  input {\n    position: absolute;\n  }\n\n  input {\n    inset: 0px;\n  }\n\n  input {\n    z-index: 20;\n  }\n\n  input {\n    opacity: 0;\n  }\n\n  input {\n    cursor: pointer;\n  }\n\n  input {\n    height: 100%;\n  }\n\n  input {\n    width: 100%;\n  }\n\n  input:checked {\n    + div {\n      --tw-bg-opacity: 1;\n      background-color: rgb(95 63 154 / var(--tw-bg-opacity, 1));\n    }\n    + div {\n\n      &::before {\n        --tw-translate-x: 100%;\n        transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n      }\n\n      &::before {\n        left: auto;\n      }\n\n      &::before {\n        --tw-border-opacity: 1;\n        border-color: rgb(95 63 154 / var(--tw-border-opacity, 1));\n      }\n    }\n  }\n\n  > div {\n    position: absolute;\n  }\n\n  > div {\n    inset: 4px;\n  }\n\n  > div {\n    --tw-bg-opacity: 1;\n    background-color: rgb(64 64 64 / var(--tw-bg-opacity, 1));\n  }\n\n  > div {\n    border-radius: 9999px;\n  }\n\n  > div {\n    pointer-events: none;\n  }\n\n  > div {\n    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  > div {\n    transition-duration: 300ms;\n  }\n\n  > div {\n\n    &:before {\n      --tw-content: '';\n      content: var(--tw-content);\n    }\n\n    &:before {\n      position: absolute;\n    }\n\n    &:before {\n      top: 50%;\n    }\n\n    &:before {\n      left: 0px;\n    }\n\n    &:before {\n      --tw-translate-y: -50%;\n      transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n    }\n\n    &:before {\n      height: 16px;\n    }\n\n    &:before {\n      width: 16px;\n    }\n\n    &:before {\n      --tw-bg-opacity: 1;\n      background-color: rgb(255 255 255 / var(--tw-bg-opacity, 1));\n    }\n\n    &:before {\n      border-width: 2px;\n    }\n\n    &:before {\n      --tw-border-opacity: 1;\n      border-color: rgb(64 64 64 / var(--tw-border-opacity, 1));\n    }\n\n    &:before {\n      border-radius: 9999px;\n    }\n\n    &:before {\n      --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);\n      --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);\n      box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n    }\n\n    &:before {\n      transition-property: all;\n      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n      transition-duration: 150ms;\n    }\n\n    &:before {\n      transition-duration: 300ms;\n    }\n  }\n}\n\n.react-scan-flash-active {\n  opacity: 0.4;\n  transition-property: opacity;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 300ms;\n}\n\n.react-scan-inspector-overlay {\n  display: flex;\n  flex-direction: column;\n  opacity: 0;\n  transition-property: opacity;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 200ms;\n  transition-timing-function: cubic-bezier(0, 0, 0.2, 1);\n  will-change: opacity;\n\n  &.fade-out {\n    opacity: 0;\n  }\n\n  &.fade-in {\n    opacity: 1;\n  }\n}\n\n.react-scan-what-changed {\n  ul {\n    list-style-type: disc;\n  }\n  ul {\n    padding-left: 16px;\n  }\n\n  li {\n    white-space: nowrap;\n  }\n\n  li {\n    > div {\n      display: flex;\n    }\n    > div {\n      align-items: center;\n    }\n    > div {\n      justify-content: space-between;\n    }\n    > div {\n      -moz-column-gap: 8px;\n           column-gap: 8px;\n    }\n  }\n}\n\n.count-badge {\n  display: flex;\n  align-items: center;\n  -moz-column-gap: 8px;\n       column-gap: 8px;\n  padding-left: 6px;\n  padding-right: 6px;\n  padding-top: 2px;\n  padding-bottom: 2px;\n  border-radius: 4px;\n  font-size: 12px;\n  line-height: 16px;\n  font-weight: 500;\n  --tw-numeric-spacing: tabular-nums;\n  font-variant-numeric: var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction);\n  --tw-text-opacity: 1;\n  color: rgb(168 85 247 / var(--tw-text-opacity, 1));\n  background-color: rgb(168 85 247 / 0.1);\n  transform-origin: center;\n  transition-property: all;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-delay: 150ms;\n  transition-duration: 300ms;\n}\n\n@keyframes countFlash {\n\n  0% {\n    background-color: rgba(168, 85, 247, 0.3);\n    transform: scale(1.05);\n  }\n\n  100% {\n    background-color: rgba(168, 85, 247, 0.1);\n    transform: scale(1);\n  }\n}\n\n.count-flash {\n  animation: countFlash .3s ease-out forwards;\n}\n\n@keyframes countFlashShake {\n\n  0% {\n    transform: translateX(0);\n  }\n\n  25% {\n    transform: translateX(-5px);\n  }\n\n  50% {\n    transform: translateX(5px) scale(1.1);\n  }\n\n  75% {\n    transform: translateX(-5px);\n  }\n\n  100% {\n    transform: translateX(0);\n  }\n}\n\n.count-flash-white {\n  animation: countFlashShake .3s ease-out forwards;\n  transition-delay: 500ms !important;\n}\n\n.change-scope {\n  display: flex;\n  align-items: center;\n  -moz-column-gap: 4px;\n       column-gap: 4px;\n  --tw-text-opacity: 1;\n  color: rgb(102 102 102 / var(--tw-text-opacity, 1));\n  font-size: 12px;\n  line-height: 16px;\n  font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;\n\n  > div {\n    padding-left: 6px;\n    padding-right: 6px;\n  }\n\n  > div {\n    padding-top: 2px;\n    padding-bottom: 2px;\n  }\n\n  > div {\n    border-radius: 4px;\n  }\n\n  > div {\n    font-size: 12px;\n    line-height: 16px;\n  }\n\n  > div {\n    font-weight: 500;\n  }\n\n  > div {\n    --tw-numeric-spacing: tabular-nums;\n    font-variant-numeric: var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction);\n  }\n\n  > div {\n    transform-origin: center;\n  }\n\n  > div {\n    transition-property: all;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  > div {\n    transition-delay: 150ms;\n  }\n\n  > div {\n    transition-duration: 300ms;\n  }\n\n  > div {\n\n    &[data-flash=\"true\"] {\n      background-color: rgb(168 85 247 / 0.1);\n    }\n\n    &[data-flash=\"true\"] {\n      --tw-text-opacity: 1;\n      color: rgb(168 85 247 / var(--tw-text-opacity, 1));\n    }\n  }\n}\n\n.react-scan-slider {\n  position: relative;\n  min-height: 24px;\n\n  > input {\n    position: absolute;\n  }\n\n  > input {\n    inset: 0px;\n  }\n\n  > input {\n    opacity: 0;\n  }\n\n  &:before {\n    --tw-content: '';\n    content: var(--tw-content);\n  }\n\n  &:before {\n    position: absolute;\n  }\n\n  &:before {\n    left: 0px;\n    right: 0px;\n  }\n\n  &:before {\n    top: 50%;\n  }\n\n  &:before {\n    --tw-translate-y: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  &:before {\n    height: 6px;\n  }\n\n  &:before {\n    background-color: rgb(142 97 227 / 0.4);\n  }\n\n  &:before {\n    border-radius: 8px;\n  }\n\n  &:before {\n    pointer-events: none;\n  }\n\n  &:after {\n    --tw-content: '';\n    content: var(--tw-content);\n  }\n\n  &:after {\n    position: absolute;\n  }\n\n  &:after {\n    left: 0px;\n    right: 0px;\n  }\n\n  &:after {\n    top: -8px;\n    bottom: -8px;\n  }\n\n  &:after {\n    z-index: -10;\n  }\n\n  span {\n    position: absolute;\n  }\n\n  span {\n    left: 0px;\n  }\n\n  span {\n    top: 50%;\n  }\n\n  span {\n    --tw-translate-y: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  span {\n    height: 10px;\n  }\n\n  span {\n    width: 10px;\n  }\n\n  span {\n    border-radius: 8px;\n  }\n\n  span {\n    --tw-bg-opacity: 1;\n    background-color: rgb(142 97 227 / var(--tw-bg-opacity, 1));\n  }\n\n  span {\n    pointer-events: none;\n  }\n\n  span {\n    transition-property: transform;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  span {\n    transition-duration: 75ms;\n  }\n}\n\n.resize-v-line {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 4px;\n  max-width: 4px;\n  height: 100%;\n  width: 100%;\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n\n  &:hover,\n  &:active {\n    > span {\n      --tw-bg-opacity: 1;\n      background-color: rgb(34 34 34 / var(--tw-bg-opacity, 1));\n    }\n\n    svg {\n      opacity: 1;\n    }\n  }\n\n  &::before {\n    --tw-content: \"\";\n    content: var(--tw-content);\n  }\n\n  &::before {\n    position: absolute;\n  }\n\n  &::before {\n    inset: 0px;\n  }\n\n  &::before {\n    left: 50%;\n  }\n\n  &::before {\n    --tw-translate-x: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  &::before {\n    width: 1px;\n  }\n\n  &::before {\n    --tw-bg-opacity: 1;\n    background-color: rgb(34 34 34 / var(--tw-bg-opacity, 1));\n  }\n\n  &::before {\n    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  > span {\n    position: absolute;\n  }\n\n  > span {\n    left: 50%;\n  }\n\n  > span {\n    top: 50%;\n  }\n\n  > span {\n    --tw-translate-x: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  > span {\n    --tw-translate-y: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  > span {\n    height: 18px;\n  }\n\n  > span {\n    width: 6px;\n  }\n\n  > span {\n    border-radius: 4px;\n  }\n\n  > span {\n    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  svg {\n    position: absolute;\n  }\n\n  svg {\n    left: 50%;\n  }\n\n  svg {\n    top: 50%;\n  }\n\n  svg {\n    --tw-translate-x: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  svg {\n    --tw-translate-y: -50%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  svg {\n    --tw-rotate: 90deg;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  svg {\n    --tw-text-opacity: 1;\n    color: rgb(163 163 163 / var(--tw-text-opacity, 1));\n  }\n\n  svg {\n    opacity: 0;\n  }\n\n  svg {\n    transition-property: opacity;\n    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n    transition-duration: 150ms;\n  }\n\n  svg {\n    z-index: 50;\n  }\n}\n\n.tree-node-search-highlight {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n\n  span {\n    padding-top: 1px;\n    padding-bottom: 1px;\n  }\n\n  span {\n    border-radius: 2px;\n  }\n\n  span {\n    --tw-bg-opacity: 1;\n    background-color: rgb(253 224 71 / var(--tw-bg-opacity, 1));\n  }\n\n  span {\n    font-weight: 500;\n  }\n\n  span {\n    --tw-text-opacity: 1;\n    color: rgb(0 0 0 / var(--tw-text-opacity, 1));\n  }\n\n  .single {\n    margin-right: 1px;\n  }\n\n  .single {\n    padding-left: 2px;\n    padding-right: 2px;\n  }\n\n  .regex {\n    padding-left: 2px;\n    padding-right: 2px;\n  }\n\n  .start {\n    margin-left: 1px;\n  }\n\n  .start {\n    border-top-left-radius: 2px;\n    border-bottom-left-radius: 2px;\n  }\n\n  .end {\n    margin-right: 1px;\n  }\n\n  .end {\n    border-top-right-radius: 2px;\n    border-bottom-right-radius: 2px;\n  }\n\n  .middle {\n    margin-left: 1px;\n    margin-right: 1px;\n  }\n\n  .middle {\n    border-radius: 2px;\n  }\n}\n\n.react-scan-toolbar-notification {\n  position: absolute;\n  left: 0px;\n  right: 0px;\n  display: flex;\n  align-items: center;\n  -moz-column-gap: 8px;\n       column-gap: 8px;\n  padding: 4px;\n  padding-left: 8px;\n  font-size: 10px;\n  --tw-text-opacity: 1;\n  color: rgb(212 212 212 / var(--tw-text-opacity, 1));\n  background-color: rgb(0 0 0 / 0.9);\n  transition-property: transform;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n\n  &:before {\n    --tw-content: '';\n    content: var(--tw-content);\n  }\n\n  &:before {\n    position: absolute;\n  }\n\n  &:before {\n    left: 0px;\n    right: 0px;\n  }\n\n  &:before {\n    --tw-bg-opacity: 1;\n    background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1));\n  }\n\n  &:before {\n    height: 8px;\n  }\n\n  &.position-top {\n    top: 100%;\n  }\n\n  &.position-top {\n    --tw-translate-y: -100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  &.position-top {\n    border-bottom-right-radius: 8px;\n    border-bottom-left-radius: 8px;\n  }\n\n  &.position-top {\n\n    &::before {\n      top: 0px;\n    }\n\n    &::before {\n      --tw-translate-y: -100%;\n      transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n    }\n  }\n\n  &.position-bottom {\n    bottom: 100%;\n  }\n\n  &.position-bottom {\n    --tw-translate-y: 100%;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n\n  &.position-bottom {\n    border-top-left-radius: 8px;\n    border-top-right-radius: 8px;\n  }\n\n  &.position-bottom {\n\n    &::before {\n      bottom: 0px;\n    }\n\n    &::before {\n      --tw-translate-y: 100%;\n      transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n    }\n  }\n\n  &.is-open {\n    --tw-translate-y: 0px;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.react-scan-header-item {\n  position: absolute;\n  inset: 0px;\n  --tw-translate-y: -200%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  transition-property: transform;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 300ms;\n\n  &.is-visible {\n    --tw-translate-y: 0px;\n    transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n  }\n}\n\n.react-scan-components-tree:has(.resize-v-line:hover, .resize-v-line:active)\n  .tree {\n  overflow: hidden;\n}\n\n.react-scan-expandable {\n  display: grid;\n  grid-template-rows: 0fr;\n  overflow: hidden;\n  transition-property: all;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 75ms;\n  transition-timing-function: ease-out;\n\n  > * {\n    min-height: 0;\n  }\n\n  &.react-scan-expanded {\n    grid-template-rows: 1fr;\n    transition-duration: 100ms;\n  }\n}\n\n.after\\:absolute::after {\n  content: var(--tw-content);\n  position: absolute;\n}\n\n.after\\:inset-0::after {\n  content: var(--tw-content);\n  inset: 0px;\n}\n\n.after\\:left-1\\/2::after {\n  content: var(--tw-content);\n  left: 50%;\n}\n\n.after\\:top-\\[100\\%\\]::after {\n  content: var(--tw-content);\n  top: 100%;\n}\n\n.after\\:h-\\[6px\\]::after {\n  content: var(--tw-content);\n  height: 6px;\n}\n\n.after\\:w-\\[10px\\]::after {\n  content: var(--tw-content);\n  width: 10px;\n}\n\n.after\\:-translate-x-1\\/2::after {\n  content: var(--tw-content);\n  --tw-translate-x: -50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n@keyframes fadeOut {\n\n  0% {\n    content: var(--tw-content);\n    opacity: 1;\n  }\n\n  100% {\n    content: var(--tw-content);\n    opacity: 0;\n  }\n}\n\n.after\\:animate-\\[fadeOut_1s_ease-out_forwards\\]::after {\n  content: var(--tw-content);\n  animation: fadeOut 1s ease-out forwards;\n}\n\n.after\\:border-l-\\[5px\\]::after {\n  content: var(--tw-content);\n  border-left-width: 5px;\n}\n\n.after\\:border-r-\\[5px\\]::after {\n  content: var(--tw-content);\n  border-right-width: 5px;\n}\n\n.after\\:border-t-\\[6px\\]::after {\n  content: var(--tw-content);\n  border-top-width: 6px;\n}\n\n.after\\:border-l-transparent::after {\n  content: var(--tw-content);\n  border-left-color: transparent;\n}\n\n.after\\:border-r-transparent::after {\n  content: var(--tw-content);\n  border-right-color: transparent;\n}\n\n.after\\:border-t-white::after {\n  content: var(--tw-content);\n  --tw-border-opacity: 1;\n  border-top-color: rgb(255 255 255 / var(--tw-border-opacity, 1));\n}\n\n.after\\:bg-purple-500\\/30::after {\n  content: var(--tw-content);\n  background-color: rgb(168 85 247 / 0.3);\n}\n\n.after\\:content-\\[\\\"\\\"\\]::after {\n  --tw-content: \"\";\n  content: var(--tw-content);\n}\n\n.focus-within\\:border-\\[\\#454545\\]:focus-within {\n  --tw-border-opacity: 1;\n  border-color: rgb(69 69 69 / var(--tw-border-opacity, 1));\n}\n\n.hover\\:bg-\\[\\#0f0f0f\\]:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(15 15 15 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:bg-\\[\\#18181B\\]:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(24 24 27 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:bg-\\[\\#34343b\\]:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(52 52 59 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:bg-\\[\\#5f3f9a\\]\\/20:hover {\n  background-color: rgb(95 63 154 / 0.2);\n}\n\n.hover\\:bg-\\[\\#5f3f9a\\]\\/40:hover {\n  background-color: rgb(95 63 154 / 0.4);\n}\n\n.hover\\:bg-red-600:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(220 38 38 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:bg-zinc-700:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(63 63 70 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:bg-zinc-800\\/50:hover {\n  background-color: rgb(39 39 42 / 0.5);\n}\n\n.hover\\:text-neutral-300:hover {\n  --tw-text-opacity: 1;\n  color: rgb(212 212 212 / var(--tw-text-opacity, 1));\n}\n\n.hover\\:text-white:hover {\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n}\n\n.group:hover .group-hover\\:bg-\\[\\#21437982\\] {\n  background-color: #21437982;\n}\n\n.group:hover .group-hover\\:bg-\\[\\#5b2d89\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(91 45 137 / var(--tw-bg-opacity, 1));\n}\n\n.group:hover .group-hover\\:bg-\\[\\#6a6a6a\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(106 106 106 / var(--tw-bg-opacity, 1));\n}\n\n.group:hover .group-hover\\:bg-\\[\\#efda1a2f\\] {\n  background-color: #efda1a2f;\n}\n\n.group:hover .group-hover\\:opacity-100 {\n  opacity: 1;\n}\n\n.peer\\/bottom:hover ~ .peer-hover\\/bottom\\:rounded-b-none {\n  border-bottom-right-radius: 0px;\n  border-bottom-left-radius: 0px;\n}\n\n.peer\\/left:hover ~ .peer-hover\\/left\\:rounded-l-none {\n  border-top-left-radius: 0px;\n  border-bottom-left-radius: 0px;\n}\n\n.peer\\/right:hover ~ .peer-hover\\/right\\:rounded-r-none {\n  border-top-right-radius: 0px;\n  border-bottom-right-radius: 0px;\n}\n\n.peer\\/top:hover ~ .peer-hover\\/top\\:rounded-t-none {\n  border-top-left-radius: 0px;\n  border-top-right-radius: 0px;\n}\n";

  // src/web/hooks/use-delayed-value.ts
  var useDelayedValue = (value, onDelay, offDelay = onDelay) => {
    const [delayedValue, setDelayedValue] = d4(value);
    y3(() => {
      if (value === delayedValue) return;
      const delay = value ? onDelay : offDelay;
      const timeout2 = setTimeout(() => setDelayedValue(value), delay);
      return () => clearTimeout(timeout2);
    }, [value, onDelay, offDelay]);
    return delayedValue;
  };

  // src/web/views/inspector/header.tsx
  var headerInspectClassName = w4(
    () => cn2(
      "absolute inset-0 flex items-center gap-x-2",
      "translate-y-0",
      "transition-transform duration-300",
      signalIsSettingsOpen.value && "-translate-y-[200%]"
    )
  );
  var HeaderInspect = () => {
    const refReRenders = A3(null);
    const refTiming = A3(null);
    const [currentFiber, setCurrentFiber] = d4(null);
    useSignalEffect(() => {
      const state = Store.inspectState.value;
      if (state.kind === "focused") {
        setCurrentFiber(state.fiber);
      }
    });
    useSignalEffect(() => {
      const state = timelineState.value;
      n3(() => {
        if (Store.inspectState.value.kind !== "focused") return;
        if (!refReRenders.current || !refTiming.current) return;
        const { totalUpdates, currentIndex, updates, isVisible, windowOffset } = state;
        const reRenders = Math.max(0, totalUpdates - 1);
        const headerText = isVisible ? `#${windowOffset + currentIndex} Re-render` : reRenders > 0 ? `\xD7${reRenders}` : "";
        let formattedTime;
        if (reRenders > 0 && currentIndex >= 0 && currentIndex < updates.length) {
          const time = updates[currentIndex]?.fiberInfo?.selfTime;
          formattedTime = time > 0 ? time < 0.1 - Number.EPSILON ? "< 0.1ms" : `${Number(time.toFixed(1))}ms` : void 0;
        }
        refReRenders.current.dataset.text = headerText ? ` \u2022 ${headerText}` : "";
        refTiming.current.dataset.text = formattedTime ? ` \u2022 ${formattedTime}` : "";
      });
    });
    const componentName = T3(() => {
      if (!currentFiber) return null;
      const { name, wrappers, wrapperTypes } = getExtendedDisplayName(currentFiber);
      const title = wrappers.length ? `${wrappers.join("(")}(${name})${")".repeat(wrappers.length)}` : name ?? "";
      const firstWrapperType = wrapperTypes[0];
      return /* @__PURE__ */ u6("span", { title, className: "flex items-center gap-x-1", children: [
        name ?? "Unknown",
        /* @__PURE__ */ u6(
          "span",
          {
            title: firstWrapperType?.title,
            className: "flex items-center gap-x-1 text-[10px] text-purple-400",
            children: !!firstWrapperType && /* @__PURE__ */ u6(k2, { children: [
              /* @__PURE__ */ u6(
                "span",
                {
                  className: cn2(
                    "rounded py-[1px] px-1",
                    "truncate",
                    firstWrapperType.compiler && "bg-purple-800 text-neutral-400",
                    !firstWrapperType.compiler && "bg-neutral-700 text-neutral-300",
                    firstWrapperType.type === "memo" && "bg-[#5f3f9a] text-white"
                  ),
                  children: firstWrapperType.type
                },
                firstWrapperType.type
              ),
              firstWrapperType.compiler && /* @__PURE__ */ u6("span", { className: "text-yellow-300", children: "\u2728" })
            ] })
          }
        ),
        wrapperTypes.length > 1 && /* @__PURE__ */ u6("span", { className: "text-[10px] text-neutral-400", children: [
          "\xD7",
          wrapperTypes.length - 1
        ] })
      ] });
    }, [currentFiber]);
    return /* @__PURE__ */ u6("div", { className: headerInspectClassName, children: [
      componentName,
      /* @__PURE__ */ u6("div", { className: "flex items-center gap-x-2 mr-auto text-xs text-[#888]", children: [
        /* @__PURE__ */ u6(
          "span",
          {
            ref: refReRenders,
            className: "with-data-text cursor-pointer !overflow-visible",
            title: "Click to toggle between rerenders and total renders"
          }
        ),
        /* @__PURE__ */ u6("span", { ref: refTiming, className: "with-data-text !overflow-visible" })
      ] })
    ] });
  };

  // src/web/widget/header.tsx
  var Header = () => {
    const isInitialView = useDelayedValue(
      Store.inspectState.value.kind === "focused",
      150,
      0
    );
    const handleClose = () => {
      signalWidgetViews.value = {
        view: "none"
      };
      Store.inspectState.value = {
        kind: "inspect-off"
      };
    };
    const isHeaderIsNotifications = signalWidgetViews.value.view === "notifications";
    if (isHeaderIsNotifications) {
      return;
    }
    return /* @__PURE__ */ u6("div", { className: "react-scan-header", children: [
      /* @__PURE__ */ u6("div", { className: "relative flex-1 h-full", children: /* @__PURE__ */ u6(
        "div",
        {
          className: cn2(
            "react-scan-header-item is-visible",
            !isInitialView && "!duration-0"
          ),
          children: /* @__PURE__ */ u6(HeaderInspect, {})
        }
      ) }),
      /* @__PURE__ */ u6(
        "button",
        {
          type: "button",
          title: "Close",
          className: "react-scan-close-button",
          onClick: handleClose,
          children: /* @__PURE__ */ u6(Icon, { name: "icon-close" })
        }
      )
    ] });
  };

  // src/web/components/toggle/index.tsx
  var Toggle = ({
    className,
    ...props
  }) => {
    return /* @__PURE__ */ u6("div", { className: cn2("react-scan-toggle", className), children: [
      /* @__PURE__ */ u6(
        "input",
        {
          type: "checkbox",
          ...props
        }
      ),
      /* @__PURE__ */ u6("div", {})
    ] });
  };

  // src/web/widget/fps-meter.tsx
  var FpsMeterInner = ({ fps: fps2 }) => {
    const getColor = (fps3) => {
      if (fps3 < 30) return "#EF4444";
      if (fps3 < 50) return "#F59E0B";
      return "rgb(214,132,245)";
    };
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2(
          "flex items-center gap-x-1 px-2 w-full",
          "h-6",
          "rounded-md",
          "font-mono leading-none",
          "bg-[#141414]",
          "ring-1 ring-white/[0.08]"
        ),
        children: [
          /* @__PURE__ */ u6(
            "div",
            {
              style: { color: getColor(fps2) },
              className: "text-sm font-semibold tracking-wide transition-colors ease-in-out w-full flex justify-center items-center",
              children: fps2
            }
          ),
          /* @__PURE__ */ u6("span", { className: "text-white/30 text-[11px] font-medium tracking-wide ml-auto min-w-fit", children: "FPS" })
        ]
      }
    );
  };
  var FPSMeter = () => {
    const [fps2, setFps] = d4(null);
    y3(() => {
      const intervalId = setInterval(() => {
        setFps(getFPS());
      }, 200);
      return () => clearInterval(intervalId);
    }, []);
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2(
          "flex items-center justify-end gap-x-2 px-1 ml-1 w-[72px]",
          "whitespace-nowrap text-sm text-white"
        ),
        children: fps2 === null ? /* @__PURE__ */ u6(k2, { children: "\uFE0F" }) : /* @__PURE__ */ u6(FpsMeterInner, { fps: fps2 })
      }
    );
  };
  var iife = (fn2) => fn2();
  var BoundedArray = class _BoundedArray extends Array {
    constructor(capacity = 25) {
      super();
      this.capacity = capacity;
    }
    push(...items) {
      const result = super.push(...items);
      while (this.length > this.capacity) {
        this.shift();
      }
      return result;
    }
    // do not couple capacity with a default param, it must be explicit
    static fromArray(array, capacity) {
      const arr = new _BoundedArray(capacity);
      arr.push(...array);
      return arr;
    }
  };

  // src/core/notifications/interaction-store.ts
  var Store2 = class {
    constructor(initialValue) {
      this.subscribers = /* @__PURE__ */ new Set();
      this.currentValue = initialValue;
    }
    subscribe(subscriber) {
      this.subscribers.add(subscriber);
      subscriber(this.currentValue);
      return () => {
        this.subscribers.delete(subscriber);
      };
    }
    setState(data) {
      this.currentValue = data;
      this.subscribers.forEach((subscriber) => subscriber(data));
    }
    getCurrentState() {
      return this.currentValue;
    }
  };
  var MAX_INTERACTION_BATCH = 150;
  var interactionStore = new Store2(
    new BoundedArray(MAX_INTERACTION_BATCH)
  );

  // src/core/notifications/performance-store.ts
  var MAX_CHANNEL_SIZE = 50;
  var PerformanceEntryChannels = class {
    constructor() {
      this.channels = {};
    }
    publish(item, to, createIfNoChannel = true) {
      const existingChannel = this.channels[to];
      if (!existingChannel) {
        if (!createIfNoChannel) {
          return;
        }
        this.channels[to] = {
          callbacks: new BoundedArray(MAX_CHANNEL_SIZE),
          state: new BoundedArray(MAX_CHANNEL_SIZE)
        };
        this.channels[to].state.push(item);
        return;
      }
      existingChannel.state.push(item);
      existingChannel.callbacks.forEach((cb) => cb(item));
    }
    getAvailableChannels() {
      return BoundedArray.fromArray(Object.keys(this.channels), MAX_CHANNEL_SIZE);
    }
    subscribe(to, cb, dropFirst = false) {
      const defer = () => {
        if (!dropFirst) {
          this.channels[to].state.forEach((item) => {
            cb(item);
          });
        }
        return () => {
          const filtered = this.channels[to].callbacks.filter(
            (subscribed) => subscribed !== cb
          );
          this.channels[to].callbacks = BoundedArray.fromArray(
            filtered,
            MAX_CHANNEL_SIZE
          );
        };
      };
      const existing = this.channels[to];
      if (!existing) {
        this.channels[to] = {
          callbacks: new BoundedArray(MAX_CHANNEL_SIZE),
          state: new BoundedArray(MAX_CHANNEL_SIZE)
        };
        this.channels[to].callbacks.push(cb);
        return defer();
      }
      existing.callbacks.push(cb);
      return defer();
    }
    updateChannelState(channel, updater, createIfNoChannel = true) {
      const existingChannel = this.channels[channel];
      if (!existingChannel) {
        if (!createIfNoChannel) {
          return;
        }
        const state = new BoundedArray(MAX_CHANNEL_SIZE);
        const newChannel = {
          callbacks: new BoundedArray(MAX_CHANNEL_SIZE),
          state
        };
        this.channels[channel] = newChannel;
        newChannel.state = updater(state);
        return;
      }
      existingChannel.state = updater(existingChannel.state);
    }
    getChannelState(channel) {
      return this.channels[channel].state ?? new BoundedArray(MAX_CHANNEL_SIZE);
    }
  };
  var performanceEntryChannels = new PerformanceEntryChannels();

  // src/core/notifications/performance.ts
  var DEFAULT_PATH_FILTERS = {
    skipProviders: true,
    skipHocs: true,
    skipContainers: true,
    skipMinified: true,
    skipUtilities: true,
    skipBoundaries: true
  };
  var PATH_FILTER_PATTERNS = {
    providers: [/Provider$/, /^Provider$/, /^Context$/],
    hocs: [/^with[A-Z]/, /^forward(?:Ref)?$/i, /^Forward(?:Ref)?\(/],
    containers: [/^(?:App)?Container$/, /^Root$/, /^ReactDev/],
    utilities: [
      /^Fragment$/,
      /^Suspense$/,
      /^ErrorBoundary$/,
      /^Portal$/,
      /^Consumer$/,
      /^Layout$/,
      /^Router/,
      /^Hydration/
    ],
    boundaries: [/^Boundary$/, /Boundary$/, /^Provider$/, /Provider$/]
  };
  var shouldIncludeInPath = (name, filters = DEFAULT_PATH_FILTERS) => {
    const patternsToCheck = [];
    if (filters.skipProviders) patternsToCheck.push(...PATH_FILTER_PATTERNS.providers);
    if (filters.skipHocs) patternsToCheck.push(...PATH_FILTER_PATTERNS.hocs);
    if (filters.skipContainers) patternsToCheck.push(...PATH_FILTER_PATTERNS.containers);
    if (filters.skipUtilities) patternsToCheck.push(...PATH_FILTER_PATTERNS.utilities);
    if (filters.skipBoundaries) patternsToCheck.push(...PATH_FILTER_PATTERNS.boundaries);
    return !patternsToCheck.some((pattern) => pattern.test(name));
  };
  var minifiedPatterns = [
    /^[a-z]$/,
    /^[a-z][0-9]$/,
    /^_+$/,
    /^[A-Za-z][_$]$/,
    /^[a-z]{1,2}$/
  ];
  var isMinified = (name) => {
    for (let i6 = 0; i6 < minifiedPatterns.length; i6++) {
      if (minifiedPatterns[i6].test(name)) return true;
    }
    const hasNoVowels = !/[aeiou]/i.test(name);
    const hasMostlyNumbers = (name.match(/\d/g)?.length ?? 0) > name.length / 2;
    const isSingleWordLowerCase = /^[a-z]+$/.test(name);
    const hasRandomLookingChars = /[$_]{2,}/.test(name);
    return Number(hasNoVowels) + Number(hasMostlyNumbers) + Number(isSingleWordLowerCase) + Number(hasRandomLookingChars) >= 2;
  };
  var getCleanComponentName = (component) => {
    const name = Te(component);
    if (!name) return "";
    return name.replace(
      /^(?:Memo|Forward(?:Ref)?|With.*?)\((?<inner>.*?)\)$/,
      "$<inner>"
    );
  };
  var getInteractionPath = (initialFiber, filters = DEFAULT_PATH_FILTERS) => {
    if (!initialFiber) return [];
    const currentName = Te(initialFiber.type);
    if (!currentName) return [];
    const stack = new Array();
    let fiber = initialFiber;
    while (fiber.return) {
      const name = getCleanComponentName(fiber.type);
      if (name && !isMinified(name) && shouldIncludeInPath(name, filters) && name.toLowerCase() !== name) {
        stack.push(name);
      }
      fiber = fiber.return;
    }
    const fullPath = new Array(stack.length);
    for (let i6 = 0; i6 < stack.length; i6++) {
      fullPath[i6] = stack[stack.length - i6 - 1];
    }
    return fullPath;
  };
  var getFirstNameFromAncestor = (fiber, accept = () => true) => {
    let curr = fiber;
    while (curr) {
      const currName = Te(curr.type);
      if (currName && accept(currName)) {
        return currName;
      }
      curr = curr.return;
    }
    return null;
  };
  var unsubscribeTrackVisibilityChange;
  var lastVisibilityHiddenAt = "never-hidden";
  var trackVisibilityChange = () => {
    unsubscribeTrackVisibilityChange?.();
    const onVisibilityChange = () => {
      if (document.hidden) {
        lastVisibilityHiddenAt = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    unsubscribeTrackVisibilityChange = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  };
  var getInteractionType = (eventName) => {
    if (["pointerup", "click"].includes(eventName)) {
      return "pointer";
    }
    if (eventName.includes("key")) ;
    if (["keydown", "keyup"].includes(eventName)) {
      return "keyboard";
    }
    return null;
  };
  var onEntryAnimationId = null;
  var setupPerformanceListener = (onEntry) => {
    trackVisibilityChange();
    const interactionMap = /* @__PURE__ */ new Map();
    const interactionTargetMap = /* @__PURE__ */ new Map();
    const processInteractionEntry = (entry) => {
      if (!entry.interactionId) return;
      if (entry.interactionId && entry.target && !interactionTargetMap.has(entry.interactionId)) {
        interactionTargetMap.set(entry.interactionId, entry.target);
      }
      if (entry.target) {
        let current = entry.target;
        while (current) {
          if (current.id === "react-scan-toolbar-root" || current.id === "react-scan-root") {
            return;
          }
          current = current.parentElement;
        }
      }
      const existingInteraction = interactionMap.get(entry.interactionId);
      if (existingInteraction) {
        if (entry.duration > existingInteraction.latency) {
          existingInteraction.entries = [entry];
          existingInteraction.latency = entry.duration;
        } else if (entry.duration === existingInteraction.latency && entry.startTime === existingInteraction.entries[0].startTime) {
          existingInteraction.entries.push(entry);
        }
      } else {
        const interactionType = getInteractionType(entry.name);
        if (!interactionType) {
          return;
        }
        const interaction = {
          id: entry.interactionId,
          latency: entry.duration,
          entries: [entry],
          target: entry.target,
          type: interactionType,
          startTime: entry.startTime,
          endTime: Date.now(),
          processingStart: entry.processingStart,
          processingEnd: entry.processingEnd,
          duration: entry.duration,
          inputDelay: entry.processingStart - entry.startTime,
          processingDuration: entry.processingEnd - entry.processingStart,
          presentationDelay: entry.duration - (entry.processingEnd - entry.startTime),
          // componentPath:
          timestamp: Date.now(),
          timeSinceTabInactive: lastVisibilityHiddenAt === "never-hidden" ? "never-hidden" : Date.now() - lastVisibilityHiddenAt,
          visibilityState: document.visibilityState,
          timeOrigin: performance.timeOrigin,
          referrer: document.referrer
        };
        interactionMap.set(interaction.id, interaction);
        if (!onEntryAnimationId) {
          onEntryAnimationId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onEntry(interactionMap.get(interaction.id));
              onEntryAnimationId = null;
            });
          });
        }
      }
    };
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (let i6 = 0, len = entries.length; i6 < len; i6++) {
        const entry = entries[i6];
        processInteractionEntry(entry);
      }
    });
    try {
      po.observe({
        type: "event",
        buffered: true,
        durationThreshold: 16
      });
      po.observe({
        type: "first-input",
        buffered: true
      });
    } catch {
    }
    return () => po.disconnect();
  };
  var setupPerformancePublisher = () => {
    return setupPerformanceListener((entry) => {
      performanceEntryChannels.publish(
        {
          kind: "entry-received",
          entry
        },
        "recording"
      );
    });
  };
  var MAX_INTERACTION_TASKS = 25;
  var tasks = new BoundedArray(MAX_INTERACTION_TASKS);
  var getAssociatedDetailedTimingInteraction = (entry, activeTasks) => {
    let closestTask = null;
    for (const task of activeTasks) {
      if (task.type !== entry.type) {
        continue;
      }
      if (closestTask === null) {
        closestTask = task;
        continue;
      }
      const getAbsoluteDiff = (task2, entry2) => Math.abs(task2.startDateTime) - (entry2.startTime + entry2.timeOrigin);
      if (getAbsoluteDiff(task, entry) < getAbsoluteDiff(closestTask, entry)) {
        closestTask = task;
      }
    }
    return closestTask;
  };
  var listenForPerformanceEntryInteractions = (onComplete) => {
    const unsubscribe = performanceEntryChannels.subscribe(
      "recording",
      (event) => {
        const associatedDetailedInteraction = event.kind === "auto-complete-race" ? tasks.find((task) => task.interactionUUID === event.interactionUUID) : getAssociatedDetailedTimingInteraction(event.entry, tasks);
        if (!associatedDetailedInteraction) {
          return;
        }
        const completedInteraction = associatedDetailedInteraction.completeInteraction(event);
        onComplete(completedInteraction);
      }
    );
    return unsubscribe;
  };
  var trackDetailedTiming = ({
    onMicroTask,
    onRAF,
    onTimeout,
    abort
  }) => {
    queueMicrotask(() => {
      if (abort?.() === true) {
        return;
      }
      if (!onMicroTask()) {
        return;
      }
      requestAnimationFrame(() => {
        if (abort?.() === true) {
          return;
        }
        if (!onRAF()) {
          return;
        }
        setTimeout(() => {
          if (abort?.() === true) {
            return;
          }
          onTimeout();
        }, 0);
      });
    });
  };
  var getTargetInteractionDetails = (target) => {
    const associatedFiber = getFiberFromElement(target);
    if (!associatedFiber) {
      return;
    }
    let componentName = associatedFiber ? Te(associatedFiber?.type) : "N/A";
    if (!componentName) {
      componentName = getFirstNameFromAncestor(associatedFiber, (name) => name.length > 2) ?? "N/A";
    }
    if (!componentName) {
      return;
    }
    const componentPath = getInteractionPath(associatedFiber);
    return {
      componentPath,
      childrenTree: {},
      componentName,
      elementFiber: associatedFiber
    };
  };
  var setupDetailedPointerTimingListener = (kind, options) => {
    let instrumentationIdInControl = null;
    const getEvent = (info) => {
      switch (kind) {
        case "pointer": {
          if (info.phase === "start") {
            return "pointerup";
          }
          if (info.target instanceof HTMLInputElement || info.target instanceof HTMLSelectElement) {
            return "change";
          }
          return "click";
        }
        case "keyboard": {
          if (info.phase === "start") {
            return "keydown";
          }
          return "change";
        }
      }
    };
    const lastInteractionRef = {
      current: {
        kind: "uninitialized-stage",
        interactionUUID: not_globally_unique_generateId(),
        // the first interaction uses this
        stageStart: Date.now(),
        interactionType: kind
      }
    };
    const onInteractionStart = (e5) => {
      const path = e5.composedPath();
      if (path.some(
        (el) => el instanceof Element && el.id === "react-scan-toolbar-root"
      )) {
        return;
      }
      if (Date.now() - lastInteractionRef.current.stageStart > 2e3) {
        lastInteractionRef.current = {
          kind: "uninitialized-stage",
          interactionUUID: not_globally_unique_generateId(),
          stageStart: Date.now(),
          interactionType: kind
        };
      }
      if (lastInteractionRef.current.kind !== "uninitialized-stage") {
        return;
      }
      const pointerUpStart = performance.now();
      options?.onStart?.(lastInteractionRef.current.interactionUUID);
      const details = getTargetInteractionDetails(e5.target);
      if (!details) {
        options?.onError?.(lastInteractionRef.current.interactionUUID);
        return;
      }
      const fiberRenders = {};
      const stopListeningForRenders = listenForRenders(fiberRenders);
      lastInteractionRef.current = {
        ...lastInteractionRef.current,
        interactionType: kind,
        blockingTimeStart: Date.now(),
        childrenTree: details.childrenTree,
        componentName: details.componentName,
        componentPath: details.componentPath,
        fiberRenders,
        kind: "interaction-start",
        interactionStartDetail: pointerUpStart,
        stopListeningForRenders
      };
      const event = getEvent({ phase: "end", target: e5.target });
      document.addEventListener(event, onLastJS, {
        once: true
      });
      requestAnimationFrame(() => {
        document.removeEventListener(event, onLastJS);
      });
    };
    document.addEventListener(
      getEvent({ phase: "start" }),
      // oxlint-disable-next-line typescript/no-explicit-any
      onInteractionStart,
      {
        capture: true
      }
    );
    const onLastJS = (e5, instrumentationId, abort) => {
      if (lastInteractionRef.current.kind !== "interaction-start" && instrumentationId === instrumentationIdInControl) {
        if (kind === "pointer" && e5.target instanceof HTMLSelectElement) {
          lastInteractionRef.current = {
            kind: "uninitialized-stage",
            interactionUUID: not_globally_unique_generateId(),
            stageStart: Date.now(),
            interactionType: kind
          };
          return;
        }
        options?.onError?.(lastInteractionRef.current.interactionUUID);
        lastInteractionRef.current = {
          kind: "uninitialized-stage",
          interactionUUID: not_globally_unique_generateId(),
          stageStart: Date.now(),
          interactionType: kind
        };
        return;
      }
      instrumentationIdInControl = instrumentationId;
      trackDetailedTiming({
        abort,
        onMicroTask: () => {
          if (lastInteractionRef.current.kind === "uninitialized-stage") {
            return false;
          }
          lastInteractionRef.current = {
            ...lastInteractionRef.current,
            kind: "js-end-stage",
            jsEndDetail: performance.now()
          };
          return true;
        },
        onRAF: () => {
          if (lastInteractionRef.current.kind !== "js-end-stage" && lastInteractionRef.current.kind !== "raf-stage") {
            options?.onError?.(lastInteractionRef.current.interactionUUID);
            lastInteractionRef.current = {
              kind: "uninitialized-stage",
              interactionUUID: not_globally_unique_generateId(),
              stageStart: Date.now(),
              interactionType: kind
            };
            return false;
          }
          lastInteractionRef.current = {
            ...lastInteractionRef.current,
            kind: "raf-stage",
            rafStart: performance.now()
          };
          return true;
        },
        onTimeout: () => {
          if (lastInteractionRef.current.kind !== "raf-stage") {
            options?.onError?.(lastInteractionRef.current.interactionUUID);
            lastInteractionRef.current = {
              kind: "uninitialized-stage",
              interactionUUID: not_globally_unique_generateId(),
              stageStart: Date.now(),
              interactionType: kind
            };
            return;
          }
          const now = Date.now();
          const timeoutStage = Object.freeze({
            ...lastInteractionRef.current,
            kind: "timeout-stage",
            blockingTimeEnd: now,
            commitEnd: performance.now()
          });
          lastInteractionRef.current = {
            kind: "uninitialized-stage",
            interactionUUID: not_globally_unique_generateId(),
            stageStart: now,
            interactionType: kind
          };
          let completed = false;
          const completeInteraction = (event) => {
            completed = true;
            const latency = event.kind === "auto-complete-race" ? event.detailedTiming.commitEnd - event.detailedTiming.interactionStartDetail : event.entry.latency;
            const finalInteraction = {
              detailedTiming: timeoutStage,
              latency,
              completedAt: Date.now(),
              flushNeeded: true
            };
            options?.onComplete?.(
              timeoutStage.interactionUUID,
              finalInteraction,
              event
            );
            const newTasks = tasks.filter(
              (task2) => task2.interactionUUID !== timeoutStage.interactionUUID
            );
            tasks = BoundedArray.fromArray(newTasks, MAX_INTERACTION_TASKS);
            return finalInteraction;
          };
          const task = {
            completeInteraction,
            endDateTime: Date.now(),
            startDateTime: timeoutStage.blockingTimeStart,
            type: kind,
            interactionUUID: timeoutStage.interactionUUID
          };
          tasks.push(task);
          if (!isPerformanceEventAvailable()) {
            const newTasks = tasks.filter(
              (task2) => task2.interactionUUID !== timeoutStage.interactionUUID
            );
            tasks = BoundedArray.fromArray(newTasks, MAX_INTERACTION_TASKS);
            completeInteraction({
              kind: "auto-complete-race",
              // redundant
              detailedTiming: timeoutStage,
              interactionUUID: timeoutStage.interactionUUID
            });
          } else {
            setTimeout(() => {
              if (completed) {
                return;
              }
              completeInteraction({
                kind: "auto-complete-race",
                // redundant
                detailedTiming: timeoutStage,
                interactionUUID: timeoutStage.interactionUUID
              });
              const newTasks = tasks.filter(
                (task2) => task2.interactionUUID !== timeoutStage.interactionUUID
              );
              tasks = BoundedArray.fromArray(newTasks, MAX_INTERACTION_TASKS);
            }, 1e3);
          }
        }
      });
    };
    const onKeyPress = (e5) => {
      const id = not_globally_unique_generateId();
      onLastJS(e5, id, () => id !== instrumentationIdInControl);
    };
    if (kind === "keyboard") {
      document.addEventListener("keypress", onKeyPress);
    }
    return () => {
      document.removeEventListener(
        getEvent({ phase: "start" }),
        // oxlint-disable-next-line typescript/no-explicit-any
        onInteractionStart,
        {
          capture: true
        }
      );
      document.removeEventListener("keypress", onKeyPress);
    };
  };
  var getHostFromFiber = (fiber) => {
    return N(fiber, (node) => {
      if (k(node)) {
        return true;
      }
    })?.stateNode;
  };
  var isPerformanceEventAvailable = () => {
    return "PerformanceEventTiming" in globalThis;
  };
  var listenForRenders = (fiberRenders) => {
    const listener = (fiber) => {
      const displayName = Te(fiber.type);
      if (!displayName) {
        return;
      }
      const existing = fiberRenders[displayName];
      if (!existing) {
        const parents = /* @__PURE__ */ new Set();
        const res = fiber.return && getParentCompositeFiber(fiber.return);
        const parentCompositeName = res && Te(res[0]);
        if (parentCompositeName) {
          parents.add(parentCompositeName);
        }
        const { selfTime: selfTime2, totalTime: totalTime2 } = Ce(fiber);
        const newChanges2 = collectInspectorDataWithoutCounts(fiber);
        const emptySection2 = {
          current: [],
          changes: /* @__PURE__ */ new Set(),
          changesCounts: /* @__PURE__ */ new Map()
        };
        const changes = {
          fiberProps: newChanges2.fiberProps || emptySection2,
          fiberState: newChanges2.fiberState || emptySection2,
          fiberContext: newChanges2.fiberContext || emptySection2
        };
        fiberRenders[displayName] = {
          renderCount: 1,
          hasMemoCache: we(fiber),
          wasFiberRenderMount: wasFiberRenderMount(fiber),
          parents,
          selfTime: selfTime2,
          totalTime: totalTime2,
          nodeInfo: [
            {
              element: getHostFromFiber(fiber),
              name: Te(fiber.type) ?? "Unknown",
              selfTime: Ce(fiber).selfTime
            }
          ],
          changes
        };
        return;
      }
      const parentType = getParentCompositeFiber(fiber)?.[0]?.type;
      if (parentType) {
        const res = fiber.return && getParentCompositeFiber(fiber.return);
        const parentCompositeName = res && Te(res[0]);
        if (parentCompositeName) {
          existing.parents.add(parentCompositeName);
        }
      }
      const { selfTime, totalTime } = Ce(fiber);
      const newChanges = collectInspectorDataWithoutCounts(fiber);
      if (!newChanges) return;
      const emptySection = {
        current: [],
        changes: /* @__PURE__ */ new Set(),
        changesCounts: /* @__PURE__ */ new Map()
      };
      existing.wasFiberRenderMount = existing.wasFiberRenderMount || wasFiberRenderMount(fiber);
      existing.hasMemoCache = existing.hasMemoCache || we(fiber);
      existing.changes = {
        fiberProps: mergeSectionData(
          existing.changes?.fiberProps || emptySection,
          newChanges.fiberProps || emptySection
        ),
        fiberState: mergeSectionData(
          existing.changes?.fiberState || emptySection,
          newChanges.fiberState || emptySection
        ),
        fiberContext: mergeSectionData(
          existing.changes?.fiberContext || emptySection,
          newChanges.fiberContext || emptySection
        )
      };
      existing.renderCount += 1;
      existing.selfTime += selfTime;
      existing.totalTime += totalTime;
      existing.nodeInfo.push({
        element: getHostFromFiber(fiber),
        name: Te(fiber.type) ?? "Unknown",
        selfTime: Ce(fiber).selfTime
      });
    };
    Store.interactionListeningForRenders = listener;
    return () => {
      if (Store.interactionListeningForRenders === listener) {
        Store.interactionListeningForRenders = null;
      }
    };
  };
  var mergeSectionData = (existing, newData) => {
    const mergedSection = {
      current: [...existing.current],
      changes: /* @__PURE__ */ new Set(),
      changesCounts: /* @__PURE__ */ new Map()
    };
    for (const value of newData.current) {
      if (!mergedSection.current.some((item) => item.name === value.name)) {
        mergedSection.current.push(value);
      }
    }
    for (const change of newData.changes) {
      if (typeof change === "string" || typeof change === "number") {
        mergedSection.changes.add(change);
        const existingCount = existing.changesCounts.get(change) || 0;
        const newCount = newData.changesCounts.get(change) || 0;
        mergedSection.changesCounts.set(change, existingCount + newCount);
      }
    }
    return mergedSection;
  };
  var wasFiberRenderMount = (fiber) => {
    if (!fiber.alternate) {
      return true;
    }
    const prevFiber = fiber.alternate;
    const wasMounted = prevFiber && prevFiber.memoizedState != null && prevFiber.memoizedState.element != null && prevFiber.memoizedState.isDehydrated !== true;
    const isMounted = fiber.memoizedState != null && fiber.memoizedState.element != null && fiber.memoizedState.isDehydrated !== true;
    return !wasMounted && isMounted;
  };

  // src/web/utils/create-store.ts
  var createStoreImpl = (createState) => {
    let state;
    const listeners = /* @__PURE__ */ new Set();
    const setState = (partial, replace) => {
      const nextState = typeof partial === "function" ? partial(state) : partial;
      if (!Object.is(nextState, state)) {
        const previousState = state;
        state = replace ?? (typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
        listeners.forEach((listener) => listener(state, previousState));
      }
    };
    const getState = () => state;
    const getInitialState = () => initialState;
    const subscribe = (selectorOrListener, listener) => {
      let selector;
      let actualListener;
      if (listener) {
        selector = selectorOrListener;
        actualListener = listener;
      } else {
        actualListener = selectorOrListener;
      }
      let currentSlice = selector ? selector(state) : void 0;
      const wrappedListener = (newState, previousState) => {
        if (selector) {
          const nextSlice = selector(newState);
          const prevSlice = selector(previousState);
          if (!Object.is(currentSlice, nextSlice)) {
            currentSlice = nextSlice;
            actualListener(nextSlice, prevSlice);
          }
        } else {
          actualListener(newState, previousState);
        }
      };
      listeners.add(wrappedListener);
      return () => listeners.delete(wrappedListener);
    };
    const api = { setState, getState, getInitialState, subscribe };
    const initialState = state = createState(setState, getState, api);
    return api;
  };
  var createStore = (createState) => createStoreImpl;

  // src/core/notifications/event-tracking.ts
  var accumulatedFiberRendersOverTask = null;
  createStore()((set) => ({
    state: {
      events: []
    },
    actions: {
      addEvent: (event) => {
        set((store) => ({
          state: {
            events: [...store.state.events, event]
          }
        }));
      },
      clear: () => {
        set({
          state: {
            events: []
          }
        });
      }
    }
  }));
  var EVENT_STORE_CAPACITY = 200;
  var toolbarEventStore = createStore()(
    (set, get) => {
      const listeners = /* @__PURE__ */ new Set();
      return {
        state: {
          events: new BoundedArray(EVENT_STORE_CAPACITY)
        },
        actions: {
          addEvent: (event) => {
            listeners.forEach((listener) => listener(event));
            const events = [...get().state.events, event];
            const applyOverlapCheckToLongRenderEvent = (longRenderEvent, onOverlap) => {
              const overlapsWith = events.find((event2) => {
                if (event2.kind === "long-render") {
                  return;
                }
                if (event2.id === longRenderEvent.id) {
                  return;
                }
                if (longRenderEvent.data.startAt <= event2.data.startAt && longRenderEvent.data.endAt <= event2.data.endAt && longRenderEvent.data.endAt >= event2.data.startAt) {
                  return true;
                }
                if (event2.data.startAt <= longRenderEvent.data.startAt && event2.data.endAt >= longRenderEvent.data.startAt) {
                  return true;
                }
                if (longRenderEvent.data.startAt <= event2.data.startAt && longRenderEvent.data.endAt >= event2.data.endAt) {
                  return true;
                }
              });
              if (overlapsWith) {
                onOverlap(overlapsWith);
              }
            };
            const toRemove = /* @__PURE__ */ new Set();
            events.forEach((event2) => {
              if (event2.kind === "interaction") return;
              applyOverlapCheckToLongRenderEvent(event2, () => {
                toRemove.add(event2.id);
              });
            });
            const withRemovedEvents = events.filter(
              (event2) => !toRemove.has(event2.id)
            );
            set(() => ({
              state: {
                events: BoundedArray.fromArray(
                  withRemovedEvents,
                  EVENT_STORE_CAPACITY
                )
              }
            }));
          },
          addListener: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
          clear: () => {
            set({
              state: {
                events: new BoundedArray(EVENT_STORE_CAPACITY)
              }
            });
          }
        }
      };
    }
  );
  var useToolbarEventLog = () => {
    return C4(
      toolbarEventStore.subscribe,
      toolbarEventStore.getState
    );
  };
  var taskDirtyAt = null;
  var taskDirtyOrigin = null;
  var previousTrackCurrentMouseOverElementCallback = null;
  var overToolbar;
  var trackCurrentMouseOverToolbar = () => {
    const callback = (e5) => {
      overToolbar = e5.composedPath().map((path) => path.id).filter(Boolean).includes("react-scan-toolbar");
    };
    document.addEventListener("mouseover", callback);
    previousTrackCurrentMouseOverElementCallback = callback;
    return () => {
      if (previousTrackCurrentMouseOverElementCallback) {
        document.removeEventListener(
          "mouseover",
          previousTrackCurrentMouseOverElementCallback
        );
      }
    };
  };
  var startDirtyTaskTracking = () => {
    const onVisibilityChange = () => {
      taskDirtyAt = performance.now();
      taskDirtyOrigin = performance.timeOrigin;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  };
  var HIGH_SEVERITY_FPS_DROP_TIME = 150;
  var framesDrawnInTheLastSecond = [];
  function startLongPipelineTracking() {
    let rafHandle;
    let timeoutHandle;
    function measure() {
      let unSub = null;
      accumulatedFiberRendersOverTask = null;
      accumulatedFiberRendersOverTask = {};
      unSub = listenForRenders(accumulatedFiberRendersOverTask);
      const startOrigin = performance.timeOrigin;
      const startTime = performance.now();
      rafHandle = requestAnimationFrame(() => {
        timeoutHandle = setTimeout(() => {
          const endNow = performance.now();
          const duration = endNow - startTime;
          const endOrigin = performance.timeOrigin;
          framesDrawnInTheLastSecond.push(endNow + endOrigin);
          const framesInTheLastSecond = framesDrawnInTheLastSecond.filter(
            (frameAt) => endNow + endOrigin - frameAt <= 1e3
          );
          const fps2 = framesInTheLastSecond.length;
          framesDrawnInTheLastSecond = framesInTheLastSecond;
          const taskConsideredDirty = taskDirtyAt !== null && taskDirtyOrigin !== null ? endNow + endOrigin - (taskDirtyOrigin + taskDirtyAt) < 100 : null;
          const wasTaskInfluencedByToolbar = overToolbar !== null && overToolbar;
          if (duration > HIGH_SEVERITY_FPS_DROP_TIME && !taskConsideredDirty && document.visibilityState === "visible" && !wasTaskInfluencedByToolbar) {
            const endAt = endOrigin + endNow;
            const startAt = startTime + startOrigin;
            toolbarEventStore.getState().actions.addEvent({
              kind: "long-render",
              id: not_globally_unique_generateId(),
              data: {
                endAt,
                startAt,
                meta: {
                  // oxlint-disable-next-line typescript/no-non-null-assertion
                  fiberRenders: accumulatedFiberRendersOverTask,
                  latency: duration,
                  fps: fps2
                }
              }
            });
          }
          taskDirtyAt = null;
          taskDirtyOrigin = null;
          unSub?.();
          measure();
        }, 0);
      });
      return unSub;
    }
    const measureUnSub = measure();
    return () => {
      measureUnSub();
      cancelAnimationFrame(rafHandle);
      clearTimeout(timeoutHandle);
    };
  }
  var startTimingTracking = () => {
    const unSubPerformance = setupPerformancePublisher();
    const unSubMouseOver = trackCurrentMouseOverToolbar();
    const unSubDirtyTaskTracking = startDirtyTaskTracking();
    const unSubLongPipelineTracking = startLongPipelineTracking();
    const onComplete = async (_6, finalInteraction, event) => {
      toolbarEventStore.getState().actions.addEvent({
        kind: "interaction",
        id: not_globally_unique_generateId(),
        data: {
          startAt: finalInteraction.detailedTiming.blockingTimeStart,
          endAt: performance.now() + performance.timeOrigin,
          meta: { ...finalInteraction, kind: event.kind }
          // TODO, will need interaction specific metadata here
        }
      });
      const existingCompletedInteractions = performanceEntryChannels.getChannelState("recording");
      finalInteraction.detailedTiming.stopListeningForRenders();
      if (existingCompletedInteractions.length) {
        performanceEntryChannels.updateChannelState(
          "recording",
          () => new BoundedArray(MAX_CHANNEL_SIZE)
        );
      }
    };
    const unSubDetailedPointerTiming = setupDetailedPointerTimingListener(
      "pointer",
      {
        onComplete
      }
    );
    const unSubDetailedKeyboardTiming = setupDetailedPointerTimingListener(
      "keyboard",
      {
        onComplete
      }
    );
    const unSubInteractions = listenForPerformanceEntryInteractions(
      (completedInteraction) => {
        interactionStore.setState(
          BoundedArray.fromArray(
            interactionStore.getCurrentState().concat(completedInteraction),
            MAX_INTERACTION_BATCH
          )
        );
      }
    );
    return () => {
      unSubMouseOver();
      unSubDirtyTaskTracking();
      unSubLongPipelineTracking();
      unSubPerformance();
      unSubDetailedPointerTiming();
      unSubInteractions();
      unSubDetailedKeyboardTiming();
    };
  };

  // src/web/views/notifications/data.ts
  var getComponentName = (path) => {
    const filteredPath = path.filter((item) => item.length > 2);
    if (filteredPath.length === 0) {
      return path.at(-1) ?? "Unknown";
    }
    return filteredPath.at(-1);
  };
  var getTotalTime = (timing) => {
    switch (timing.kind) {
      case "interaction": {
        const {
          renderTime,
          otherJSTime,
          framePreparation,
          frameConstruction,
          frameDraw
        } = timing;
        return renderTime + otherJSTime + framePreparation + frameConstruction + (frameDraw ?? 0);
      }
      case "dropped-frames": {
        return timing.otherTime + timing.renderTime;
      }
    }
  };
  var isRenderMemoizable = (groupedFiberRender) => {
    if (groupedFiberRender.wasFiberRenderMount) {
      return false;
    }
    if (groupedFiberRender.hasMemoCache) {
      return false;
    }
    return groupedFiberRender.changes.context.length === 0 && groupedFiberRender.changes.props.length === 0 && groupedFiberRender.changes.state.length === 0;
  };
  var getEventSeverity = (event) => {
    const totalTime = getTotalTime(event.timing);
    switch (event.kind) {
      case "interaction": {
        if (totalTime < 200) return "low";
        if (totalTime < 500) return "needs-improvement";
        return "high";
      }
      case "dropped-frames": {
        if (totalTime < 50) return "low";
        if (totalTime < HIGH_SEVERITY_FPS_DROP_TIME) return "needs-improvement";
        return "high";
      }
    }
  };
  var useNotificationsContext = () => x3(NotificationStateContext);
  var NotificationStateContext = K2(null);

  // src/web/views/notifications/icons.tsx
  var ChevronRight = ({
    size = 24,
    className
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className: cn2(["lucide lucide-chevron-right", className]),
      children: /* @__PURE__ */ u6("path", { d: "m9 18 6-6-6-6" })
    }
  );
  var Notification = ({
    className = "",
    size = 24,
    events = []
  }) => {
    const hasHighSeverity = events.includes(true);
    const totalSevere = events.filter((e5) => e5).length;
    const displayCount = totalSevere > 99 ? ">99" : totalSevere;
    const badgeSize = hasHighSeverity ? Math.max(size * 0.6, 14) : Math.max(size * 0.4, 6);
    return /* @__PURE__ */ u6("div", { className: "relative", children: [
      /* @__PURE__ */ u6(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          className: `lucide lucide-bell ${className}`,
          children: [
            /* @__PURE__ */ u6("path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }),
            /* @__PURE__ */ u6("path", { d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" })
          ]
        }
      ),
      events.length > 0 && totalSevere > 0 && ReactScanInternals.options.value.showNotificationCount && /* @__PURE__ */ u6(
        "div",
        {
          className: cn2([
            "absolute",
            hasHighSeverity ? "-top-2.5 -right-2.5" : "-top-1 -right-1",
            "rounded-full",
            "flex items-center justify-center",
            "text-[8px] font-medium text-white",
            "aspect-square",
            hasHighSeverity ? "bg-red-500/90" : "bg-purple-500/90"
          ]),
          style: {
            width: `${badgeSize}px`,
            height: `${badgeSize}px`,
            padding: hasHighSeverity ? "0.5px" : "0"
          },
          children: hasHighSeverity && displayCount
        }
      )
    ] });
  };
  var CloseIcon = ({
    className = "",
    size = 24
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className,
      children: [
        /* @__PURE__ */ u6("path", { d: "M18 6 6 18" }),
        /* @__PURE__ */ u6("path", { d: "m6 6 12 12" })
      ]
    }
  );
  var VolumeOnIcon = ({
    className = "",
    size = 24
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className,
      children: [
        /* @__PURE__ */ u6("path", { d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" }),
        /* @__PURE__ */ u6("path", { d: "M16 9a5 5 0 0 1 0 6" }),
        /* @__PURE__ */ u6("path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728" })
      ]
    }
  );
  var VolumeOffIcon = ({
    className = "",
    size = 24
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className,
      children: [
        /* @__PURE__ */ u6("path", { d: "M16 9a5 5 0 0 1 .95 2.293" }),
        /* @__PURE__ */ u6("path", { d: "M19.364 5.636a9 9 0 0 1 1.889 9.96" }),
        /* @__PURE__ */ u6("path", { d: "m2 2 20 20" }),
        /* @__PURE__ */ u6("path", { d: "m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11" }),
        /* @__PURE__ */ u6("path", { d: "M9.828 4.172A.686.686 0 0 1 11 4.657v.686" })
      ]
    }
  );
  var ArrowLeft = ({
    size = 24,
    className
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className: cn2(["lucide lucide-arrow-left", className]),
      children: [
        /* @__PURE__ */ u6("path", { d: "m12 19-7-7 7-7" }),
        /* @__PURE__ */ u6("path", { d: "M19 12H5" })
      ]
    }
  );
  var PointerIcon = ({
    className = "",
    size = 24
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className,
      children: [
        /* @__PURE__ */ u6("path", { d: "M14 4.1 12 6" }),
        /* @__PURE__ */ u6("path", { d: "m5.1 8-2.9-.8" }),
        /* @__PURE__ */ u6("path", { d: "m6 12-1.9 2" }),
        /* @__PURE__ */ u6("path", { d: "M7.2 2.2 8 5.1" }),
        /* @__PURE__ */ u6("path", { d: "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" })
      ]
    }
  );
  var KeyboardIcon = ({
    className = "",
    size = 24
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      className,
      children: [
        /* @__PURE__ */ u6("path", { d: "M10 8h.01" }),
        /* @__PURE__ */ u6("path", { d: "M12 12h.01" }),
        /* @__PURE__ */ u6("path", { d: "M14 8h.01" }),
        /* @__PURE__ */ u6("path", { d: "M16 12h.01" }),
        /* @__PURE__ */ u6("path", { d: "M18 8h.01" }),
        /* @__PURE__ */ u6("path", { d: "M6 8h.01" }),
        /* @__PURE__ */ u6("path", { d: "M7 16h10" }),
        /* @__PURE__ */ u6("path", { d: "M8 12h.01" }),
        /* @__PURE__ */ u6("rect", { width: "20", height: "16", x: "2", y: "4", rx: "2" })
      ]
    }
  );
  var ClearIcon = ({
    className = "",
    size = 24
  }) => {
    return /* @__PURE__ */ u6(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        className,
        style: { transform: "rotate(180deg)" },
        children: [
          /* @__PURE__ */ u6("circle", { cx: "12", cy: "12", r: "10" }),
          /* @__PURE__ */ u6("path", { d: "m4.9 4.9 14.2 14.2" })
        ]
      }
    );
  };
  var TrendingDownIcon = ({
    className = "",
    size = 24
  }) => /* @__PURE__ */ u6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ u6("polyline", { points: "22 17 13.5 8.5 8.5 13.5 2 7" }),
        /* @__PURE__ */ u6("polyline", { points: "16 17 22 17 22 11" })
      ]
    }
  );

  // src/web/views/notifications/popover.tsx
  var Popover = ({
    children,
    triggerContent,
    wrapperProps
  }) => {
    const [popoverState, setPopoverState] = d4("closed");
    const [elBoundingRect, setElBoundingRect] = d4(null);
    const [viewportSize, setViewportSize] = d4({
      width: window.innerWidth,
      height: window.innerHeight
    });
    const triggerRef = A3(null);
    const popoverRef = A3(null);
    const portalEl = x3(ToolbarElementContext);
    const isHoveredRef = A3(false);
    y3(() => {
      const handleResize = () => {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
        updateRect();
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    const updateRect = () => {
      if (triggerRef.current && portalEl) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const portalRect = portalEl.getBoundingClientRect();
        const centerX = triggerRect.left + triggerRect.width / 2;
        const centerY = triggerRect.top;
        const rect = new DOMRect(
          centerX - portalRect.left,
          centerY - portalRect.top,
          triggerRect.width,
          triggerRect.height
        );
        setElBoundingRect(rect);
      }
    };
    y3(() => {
      updateRect();
    }, [triggerRef.current]);
    y3(() => {
      if (popoverState === "opening") {
        const timer = setTimeout(() => setPopoverState("open"), 120);
        return () => clearTimeout(timer);
      } else if (popoverState === "closing") {
        const timer = setTimeout(() => setPopoverState("closed"), 120);
        return () => clearTimeout(timer);
      }
    }, [popoverState]);
    y3(() => {
      const interval = setInterval(() => {
        if (!isHoveredRef.current && popoverState !== "closed") {
          setPopoverState("closing");
        }
      }, 1e3);
      return () => clearInterval(interval);
    }, [popoverState]);
    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      updateRect();
      setPopoverState("opening");
    };
    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      updateRect();
      setPopoverState("closing");
    };
    const getPopoverPosition = () => {
      if (!elBoundingRect || !portalEl) return { top: 0, left: 0 };
      const portalRect = portalEl.getBoundingClientRect();
      const popoverWidth = 175;
      const popoverHeight = popoverRef.current?.offsetHeight || 40;
      const safeArea = 5;
      const viewportX = elBoundingRect.x + portalRect.left;
      const viewportY = elBoundingRect.y + portalRect.top;
      let left = viewportX;
      let top = viewportY - 4;
      if (left - popoverWidth / 2 < safeArea) {
        left = safeArea + popoverWidth / 2;
      } else if (left + popoverWidth / 2 > viewportSize.width - safeArea) {
        left = viewportSize.width - safeArea - popoverWidth / 2;
      }
      if (top - popoverHeight < safeArea) {
        top = viewportY + elBoundingRect.height + 4;
      }
      return {
        top: top - portalRect.top,
        left: left - portalRect.left
      };
    };
    const popoverPosition = getPopoverPosition();
    return /* @__PURE__ */ u6(k2, { children: [
      portalEl && elBoundingRect && popoverState !== "closed" && $3(
        /* @__PURE__ */ u6(
          "div",
          {
            ref: popoverRef,
            className: cn2([
              "absolute z-100 bg-white text-black rounded-lg px-3 py-2 shadow-lg",
              "transition-[opacity] duration-120 ease-out",
              'after:content-[""] after:absolute after:top-[100%]',
              "after:left-1/2 after:-translate-x-1/2",
              "after:w-[10px] after:h-[6px]",
              "after:border-l-[5px] after:border-l-transparent",
              "after:border-r-[5px] after:border-r-transparent",
              "after:border-t-[6px] after:border-t-white",
              "pointer-events-none",
              popoverState === "opening" || popoverState === "closing" ? "opacity-0" : "opacity-100"
            ]),
            style: {
              top: popoverPosition.top + "px",
              left: popoverPosition.left + "px",
              transform: `translate(-50%, calc(-100% - 4px)) scale(${popoverState === "open" ? 1 : 0.97})`,
              minWidth: "175px",
              willChange: "opacity, transform"
            },
            children
          }
        ),
        portalEl
      ),
      /* @__PURE__ */ u6(
        "div",
        {
          ref: triggerRef,
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
          ...wrapperProps,
          children: triggerContent
        }
      )
    ] });
  };

  // src/web/views/notifications/notification-tabs.tsx
  var NotificationTabs = ({
    selectedEvent: _6
  }) => {
    const { notificationState, setNotificationState, setRoute } = useNotificationsContext();
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2([
          "flex w-full justify-between items-center px-3 py-2 text-xs"
        ]),
        children: [
          /* @__PURE__ */ u6(
            "div",
            {
              className: cn2([
                "bg-[#18181B] flex items-center gap-x-1 p-1 rounded-sm"
              ]),
              children: [
                /* @__PURE__ */ u6(
                  "button",
                  {
                    onClick: () => {
                      setRoute({
                        route: "render-visualization",
                        routeMessage: null
                      });
                    },
                    className: cn2([
                      "w-1/2 flex items-center justify-center whitespace-nowrap py-[5px] px-1 gap-x-1",
                      notificationState.route === "render-visualization" || notificationState.route === "render-explanation" ? "text-white bg-[#7521c8] rounded-sm" : "text-[#6E6E77] bg-[#18181B] rounded-sm"
                    ]),
                    children: "Ranked"
                  }
                ),
                /* @__PURE__ */ u6(
                  "button",
                  {
                    onClick: () => {
                      setRoute({
                        route: "other-visualization",
                        routeMessage: null
                      });
                    },
                    className: cn2([
                      "w-1/2 flex items-center justify-center whitespace-nowrap py-[5px] px-1 gap-x-1",
                      notificationState.route === "other-visualization" ? "text-white bg-[#7521c8] rounded-sm" : "text-[#6E6E77] bg-[#18181B] rounded-sm"
                    ]),
                    children: "Overview"
                  }
                ),
                /* @__PURE__ */ u6(
                  "button",
                  {
                    onClick: () => {
                      setRoute({
                        route: "optimize",
                        routeMessage: null
                      });
                    },
                    className: cn2([
                      "w-1/2 flex items-center justify-center whitespace-nowrap py-[5px] px-1 gap-x-1",
                      notificationState.route === "optimize" ? "text-white bg-[#7521c8] rounded-sm" : "text-[#6E6E77] bg-[#18181B] rounded-sm"
                    ]),
                    children: /* @__PURE__ */ u6("span", { children: "Prompts" })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ u6(
            Popover,
            {
              triggerContent: /* @__PURE__ */ u6(
                "button",
                {
                  onClick: () => {
                    setNotificationState((prev) => {
                      if (prev.audioNotificationsOptions.enabled && prev.audioNotificationsOptions.audioContext.state !== "closed") {
                        prev.audioNotificationsOptions.audioContext.close();
                      }
                      const prevEnabledState = prev.audioNotificationsOptions.enabled;
                      localStorage.setItem(
                        "react-scan-notifications-audio",
                        String(!prevEnabledState)
                      );
                      const audioContext = new AudioContext();
                      if (!prev.audioNotificationsOptions.enabled) {
                        playNotificationSound(audioContext);
                      }
                      if (prevEnabledState) {
                        audioContext.close();
                      }
                      return {
                        ...prev,
                        audioNotificationsOptions: prevEnabledState ? {
                          audioContext: null,
                          enabled: false
                        } : {
                          audioContext,
                          enabled: true
                        }
                      };
                    });
                  },
                  className: "ml-auto",
                  children: /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex gap-x-2 justify-center items-center text-[#6E6E77]"
                      ]),
                      children: [
                        /* @__PURE__ */ u6("span", { children: "Alerts" }),
                        notificationState.audioNotificationsOptions.enabled ? /* @__PURE__ */ u6(VolumeOnIcon, { size: 16, className: "text-[#6E6E77]" }) : /* @__PURE__ */ u6(VolumeOffIcon, { size: 16, className: "text-[#6E6E77]" })
                      ]
                    }
                  )
                }
              ),
              children: /* @__PURE__ */ u6(k2, { children: "Play a chime when a slowdown is recorded" })
            }
          )
        ]
      }
    );
  };

  // src/web/views/notifications/optimize.tsx
  var formatReactData = (groupedFiberRenders) => {
    let text = "";
    const filteredFibers = groupedFiberRenders.toSorted((a6, b4) => b4.totalTime - a6.totalTime).slice(0, 30).filter((fiber) => fiber.totalTime > 5);
    filteredFibers.forEach((fiberRender) => {
      let localText = "";
      localText += "Component Name:";
      localText += fiberRender.name;
      localText += "\n";
      localText += `Rendered: ${fiberRender.count} times
`;
      localText += `Sum of self times for ${fiberRender.name} is ${fiberRender.totalTime.toFixed(0)}ms
`;
      if (fiberRender.changes.props.length > 0) {
        localText += `Changed props for all ${fiberRender.name} instances ("name:count" pairs)
`;
        fiberRender.changes.props.forEach((change) => {
          localText += `${change.name}:${change.count}x
`;
        });
      }
      if (fiberRender.changes.state.length > 0) {
        localText += `Changed state for all ${fiberRender.name} instances ("hook index:count" pairs)
`;
        fiberRender.changes.state.forEach((change) => {
          localText += `${change.index}:${change.count}x
`;
        });
      }
      if (fiberRender.changes.context.length > 0) {
        localText += `Changed context for all ${fiberRender.name} instances ("context display name (if exists):count" pairs)
`;
        fiberRender.changes.context.forEach((change) => {
          localText += `${change.name}:${change.count}x
`;
        });
      }
      text += localText;
      text += "\n";
    });
    return text;
  };
  var generateInteractionDataPrompt = ({
    renderTime,
    eHandlerTimeExcludingRenders,
    toRafTime,
    commitTime,
    framePresentTime,
    formattedReactData
  }) => {
    return `I will provide you with a set of high level, and low level performance data about an interaction in a React App:
### High level
- react component render time: ${renderTime.toFixed(0)}ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): ${eHandlerTimeExcludingRenders.toFixed(0)}ms
- how long it took from the last event handler time, to the last request animation frame: ${toRafTime.toFixed(0)}ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: ${commitTime.toFixed(0)}ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
${framePresentTime === null ? "" : `- how long it took from dom commit for the frame to be presented: ${framePresentTime.toFixed(0)}ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time`}

### Low level
We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.
${formattedReactData}`;
  };
  var generateInteractionOptimizationPrompt = ({
    interactionType,
    name,
    componentPath,
    time,
    renderTime,
    eHandlerTimeExcludingRenders,
    toRafTime,
    commitTime,
    framePresentTime,
    formattedReactData
  }) => `You will attempt to implement a performance improvement to a user interaction in a React app. You will be provided with data about the interaction, and the slow down.

Your should split your goals into 2 parts:
- identifying the problem
- fixing the problem
	- it is okay to implement a fix even if you aren't 100% sure the fix solves the performance problem. When you aren't sure, you should tell the user to try repeating the interaction, and feeding the "Formatted Data" in the React Scan notifications optimize tab. This allows you to start a debugging flow with the user, where you attempt a fix, and observe the result. The user may make a mistake when they pass you the formatted data, so must make sure, given the data passed to you, that the associated data ties to the same interaction you were trying to debug.


Make sure to check if the user has the react compiler enabled (project dependent, configured through build tool), so you don't unnecessarily memoize components. If it is, you do not need to worry about memoizing user components

One challenge you may face is the performance problem lies in a node_module, not in user code. If you are confident the problem originates because of a node_module, there are multiple strategies, which are context dependent:
- you can try to work around the problem, knowing which module is slow
- you can determine if its possible to resolve the problem in the node_module by modifying non node_module code
- you can monkey patch the node_module to experiment and see if it's really the problem (you can modify a functions properties to hijack the call for example)
- you can determine if it's feasible to replace whatever node_module is causing the problem with a performant option (this is an extreme)

The interaction was a ${interactionType} on the component named ${name}. This component has the following ancestors ${componentPath}. This is the path from the component, to the root. This should be enough information to figure out where this component is in the user's code base

This path is the component that was clicked, so it should tell you roughly where component had an event handler that triggered a state change.

Please note that the leaf node of this path might not be user code (if they use a UI library), and they may contain many wrapper components that just pass through children that aren't relevant to the actual click. So make you sure analyze the path and understand what the user code is doing

We have a set of high level, and low level data about the performance issue.

The click took ${time.toFixed(0)}ms from interaction start, to when a new frame was presented to a user.

We also provide you with a breakdown of what the browser spent time on during the period of interaction start to frame presentation.

- react component render time: ${renderTime.toFixed(0)}ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): ${eHandlerTimeExcludingRenders.toFixed(0)}ms
- how long it took from the last event handler time, to the last request animation frame: ${toRafTime.toFixed(0)}ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: ${commitTime.toFixed(0)}ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
${framePresentTime === null ? "" : `- how long it took from dom commit for the frame to be presented: ${framePresentTime.toFixed(0)}ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time`}


We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.

${formattedReactData}

You may notice components have many renders, but much fewer props/state/context changes. This normally implies most of the components could of been memoized to avoid computation

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So the flow should be:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders. 

An important thing to note is that if you see a lot of react renders (some components with very high render counts), but javascript excluding renders is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run during the JS event handler period.

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one. And it may also be the case the comparison of the hooks dependency can be expensive, and that would not be tracked in render time.

If a node_module is the component with high renders, you can experiment to see if that component is the root issue (because of hooks). You should use the same instructions for node_module debugging mentioned previously.

`;
  var generateFrameDropOptimizationPrompt = ({
    renderTime,
    otherTime,
    formattedReactData
  }) => `You will attempt to implement a performance improvement to a large slowdown in a react app

Your should split your goals into 2 parts:
- identifying the problem
- fixing the problem
	- it is okay to implement a fix even if you aren't 100% sure the fix solves the performance problem. When you aren't sure, you should tell the user to try repeating the interaction, and feeding the "Formatted Data" in the React Scan notifications optimize tab. This allows you to start a debugging flow with the user, where you attempt a fix, and observe the result. The user may make a mistake when they pass you the formatted data, so must make sure, given the data passed to you, that the associated data ties to the same interaction you were trying to debug.

Make sure to check if the user has the react compiler enabled (project dependent, configured through build tool), so you don't unnecessarily memoize components. If it is, you do not need to worry about memoizing user components

One challenge you may face is the performance problem lies in a node_module, not in user code. If you are confident the problem originates because of a node_module, there are multiple strategies, which are context dependent:
- you can try to work around the problem, knowing which module is slow
- you can determine if its possible to resolve the problem in the node_module by modifying non node_module code
- you can monkey patch the node_module to experiment and see if it's really the problem (you can modify a functions properties to hijack the call for example)
- you can determine if it's feasible to replace whatever node_module is causing the problem with a performant option (this is an extreme)


We have the high level time of how much react spent rendering, and what else the browser spent time on during this slowdown

- react component render time: ${renderTime.toFixed(0)}ms
- other time: ${otherTime}ms


We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.

${formattedReactData}

You may notice components have many renders, but much fewer props/state/context changes. This normally implies most of the components could of been memoized to avoid computation

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So the flow should be:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders. 

An important thing to note is that if you see a lot of react renders (some components with very high render counts), but other time is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run outside of what we profile (just react render time).

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one. And it may also be the case the comparison of the hooks dependency can be expensive, and that would not be tracked in render time.

If a node_module is the component with high renders, you can experiment to see if that component is the root issue (because of hooks). You should use the same instructions for node_module debugging mentioned previously.

If renders don't seem to be the problem, see if there are any expensive CSS properties being added/mutated, or any expensive DOM Element mutations/new elements being created that could cause this slowdown. 
`;
  var generateFrameDropExplanationPrompt = ({
    renderTime,
    otherTime,
    formattedReactData
  }) => `Your goal will be to help me find the source of a performance problem in a React App. I collected a large dataset about this specific performance problem.

We have the high level time of how much react spent rendering, and what else the browser spent time on during this slowdown

- react component render time: ${renderTime.toFixed(0)}ms
- other time (other JavaScript, hooks like useEffect, style recalculations, layerization, paint & commit and everything else the browser might do to draw a new frame after javascript mutates the DOM): ${otherTime}ms


We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.

${formattedReactData}

You may notice components have many renders, but much fewer props/state/context changes. This normally implies most of the components could of been memoized to avoid computation

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So a flow we can go through is:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders. 


An important thing to note is that if you see a lot of react renders (some components with very high render counts), but other time is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run outside of what we profile (just react render time).

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one, and this can add significant overhead when thousands of effects ran.

If it's not possible to explain the root problem from this data, please ask me for more data explicitly, and what we would need to know to find the source of the performance problem.
`;
  var generateFrameDropDataPrompt = ({
    renderTime,
    otherTime,
    formattedReactData
  }) => `I will provide you with a set of high level, and low level performance data about a large frame drop in a React App:
### High level
- react component render time: ${renderTime.toFixed(0)}ms
- how long it took to run everything else (other JavaScript, hooks like useEffect, style recalculations, layerization, paint & commit and everything else the browser might do to draw a new frame after javascript mutates the DOM): ${otherTime}ms

### Low level
We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.
${formattedReactData}`;
  var generateInteractionExplanationPrompt = ({
    interactionType,
    name,
    time,
    renderTime,
    eHandlerTimeExcludingRenders,
    toRafTime,
    commitTime,
    framePresentTime,
    formattedReactData
  }) => `Your goal will be to help me find the source of a performance problem. I collected a large dataset about this specific performance problem.

There was a ${interactionType} on a component named ${name}. This means, roughly, the component that handled the ${interactionType} event was named ${name}.

We have a set of high level, and low level data about the performance issue.

The click took ${time.toFixed(0)}ms from interaction start, to when a new frame was presented to a user.

We also provide you with a breakdown of what the browser spent time on during the period of interaction start to frame presentation.

- react component render time: ${renderTime.toFixed(0)}ms
- how long it took to run javascript event handlers (EXCLUDING REACT RENDERS): ${eHandlerTimeExcludingRenders.toFixed(0)}ms
- how long it took from the last event handler time, to the last request animation frame: ${toRafTime.toFixed(0)}ms
	- things like prepaint, style recalculations, layerization, async web API's like observers may occur during this time
- how long it took from the last request animation frame to when the dom was committed: ${commitTime.toFixed(0)}ms
	- during this period you will see paint, commit, potential style recalcs, and other misc browser activity. Frequently high times here imply css that makes the browser do a lot of work, or mutating expensive dom properties during the event handler stage. This can be many things, but it narrows the problem scope significantly when this is high
${framePresentTime === null ? "" : `- how long it took from dom commit for the frame to be presented: ${framePresentTime.toFixed(0)}ms. This is when information about how to paint the next frame is sent to the compositor threads, and when the GPU does work. If this is high, look for issues that may be a bottleneck for operations occurring during this time`}

We also have lower level information about react components, such as their render time, and which props/state/context changed when they re-rendered.

${formattedReactData}


You may notice components have many renders, but much fewer props/state/context changes. This normally implies most of the components could of been memoized to avoid computation

It's also important to remember if a component had no props/state/context change, and it was memoized, it would not render. So a flow we can go through is:
- find the most expensive components
- see what's causing them to render
- determine how you can make those state/props/context not change for a large set of the renders
- once there are no more changes left, you can memoize the component so it no longer unnecessarily re-renders. 


An important thing to note is that if you see a lot of react renders (some components with very high render counts), but javascript excluding renders is much higher than render time, it is possible that the components with lots of renders run hooks like useEffect/useLayoutEffect, which run during the JS event handler period.

It's also good to note that react profiles hook times in development, and if many hooks are called (lets say 5,000 components all called a useEffect), it will have to profile every single one. And it may also be the case the comparison of the hooks dependency can be expensive, and that would not be tracked in render time.

If it's not possible to explain the root problem from this data, please ask me for more data explicitly, and what we would need to know to find the source of the performance problem.
`;
  var getLLMPrompt = (activeTab, selectedEvent) => iife(() => {
    switch (activeTab) {
      case "data": {
        switch (selectedEvent.kind) {
          case "dropped-frames": {
            return generateFrameDropDataPrompt({
              formattedReactData: formatReactData(
                selectedEvent.groupedFiberRenders
              ),
              renderTime: selectedEvent.groupedFiberRenders.reduce(
                (prev, curr) => prev + curr.totalTime,
                0
              ),
              otherTime: selectedEvent.timing.otherTime
            });
          }
          case "interaction": {
            return generateInteractionDataPrompt({
              commitTime: selectedEvent.timing.frameConstruction,
              eHandlerTimeExcludingRenders: selectedEvent.timing.otherJSTime,
              formattedReactData: formatReactData(
                selectedEvent.groupedFiberRenders
              ),
              framePresentTime: selectedEvent.timing.frameDraw,
              renderTime: selectedEvent.groupedFiberRenders.reduce(
                (prev, curr) => prev + curr.totalTime,
                0
              ),
              toRafTime: selectedEvent.timing.framePreparation
            });
          }
        }
      }
      case "explanation": {
        switch (selectedEvent.kind) {
          case "dropped-frames": {
            return generateFrameDropExplanationPrompt({
              formattedReactData: formatReactData(
                selectedEvent.groupedFiberRenders
              ),
              renderTime: selectedEvent.groupedFiberRenders.reduce(
                (prev, curr) => prev + curr.totalTime,
                0
              ),
              otherTime: selectedEvent.timing.otherTime
            });
          }
          case "interaction": {
            return generateInteractionExplanationPrompt({
              commitTime: selectedEvent.timing.frameConstruction,
              eHandlerTimeExcludingRenders: selectedEvent.timing.otherJSTime,
              formattedReactData: formatReactData(
                selectedEvent.groupedFiberRenders
              ),
              framePresentTime: selectedEvent.timing.frameDraw,
              interactionType: selectedEvent.type,
              name: getComponentName(selectedEvent.componentPath),
              renderTime: selectedEvent.groupedFiberRenders.reduce(
                (prev, curr) => prev + curr.totalTime,
                0
              ),
              time: getTotalTime(selectedEvent.timing),
              toRafTime: selectedEvent.timing.framePreparation
            });
          }
        }
      }
      case "fix": {
        switch (selectedEvent.kind) {
          case "dropped-frames": {
            return generateFrameDropOptimizationPrompt({
              formattedReactData: formatReactData(
                selectedEvent.groupedFiberRenders
              ),
              renderTime: selectedEvent.groupedFiberRenders.reduce(
                (prev, curr) => prev + curr.totalTime,
                0
              ),
              otherTime: selectedEvent.timing.otherTime
            });
          }
          case "interaction": {
            return generateInteractionOptimizationPrompt({
              commitTime: selectedEvent.timing.frameConstruction,
              componentPath: selectedEvent.componentPath.join(">"),
              eHandlerTimeExcludingRenders: selectedEvent.timing.otherJSTime,
              formattedReactData: formatReactData(
                selectedEvent.groupedFiberRenders
              ),
              framePresentTime: selectedEvent.timing.frameDraw,
              interactionType: selectedEvent.type,
              name: getComponentName(selectedEvent.componentPath),
              renderTime: selectedEvent.groupedFiberRenders.reduce(
                (prev, curr) => prev + curr.totalTime,
                0
              ),
              time: getTotalTime(selectedEvent.timing),
              toRafTime: selectedEvent.timing.framePreparation
            });
          }
        }
      }
    }
  });
  var Optimize = ({
    selectedEvent
  }) => {
    const [activeTab, setActiveTab] = d4(
      "fix"
    );
    const [copying, setCopying] = d4(false);
    return /* @__PURE__ */ u6("div", { className: cn2(["w-full h-full"]), children: [
      /* @__PURE__ */ u6(
        "div",
        {
          className: cn2([
            "border border-[#27272A] rounded-sm h-4/5 text-xs overflow-hidden"
          ]),
          children: [
            /* @__PURE__ */ u6("div", { className: cn2(["bg-[#18181B] p-1 rounded-t-sm"]), children: /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-1"]), children: [
              /* @__PURE__ */ u6(
                "button",
                {
                  onClick: () => setActiveTab("fix"),
                  className: cn2([
                    "flex items-center justify-center whitespace-nowrap py-1.5 px-3 rounded-sm",
                    activeTab === "fix" ? "text-white bg-[#7521c8]" : "text-[#6E6E77] hover:text-white"
                  ]),
                  children: "Fix"
                }
              ),
              /* @__PURE__ */ u6(
                "button",
                {
                  onClick: () => setActiveTab("explanation"),
                  className: cn2([
                    "flex items-center justify-center whitespace-nowrap py-1.5 px-3 rounded-sm",
                    activeTab === "explanation" ? "text-white bg-[#7521c8]" : "text-[#6E6E77] hover:text-white"
                  ]),
                  children: "Explanation"
                }
              ),
              /* @__PURE__ */ u6(
                "button",
                {
                  onClick: () => setActiveTab("data"),
                  className: cn2([
                    "flex items-center justify-center whitespace-nowrap py-1.5 px-3 rounded-sm",
                    activeTab === "data" ? "text-white bg-[#7521c8]" : "text-[#6E6E77] hover:text-white"
                  ]),
                  children: "Data"
                }
              )
            ] }) }),
            /* @__PURE__ */ u6("div", { className: cn2(["overflow-y-auto h-full"]), children: /* @__PURE__ */ u6(
              "pre",
              {
                className: cn2([
                  "p-2 h-full",
                  "whitespace-pre-wrap break-words",
                  "text-gray-300 font-mono "
                ]),
                children: getLLMPrompt(activeTab, selectedEvent)
              }
            ) })
          ]
        }
      ),
      /* @__PURE__ */ u6(
        "button",
        {
          onClick: async () => {
            const text = getLLMPrompt(activeTab, selectedEvent);
            await navigator.clipboard.writeText(text);
            setCopying(true);
            setTimeout(() => setCopying(false), 1e3);
          },
          className: cn2([
            "mt-4 px-4 py-2 bg-[#18181B] text-[#6E6E77] rounded-sm",
            "hover:text-white transition-colors duration-200",
            "flex items-center justify-center gap-x-2 text-xs"
          ]),
          children: [
            /* @__PURE__ */ u6("span", { children: copying ? "Copied!" : "Copy Prompt" }),
            /* @__PURE__ */ u6(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                width: "16",
                height: "16",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                className: cn2([
                  "transition-transform duration-200",
                  copying && "scale-110"
                ]),
                children: copying ? /* @__PURE__ */ u6("path", { d: "M20 6L9 17l-5-5" }) : /* @__PURE__ */ u6(k2, { children: [
                  /* @__PURE__ */ u6("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }),
                  /* @__PURE__ */ u6("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" })
                ] })
              }
            )
          ]
        }
      )
    ] });
  };

  // src/web/views/notifications/other-visualization.tsx
  var getTimeData = (selectedEvent, isProduction2) => {
    switch (selectedEvent.kind) {
      // todo: push instead of conditional spread
      case "dropped-frames": {
        const timeData = [
          ...isProduction2 ? [
            {
              name: "Total Processing Time",
              time: getTotalTime(selectedEvent.timing),
              color: "bg-red-500",
              kind: "total-processing-time"
            }
          ] : [
            {
              name: "Renders",
              time: selectedEvent.timing.renderTime,
              color: "bg-purple-500",
              kind: "render"
            },
            {
              name: "JavaScript, DOM updates, Draw Frame",
              time: selectedEvent.timing.otherTime,
              color: "bg-[#4b4b4b]",
              kind: "other-frame-drop"
            }
          ]
        ];
        return timeData;
      }
      case "interaction": {
        const timeData = [
          ...!isProduction2 ? [
            {
              name: "Renders",
              time: selectedEvent.timing.renderTime,
              color: "bg-purple-500",
              kind: "render"
            }
          ] : [],
          {
            name: isProduction2 ? "React Renders, Hooks, Other JavaScript" : "JavaScript/React Hooks ",
            time: selectedEvent.timing.otherJSTime,
            color: "bg-[#EFD81A]",
            kind: "other-javascript"
          },
          {
            name: "Update DOM and Draw New Frame",
            time: getTotalTime(selectedEvent.timing) - selectedEvent.timing.renderTime - selectedEvent.timing.otherJSTime,
            color: "bg-[#1D3A66]",
            kind: "other-not-javascript"
          }
        ];
        return timeData;
      }
    }
  };
  var OtherVisualization = ({
    selectedEvent
  }) => {
    const [isProduction2] = d4(getIsProduction() ?? false);
    const { notificationState } = useNotificationsContext();
    const [expandedItems, setExpandedItems] = d4(
      notificationState.routeMessage?.name ? [notificationState.routeMessage.name] : []
    );
    const timeData = getTimeData(selectedEvent, isProduction2);
    const root = x3(ToolbarElementContext);
    y3(() => {
      if (notificationState.routeMessage?.name) {
        const container = root?.querySelector("#overview-scroll-container");
        const element = root?.querySelector(
          `#react-scan-overview-bar-${notificationState.routeMessage.name}`
        );
        if (container && element) {
          const elementTop = element.getBoundingClientRect().top;
          const containerTop = container.getBoundingClientRect().top;
          const scrollOffset = elementTop - containerTop;
          container.scrollTop = container.scrollTop + scrollOffset;
        }
      }
    }, [notificationState.route]);
    y3(() => {
      if (notificationState.route === "other-visualization") {
        setExpandedItems(
          (prev) => notificationState.routeMessage?.name ? [notificationState.routeMessage.name] : prev
        );
      }
    }, [notificationState.route]);
    const totalTime = timeData.reduce((acc, item) => acc + item.time, 0);
    return /* @__PURE__ */ u6("div", { className: "rounded-sm border border-zinc-800 text-xs", children: [
      /* @__PURE__ */ u6("div", { className: "p-2 border-b border-zinc-800 bg-zinc-900/50", children: /* @__PURE__ */ u6("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ u6("h3", { className: "text-xs font-medium", children: "What was time spent on?" }),
        /* @__PURE__ */ u6("span", { className: "text-xs text-zinc-400", children: [
          "Total: ",
          totalTime.toFixed(0),
          "ms"
        ] })
      ] }) }),
      /* @__PURE__ */ u6("div", { className: "divide-y divide-zinc-800", children: timeData.map((entry) => {
        const isExpanded = expandedItems.includes(entry.kind);
        return /* @__PURE__ */ u6("div", { id: `react-scan-overview-bar-${entry.kind}`, children: [
          /* @__PURE__ */ u6(
            "button",
            {
              onClick: () => setExpandedItems(
                (prev) => prev.includes(entry.kind) ? prev.filter((item) => item !== entry.kind) : [...prev, entry.kind]
              ),
              className: "w-full px-3 py-2 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors",
              children: /* @__PURE__ */ u6("div", { className: "flex-1", children: [
                /* @__PURE__ */ u6("div", { className: "flex items-center justify-between mb-2", children: [
                  /* @__PURE__ */ u6("div", { className: "flex items-center gap-0.5", children: [
                    /* @__PURE__ */ u6(
                      "svg",
                      {
                        className: `h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`,
                        fill: "none",
                        stroke: "currentColor",
                        viewBox: "0 0 24 24",
                        children: /* @__PURE__ */ u6(
                          "path",
                          {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            strokeWidth: 2,
                            d: "M9 5l7 7-7 7"
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ u6("span", { className: "font-medium flex items-center text-left", children: entry.name })
                  ] }),
                  /* @__PURE__ */ u6("span", { className: " text-zinc-400", children: [
                    entry.time.toFixed(0),
                    "ms"
                  ] })
                ] }),
                /* @__PURE__ */ u6("div", { className: "h-1 bg-zinc-800 rounded-full overflow-hidden", children: /* @__PURE__ */ u6(
                  "div",
                  {
                    className: `h-full ${entry.color} transition-all`,
                    style: {
                      width: `${entry.time / totalTime * 100}%`
                    }
                  }
                ) })
              ] })
            }
          ),
          isExpanded && /* @__PURE__ */ u6("div", { className: "bg-zinc-900/30 border-t border-zinc-800 px-2.5 py-3", children: /* @__PURE__ */ u6("p", { className: " text-zinc-400 mb-4 text-xs", children: iife(() => {
            switch (selectedEvent.kind) {
              case "interaction": {
                switch (entry.kind) {
                  case "render": {
                    return /* @__PURE__ */ u6(
                      Explanation,
                      {
                        input: getRenderInput(selectedEvent)
                      }
                    );
                  }
                  case "other-javascript": {
                    return /* @__PURE__ */ u6(
                      Explanation,
                      {
                        input: getJSInput(selectedEvent)
                      }
                    );
                  }
                  case "other-not-javascript": {
                    return /* @__PURE__ */ u6(
                      Explanation,
                      {
                        input: getDrawInput(selectedEvent)
                      }
                    );
                  }
                }
              }
              case "dropped-frames": {
                switch (entry.kind) {
                  case "total-processing-time": {
                    return /* @__PURE__ */ u6(
                      Explanation,
                      {
                        input: {
                          kind: "total-processing",
                          data: {
                            time: getTotalTime(selectedEvent.timing)
                          }
                        }
                      }
                    );
                  }
                  case "render": {
                    return /* @__PURE__ */ u6(k2, { children: /* @__PURE__ */ u6(
                      Explanation,
                      {
                        input: {
                          kind: "render",
                          data: {
                            topByTime: selectedEvent.groupedFiberRenders.toSorted(
                              (a6, b4) => b4.totalTime - a6.totalTime
                            ).slice(0, 3).map((render) => ({
                              name: render.name,
                              percentage: render.totalTime / getTotalTime(
                                selectedEvent.timing
                              )
                            }))
                          }
                        }
                      }
                    ) });
                  }
                  case "other-frame-drop": {
                    return /* @__PURE__ */ u6(
                      Explanation,
                      {
                        input: {
                          kind: "other"
                        }
                      }
                    );
                  }
                }
              }
            }
          }) }) })
        ] }, entry.kind);
      }) })
    ] });
  };
  var getDrawInput = (event) => {
    const renderCount = event.groupedFiberRenders.reduce(
      (prev, curr) => prev + curr.count,
      0
    );
    const renderTime = event.timing.renderTime;
    const totalTime = getTotalTime(event.timing);
    const renderPercentage = renderTime / totalTime * 100;
    if (renderCount > 100) {
      return {
        kind: "high-render-count-update-dom-draw-frame",
        data: {
          count: renderCount,
          percentageOfTotal: renderPercentage,
          copyButton: /* @__PURE__ */ u6(CopyPromptButton, {})
        }
      };
    }
    return {
      kind: "update-dom-draw-frame",
      data: {
        copyButton: /* @__PURE__ */ u6(CopyPromptButton, {})
      }
    };
  };
  var CopyPromptButton = () => {
    const [copying, setCopying] = d4(false);
    const { notificationState } = useNotificationsContext();
    return /* @__PURE__ */ u6(
      "button",
      {
        onClick: async () => {
          if (!notificationState.selectedEvent) {
            return;
          }
          await navigator.clipboard.writeText(
            getLLMPrompt("explanation", notificationState.selectedEvent)
          );
          setCopying(true);
          setTimeout(() => setCopying(false), 1e3);
        },
        className: "bg-zinc-800 flex hover:bg-zinc-700 text-zinc-200 px-2 py-1 rounded gap-x-3",
        children: [
          /* @__PURE__ */ u6("span", { children: copying ? "Copied!" : "Copy Prompt" }),
          /* @__PURE__ */ u6(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              width: "16",
              height: "16",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              className: cn2([
                "transition-transform duration-200",
                copying && "scale-110"
              ]),
              children: copying ? /* @__PURE__ */ u6("path", { d: "M20 6L9 17l-5-5" }) : /* @__PURE__ */ u6(k2, { children: [
                /* @__PURE__ */ u6("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }),
                /* @__PURE__ */ u6("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" })
              ] })
            }
          )
        ]
      }
    );
  };
  var getRenderInput = (event) => {
    if (event.timing.renderTime / getTotalTime(event.timing) > 0.3) {
      return {
        kind: "render",
        data: {
          topByTime: event.groupedFiberRenders.toSorted((a6, b4) => b4.totalTime - a6.totalTime).slice(0, 3).map((e5) => ({
            percentage: e5.totalTime / getTotalTime(event.timing),
            name: e5.name
          }))
        }
      };
    }
    return {
      kind: "other"
    };
  };
  var getJSInput = (event) => {
    const renderCount = event.groupedFiberRenders.reduce(
      (prev, curr) => prev + curr.count,
      0
    );
    if (event.timing.otherJSTime / getTotalTime(event.timing) < 0.2) {
      return {
        kind: "js-explanation-base"
      };
    }
    if (event.groupedFiberRenders.find((render) => render.count > 200) || event.groupedFiberRenders.reduce((prev, curr) => prev + curr.count, 0) > 500) {
      return {
        kind: "high-render-count-high-js",
        data: {
          renderCount,
          topByCount: event.groupedFiberRenders.filter((groupedRender) => groupedRender.count > 100).toSorted((a6, b4) => b4.count - a6.count).slice(0, 3)
        }
      };
    }
    if (event.timing.otherJSTime / getTotalTime(event.timing) > 0.3) {
      if (event.timing.renderTime > 0.2) {
        return {
          kind: "js-explanation-base"
        };
      }
      return {
        kind: "low-render-count-high-js",
        data: {
          renderCount
        }
      };
    }
    return {
      kind: "js-explanation-base"
    };
  };
  var Explanation = ({ input }) => {
    switch (input.kind) {
      case "total-processing": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: [
                "This is the time it took to draw the entire frame that was presented to the user. To be at 60FPS, this number needs to be ",
                "<=16ms"
              ] }),
              /* @__PURE__ */ u6("p", { children: 'To debug the issue, check the "Ranked" tab to see if there are significant component renders' }),
              /* @__PURE__ */ u6("p", { children: "On a production React build, React Scan can't access the time it took for component to render. To get that information, run React Scan on a development build" }),
              /* @__PURE__ */ u6("p", { children: [
                "To understand precisely what caused the slowdown while in production, use the ",
                /* @__PURE__ */ u6("strong", { children: "Chrome profiler" }),
                " and analyze the function call times."
              ] }),
              /* @__PURE__ */ u6("p", {})
            ]
          }
        );
      }
      case "render": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: "This is the time it took React to run components, and internal logic to handle the output of your component." }),
              /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col"]), children: [
                /* @__PURE__ */ u6("p", { children: "The slowest components for this time period were:" }),
                input.data.topByTime.map((item) => /* @__PURE__ */ u6("div", { children: [
                  /* @__PURE__ */ u6("strong", { children: item.name }),
                  ":",
                  " ",
                  (item.percentage * 100).toFixed(0),
                  "% of total"
                ] }, item.name))
              ] }),
              /* @__PURE__ */ u6("p", { children: 'To view the render times of all your components, and what caused them to render, go to the "Ranked" tab' }),
              /* @__PURE__ */ u6("p", { children: 'The "Ranked" tab shows the render times of every component.' }),
              /* @__PURE__ */ u6("p", { children: "The render times of the same components are grouped together into one bar." }),
              /* @__PURE__ */ u6("p", { children: "Clicking the component will show you what props, state, or context caused the component to re-render." })
            ]
          }
        );
      }
      case "js-explanation-base": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: "This is the period when JavaScript hooks and other JavaScript outside of React Renders run." }),
              /* @__PURE__ */ u6("p", { children: [
                "The most common culprit for high JS time is expensive hooks, like expensive callbacks inside of ",
                /* @__PURE__ */ u6("code", { children: "useEffect" }),
                "'s or a large number of useEffect's called, but this can also be JavaScript event handlers (",
                /* @__PURE__ */ u6("code", { children: "'onclick'" }),
                ", ",
                /* @__PURE__ */ u6("code", { children: "'onchange'" }),
                ") that performed expensive computation."
              ] }),
              /* @__PURE__ */ u6("p", { children: "If you have lots of components rendering that call hooks, like useEffect, it can add significant overhead even if the callbacks are not expensive. If this is the case, you can try optimizing the renders of those components to avoid the hook from having to run." }),
              /* @__PURE__ */ u6("p", { children: [
                "You should profile your app using the",
                " ",
                /* @__PURE__ */ u6("strong", { children: "Chrome DevTools profiler" }),
                " to learn exactly which functions took the longest to execute."
              ] })
            ]
          }
        );
      }
      case "high-render-count-high-js": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: "This is the period when JavaScript hooks and other JavaScript outside of React Renders run." }),
              input.data.renderCount === 0 ? /* @__PURE__ */ u6(k2, { children: [
                /* @__PURE__ */ u6("p", { children: "There were no renders, which means nothing related to React caused this slowdown. The most likely cause of the slowdown is a slow JavaScript event handler, or code related to a Web API" }),
                /* @__PURE__ */ u6("p", { children: [
                  "You should try to reproduce the slowdown while profiling your website with the",
                  /* @__PURE__ */ u6("strong", { children: "Chrome DevTools profiler" }),
                  " to see exactly what functions took the longest to execute."
                ] })
              ] }) : /* @__PURE__ */ u6(k2, { children: [
                " ",
                /* @__PURE__ */ u6("p", { children: [
                  "There were ",
                  /* @__PURE__ */ u6("strong", { children: input.data.renderCount }),
                  " renders, which could have contributed to the high JavaScript/Hook time if they ran lots of hooks, like ",
                  /* @__PURE__ */ u6("code", { children: "useEffects" }),
                  "."
                ] }),
                /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col"]), children: [
                  /* @__PURE__ */ u6("p", { children: "You should try optimizing the renders of:" }),
                  input.data.topByCount.map((item) => /* @__PURE__ */ u6("div", { children: [
                    "- ",
                    /* @__PURE__ */ u6("strong", { children: item.name }),
                    " (rendered ",
                    item.count,
                    "x)"
                  ] }, item.name))
                ] }),
                "and then checking if the problem still exists.",
                /* @__PURE__ */ u6("p", { children: [
                  "You can also try profiling your app using the",
                  " ",
                  /* @__PURE__ */ u6("strong", { children: "Chrome DevTools profiler" }),
                  " to see exactly what functions took the longest to execute."
                ] })
              ] })
            ]
          }
        );
      }
      case "low-render-count-high-js": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: "This is the period when JavaScript hooks and other JavaScript outside of React Renders run." }),
              /* @__PURE__ */ u6("p", { children: [
                "There were only ",
                /* @__PURE__ */ u6("strong", { children: input.data.renderCount }),
                " renders detected, which means either you had very expensive hooks like",
                " ",
                /* @__PURE__ */ u6("code", { children: "useEffect" }),
                "/",
                /* @__PURE__ */ u6("code", { children: "useLayoutEffect" }),
                ", or there is other JavaScript running during this interaction that took up the majority of the time."
              ] }),
              /* @__PURE__ */ u6("p", { children: [
                "To understand precisely what caused the slowdown, use the",
                " ",
                /* @__PURE__ */ u6("strong", { children: "Chrome profiler" }),
                " and analyze the function call times."
              ] })
            ]
          }
        );
      }
      case "high-render-count-update-dom-draw-frame": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: "These are the calculations the browser is forced to do in response to the JavaScript that ran during the interaction." }),
              /* @__PURE__ */ u6("p", { children: "This can be caused by CSS updates/CSS recalculations, or new DOM elements/DOM mutations." }),
              /* @__PURE__ */ u6("p", { children: [
                "During this interaction, there were",
                " ",
                /* @__PURE__ */ u6("strong", { children: input.data.count }),
                " renders, which was",
                " ",
                /* @__PURE__ */ u6("strong", { children: [
                  input.data.percentageOfTotal.toFixed(0),
                  "%"
                ] }),
                " of the time spent processing"
              ] }),
              /* @__PURE__ */ u6("p", { children: "The work performed as a result of the renders may have forced the browser to spend a lot of time to draw the next frame." }),
              /* @__PURE__ */ u6("p", { children: 'You can try optimizing the renders to see if the performance problem still exists using the "Ranked" tab.' }),
              /* @__PURE__ */ u6("p", { children: "If you use an AI-based code editor, you can export the performance data collected as a prompt." }),
              /* @__PURE__ */ u6("p", { children: input.data.copyButton }),
              /* @__PURE__ */ u6("p", { children: "Provide this formatted data to the model and ask it to find, or fix, what could be causing this performance problem." }),
              /* @__PURE__ */ u6("p", { children: 'For a larger selection of prompts, try the "Prompts" tab' })
            ]
          }
        );
      }
      case "update-dom-draw-frame": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: "These are the calculations the browser is forced to do in response to the JavaScript that ran during the interaction." }),
              /* @__PURE__ */ u6("p", { children: "This can be caused by CSS updates/CSS recalculations, or new DOM elements/DOM mutations." }),
              /* @__PURE__ */ u6("p", { children: "If you use an AI-based code editor, you can export the performance data collected as a prompt." }),
              /* @__PURE__ */ u6("p", { children: input.data.copyButton }),
              /* @__PURE__ */ u6("p", { children: "Provide this formatted data to the model and ask it to find, or fix, what could be causing this performance problem." }),
              /* @__PURE__ */ u6("p", { children: 'For a larger selection of prompts, try the "Prompts" tab' })
            ]
          }
        );
      }
      case "other": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([
              "text-[#E4E4E7] text-[10px] leading-6 flex flex-col gap-y-2"
            ]),
            children: [
              /* @__PURE__ */ u6("p", { children: [
                "This is the time it took to run everything other than React renders. This can be hooks like ",
                /* @__PURE__ */ u6("code", { children: "useEffect" }),
                ", other JavaScript not part of React, or work the browser has to do to update the DOM and draw the next frame."
              ] }),
              /* @__PURE__ */ u6("p", { children: [
                "To get a better picture of what happened, profile your app using the",
                " ",
                /* @__PURE__ */ u6("strong", { children: "Chrome profiler" }),
                " when the performance problem arises."
              ] })
            ]
          }
        );
      }
    }
  };

  // src/core/notifications/outline-overlay.ts
  var highlightCanvas = null;
  var highlightCtx = null;
  var HighlightStore = d5({
    kind: "idle",
    current: null
  });
  var currFrame = null;
  var lastFrameTime = 0;
  var FADE_SPEED = 1.8;
  var MAX_DELTA = 0.05;
  var DEFAULT_DELTA = 1 / 60;
  var drawHighlights = () => {
    if (currFrame) {
      cancelAnimationFrame(currFrame);
    }
    currFrame = requestAnimationFrame((timestamp) => {
      if (!highlightCanvas || !highlightCtx) {
        return;
      }
      const dt = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1e3, MAX_DELTA) : DEFAULT_DELTA;
      lastFrameTime = timestamp;
      const step = FADE_SPEED * dt;
      highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
      const color = "hsl(271, 76%, 53%)";
      const state = HighlightStore.value;
      const { alpha, current } = iife(() => {
        switch (state.kind) {
          case "transition": {
            const current2 = state.current?.alpha && state.current.alpha > 0 ? state.current : state.transitionTo;
            return {
              alpha: current2 ? current2.alpha : 0,
              current: current2
            };
          }
          case "move-out": {
            return { alpha: state.current?.alpha ?? 0, current: state.current };
          }
          case "idle": {
            return { alpha: 1, current: state.current };
          }
        }
      });
      current?.rects.forEach((rect) => {
        if (!highlightCtx) {
          return;
        }
        highlightCtx.shadowColor = color;
        highlightCtx.shadowBlur = 6;
        highlightCtx.strokeStyle = color;
        highlightCtx.lineWidth = 2;
        highlightCtx.globalAlpha = alpha;
        highlightCtx.beginPath();
        highlightCtx.rect(rect.left, rect.top, rect.width, rect.height);
        highlightCtx.stroke();
        highlightCtx.shadowBlur = 0;
        highlightCtx.beginPath();
        highlightCtx.rect(rect.left, rect.top, rect.width, rect.height);
        highlightCtx.stroke();
      });
      switch (state.kind) {
        case "move-out": {
          if (state.current.alpha === 0) {
            HighlightStore.value = {
              kind: "idle",
              current: null
            };
            lastFrameTime = 0;
            return;
          }
          if (state.current.alpha <= 0.01) {
            state.current.alpha = 0;
          }
          state.current.alpha = Math.max(0, state.current.alpha - step);
          drawHighlights();
          return;
        }
        case "transition": {
          if (state.current && state.current.alpha > 0) {
            state.current.alpha = Math.max(0, state.current.alpha - step);
            drawHighlights();
            return;
          }
          if (state.transitionTo.alpha === 1) {
            HighlightStore.value = {
              kind: "idle",
              current: state.transitionTo
            };
            lastFrameTime = 0;
            return;
          }
          state.transitionTo.alpha = Math.min(state.transitionTo.alpha + step, 1);
          drawHighlights();
        }
        case "idle": {
          lastFrameTime = 0;
          return;
        }
      }
    });
  };
  var handleResizeListener = null;
  var createHighlightCanvas = (root) => {
    highlightCanvas = document.createElement("canvas");
    highlightCtx = highlightCanvas.getContext("2d", { alpha: true });
    if (!highlightCtx) return null;
    const dpr2 = window.devicePixelRatio || 1;
    const { innerWidth, innerHeight } = window;
    highlightCanvas.style.width = `${innerWidth}px`;
    highlightCanvas.style.height = `${innerHeight}px`;
    highlightCanvas.width = innerWidth * dpr2;
    highlightCanvas.height = innerHeight * dpr2;
    highlightCanvas.style.position = "fixed";
    highlightCanvas.style.left = "0";
    highlightCanvas.style.top = "0";
    highlightCanvas.style.pointerEvents = "none";
    highlightCanvas.style.zIndex = "2147483600";
    highlightCtx.scale(dpr2, dpr2);
    root.appendChild(highlightCanvas);
    if (handleResizeListener) {
      window.removeEventListener("resize", handleResizeListener);
    }
    const handleResize = () => {
      if (!highlightCanvas || !highlightCtx) return;
      const dpr3 = window.devicePixelRatio || 1;
      const { innerWidth: innerWidth2, innerHeight: innerHeight2 } = window;
      highlightCanvas.style.width = `${innerWidth2}px`;
      highlightCanvas.style.height = `${innerHeight2}px`;
      highlightCanvas.width = innerWidth2 * dpr3;
      highlightCanvas.height = innerHeight2 * dpr3;
      highlightCtx.scale(dpr3, dpr3);
      drawHighlights();
    };
    handleResizeListener = handleResize;
    window.addEventListener("resize", handleResize);
    HighlightStore.subscribe(() => {
      requestAnimationFrame(() => {
        drawHighlights();
      });
    });
    return cleanup2;
  };
  function cleanup2() {
    if (highlightCanvas?.parentNode) {
      highlightCanvas.parentNode.removeChild(highlightCanvas);
    }
    highlightCanvas = null;
    highlightCtx = null;
  }

  // src/web/views/notifications/render-bar-chart.tsx
  var fadeOutHighlights = () => {
    const curr = HighlightStore.value.current ? HighlightStore.value.current : HighlightStore.value.kind === "transition" ? HighlightStore.value.transitionTo : null;
    if (!curr) {
      return;
    }
    if (HighlightStore.value.kind === "transition") {
      HighlightStore.value = {
        kind: "move-out",
        // because we want to dynamically fade this value
        current: HighlightStore.value.current?.alpha === 0 ? (
          // we want to only start fading from transition if current is done animating out
          HighlightStore.value.transitionTo
        ) : (
          // if current doesn't exist then transition must exist
          HighlightStore.value.current ?? HighlightStore.value.transitionTo
        )
      };
      return;
    }
    HighlightStore.value = {
      kind: "move-out",
      current: {
        alpha: 0,
        ...curr
      }
    };
  };
  var RenderBarChart = ({
    selectedEvent
  }) => {
    const totalInteractionTime = getTotalTime(selectedEvent.timing);
    const nonRender = totalInteractionTime - selectedEvent.timing.renderTime;
    const [isProduction2] = d4(getIsProduction());
    const events = selectedEvent.groupedFiberRenders;
    const bars = events.map((event) => ({
      event,
      kind: "render",
      totalTime: isProduction2 ? event.count : event.totalTime
    }));
    const isShowingExtraInfo = iife(() => {
      switch (selectedEvent.kind) {
        case "dropped-frames": {
          return selectedEvent.timing.renderTime / totalInteractionTime < 0.1;
        }
        case "interaction": {
          return (selectedEvent.timing.otherJSTime + selectedEvent.timing.renderTime) / totalInteractionTime < 0.2;
        }
      }
    });
    if (selectedEvent.kind === "interaction" && !isProduction2) {
      bars.push({
        kind: "other-javascript",
        totalTime: selectedEvent.timing.otherJSTime
      });
    }
    if (isShowingExtraInfo && !isProduction2) {
      if (selectedEvent.kind === "interaction") {
        bars.push({
          kind: "other-not-javascript",
          totalTime: getTotalTime(selectedEvent.timing) - selectedEvent.timing.renderTime - selectedEvent.timing.otherJSTime
        });
      } else {
        bars.push({
          kind: "other-frame-drop",
          totalTime: nonRender
        });
      }
    }
    const debouncedMouseEnter = A3({
      lastCallAt: null,
      timer: null
    });
    const totalBarTime = bars.reduce((prev, curr) => prev + curr.totalTime, 0);
    return /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col h-full w-full gap-y-1"]), children: [
      iife(() => {
        if (isProduction2 && bars.length === 0) {
          return /* @__PURE__ */ u6("div", { className: "flex flex-col items-center justify-center h-full text-zinc-400", children: [
            /* @__PURE__ */ u6("p", { className: "text-sm w-full text-left text-white mb-1.5", children: "No data available" }),
            /* @__PURE__ */ u6("p", { className: "text-x w-full text-lefts", children: "No data was collected during this period" })
          ] });
        }
        if (bars.length === 0) {
          return /* @__PURE__ */ u6("div", { className: "flex flex-col items-center justify-center h-full text-zinc-400", children: [
            /* @__PURE__ */ u6("p", { className: "text-sm w-full text-left text-white mb-1.5", children: "No renders collected" }),
            /* @__PURE__ */ u6("p", { className: "text-x w-full text-lefts", children: "There were no renders during this period" })
          ] });
        }
      }),
      bars.toSorted((a6, b4) => b4.totalTime - a6.totalTime).map((bar) => /* @__PURE__ */ u6(
        RenderBar,
        {
          bars,
          bar,
          debouncedMouseEnter,
          totalBarTime,
          isProduction: isProduction2
        },
        bar.kind === "render" ? bar.event.id : bar.kind
      ))
    ] });
  };
  var getTransitionState = (state) => {
    if (!state.current) {
      return "fading-in";
    }
    if (state.current.alpha > 0) {
      return "fading-out";
    }
    return "fading-in";
  };
  var RenderBar = ({
    bar,
    debouncedMouseEnter,
    totalBarTime,
    isProduction: isProduction2,
    bars,
    depth = 0
  }) => {
    const { setNotificationState, setRoute } = useNotificationsContext();
    const [isExpanded, setIsExpanded] = d4(false);
    const isLeaf = bar.kind === "render" ? bar.event.parents.size === 0 : true;
    const parentBars = bars.filter(
      (otherBar) => otherBar.kind === "render" && bar.kind === "render" ? bar.event.parents.has(otherBar.event.name) && otherBar.event.name !== bar.event.name : false
    );
    const missingParentNames = bar.kind === "render" ? Array.from(bar.event.parents).filter(
      (parentName) => !bars.some(
        (b4) => b4.kind === "render" && b4.event.name === parentName
      )
    ) : [];
    const handleBarClick = () => {
      if (bar.kind === "render") {
        setNotificationState((prev) => ({
          ...prev,
          selectedFiber: bar.event
        }));
        setRoute({
          route: "render-explanation",
          routeMessage: null
        });
      } else {
        setRoute({
          route: "other-visualization",
          routeMessage: {
            kind: "auto-open-overview-accordion",
            name: bar.kind
          }
        });
      }
    };
    return /* @__PURE__ */ u6("div", { className: "w-full", children: [
      /* @__PURE__ */ u6(
        "div",
        {
          className: cn2(["w-full flex items-center relative text-xs min-w-0"]),
          children: [
            /* @__PURE__ */ u6(
              "button",
              {
                onMouseLeave: () => {
                  debouncedMouseEnter.current.timer && clearTimeout(debouncedMouseEnter.current.timer);
                  fadeOutHighlights();
                },
                onMouseEnter: async () => {
                  const highlightBars = async () => {
                    debouncedMouseEnter.current.lastCallAt = Date.now();
                    if (bar.kind !== "render") {
                      const curr = HighlightStore.value.current ? HighlightStore.value.current : HighlightStore.value.kind === "transition" ? HighlightStore.value.transitionTo : null;
                      if (!curr) {
                        HighlightStore.value = {
                          kind: "idle",
                          current: null
                        };
                        return;
                      }
                      HighlightStore.value = {
                        kind: "move-out",
                        current: {
                          alpha: 0,
                          ...curr
                        }
                      };
                      return;
                    }
                    const state = HighlightStore.value;
                    const currentState = iife(() => {
                      switch (state.kind) {
                        case "transition": {
                          return state.transitionTo;
                        }
                        case "idle":
                        case "move-out": {
                          return state.current;
                        }
                      }
                    });
                    const stateRects = [];
                    if (state.kind === "transition") {
                      const transitionState = getTransitionState(state);
                      iife(() => {
                        switch (transitionState) {
                          case "fading-in": {
                            HighlightStore.value = {
                              kind: "transition",
                              current: state.transitionTo,
                              transitionTo: {
                                rects: stateRects,
                                alpha: 0,
                                name: bar.event.name
                              }
                            };
                            return;
                          }
                          case "fading-out": {
                            HighlightStore.value = {
                              kind: "transition",
                              current: HighlightStore.value.current ? {
                                alpha: 0,
                                ...HighlightStore.value.current
                              } : null,
                              transitionTo: {
                                rects: stateRects,
                                alpha: 0,
                                name: bar.event.name
                              }
                            };
                            return;
                          }
                        }
                      });
                    } else {
                      HighlightStore.value = {
                        kind: "transition",
                        transitionTo: {
                          rects: stateRects,
                          alpha: 0,
                          name: bar.event.name
                        },
                        current: currentState ? {
                          alpha: 0,
                          ...currentState
                        } : null
                      };
                    }
                    const trueElements = bar.event.elements.filter(
                      (element) => element instanceof Element
                    );
                    for await (const entries of getBatchedRectMap(trueElements)) {
                      entries.forEach(({ boundingClientRect }) => {
                        stateRects.push(boundingClientRect);
                      });
                      drawHighlights();
                    }
                  };
                  if (debouncedMouseEnter.current.lastCallAt && Date.now() - debouncedMouseEnter.current.lastCallAt < 200) {
                    debouncedMouseEnter.current.timer && clearTimeout(debouncedMouseEnter.current.timer);
                    debouncedMouseEnter.current.timer = setTimeout(() => {
                      highlightBars();
                    }, 200);
                    return;
                  }
                  highlightBars();
                },
                onClick: handleBarClick,
                className: cn2([
                  "h-full w-[90%] flex items-center hover:bg-[#0f0f0f] rounded-l-md min-w-0 relative"
                ]),
                children: [
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      style: {
                        minWidth: "fit-content",
                        width: `${bar.totalTime / totalBarTime * 100}%`
                      },
                      className: cn2([
                        "flex items-center rounded-sm text-white text-xs h-[28px] shrink-0",
                        bar.kind === "render" && "bg-[#412162] group-hover:bg-[#5b2d89]",
                        bar.kind === "other-frame-drop" && "bg-[#44444a] group-hover:bg-[#6a6a6a]",
                        bar.kind === "other-javascript" && "bg-[#efd81a6b] group-hover:bg-[#efda1a2f]",
                        bar.kind === "other-not-javascript" && "bg-[#214379d4] group-hover:bg-[#21437982]"
                      ])
                    }
                  ),
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "absolute inset-0 flex items-center px-2",
                        "min-w-0"
                      ]),
                      children: /* @__PURE__ */ u6("div", { className: "flex items-center gap-x-2 min-w-0 w-full", children: [
                        /* @__PURE__ */ u6("span", { className: cn2(["truncate"]), children: iife(() => {
                          switch (bar.kind) {
                            case "other-frame-drop": {
                              return "JavaScript, DOM updates, Draw Frame";
                            }
                            case "other-javascript": {
                              return "JavaScript/React Hooks";
                            }
                            case "other-not-javascript": {
                              return "Update DOM and Draw New Frame";
                            }
                            case "render": {
                              return bar.event.name;
                            }
                          }
                        }) }),
                        bar.kind === "render" && isRenderMemoizable(bar.event) && /* @__PURE__ */ u6(
                          "div",
                          {
                            style: {
                              lineHeight: "10px"
                            },
                            className: cn2([
                              "px-1 py-0.5 bg-[#6a369e] flex items-center rounded-sm font-semibold text-[8px] shrink-0"
                            ]),
                            children: "Memoizable"
                          }
                        )
                      ] })
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ u6(
              "button",
              {
                onClick: () => bar.kind === "render" && !isLeaf && setIsExpanded(!isExpanded),
                className: cn2([
                  "flex items-center min-w-fit shrink-0 rounded-r-md h-[28px]",
                  !isLeaf && "hover:bg-[#0f0f0f]",
                  bar.kind === "render" && !isLeaf ? "cursor-pointer" : "cursor-default"
                ]),
                children: [
                  /* @__PURE__ */ u6("div", { className: "w-[20px] flex items-center justify-center", children: bar.kind === "render" && !isLeaf && /* @__PURE__ */ u6(
                    ChevronRight,
                    {
                      className: cn2(
                        "transition-transform",
                        isExpanded && "rotate-90"
                      ),
                      size: 16
                    }
                  ) }),
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      style: {
                        minWidth: isLeaf ? "fit-content" : isProduction2 ? "30px" : "60px"
                      },
                      className: "flex items-center justify-end gap-x-1",
                      children: [
                        bar.kind === "render" && /* @__PURE__ */ u6("span", { className: cn2(["text-[10px]"]), children: [
                          "x",
                          bar.event.count
                        ] }),
                        (bar.kind !== "render" || !isProduction2) && /* @__PURE__ */ u6("span", { className: "text-[10px] text-[#7346a0] pr-1", children: [
                          bar.totalTime < 1 ? "<1" : bar.totalTime.toFixed(0),
                          "ms"
                        ] })
                      ]
                    }
                  )
                ]
              }
            ),
            depth === 0 && /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "absolute right-0 top-1/2 transition-none -translate-y-1/2 bg-white text-black px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity mr-16",
                  "pointer-events-none"
                ]),
                children: "Click to learn more"
              }
            )
          ]
        }
      ),
      isExpanded && (parentBars.length > 0 || missingParentNames.length > 0) && /* @__PURE__ */ u6("div", { className: "pl-3 flex flex-col gap-y-1 mt-1", children: [
        parentBars.toSorted((a6, b4) => b4.totalTime - a6.totalTime).map((parentBar, i6) => /* @__PURE__ */ u6(
          RenderBar,
          {
            depth: depth + 1,
            bar: parentBar,
            debouncedMouseEnter,
            totalBarTime,
            isProduction: isProduction2,
            bars
          },
          i6
        )),
        missingParentNames.map((parentName) => /* @__PURE__ */ u6("div", { className: "w-full", children: /* @__PURE__ */ u6("div", { className: "w-full flex items-center relative text-xs", children: /* @__PURE__ */ u6("div", { className: "h-full w-full flex items-center relative", children: [
          /* @__PURE__ */ u6("div", { className: "flex items-center rounded-sm text-white text-xs h-[28px] w-full" }),
          /* @__PURE__ */ u6("div", { className: "absolute inset-0 flex items-center px-2", children: /* @__PURE__ */ u6("span", { className: "truncate whitespace-nowrap text-white/70 w-full", children: parentName }) })
        ] }) }) }, parentName))
      ] })
    ] });
  };

  // src/web/views/notifications/render-explanation.tsx
  var RenderExplanation = ({
    selectedEvent: _6,
    selectedFiber
  }) => {
    const { setRoute } = useNotificationsContext();
    const [tipisShown, setTipIsShown] = d4(true);
    const [isProduction2] = d4(getIsProduction());
    _4(() => {
      const res = localStorage.getItem("react-scan-tip-shown");
      const asBool = res === "true" ? true : res === "false" ? false : null;
      if (asBool === null) {
        setTipIsShown(true);
        localStorage.setItem("react-scan-tip-is-shown", "true");
        return;
      }
      if (!asBool) {
        setTipIsShown(false);
      }
    }, []);
    const isMemoizable = selectedFiber.changes.context.length === 0 && selectedFiber.changes.props.length === 0 && selectedFiber.changes.state.length === 0;
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2([
          "w-full min-h-fit h-full flex flex-col py-4 pt-0 rounded-sm"
        ]),
        children: [
          /* @__PURE__ */ u6("div", { className: cn2(["flex items-start gap-x-4 "]), children: [
            /* @__PURE__ */ u6(
              "button",
              {
                onClick: () => {
                  setRoute({
                    route: "render-visualization",
                    routeMessage: null
                  });
                },
                className: cn2([
                  "text-white hover:bg-[#34343b] flex gap-x-1 justify-center items-center mb-4 w-fit px-2.5 py-1.5 text-xs rounded-sm bg-[#18181B]"
                ]),
                children: [
                  /* @__PURE__ */ u6(ArrowLeft, { size: 14 }),
                  " ",
                  /* @__PURE__ */ u6("span", { children: "Overview" })
                ]
              }
            ),
            /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col gap-y-1"]), children: [
              /* @__PURE__ */ u6(
                "div",
                {
                  className: cn2(["text-sm font-bold text-white overflow-x-hidden"]),
                  children: /* @__PURE__ */ u6("div", { className: "flex items-center gap-x-2 truncate", children: selectedFiber.name })
                }
              ),
              /* @__PURE__ */ u6("div", { className: cn2(["flex gap-x-2"]), children: [
                !isProduction2 && /* @__PURE__ */ u6(k2, { children: /* @__PURE__ */ u6("div", { className: cn2(["text-xs text-gray-400"]), children: [
                  "\u2022 Render time: ",
                  selectedFiber.totalTime.toFixed(0),
                  "ms"
                ] }) }),
                /* @__PURE__ */ u6("div", { className: cn2(["text-xs text-gray-400 mb-4"]), children: [
                  "\u2022 Renders: ",
                  selectedFiber.count,
                  "x"
                ] })
              ] })
            ] })
          ] }),
          tipisShown && !isMemoizable && /* @__PURE__ */ u6(
            "div",
            {
              className: cn2([
                "w-full mb-4 bg-[#0A0A0A] border border-[#27272A] rounded-sm overflow-hidden flex relative"
              ]),
              children: [
                /* @__PURE__ */ u6(
                  "button",
                  {
                    onClick: () => {
                      setTipIsShown(false);
                      localStorage.setItem("react-scan-tip-shown", "false");
                    },
                    className: cn2([
                      "absolute right-2 top-2 rounded-sm p-1 hover:bg-[#18181B]"
                    ]),
                    children: /* @__PURE__ */ u6(CloseIcon, { size: 12 })
                  }
                ),
                /* @__PURE__ */ u6("div", { className: cn2(["w-1 bg-[#d36cff]"]) }),
                /* @__PURE__ */ u6("div", { className: cn2(["flex-1"]), children: [
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2(["px-3 py-2 text-gray-100 text-xs font-semibold"]),
                      children: "How to stop renders"
                    }
                  ),
                  /* @__PURE__ */ u6("div", { className: cn2(["px-3 pb-2 text-gray-400 text-[10px]"]), children: "Stop the following props, state and context from changing between renders, and wrap the component in React.memo if not already" })
                ] })
              ]
            }
          ),
          isMemoizable && /* @__PURE__ */ u6(
            "div",
            {
              className: cn2([
                "w-full mb-4 bg-[#0A0A0A] border border-[#27272A] rounded-sm overflow-hidden flex"
              ]),
              children: [
                /* @__PURE__ */ u6("div", { className: cn2(["w-1 bg-[#d36cff]"]) }),
                /* @__PURE__ */ u6("div", { className: cn2(["flex-1"]), children: [
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2(["px-3 py-2 text-gray-100 text-sm font-semibold"]),
                      children: "No changes detected"
                    }
                  ),
                  /* @__PURE__ */ u6("div", { className: cn2(["px-3 pb-2 text-gray-400 text-xs"]), children: "This component would not have rendered if it was memoized" })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ u6("div", { className: cn2(["flex w-full"]), children: [
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "flex flex-col border border-[#27272A] rounded-l-sm overflow-hidden w-1/3"
                ]),
                children: [
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "text-[14px] font-semibold px-2 py-2 bg-[#18181B] text-white flex justify-center"
                      ]),
                      children: "Changed Props"
                    }
                  ),
                  selectedFiber.changes.props.length > 0 ? selectedFiber.changes.props.toSorted((a6, b4) => b4.count - a6.count).map((change) => /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex flex-col justify-between items-center border-t overflow-x-auto border-[#27272A] px-1 py-1 text-wrap bg-[#0A0A0A] text-[10px]"
                      ]),
                      children: [
                        /* @__PURE__ */ u6("span", { className: cn2(["text-white "]), children: change.name }),
                        /* @__PURE__ */ u6(
                          "div",
                          {
                            className: cn2([" text-[8px]  text-[#d36cff] pl-1 py-1 "]),
                            children: [
                              change.count,
                              "/",
                              selectedFiber.count,
                              "x"
                            ]
                          }
                        )
                      ]
                    },
                    change.name
                  )) : /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex items-center justify-center h-full bg-[#0A0A0A] text-[#A1A1AA] border-t border-[#27272A]"
                      ]),
                      children: "No changes"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "flex flex-col border border-[#27272A] border-l-0 overflow-hidden w-1/3"
                ]),
                children: [
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        " text-[14px] font-semibold px-2 py-2 bg-[#18181B] text-white flex justify-center"
                      ]),
                      children: "Changed State"
                    }
                  ),
                  selectedFiber.changes.state.length > 0 ? selectedFiber.changes.state.toSorted((a6, b4) => b4.count - a6.count).map((change) => /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex flex-col justify-between items-center border-t overflow-x-auto border-[#27272A] px-1 py-1 text-wrap bg-[#0A0A0A] text-[10px]"
                      ]),
                      children: [
                        /* @__PURE__ */ u6("span", { className: cn2(["text-white "]), children: [
                          "index ",
                          change.index
                        ] }),
                        /* @__PURE__ */ u6(
                          "div",
                          {
                            className: cn2([
                              "rounded-full  text-[#d36cff] pl-1 py-1 text-[8px]"
                            ]),
                            children: [
                              change.count,
                              "/",
                              selectedFiber.count,
                              "x"
                            ]
                          }
                        )
                      ]
                    },
                    change.index
                  )) : /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex items-center justify-center h-full bg-[#0A0A0A] text-[#A1A1AA] border-t border-[#27272A]"
                      ]),
                      children: "No changes"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "flex flex-col border border-[#27272A] border-l-0 rounded-r-sm overflow-hidden w-1/3"
                ]),
                children: [
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        " text-[14px] font-semibold px-2 py-2 bg-[#18181B] text-white flex justify-center"
                      ]),
                      children: "Changed Context"
                    }
                  ),
                  selectedFiber.changes.context.length > 0 ? selectedFiber.changes.context.toSorted((a6, b4) => b4.count - a6.count).map((change) => /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex flex-col justify-between items-center border-t  border-[#27272A] px-1 py-1 bg-[#0A0A0A] text-[10px] overflow-x-auto"
                      ]),
                      children: [
                        /* @__PURE__ */ u6("span", { className: cn2(["text-white "]), children: change.name }),
                        /* @__PURE__ */ u6(
                          "div",
                          {
                            className: cn2([
                              "rounded-full text-[#d36cff] pl-1 py-1 text-[8px] text-wrap"
                            ]),
                            children: [
                              change.count,
                              "/",
                              selectedFiber.count,
                              "x"
                            ]
                          }
                        )
                      ]
                    },
                    change.name
                  )) : /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex items-center justify-center h-full bg-[#0A0A0A] text-[#A1A1AA] border-t border-[#27272A] py-2"
                      ]),
                      children: "No changes"
                    }
                  )
                ]
              }
            )
          ] })
        ]
      }
    );
  };

  // src/web/views/notifications/details-routes.tsx
  var DetailsRoutes = () => {
    const { notificationState, setNotificationState } = useNotificationsContext();
    const [dots, setDots] = d4("...");
    const containerRef = A3(null);
    y3(() => {
      const interval = setInterval(() => {
        setDots((prev) => {
          if (prev === "...") return "";
          return prev + ".";
        });
      }, 500);
      return () => clearInterval(interval);
    }, []);
    if (!notificationState.selectedEvent) {
      return /* @__PURE__ */ u6(
        "div",
        {
          ref: containerRef,
          className: cn2([
            "h-full w-full flex flex-col items-center justify-center relative py-2 px-4"
          ]),
          children: [
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "p-2 flex justify-center items-center border-[#27272A] absolute top-0 right-0"
                ]),
                children: /* @__PURE__ */ u6(
                  "button",
                  {
                    onClick: () => {
                      signalWidgetViews.value = {
                        view: "none"
                      };
                    },
                    children: /* @__PURE__ */ u6(CloseIcon, { size: 18, className: "text-[#6F6F78]" })
                  }
                )
              }
            ),
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "flex flex-col items-start pt-5 bg-[#0A0A0A] p-5 rounded-sm max-w-md",
                  " shadow-lg"
                ]),
                children: /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col items-start gap-y-4"]), children: [
                  /* @__PURE__ */ u6("div", { className: cn2(["flex items-center"]), children: /* @__PURE__ */ u6("span", { className: cn2(["text-zinc-400 font-medium text-[17px]"]), children: [
                    "Scanning for slowdowns",
                    dots
                  ] }) }),
                  notificationState.events.length !== 0 && /* @__PURE__ */ u6("p", { className: cn2(["text-xs"]), children: [
                    "Click on an item in the",
                    " ",
                    /* @__PURE__ */ u6("span", { className: cn2(["text-purple-400"]), children: "History" }),
                    " list to get started"
                  ] }),
                  /* @__PURE__ */ u6("p", { className: cn2(["text-zinc-600 text-xs"]), children: "You don't need to keep this panel open for React Scan to record slowdowns" }),
                  /* @__PURE__ */ u6("p", { className: cn2(["text-zinc-600 text-xs"]), children: "Enable audio alerts to hear a delightful ding every time a large slowdown is recorded" }),
                  /* @__PURE__ */ u6(
                    "button",
                    {
                      onClick: () => {
                        if (notificationState.audioNotificationsOptions.enabled) {
                          setNotificationState((prev) => {
                            if (prev.audioNotificationsOptions.audioContext?.state !== "closed") {
                              prev.audioNotificationsOptions.audioContext?.close();
                            }
                            localStorage.setItem("react-scan-notifications-audio", "false");
                            return {
                              ...prev,
                              audioNotificationsOptions: {
                                audioContext: null,
                                enabled: false
                              }
                            };
                          });
                          return;
                        }
                        localStorage.setItem("react-scan-notifications-audio", "true");
                        const audioContext = new AudioContext();
                        playNotificationSound(audioContext);
                        setNotificationState((prev) => ({
                          ...prev,
                          audioNotificationsOptions: {
                            enabled: true,
                            audioContext
                          }
                        }));
                      },
                      className: cn2([
                        "px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-sm w-full",
                        " text-sm flex items-center gap-x-2 justify-center"
                      ]),
                      children: notificationState.audioNotificationsOptions.enabled ? /* @__PURE__ */ u6(k2, { children: /* @__PURE__ */ u6("span", { className: "flex items-center gap-x-1", children: "Disable audio alerts" }) }) : /* @__PURE__ */ u6(k2, { children: /* @__PURE__ */ u6("span", { className: "flex items-center gap-x-1", children: "Enable audio alerts" }) })
                    }
                  )
                ] })
              }
            )
          ]
        }
      );
    }
    switch (notificationState.route) {
      case "render-visualization": {
        return /* @__PURE__ */ u6(TabLayout, { children: /* @__PURE__ */ u6(RenderBarChart, { selectedEvent: notificationState.selectedEvent }) });
      }
      case "render-explanation": {
        if (!notificationState.selectedFiber) {
          throw new Error(
            "Invariant: must have selected fiber when viewing render explanation"
          );
        }
        return /* @__PURE__ */ u6(TabLayout, { children: /* @__PURE__ */ u6(
          RenderExplanation,
          {
            selectedFiber: notificationState.selectedFiber,
            selectedEvent: notificationState.selectedEvent
          }
        ) });
      }
      case "other-visualization": {
        return /* @__PURE__ */ u6(TabLayout, { children: /* @__PURE__ */ u6(
          "div",
          {
            className: cn2(["flex w-full h-full flex-col overflow-y-auto"]),
            id: "overview-scroll-container",
            children: /* @__PURE__ */ u6(
              OtherVisualization,
              {
                selectedEvent: notificationState.selectedEvent
              }
            )
          }
        ) });
      }
      case "optimize": {
        return /* @__PURE__ */ u6(TabLayout, { children: /* @__PURE__ */ u6(Optimize, { selectedEvent: notificationState.selectedEvent }) });
      }
    }
    notificationState.route;
  };
  var TabLayout = ({ children }) => {
    const { notificationState } = useNotificationsContext();
    if (!notificationState.selectedEvent) {
      throw new Error(
        "Invariant: d must have selected event when viewing render explanation"
      );
    }
    return /* @__PURE__ */ u6("div", { className: cn2([`w-full h-full flex flex-col gap-y-2`]), children: [
      /* @__PURE__ */ u6("div", { className: cn2(["h-[50px] w-full"]), children: /* @__PURE__ */ u6(NotificationTabs, { selectedEvent: notificationState.selectedEvent }) }),
      /* @__PURE__ */ u6(
        "div",
        {
          className: cn2(["h-calc(100%-50px) flex flex-col overflow-y-auto px-3"]),
          children
        }
      )
    ] });
  };

  // src/web/views/notifications/notification-header.tsx
  var NotificationHeader = ({
    selectedEvent
  }) => {
    const severity = getEventSeverity(selectedEvent);
    switch (selectedEvent.kind) {
      case "interaction": {
        return (
          // h-[48px] is a hack to adjust for header size
          /* @__PURE__ */ u6(
            "div",
            {
              className: cn2([`w-full flex border-b border-[#27272A] min-h-[48px]`]),
              children: /* @__PURE__ */ u6(
                "div",
                {
                  className: cn2([
                    "min-w-fit w-full justify-start flex items-center border-r border-[#27272A] pl-5 pr-2 text-sm gap-x-4"
                  ]),
                  children: [
                    /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-2 "]), children: [
                      /* @__PURE__ */ u6("span", { className: cn2(["text-[#5a5a5a] mr-0.5"]), children: selectedEvent.type === "click" ? "Clicked " : "Typed in " }),
                      /* @__PURE__ */ u6("span", { children: getComponentName(selectedEvent.componentPath) }),
                      /* @__PURE__ */ u6(
                        "div",
                        {
                          className: cn2([
                            "w-fit flex items-center justify-center h-fit text-white px-1 rounded-sm font-semibold text-[10px] whitespace-nowrap",
                            severity === "low" && "bg-green-500/50",
                            severity === "needs-improvement" && "bg-[#b77116]",
                            severity === "high" && "bg-[#b94040]"
                          ]),
                          children: [
                            getTotalTime(selectedEvent.timing).toFixed(0),
                            "ms processing time"
                          ]
                        }
                      )
                    ] }),
                    /* @__PURE__ */ u6(
                      "div",
                      {
                        className: cn2(["flex items-center gap-x-2  justify-end ml-auto"]),
                        children: /* @__PURE__ */ u6(
                          "div",
                          {
                            className: cn2([
                              "p-2 flex justify-center items-center border-[#27272A]"
                            ]),
                            children: /* @__PURE__ */ u6(
                              "button",
                              {
                                onClick: () => {
                                  signalWidgetViews.value = {
                                    view: "none"
                                  };
                                },
                                title: "Close",
                                children: /* @__PURE__ */ u6(CloseIcon, { size: 18, className: "text-[#6F6F78]" })
                              }
                            )
                          }
                        )
                      }
                    )
                  ]
                }
              )
            }
          )
        );
      }
      case "dropped-frames": {
        return /* @__PURE__ */ u6(
          "div",
          {
            className: cn2([`w-full flex border-b border-[#27272A] min-h-[48px]`]),
            children: /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "min-w-fit w-full justify-start flex items-center border-r border-[#27272A] pl-5 pr-2 text-sm gap-x-4"
                ]),
                children: [
                  /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-2 "]), children: [
                    "FPS Drop",
                    /* @__PURE__ */ u6(
                      "div",
                      {
                        className: cn2([
                          "w-fit flex items-center justify-center h-fit text-white px-1 rounded-sm font-semibold text-[10px] whitespace-nowrap",
                          severity === "low" && "bg-green-500/50",
                          severity === "needs-improvement" && "bg-[#b77116]",
                          severity === "high" && "bg-[#b94040]"
                        ]),
                        children: [
                          "dropped to ",
                          selectedEvent.fps,
                          " FPS"
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ u6(
                    "div",
                    {
                      className: cn2([
                        "flex items-center gap-x-2 w-2/4 justify-end ml-auto"
                      ]),
                      children: /* @__PURE__ */ u6(
                        "div",
                        {
                          className: cn2([
                            "p-2 flex justify-center items-center border-[#27272A]"
                          ]),
                          children: /* @__PURE__ */ u6(
                            "button",
                            {
                              onClick: () => {
                                signalWidgetViews.value = {
                                  view: "none"
                                };
                              },
                              children: /* @__PURE__ */ u6(CloseIcon, { size: 18, className: "text-[#6F6F78]" })
                            }
                          )
                        }
                      )
                    }
                  )
                ]
              }
            )
          }
        );
      }
    }
  };

  // src/web/views/notifications/collapsed-event.tsx
  var useNestedFlash = ({
    flashingItemsCount,
    totalEvents
  }) => {
    const [newFlash, setNewFlash] = d4(false);
    const flashedFor = A3(0);
    const lastFlashTime = A3(0);
    y3(() => {
      if (flashedFor.current >= totalEvents) {
        return;
      }
      const now = Date.now();
      const debounceTime = 250;
      const timeSinceLastFlash = now - lastFlashTime.current;
      if (timeSinceLastFlash >= debounceTime) {
        setNewFlash(false);
        const timeout2 = setTimeout(() => {
          flashedFor.current = totalEvents;
          lastFlashTime.current = Date.now();
          setNewFlash(true);
          setTimeout(() => {
            setNewFlash(false);
          }, 2e3);
        }, 50);
        return () => clearTimeout(timeout2);
      } else {
        const delayNeeded = debounceTime - timeSinceLastFlash;
        const timeout2 = setTimeout(() => {
          setNewFlash(false);
          setTimeout(() => {
            flashedFor.current = totalEvents;
            lastFlashTime.current = Date.now();
            setNewFlash(true);
            setTimeout(() => {
              setNewFlash(false);
            }, 2e3);
          }, 50);
        }, delayNeeded);
        return () => clearTimeout(timeout2);
      }
    }, [flashingItemsCount]);
    return newFlash;
  };
  var CollapsedItem = ({
    item,
    shouldFlash
  }) => {
    const [expanded, setExpanded] = d4(false);
    const severity = item.events.map(getEventSeverity).reduce((prev, curr) => {
      switch (curr) {
        case "high": {
          return "high";
        }
        case "needs-improvement": {
          return prev === "high" ? "high" : "needs-improvement";
        }
        case "low": {
          return prev;
        }
      }
    }, "low");
    const flashingItemsCount = item.events.reduce(
      (prev, curr) => shouldFlash(curr.id) ? prev + 1 : prev,
      0
    );
    const shouldFlashAgain = useNestedFlash({
      flashingItemsCount,
      totalEvents: item.events.length
    });
    return /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col gap-y-0.5"]), children: [
      /* @__PURE__ */ u6(
        "button",
        {
          onClick: () => setExpanded((expanded2) => !expanded2),
          className: cn2([
            "pl-2 py-1.5  text-sm flex items-center rounded-sm hover:bg-[#18181B] relative overflow-hidden",
            shouldFlashAgain && !expanded && "after:absolute after:inset-0 after:bg-purple-500/30 after:animate-[fadeOut_1s_ease-out_forwards]"
          ]),
          children: [
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "w-4/5 flex items-center justify-start h-full text-xs truncate gap-x-1.5"
                ]),
                children: [
                  /* @__PURE__ */ u6("span", { className: cn2(["min-w-fit"]), children: /* @__PURE__ */ u6(
                    ChevronRight,
                    {
                      className: cn2([
                        "text-[#A1A1AA] transition-transform",
                        expanded ? "rotate-90" : ""
                      ]),
                      size: 14
                    },
                    `chevron-${item.timestamp}`
                  ) }),
                  /* @__PURE__ */ u6("span", { className: cn2(["text-xs"]), children: item.kind === "collapsed-frame-drops" ? "FPS Drops" : getComponentName(item.events.at(0)?.componentPath ?? []) })
                ]
              }
            ),
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2(["ml-auto min-w-fit flex justify-end items-center"]),
                children: /* @__PURE__ */ u6(
                  "div",
                  {
                    style: {
                      lineHeight: "10px"
                    },
                    className: cn2([
                      "w-fit flex items-center text-[10px] justify-center h-full text-white px-1 py-1 rounded-sm font-semibold",
                      severity === "low" && "bg-green-500/60",
                      severity === "needs-improvement" && "bg-[#b77116] text-[10px]",
                      severity === "high" && "bg-[#b94040]"
                    ]),
                    children: [
                      "x",
                      item.events.length
                    ]
                  }
                )
              }
            )
          ]
        }
      ),
      expanded && /* @__PURE__ */ u6(IndentedContent, { children: item.events.toSorted((a6, b4) => b4.timestamp - a6.timestamp).map((event) => /* @__PURE__ */ u6(
        SlowdownHistoryItem,
        {
          event,
          shouldFlash: shouldFlash(event.id)
        }
      )) })
    ] });
  };
  var IndentedContent = ({
    children
  }) => /* @__PURE__ */ u6("div", { className: "relative pl-6 flex flex-col gap-y-1", children: [
    /* @__PURE__ */ u6("div", { className: "absolute left-3 top-0 bottom-0 w-px bg-[#27272A]" }),
    children
  ] });

  // src/web/views/notifications/slowdown-history.tsx
  var useFlashManager = (events) => {
    const prevEventsRef = A3([]);
    const [newEventIds, setNewEventIds] = d4(/* @__PURE__ */ new Set());
    const isInitialMount = A3(true);
    y3(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        prevEventsRef.current = events;
        return;
      }
      const currentIds = new Set(events.map((e5) => e5.id));
      const prevIds = new Set(prevEventsRef.current.map((e5) => e5.id));
      const newIds = /* @__PURE__ */ new Set();
      currentIds.forEach((id) => {
        if (!prevIds.has(id)) {
          newIds.add(id);
        }
      });
      if (newIds.size > 0) {
        setNewEventIds(newIds);
        setTimeout(() => {
          setNewEventIds(/* @__PURE__ */ new Set());
        }, 2e3);
      }
      prevEventsRef.current = events;
    }, [events]);
    return (id) => newEventIds.has(id);
  };
  var useFlash = ({ shouldFlash }) => {
    const [isFlashing, setIsFlashing] = d4(shouldFlash);
    y3(() => {
      if (shouldFlash) {
        setIsFlashing(true);
        const timer = setTimeout(() => {
          setIsFlashing(false);
        }, 1e3);
        return () => clearTimeout(timer);
      }
    }, [shouldFlash]);
    return isFlashing;
  };
  var SlowdownHistoryItem = ({
    event,
    shouldFlash
  }) => {
    const { notificationState, setNotificationState } = useNotificationsContext();
    const severity = getEventSeverity(event);
    const isFlashing = useFlash({ shouldFlash });
    switch (event.kind) {
      case "interaction": {
        return /* @__PURE__ */ u6(
          "button",
          {
            onClick: () => {
              setNotificationState((prev) => ({
                ...prev,
                selectedEvent: event,
                route: "render-visualization",
                selectedFiber: null
              }));
            },
            className: cn2([
              "pl-2 py-1.5  text-sm flex w-full items-center rounded-sm hover:bg-[#18181B] relative overflow-hidden",
              event.id === notificationState.selectedEvent?.id && "bg-[#18181B]",
              isFlashing && "after:absolute after:inset-0 after:bg-purple-500/30 after:animate-[fadeOut_1s_ease-out_forwards]"
            ]),
            children: [
              /* @__PURE__ */ u6(
                "div",
                {
                  className: cn2([
                    "w-4/5 flex items-center justify-start h-full gap-x-1.5"
                  ]),
                  children: [
                    /* @__PURE__ */ u6("span", { className: cn2(["min-w-fit text-xs"]), children: iife(() => {
                      switch (event.type) {
                        case "click": {
                          return /* @__PURE__ */ u6(PointerIcon, { size: 14 });
                        }
                        case "keyboard": {
                          return /* @__PURE__ */ u6(KeyboardIcon, { size: 14 });
                        }
                      }
                    }) }),
                    /* @__PURE__ */ u6("span", { className: cn2(["text-xs pr-1 truncate"]), children: getComponentName(event.componentPath) })
                  ]
                }
              ),
              /* @__PURE__ */ u6(
                "div",
                {
                  className: cn2([" min-w-fit flex justify-end items-center ml-auto"]),
                  children: /* @__PURE__ */ u6(
                    "div",
                    {
                      style: {
                        lineHeight: "10px"
                      },
                      className: cn2([
                        "gap-x-0.5 w-fit flex items-end justify-center h-full text-white px-1 py-1 rounded-sm font-semibold text-[10px]",
                        severity === "low" && "bg-green-500/50",
                        severity === "needs-improvement" && "bg-[#b77116] text-[10px]",
                        severity === "high" && "bg-[#b94040]"
                      ]),
                      children: /* @__PURE__ */ u6(
                        "div",
                        {
                          style: {
                            lineHeight: "10px"
                          },
                          className: cn2(["text-[10px] text-white flex items-end"]),
                          children: [
                            getTotalTime(event.timing).toFixed(0),
                            "ms"
                          ]
                        }
                      )
                    }
                  )
                }
              )
            ]
          }
        );
      }
      case "dropped-frames": {
        return /* @__PURE__ */ u6(
          "button",
          {
            onClick: () => {
              setNotificationState((prev) => ({
                ...prev,
                selectedEvent: event,
                // explicitly force back to render-visualization since the user might get confused when they don't see the detailed view immediately when clicking the view
                route: "render-visualization",
                selectedFiber: null
              }));
            },
            className: cn2([
              "pl-2 py-1.5  w-full text-sm flex items-center rounded-sm hover:bg-[#18181B] relative overflow-hidden",
              event.id === notificationState.selectedEvent?.id && "bg-[#18181B]",
              isFlashing && "after:absolute after:inset-0 after:bg-purple-500/30 after:animate-[fadeOut_1s_ease-out_forwards]"
            ]),
            children: [
              /* @__PURE__ */ u6(
                "div",
                {
                  className: cn2([
                    "w-4/5 flex items-center justify-start h-full text-xs truncate"
                  ]),
                  children: [
                    /* @__PURE__ */ u6(TrendingDownIcon, { size: 14, className: "mr-1.5" }),
                    " FPS Drop"
                  ]
                }
              ),
              /* @__PURE__ */ u6(
                "div",
                {
                  className: cn2([" min-w-fit flex justify-end items-center ml-auto"]),
                  children: /* @__PURE__ */ u6(
                    "div",
                    {
                      style: {
                        lineHeight: "10px"
                      },
                      className: cn2([
                        "w-fit flex items-center justify-center h-full text-white px-1 py-1 rounded-sm text-[10px] font-bold",
                        severity === "low" && "bg-green-500/60",
                        severity === "needs-improvement" && "bg-[#b77116] text-[10px]",
                        severity === "high" && "bg-[#b94040]"
                      ]),
                      children: [
                        event.fps,
                        " FPS"
                      ]
                    }
                  )
                }
              )
            ]
          }
        );
      }
    }
  };
  var collapseEvents = (events) => {
    const newEvents = events.reduce((prev, curr) => {
      const lastEvent = prev.at(-1);
      if (!lastEvent) {
        return [
          {
            kind: "single",
            event: curr,
            timestamp: curr.timestamp
          }
        ];
      }
      switch (lastEvent.kind) {
        case "collapsed-keyboard": {
          if (curr.kind === "interaction" && curr.type === "keyboard" && // must be on the same semantic component, it would be ideal to compare on fiberId, but i digress
          curr.componentPath.join("-") === lastEvent.events[0].componentPath.join("-")) {
            const eventsWithoutLast = prev.filter((e5) => e5 !== lastEvent);
            return [
              ...eventsWithoutLast,
              {
                kind: "collapsed-keyboard",
                events: [...lastEvent.events, curr],
                timestamp: Math.max(
                  ...[...lastEvent.events, curr].map((e5) => e5.timestamp)
                )
              }
            ];
          }
          return [
            ...prev,
            {
              kind: "single",
              event: curr,
              timestamp: curr.timestamp
            }
          ];
        }
        case "single": {
          if (lastEvent.event.kind === "interaction" && lastEvent.event.type === "keyboard" && curr.kind === "interaction" && curr.type === "keyboard" && lastEvent.event.componentPath.join("-") === curr.componentPath.join("-")) {
            const eventsWithoutLast = prev.filter((e5) => e5 !== lastEvent);
            return [
              ...eventsWithoutLast,
              {
                kind: "collapsed-keyboard",
                events: [lastEvent.event, curr],
                timestamp: Math.max(lastEvent.event.timestamp, curr.timestamp)
              }
            ];
          }
          if (lastEvent.event.kind === "dropped-frames" && curr.kind === "dropped-frames") {
            const eventsWithoutLast = prev.filter((e5) => e5 !== lastEvent);
            return [
              ...eventsWithoutLast,
              {
                kind: "collapsed-frame-drops",
                events: [lastEvent.event, curr],
                timestamp: Math.max(lastEvent.event.timestamp, curr.timestamp)
              }
            ];
          }
          return [
            ...prev,
            {
              kind: "single",
              event: curr,
              timestamp: curr.timestamp
            }
          ];
        }
        case "collapsed-frame-drops": {
          if (curr.kind === "dropped-frames") {
            const eventsWithoutLast = prev.filter((e5) => e5 !== lastEvent);
            return [
              ...eventsWithoutLast,
              {
                kind: "collapsed-frame-drops",
                events: [...lastEvent.events, curr],
                timestamp: Math.max(
                  ...[...lastEvent.events, curr].map((e5) => e5.timestamp)
                )
              }
            ];
          }
          return [
            ...prev,
            {
              kind: "single",
              event: curr,
              timestamp: curr.timestamp
            }
          ];
        }
      }
    }, []);
    return newEvents;
  };
  var useLaggedEvents = (lagMs = 150) => {
    const { notificationState } = useNotificationsContext();
    const [laggedEvents, setLaggedEvents] = d4(notificationState.events);
    y3(() => {
      setTimeout(() => {
        setLaggedEvents(notificationState.events);
      }, lagMs);
    }, [notificationState.events]);
    return [laggedEvents, setLaggedEvents];
  };
  var SlowdownHistory = () => {
    const { notificationState, setNotificationState } = useNotificationsContext();
    const shouldFlash = useFlashManager(notificationState.events);
    const [laggedEvents, setLaggedEvents] = useLaggedEvents();
    const collapsedEvents = collapseEvents(laggedEvents).toSorted(
      (a6, b4) => b4.timestamp - a6.timestamp
    );
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2([
          `w-full h-full gap-y-2 flex flex-col border-r border-[#27272A] overflow-y-auto`
        ]),
        children: [
          /* @__PURE__ */ u6(
            "div",
            {
              className: cn2([
                "text-sm text-[#65656D] pl-3 pr-1 w-full flex items-center justify-between"
              ]),
              children: [
                /* @__PURE__ */ u6("span", { children: "History" }),
                /* @__PURE__ */ u6(
                  Popover,
                  {
                    wrapperProps: {
                      className: "h-full flex items-center justify-center ml-auto"
                    },
                    triggerContent: /* @__PURE__ */ u6(
                      "button",
                      {
                        className: cn2(["hover:bg-[#18181B] rounded-full p-2"]),
                        title: "Clear all events",
                        onClick: () => {
                          toolbarEventStore.getState().actions.clear();
                          setNotificationState((prev) => ({
                            ...prev,
                            selectedEvent: null,
                            selectedFiber: null,
                            route: prev.route === "other-visualization" ? "other-visualization" : "render-visualization"
                          }));
                          setLaggedEvents([]);
                        },
                        children: /* @__PURE__ */ u6(ClearIcon, { className: cn2([""]), size: 16 })
                      }
                    ),
                    children: /* @__PURE__ */ u6("div", { className: cn2(["w-full flex justify-center"]), children: "Clear all events" })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col px-1 gap-y-1"]), children: [
            collapsedEvents.length === 0 && /* @__PURE__ */ u6(
              "div",
              {
                className: cn2([
                  "flex items-center justify-center text-zinc-500 text-sm py-4"
                ]),
                children: "No Events"
              }
            ),
            collapsedEvents.map(
              (historyItem) => iife(() => {
                switch (historyItem.kind) {
                  case "collapsed-keyboard": {
                    return /* @__PURE__ */ u6(CollapsedItem, { shouldFlash, item: historyItem });
                  }
                  case "single": {
                    return /* @__PURE__ */ u6(
                      SlowdownHistoryItem,
                      {
                        event: historyItem.event,
                        shouldFlash: shouldFlash(historyItem.event.id)
                      },
                      historyItem.event.id
                    );
                  }
                  case "collapsed-frame-drops": {
                    return /* @__PURE__ */ u6(CollapsedItem, { shouldFlash, item: historyItem });
                  }
                }
              })
            )
          ] })
        ]
      }
    );
  };

  // src/web/views/notifications/notifications.tsx
  var getGroupedFiberRenders = (fiberRenders) => {
    const res = Object.values(fiberRenders).map((render) => ({
      id: not_globally_unique_generateId(),
      totalTime: render.nodeInfo.reduce((prev, curr) => prev + curr.selfTime, 0),
      count: render.nodeInfo.length,
      name: render.nodeInfo[0].name,
      // invariant, at least one exists,
      deletedAll: false,
      parents: render.parents,
      hasMemoCache: render.hasMemoCache,
      wasFiberRenderMount: render.wasFiberRenderMount,
      // it would be nice if we calculated the % of components memoizable, but this would have to be calculated downstream before it got aggregated
      elements: render.nodeInfo.map((node) => node.element),
      changes: {
        context: render.changes.fiberContext.current.filter(
          (change) => render.changes.fiberContext.changesCounts.get(change.name)
        ).map((change) => ({
          name: String(change.name),
          count: render.changes.fiberContext.changesCounts.get(change.name) ?? 0
        })),
        props: render.changes.fiberProps.current.filter(
          (change) => render.changes.fiberProps.changesCounts.get(change.name)
        ).map((change) => ({
          name: String(change.name),
          count: render.changes.fiberProps.changesCounts.get(change.name) ?? 0
        })),
        state: render.changes.fiberState.current.filter(
          (change) => render.changes.fiberState.changesCounts.get(Number(change.name))
        ).map((change) => ({
          index: change.name,
          count: render.changes.fiberState.changesCounts.get(Number(change.name)) ?? 0
        }))
      }
    }));
    return res;
  };
  var useGarbageCollectElements = (notificationEvents) => {
    y3(() => {
      const checkElementsExistence = () => {
        notificationEvents.forEach((event) => {
          if (!event.groupedFiberRenders) return;
          event.groupedFiberRenders.forEach((render) => {
            if (render.deletedAll) return;
            if (!render.elements || render.elements.length === 0) {
              render.deletedAll = true;
              return;
            }
            const initialLength = render.elements.length;
            render.elements = render.elements.filter((element) => {
              return element && element.isConnected;
            });
            if (render.elements.length === 0 && initialLength > 0) {
              render.deletedAll = true;
            }
          });
        });
      };
      const intervalId = setInterval(checkElementsExistence, 5e3);
      return () => {
        clearInterval(intervalId);
      };
    }, [notificationEvents]);
  };
  var useAppNotifications = () => {
    const log2 = useToolbarEventLog();
    const notificationEvents = [];
    useGarbageCollectElements(notificationEvents);
    log2.state.events.forEach((event) => {
      const fiberRenders = event.kind === "interaction" ? event.data.meta.detailedTiming.fiberRenders : event.data.meta.fiberRenders;
      const groupedFiberRenders = getGroupedFiberRenders(fiberRenders);
      const renderTime = groupedFiberRenders.reduce(
        (prev, curr) => prev + curr.totalTime,
        0
      );
      switch (event.kind) {
        case "interaction": {
          const { commitEnd, jsEndDetail, interactionStartDetail, rafStart } = event.data.meta.detailedTiming;
          const otherJSTime = Math.max(
            0,
            jsEndDetail - interactionStartDetail - renderTime
          );
          const frameDraw = Math.max(
            event.data.meta.latency - (commitEnd - interactionStartDetail),
            0
          );
          notificationEvents.push({
            componentPath: event.data.meta.detailedTiming.componentPath,
            groupedFiberRenders,
            id: event.id,
            kind: "interaction",
            memory: null,
            timestamp: event.data.startAt,
            type: event.data.meta.detailedTiming.interactionType === "keyboard" ? "keyboard" : "click",
            timing: {
              renderTime,
              kind: "interaction",
              otherJSTime,
              framePreparation: rafStart - jsEndDetail,
              frameConstruction: commitEnd - rafStart,
              frameDraw
            }
          });
          return;
        }
        case "long-render": {
          notificationEvents.push({
            kind: "dropped-frames",
            id: event.id,
            memory: null,
            timing: {
              kind: "dropped-frames",
              renderTime,
              otherTime: event.data.meta.latency
            },
            groupedFiberRenders,
            timestamp: event.data.startAt,
            fps: event.data.meta.fps
          });
          return;
        }
      }
    });
    return notificationEvents;
  };
  var timeout = 1e3;
  var NotificationAudio = () => {
    const { notificationState, setNotificationState } = useNotificationsContext();
    const playedFor = A3(null);
    const debounceTimeout = A3(null);
    const lastPlayedTime = A3(0);
    const [laggedEvents] = useLaggedEvents();
    const alertEventsCount = laggedEvents.filter(
      // todo: make this configurable
      (event) => getEventSeverity(event) === "high"
    ).length;
    y3(() => {
      const audioEnabledString = localStorage.getItem(
        "react-scan-notifications-audio"
      );
      if (audioEnabledString !== "false" && audioEnabledString !== "true") {
        localStorage.setItem("react-scan-notifications-audio", "false");
        return;
      }
      const audioEnabled = audioEnabledString === "false" ? false : true;
      if (audioEnabled) {
        setNotificationState((prev) => {
          if (prev.audioNotificationsOptions.enabled) {
            return prev;
          }
          return {
            ...prev,
            audioNotificationsOptions: {
              enabled: true,
              audioContext: new AudioContext()
            }
          };
        });
        return;
      }
    }, []);
    y3(() => {
      const { audioNotificationsOptions } = notificationState;
      if (!audioNotificationsOptions.enabled) {
        return;
      }
      if (alertEventsCount === 0) {
        return;
      }
      if (playedFor.current && playedFor.current >= alertEventsCount) {
        return;
      }
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      const now = Date.now();
      const timeSinceLastPlay = now - lastPlayedTime.current;
      const remainingDebounceTime = Math.max(0, timeout - timeSinceLastPlay);
      debounceTimeout.current = setTimeout(() => {
        playNotificationSound(audioNotificationsOptions.audioContext);
        playedFor.current = alertEventsCount;
        lastPlayedTime.current = Date.now();
        debounceTimeout.current = null;
      }, remainingDebounceTime);
    }, [alertEventsCount]);
    y3(() => {
      if (alertEventsCount !== 0) {
        return;
      }
      playedFor.current = null;
    }, [alertEventsCount]);
    y3(() => {
      return () => {
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
        }
      };
    }, []);
    return null;
  };
  var NotificationWrapper = D4((_6, ref) => {
    const events = useAppNotifications();
    const [notificationState, setNotificationState] = d4({
      detailsExpanded: false,
      events,
      filterBy: "latest",
      moreInfoExpanded: false,
      route: "render-visualization",
      selectedEvent: events.toSorted((a6, b4) => a6.timestamp - b4.timestamp).at(-1) ?? null,
      selectedFiber: null,
      routeMessage: null,
      audioNotificationsOptions: {
        enabled: false,
        audioContext: null
      }
    });
    notificationState.events = events;
    return /* @__PURE__ */ u6(
      NotificationStateContext.Provider,
      {
        value: {
          notificationState,
          setNotificationState,
          setRoute: ({ route, routeMessage }) => {
            setNotificationState((prev) => {
              const newState = { ...prev, route, routeMessage };
              switch (route) {
                case "render-visualization": {
                  fadeOutHighlights();
                  return {
                    ...newState,
                    selectedFiber: null
                  };
                }
                case "optimize": {
                  fadeOutHighlights();
                  return {
                    ...newState,
                    selectedFiber: null
                  };
                }
                case "other-visualization": {
                  fadeOutHighlights();
                  return {
                    ...newState,
                    selectedFiber: null
                  };
                }
                case "render-explanation": {
                  fadeOutHighlights();
                  return newState;
                }
              }
            });
          }
        },
        children: [
          /* @__PURE__ */ u6(NotificationAudio, {}),
          /* @__PURE__ */ u6(Notifications, { ref })
        ]
      }
    );
  });
  var Notifications = D4((_6, ref) => {
    const { notificationState } = useNotificationsContext();
    return /* @__PURE__ */ u6("div", { ref, className: cn2(["h-full w-full flex flex-col"]), children: [
      notificationState.selectedEvent && /* @__PURE__ */ u6(
        "div",
        {
          className: cn2([
            "w-full h-[48px] flex flex-col",
            notificationState.moreInfoExpanded && "h-[235px]",
            notificationState.moreInfoExpanded && notificationState.selectedEvent.kind === "dropped-frames" && "h-[150px]"
          ]),
          children: [
            /* @__PURE__ */ u6(NotificationHeader, { selectedEvent: notificationState.selectedEvent }),
            notificationState.moreInfoExpanded && /* @__PURE__ */ u6(MoreInfo, {})
          ]
        }
      ),
      /* @__PURE__ */ u6(
        "div",
        {
          className: cn2([
            "flex ",
            notificationState.selectedEvent ? "h-[calc(100%-48px)]" : "h-full",
            notificationState.moreInfoExpanded && "h-[calc(100%-200px)]",
            notificationState.moreInfoExpanded && notificationState.selectedEvent?.kind === "dropped-frames" && "h-[calc(100%-150px)]"
          ]),
          children: [
            /* @__PURE__ */ u6("div", { className: cn2(["h-full min-w-[200px]"]), children: /* @__PURE__ */ u6(SlowdownHistory, {}) }),
            /* @__PURE__ */ u6("div", { className: cn2(["w-[calc(100%-200px)] h-full overflow-y-auto"]), children: /* @__PURE__ */ u6(DetailsRoutes, {}) })
          ]
        }
      )
    ] });
  });
  var MoreInfo = () => {
    const { notificationState } = useNotificationsContext();
    if (!notificationState.selectedEvent) {
      throw new Error("Invariant must have selected event for more info");
    }
    const event = notificationState.selectedEvent;
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2([
          "px-4 py-2 border-b border-[#27272A] bg-[#18181B]/50 h-[calc(100%-40px)]",
          event.kind === "dropped-frames" && `h-[calc(100%-25px)]`
        ]),
        children: /* @__PURE__ */ u6("div", { className: cn2(["flex flex-col gap-y-4 h-full"]), children: iife(() => {
          switch (event.kind) {
            case "interaction": {
              return /* @__PURE__ */ u6(k2, { children: [
                /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-3"]), children: [
                  /* @__PURE__ */ u6("span", { className: "text-[#6F6F78] text-xs font-medium", children: event.type === "click" ? "Clicked component location" : "Typed in component location" }),
                  /* @__PURE__ */ u6("div", { className: "font-mono text-[#E4E4E7] flex items-center bg-[#27272A] pl-2 py-1 rounded-sm overflow-x-auto", children: event.componentPath.toReversed().map((part, i6) => /* @__PURE__ */ u6(k2, { children: [
                    /* @__PURE__ */ u6(
                      "span",
                      {
                        style: {
                          lineHeight: "14px"
                        },
                        className: "text-[10px] whitespace-nowrap",
                        children: part
                      },
                      part
                    ),
                    i6 < event.componentPath.length - 1 && /* @__PURE__ */ u6("span", { className: "text-[#6F6F78] mx-0.5", children: "\u2039" })
                  ] })) })
                ] }),
                /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-3"]), children: [
                  /* @__PURE__ */ u6("span", { className: "text-[#6F6F78] text-xs font-medium", children: "Total Time" }),
                  /* @__PURE__ */ u6("span", { className: "text-[#E4E4E7] bg-[#27272A] px-1.5 py-1 rounded-sm text-xs", children: [
                    getTotalTime(event.timing).toFixed(0),
                    "ms"
                  ] })
                ] }),
                /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-3"]), children: [
                  /* @__PURE__ */ u6("span", { className: "text-[#6F6F78] text-xs font-medium", children: "Occurred" }),
                  /* @__PURE__ */ u6("span", { className: "text-[#E4E4E7] bg-[#27272A] px-1.5 py-1 rounded-sm text-xs", children: `${((Date.now() - event.timestamp) / 1e3).toFixed(0)}s ago` })
                ] })
              ] });
            }
            case "dropped-frames": {
              return /* @__PURE__ */ u6(k2, { children: [
                /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-3"]), children: [
                  /* @__PURE__ */ u6("span", { className: "text-[#6F6F78] text-xs font-medium", children: "Total Time" }),
                  /* @__PURE__ */ u6("span", { className: "text-[#E4E4E7] bg-[#27272A] px-1.5 py-1 rounded-sm text-xs", children: [
                    getTotalTime(event.timing).toFixed(0),
                    "ms"
                  ] })
                ] }),
                /* @__PURE__ */ u6("div", { className: cn2(["flex items-center gap-x-3"]), children: [
                  /* @__PURE__ */ u6("span", { className: "text-[#6F6F78] text-xs font-medium", children: "Occurred" }),
                  /* @__PURE__ */ u6("span", { className: "text-[#E4E4E7] bg-[#27272A] px-1.5 py-1 rounded-sm text-xs", children: `${((Date.now() - event.timestamp) / 1e3).toFixed(0)}s ago` })
                ] })
              ] });
            }
          }
        }) })
      }
    );
  };

  // src/web/views/toolbar/index.tsx
  var Toolbar = constant(() => {
    const events = useAppNotifications();
    const [laggedEvents, setLaggedEvents] = d4(events);
    y3(() => {
      const timeout2 = setTimeout(() => {
        setLaggedEvents(events);
      }, 500 + 100);
      return () => {
        clearTimeout(timeout2);
      };
    }, [events]);
    const inspectState = Store.inspectState;
    const isInspectActive = inspectState.value.kind === "inspecting";
    const isInspectFocused = inspectState.value.kind === "focused";
    const [seenEvents, setSeenEvents] = d4([]);
    const onToggleInspect = q2(() => {
      const currentState = Store.inspectState.value;
      switch (currentState.kind) {
        case "inspecting": {
          signalWidgetViews.value = {
            view: "none"
          };
          Store.inspectState.value = {
            kind: "inspect-off"
          };
          return;
        }
        case "focused": {
          signalWidgetViews.value = {
            view: "inspector"
          };
          Store.inspectState.value = {
            kind: "inspecting",
            hoveredDomElement: null
          };
          return;
        }
        // todo: auto select the root fibers first stateNode, and tell the user to select the element
        case "inspect-off": {
          signalWidgetViews.value = {
            view: "none"
          };
          Store.inspectState.value = {
            kind: "inspecting",
            hoveredDomElement: null
          };
          return;
        }
        case "uninitialized": {
          return;
        }
      }
    }, []);
    const onToggleActive = q2((e5) => {
      e5.preventDefault();
      e5.stopPropagation();
      if (!ReactScanInternals.instrumentation) {
        return;
      }
      const isPaused = !ReactScanInternals.instrumentation.isPaused.value;
      ReactScanInternals.instrumentation.isPaused.value = isPaused;
      const existingLocalStorageOptions = readLocalStorage("react-scan-options");
      saveLocalStorage("react-scan-options", {
        ...existingLocalStorageOptions,
        enabled: !isPaused
      });
    }, []);
    useSignalEffect(() => {
      const state = Store.inspectState.value;
      if (state.kind === "uninitialized") {
        Store.inspectState.value = {
          kind: "inspect-off"
        };
      }
    });
    let inspectIcon = null;
    let inspectColor = "#999";
    if (isInspectActive) {
      inspectIcon = /* @__PURE__ */ u6(Icon, { name: "icon-inspect" });
      inspectColor = "#8e61e3";
    } else if (isInspectFocused) {
      inspectIcon = /* @__PURE__ */ u6(Icon, { name: "icon-focus" });
      inspectColor = "#8e61e3";
    } else {
      inspectIcon = /* @__PURE__ */ u6(Icon, { name: "icon-inspect" });
      inspectColor = "#999";
    }
    _4(() => {
      if (signalWidgetViews.value.view !== "notifications") {
        return;
      }
      const ids = new Set(events.map((event) => event.id));
      setSeenEvents([...ids.values()]);
    }, [events.length, signalWidgetViews.value.view]);
    return /* @__PURE__ */ u6("div", { className: "flex max-h-9 min-h-9 flex-1 items-stretch overflow-hidden", children: [
      /* @__PURE__ */ u6("div", { className: "h-full flex items-center min-w-fit", children: /* @__PURE__ */ u6(
        "button",
        {
          type: "button",
          id: "react-scan-inspect-element",
          title: "Inspect element",
          onClick: onToggleInspect,
          className: "button flex items-center justify-center h-full w-full pl-3 pr-2.5",
          style: { color: inspectColor },
          children: inspectIcon
        }
      ) }),
      /* @__PURE__ */ u6("div", { className: "h-full flex items-center justify-center", children: /* @__PURE__ */ u6(
        "button",
        {
          type: "button",
          id: "react-scan-notifications",
          title: "Notifications",
          onClick: () => {
            if (Store.inspectState.value.kind !== "inspect-off") {
              Store.inspectState.value = {
                kind: "inspect-off"
              };
            }
            switch (signalWidgetViews.value.view) {
              case "inspector": {
                Store.inspectState.value = {
                  kind: "inspect-off"
                };
                const ids = new Set(events.map((event) => event.id));
                setSeenEvents([...ids.values()]);
                signalWidgetViews.value = {
                  view: "notifications"
                };
                return;
              }
              case "notifications": {
                signalWidgetViews.value = {
                  view: "none"
                };
                return;
              }
              case "none": {
                const ids = new Set(events.map((event) => event.id));
                setSeenEvents([...ids.values()]);
                signalWidgetViews.value = {
                  view: "notifications"
                };
                return;
              }
            }
          },
          className: "button flex items-center justify-center h-full pl-2.5 pr-2.5",
          style: { color: inspectColor },
          children: /* @__PURE__ */ u6(
            Notification,
            {
              events: laggedEvents.filter((event) => !seenEvents.includes(event.id)).map((event) => getEventSeverity(event) === "high"),
              size: 16,
              className: cn2([
                "text-[#999]",
                signalWidgetViews.value.view === "notifications" && "text-[#8E61E3]"
              ])
            }
          )
        }
      ) }),
      /* @__PURE__ */ u6(
        Toggle,
        {
          checked: !ReactScanInternals.instrumentation?.isPaused.value,
          onChange: onToggleActive,
          className: "place-self-center",
          title: "Outline Re-renders"
        }
      ),
      ReactScanInternals.options.value.showFPS && /* @__PURE__ */ u6(FPSMeter, {})
    ] });
  });

  // src/web/views/index.tsx
  var isInspecting = w4(
    () => Store.inspectState.value.kind === "inspecting"
  );
  var headerClassName = w4(
    () => cn2(
      "relative",
      "flex-1",
      "flex flex-col",
      "rounded-t-lg",
      "overflow-hidden",
      "opacity-100",
      "transition-[opacity]",
      isInspecting.value && "opacity-0 duration-0 delay-0"
    )
  );
  var isInspectorViewOpen = w4(
    () => signalWidgetViews.value.view === "inspector"
  );
  var isNotificationsViewOpen = w4(
    () => signalWidgetViews.value.view === "notifications"
  );
  var Content = () => {
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2(
          "flex flex-1 flex-col",
          "overflow-hidden z-10",
          "rounded-lg",
          "bg-black",
          "opacity-100",
          "transition-[border-radius]",
          "peer-hover/left:rounded-l-none",
          "peer-hover/right:rounded-r-none",
          "peer-hover/top:rounded-t-none",
          "peer-hover/bottom:rounded-b-none"
        ),
        children: [
          /* @__PURE__ */ u6("div", { className: headerClassName, children: [
            /* @__PURE__ */ u6(Header, {}),
            /* @__PURE__ */ u6(
              "div",
              {
                className: cn2(
                  "relative",
                  "flex-1 flex",
                  "text-white",
                  "bg-[#0A0A0A]",
                  "transition-opacity delay-150",
                  "overflow-hidden",
                  "border-b border-[#222]"
                ),
                children: [
                  /* @__PURE__ */ u6(ContentView, { isOpen: isInspectorViewOpen, children: /* @__PURE__ */ u6(ViewInspector, {}) }),
                  /* @__PURE__ */ u6(ContentView, { isOpen: isNotificationsViewOpen, children: /* @__PURE__ */ u6(NotificationWrapper, {}) })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ u6(Toolbar, {})
        ]
      }
    );
  };
  var ContentView = ({ isOpen, children }) => {
    return /* @__PURE__ */ u6(
      "div",
      {
        className: cn2(
          "flex-1",
          "opacity-0",
          "overflow-y-auto overflow-x-hidden",
          "transition-opacity delay-0",
          "pointer-events-none",
          isOpen.value && "opacity-100 delay-150 pointer-events-auto"
        ),
        children: /* @__PURE__ */ u6("div", { className: "absolute inset-0 flex", children })
      }
    );
  };

  // src/web/views/inspector/overlay/index.tsx
  var lerp2 = (start2, end, t5) => start2 + (end - start2) * t5;
  var ANIMATION_CONFIG = {
    frameInterval: 1e3 / 60,
    speeds: {
      fast: 0.51,
      slow: 0.1,
      off: 0
    }
  };
  var OVERLAY_DPR = IS_CLIENT ? window.devicePixelRatio || 1 : 1;
  var ScanOverlay = () => {
    const refCanvas = A3(null);
    const refEventCatcher = A3(null);
    const refCurrentRect = A3(null);
    const refCurrentLockIconRect = A3(null);
    const refLastHoveredElement = A3(null);
    const refRafId = A3(0);
    const refTimeout = A3();
    const refCleanupMap = A3(
      /* @__PURE__ */ new Map()
    );
    const refIsFadingOut = A3(false);
    const refLastFrameTime = A3(0);
    const drawLockIcon = (ctx2, x5, y5, size) => {
      ctx2.save();
      ctx2.strokeStyle = "white";
      ctx2.fillStyle = "white";
      ctx2.lineWidth = 1.5;
      const shackleWidth = size * 0.6;
      const shackleHeight = size * 0.5;
      const shackleX = x5 + (size - shackleWidth) / 2;
      const shackleY = y5;
      ctx2.beginPath();
      ctx2.arc(
        shackleX + shackleWidth / 2,
        shackleY + shackleHeight / 2,
        shackleWidth / 2,
        Math.PI,
        0,
        false
      );
      ctx2.stroke();
      const bodyWidth = size * 0.8;
      const bodyHeight = size * 0.5;
      const bodyX = x5 + (size - bodyWidth) / 2;
      const bodyY = y5 + shackleHeight / 2;
      ctx2.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
      ctx2.restore();
    };
    const drawStatsPill = (ctx2, rect, kind, fiber) => {
      if (!fiber) return;
      const pillHeight = 24;
      const pillPadding = 8;
      const componentName = (fiber?.type && Te(fiber.type)) ?? "Unknown";
      const text = componentName;
      ctx2.save();
      ctx2.font = "12px system-ui, -apple-system, sans-serif";
      const textMetrics = ctx2.measureText(text);
      const textWidth = textMetrics.width;
      const lockIconSize = kind === "locked" ? 14 : 0;
      const lockIconPadding = kind === "locked" ? 6 : 0;
      const pillWidth = textWidth + pillPadding * 2 + lockIconSize + lockIconPadding;
      const pillX = rect.left;
      const pillY = rect.top - pillHeight - 4;
      ctx2.fillStyle = "rgb(37, 37, 38, .75)";
      ctx2.beginPath();
      ctx2.roundRect(pillX, pillY, pillWidth, pillHeight, 3);
      ctx2.fill();
      if (kind === "locked") {
        const lockX = pillX + pillPadding;
        const lockY = pillY + (pillHeight - lockIconSize) / 2 + 2;
        drawLockIcon(ctx2, lockX, lockY, lockIconSize);
        refCurrentLockIconRect.current = {
          x: lockX,
          y: lockY,
          width: lockIconSize,
          height: lockIconSize
        };
      } else {
        refCurrentLockIconRect.current = null;
      }
      ctx2.fillStyle = "white";
      ctx2.textBaseline = "middle";
      const textX = pillX + pillPadding + (kind === "locked" ? lockIconSize + lockIconPadding : 0);
      ctx2.fillText(text, textX, pillY + pillHeight / 2);
      ctx2.restore();
    };
    const drawRect = (canvas2, ctx2, kind, fiber) => {
      if (!refCurrentRect.current) return;
      const rect = refCurrentRect.current;
      ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
      ctx2.strokeStyle = "rgba(142, 97, 227, 0.5)";
      ctx2.fillStyle = "rgba(173, 97, 230, 0.10)";
      if (kind === "locked") {
        ctx2.setLineDash([]);
      } else {
        ctx2.setLineDash([4]);
      }
      ctx2.lineWidth = 1;
      ctx2.fillRect(rect.left, rect.top, rect.width, rect.height);
      ctx2.strokeRect(rect.left, rect.top, rect.width, rect.height);
      drawStatsPill(ctx2, rect, kind, fiber);
    };
    const animate = (canvas2, ctx2, targetRect, kind, parentCompositeFiber, onComplete) => {
      const speed = ReactScanInternals.options.value.animationSpeed;
      const t5 = ANIMATION_CONFIG.speeds[speed] ?? ANIMATION_CONFIG.speeds.off;
      const animationFrame2 = (timestamp) => {
        if (timestamp - refLastFrameTime.current < ANIMATION_CONFIG.frameInterval) {
          refRafId.current = requestAnimationFrame(animationFrame2);
          return;
        }
        refLastFrameTime.current = timestamp;
        if (!refCurrentRect.current) {
          cancelAnimationFrame(refRafId.current);
          return;
        }
        refCurrentRect.current = {
          left: lerp2(refCurrentRect.current.left, targetRect.left, t5),
          top: lerp2(refCurrentRect.current.top, targetRect.top, t5),
          width: lerp2(refCurrentRect.current.width, targetRect.width, t5),
          height: lerp2(refCurrentRect.current.height, targetRect.height, t5)
        };
        drawRect(canvas2, ctx2, kind, parentCompositeFiber);
        const stillMoving = Math.abs(refCurrentRect.current.left - targetRect.left) > 0.1 || Math.abs(refCurrentRect.current.top - targetRect.top) > 0.1 || Math.abs(refCurrentRect.current.width - targetRect.width) > 0.1 || Math.abs(refCurrentRect.current.height - targetRect.height) > 0.1;
        if (stillMoving) {
          refRafId.current = requestAnimationFrame(animationFrame2);
        } else {
          refCurrentRect.current = targetRect;
          drawRect(canvas2, ctx2, kind, parentCompositeFiber);
          cancelAnimationFrame(refRafId.current);
          ctx2.restore();
        }
      };
      cancelAnimationFrame(refRafId.current);
      clearTimeout(refTimeout.current);
      refRafId.current = requestAnimationFrame(animationFrame2);
      refTimeout.current = setTimeout(() => {
        cancelAnimationFrame(refRafId.current);
        refCurrentRect.current = targetRect;
        drawRect(canvas2, ctx2, kind, parentCompositeFiber);
        ctx2.restore();
      }, 1e3);
    };
    const setupOverlayAnimation = (canvas2, ctx2, targetRect, kind, parentCompositeFiber) => {
      ctx2.save();
      if (!refCurrentRect.current) {
        refCurrentRect.current = targetRect;
        drawRect(canvas2, ctx2, kind, parentCompositeFiber);
        ctx2.restore();
        return;
      }
      animate(canvas2, ctx2, targetRect, kind, parentCompositeFiber);
    };
    const drawHoverOverlay = async (overlayElement, canvas2, ctx2, kind) => {
      if (!overlayElement || !canvas2 || !ctx2) return;
      const { parentCompositeFiber } = getCompositeComponentFromElement(overlayElement);
      const targetRect = await getAssociatedFiberRect(overlayElement);
      if (!parentCompositeFiber || !targetRect) return;
      setupOverlayAnimation(canvas2, ctx2, targetRect, kind, parentCompositeFiber);
    };
    const unsubscribeAll = () => {
      for (const cleanup3 of refCleanupMap.current.values()) {
        cleanup3?.();
      }
    };
    const cleanupCanvas = (canvas2) => {
      const ctx2 = canvas2.getContext("2d");
      if (ctx2) {
        ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
      }
      refCurrentRect.current = null;
      refCurrentLockIconRect.current = null;
      refLastHoveredElement.current = null;
      canvas2.classList.remove("fade-in");
      refIsFadingOut.current = false;
    };
    const startFadeOut = (onComplete) => {
      if (!refCanvas.current || refIsFadingOut.current) return;
      const handleTransitionEnd = (e5) => {
        if (!refCanvas.current || e5.propertyName !== "opacity" || !refIsFadingOut.current) {
          return;
        }
        refCanvas.current.removeEventListener(
          "transitionend",
          handleTransitionEnd
        );
        cleanupCanvas(refCanvas.current);
        onComplete?.();
      };
      const existingListener = refCleanupMap.current.get("fade-out");
      if (existingListener) {
        existingListener();
        refCleanupMap.current.delete("fade-out");
      }
      refCanvas.current.addEventListener("transitionend", handleTransitionEnd);
      refCleanupMap.current.set("fade-out", () => {
        refCanvas.current?.removeEventListener(
          "transitionend",
          handleTransitionEnd
        );
      });
      refIsFadingOut.current = true;
      refCanvas.current.classList.remove("fade-in");
      requestAnimationFrame(() => {
        refCanvas.current?.classList.add("fade-out");
      });
    };
    const startFadeIn = () => {
      if (!refCanvas.current) return;
      refIsFadingOut.current = false;
      refCanvas.current.classList.remove("fade-out");
      requestAnimationFrame(() => {
        refCanvas.current?.classList.add("fade-in");
      });
    };
    const handleHoverableElement = (componentElement) => {
      if (componentElement === refLastHoveredElement.current) return;
      refLastHoveredElement.current = componentElement;
      if (nonVisualTags.has(componentElement.tagName)) {
        startFadeOut();
      } else {
        startFadeIn();
      }
      Store.inspectState.value = {
        kind: "inspecting",
        hoveredDomElement: componentElement
      };
    };
    const handleNonHoverableArea = () => {
      if (!refCurrentRect.current || !refCanvas.current || refIsFadingOut.current) {
        return;
      }
      startFadeOut();
    };
    const handlePointerMove = throttle((e5) => {
      const state = Store.inspectState.peek();
      if (state.kind !== "inspecting" || !refEventCatcher.current) return;
      refEventCatcher.current.style.pointerEvents = "none";
      const element = document.elementFromPoint(e5?.clientX ?? 0, e5?.clientY ?? 0);
      refEventCatcher.current.style.removeProperty("pointer-events");
      clearTimeout(refTimeout.current);
      if (element && element !== refCanvas.current) {
        const { parentCompositeFiber } = getCompositeComponentFromElement(
          element
        );
        if (parentCompositeFiber) {
          const componentElement = findComponentDOMNode(parentCompositeFiber);
          if (componentElement) {
            handleHoverableElement(componentElement);
            return;
          }
        }
      }
      handleNonHoverableArea();
    }, 32);
    const isClickInLockIcon = (e5, canvas2) => {
      const currentRect = refCurrentLockIconRect.current;
      if (!currentRect) return false;
      const rect = canvas2.getBoundingClientRect();
      const scaleX = canvas2.width / rect.width;
      const scaleY = canvas2.height / rect.height;
      const x5 = (e5.clientX - rect.left) * scaleX;
      const y5 = (e5.clientY - rect.top) * scaleY;
      const adjustedX = x5 / OVERLAY_DPR;
      const adjustedY = y5 / OVERLAY_DPR;
      return adjustedX >= currentRect.x && adjustedX <= currentRect.x + currentRect.width && adjustedY >= currentRect.y && adjustedY <= currentRect.y + currentRect.height;
    };
    const handleLockIconClick = (state) => {
      if (state.kind === "focused") {
        Store.inspectState.value = {
          kind: "inspecting",
          hoveredDomElement: state.focusedDomElement
        };
      }
    };
    const handleElementClick = (e5) => {
      const clickableElements = [
        "react-scan-inspect-element",
        "react-scan-power"
      ];
      if (e5.target instanceof HTMLElement && clickableElements.includes(e5.target.id)) {
        return;
      }
      const tagName = refLastHoveredElement.current?.tagName;
      if (tagName && nonVisualTags.has(tagName)) {
        return;
      }
      e5.preventDefault();
      e5.stopPropagation();
      const element = refLastHoveredElement.current ?? document.elementFromPoint(e5.clientX, e5.clientY);
      if (!element) return;
      const clickedEl = e5.composedPath().at(0);
      if (clickedEl instanceof HTMLElement && clickableElements.includes(clickedEl.id)) {
        const syntheticEvent = new MouseEvent(e5.type, e5);
        syntheticEvent.__reactScanSyntheticEvent = true;
        clickedEl.dispatchEvent(syntheticEvent);
        return;
      }
      const { parentCompositeFiber } = getCompositeComponentFromElement(
        element
      );
      if (!parentCompositeFiber) return;
      const componentElement = findComponentDOMNode(parentCompositeFiber);
      if (!componentElement) {
        refLastHoveredElement.current = null;
        Store.inspectState.value = {
          kind: "inspect-off"
        };
        return;
      }
      Store.inspectState.value = {
        kind: "focused",
        focusedDomElement: componentElement,
        fiber: parentCompositeFiber
      };
    };
    const handleClick = (e5) => {
      if (e5.__reactScanSyntheticEvent) {
        return;
      }
      const state = Store.inspectState.peek();
      const canvas2 = refCanvas.current;
      if (!canvas2 || !refEventCatcher.current) return;
      if (isClickInLockIcon(e5, canvas2)) {
        e5.preventDefault();
        e5.stopPropagation();
        handleLockIconClick(state);
        return;
      }
      if (state.kind === "inspecting") {
        handleElementClick(e5);
      }
    };
    const handleKeyDown = (e5) => {
      if (e5.key !== "Escape") return;
      const state = Store.inspectState.peek();
      const canvas2 = refCanvas.current;
      if (!canvas2) return;
      if (document.activeElement?.id === "react-scan-root") {
        return;
      }
      signalWidgetViews.value = {
        view: "none"
      };
      if (state.kind === "focused" || state.kind === "inspecting") {
        e5.preventDefault();
        e5.stopPropagation();
        switch (state.kind) {
          case "focused": {
            startFadeIn();
            refCurrentRect.current = null;
            refLastHoveredElement.current = state.focusedDomElement;
            Store.inspectState.value = {
              kind: "inspecting",
              hoveredDomElement: state.focusedDomElement
            };
            break;
          }
          case "inspecting": {
            startFadeOut(() => {
              signalIsSettingsOpen.value = false;
              Store.inspectState.value = {
                kind: "inspect-off"
              };
            });
            break;
          }
        }
      }
    };
    const handleStateChange = (state, canvas2, ctx2) => {
      refCleanupMap.current.get(state.kind)?.();
      if (refEventCatcher.current) {
        if (state.kind !== "inspecting") {
          refEventCatcher.current.style.pointerEvents = "none";
        }
      }
      if (refRafId.current) {
        cancelAnimationFrame(refRafId.current);
      }
      let unsubReport;
      switch (state.kind) {
        case "inspect-off":
          startFadeOut();
          return;
        case "inspecting":
          drawHoverOverlay(state.hoveredDomElement, canvas2, ctx2, "inspecting");
          break;
        case "focused":
          if (!state.focusedDomElement) return;
          if (refLastHoveredElement.current !== state.focusedDomElement) {
            refLastHoveredElement.current = state.focusedDomElement;
          }
          signalWidgetViews.value = {
            view: "inspector"
          };
          drawHoverOverlay(state.focusedDomElement, canvas2, ctx2, "locked");
          unsubReport = Store.lastReportTime.subscribe(() => {
            if (refRafId.current && refCurrentRect.current) {
              const { parentCompositeFiber } = getCompositeComponentFromElement(
                state.focusedDomElement
              );
              if (parentCompositeFiber) {
                drawHoverOverlay(state.focusedDomElement, canvas2, ctx2, "locked");
              }
            }
          });
          if (unsubReport) {
            refCleanupMap.current.set(state.kind, unsubReport);
          }
          break;
      }
    };
    const updateCanvasSize = (canvas2, ctx2) => {
      const rect = canvas2.getBoundingClientRect();
      canvas2.width = rect.width * OVERLAY_DPR;
      canvas2.height = rect.height * OVERLAY_DPR;
      ctx2.scale(OVERLAY_DPR, OVERLAY_DPR);
      ctx2.save();
    };
    const handleResizeOrScroll = () => {
      const state = Store.inspectState.peek();
      const canvas2 = refCanvas.current;
      if (!canvas2) return;
      const ctx2 = canvas2?.getContext("2d");
      if (!ctx2) return;
      cancelAnimationFrame(refRafId.current);
      clearTimeout(refTimeout.current);
      updateCanvasSize(canvas2, ctx2);
      refCurrentRect.current = null;
      if (state.kind === "focused" && state.focusedDomElement) {
        drawHoverOverlay(state.focusedDomElement, canvas2, ctx2, "locked");
      } else if (state.kind === "inspecting" && state.hoveredDomElement) {
        drawHoverOverlay(state.hoveredDomElement, canvas2, ctx2, "inspecting");
      }
    };
    const handlePointerDown = (e5) => {
      const state = Store.inspectState.peek();
      const canvas2 = refCanvas.current;
      if (!canvas2) return;
      if (state.kind === "inspecting" || isClickInLockIcon(e5, canvas2)) {
        e5.preventDefault();
        e5.stopPropagation();
        e5.stopImmediatePropagation();
      }
    };
    y3(() => {
      const canvas2 = refCanvas.current;
      if (!canvas2) return;
      const ctx2 = canvas2?.getContext("2d");
      if (!ctx2) return;
      updateCanvasSize(canvas2, ctx2);
      const unSubState = Store.inspectState.subscribe((state) => {
        handleStateChange(state, canvas2, ctx2);
      });
      window.addEventListener("scroll", handleResizeOrScroll, { passive: true });
      window.addEventListener("resize", handleResizeOrScroll, { passive: true });
      document.addEventListener("pointermove", handlePointerMove, {
        passive: true,
        capture: true
      });
      document.addEventListener("pointerdown", handlePointerDown, {
        capture: true
      });
      document.addEventListener("click", handleClick, { capture: true });
      document.addEventListener("keydown", handleKeyDown, { capture: true });
      return () => {
        unsubscribeAll();
        unSubState();
        window.removeEventListener("scroll", handleResizeOrScroll);
        window.removeEventListener("resize", handleResizeOrScroll);
        document.removeEventListener("pointermove", handlePointerMove, {
          capture: true
        });
        document.removeEventListener("click", handleClick, { capture: true });
        document.removeEventListener("pointerdown", handlePointerDown, {
          capture: true
        });
        document.removeEventListener("keydown", handleKeyDown, { capture: true });
        if (refRafId.current) {
          cancelAnimationFrame(refRafId.current);
        }
        clearTimeout(refTimeout.current);
      };
    }, []);
    return /* @__PURE__ */ u6(k2, { children: [
      /* @__PURE__ */ u6(
        "div",
        {
          ref: refEventCatcher,
          className: cn2("fixed top-0 left-0 w-screen h-screen", "z-[214748365]"),
          style: {
            pointerEvents: "none"
          }
        }
      ),
      /* @__PURE__ */ u6(
        "canvas",
        {
          ref: refCanvas,
          dir: "ltr",
          className: cn2(
            "react-scan-inspector-overlay",
            "fixed top-0 left-0 w-screen h-screen",
            "pointer-events-none",
            "z-[214748367]"
          )
        }
      )
    ] });
  };

  // src/web/widget/helpers.ts
  var WindowDimensions = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.maxWidth = width - SAFE_AREA * 2;
      this.maxHeight = height - SAFE_AREA * 2;
    }
    rightEdge(width) {
      return this.width - width - SAFE_AREA;
    }
    bottomEdge(height) {
      return this.height - height - SAFE_AREA;
    }
    isFullWidth(width) {
      return width >= this.maxWidth;
    }
    isFullHeight(height) {
      return height >= this.maxHeight;
    }
  };
  var cachedWindowDimensions;
  var getWindowDimensions = () => {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    if (cachedWindowDimensions && cachedWindowDimensions.width === currentWidth && cachedWindowDimensions.height === currentHeight) {
      return cachedWindowDimensions;
    }
    cachedWindowDimensions = new WindowDimensions(currentWidth, currentHeight);
    return cachedWindowDimensions;
  };
  var getOppositeCorner = (position, currentCorner, isFullScreen, isFullWidth, isFullHeight) => {
    if (isFullScreen) {
      if (position === "top-left") return "bottom-right";
      if (position === "top-right") return "bottom-left";
      if (position === "bottom-left") return "top-right";
      if (position === "bottom-right") return "top-left";
      const [vertical, horizontal] = currentCorner.split("-");
      if (position === "left") return `${vertical}-right`;
      if (position === "right") return `${vertical}-left`;
      if (position === "top") return `bottom-${horizontal}`;
      if (position === "bottom") return `top-${horizontal}`;
    }
    if (isFullWidth) {
      if (position === "left")
        return `${currentCorner.split("-")[0]}-right`;
      if (position === "right")
        return `${currentCorner.split("-")[0]}-left`;
    }
    if (isFullHeight) {
      if (position === "top")
        return `bottom-${currentCorner.split("-")[1]}`;
      if (position === "bottom")
        return `top-${currentCorner.split("-")[1]}`;
    }
    return currentCorner;
  };
  var calculatePosition = (corner, width, height) => {
    const isRTL = getComputedStyle(document.body).direction === "rtl";
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const isMinimized = width === MIN_SIZE.width;
    const effectiveWidth = isMinimized ? width : Math.min(width, windowWidth - SAFE_AREA * 2);
    const effectiveHeight = isMinimized ? height : Math.min(height, windowHeight - SAFE_AREA * 2);
    let x5;
    let y5;
    let leftBound = SAFE_AREA;
    let rightBound = windowWidth - effectiveWidth - SAFE_AREA;
    let topBound = SAFE_AREA;
    let bottomBound = windowHeight - effectiveHeight - SAFE_AREA;
    switch (corner) {
      case "top-right":
        x5 = isRTL ? -leftBound : rightBound;
        y5 = topBound;
        break;
      case "bottom-right":
        x5 = isRTL ? -leftBound : rightBound;
        y5 = bottomBound;
        break;
      case "bottom-left":
        x5 = isRTL ? -rightBound : leftBound;
        y5 = bottomBound;
        break;
      case "top-left":
        x5 = isRTL ? -rightBound : leftBound;
        y5 = topBound;
        break;
      default:
        x5 = leftBound;
        y5 = topBound;
        break;
    }
    if (isMinimized) {
      if (isRTL) {
        x5 = Math.min(
          -leftBound,
          Math.max(x5, -rightBound)
        );
      } else {
        x5 = Math.max(
          leftBound,
          Math.min(x5, rightBound)
        );
      }
      y5 = Math.max(
        topBound,
        Math.min(y5, bottomBound)
      );
    }
    return { x: x5, y: y5 };
  };
  var positionMatchesCorner = (position, corner) => {
    const [vertical, horizontal] = corner.split("-");
    return position !== vertical && position !== horizontal;
  };
  var getHandleVisibility = (position, corner, isFullWidth, isFullHeight) => {
    if (isFullWidth && isFullHeight) {
      return true;
    }
    if (!isFullWidth && !isFullHeight) {
      return positionMatchesCorner(position, corner);
    }
    if (isFullWidth) {
      return position !== corner.split("-")[0];
    }
    if (isFullHeight) {
      return position !== corner.split("-")[1];
    }
    return false;
  };
  var calculateBoundedSize = (currentSize, delta, isWidth) => {
    const min = isWidth ? MIN_SIZE.width : MIN_SIZE.initialHeight;
    const max = isWidth ? getWindowDimensions().maxWidth : getWindowDimensions().maxHeight;
    const newSize = currentSize + delta;
    return Math.min(Math.max(min, newSize), max);
  };
  var calculateNewSizeAndPosition = (position, initialSize, initialPosition, deltaX, deltaY) => {
    const isRTL = getComputedStyle(document.body).direction === "rtl";
    const maxWidth = window.innerWidth - SAFE_AREA * 2;
    const maxHeight = window.innerHeight - SAFE_AREA * 2;
    let newWidth = initialSize.width;
    let newHeight = initialSize.height;
    let newX = initialPosition.x;
    let newY = initialPosition.y;
    if (isRTL && position.includes("right")) {
      const availableWidth = -initialPosition.x + initialSize.width - SAFE_AREA;
      const proposedWidth = Math.min(initialSize.width + deltaX, availableWidth);
      newWidth = Math.min(maxWidth, Math.max(MIN_SIZE.width, proposedWidth));
      newX = initialPosition.x + (newWidth - initialSize.width);
    }
    if (isRTL && position.includes("left")) {
      const availableWidth = window.innerWidth - initialPosition.x - SAFE_AREA;
      const proposedWidth = Math.min(initialSize.width - deltaX, availableWidth);
      newWidth = Math.min(maxWidth, Math.max(MIN_SIZE.width, proposedWidth));
    }
    if (!isRTL && position.includes("right")) {
      const availableWidth = window.innerWidth - initialPosition.x - SAFE_AREA;
      const proposedWidth = Math.min(initialSize.width + deltaX, availableWidth);
      newWidth = Math.min(maxWidth, Math.max(MIN_SIZE.width, proposedWidth));
    }
    if (!isRTL && position.includes("left")) {
      const availableWidth = initialPosition.x + initialSize.width - SAFE_AREA;
      const proposedWidth = Math.min(initialSize.width - deltaX, availableWidth);
      newWidth = Math.min(maxWidth, Math.max(MIN_SIZE.width, proposedWidth));
      newX = initialPosition.x - (newWidth - initialSize.width);
    }
    if (position.includes("bottom")) {
      const availableHeight = window.innerHeight - initialPosition.y - SAFE_AREA;
      const proposedHeight = Math.min(
        initialSize.height + deltaY,
        availableHeight
      );
      newHeight = Math.min(
        maxHeight,
        Math.max(MIN_SIZE.initialHeight, proposedHeight)
      );
    }
    if (position.includes("top")) {
      const availableHeight = initialPosition.y + initialSize.height - SAFE_AREA;
      const proposedHeight = Math.min(
        initialSize.height - deltaY,
        availableHeight
      );
      newHeight = Math.min(
        maxHeight,
        Math.max(MIN_SIZE.initialHeight, proposedHeight)
      );
      newY = initialPosition.y - (newHeight - initialSize.height);
    }
    let leftBound = SAFE_AREA;
    let rightBound = window.innerWidth - SAFE_AREA - newWidth;
    let topBound = SAFE_AREA;
    let bottomBound = window.innerHeight - SAFE_AREA - newHeight;
    if (isRTL) {
      newX = Math.min(
        -leftBound,
        Math.max(newX, -rightBound)
      );
    } else {
      newX = Math.max(
        leftBound,
        Math.min(newX, rightBound)
      );
    }
    newY = Math.max(
      topBound,
      Math.min(newY, bottomBound)
    );
    return {
      newSize: { width: newWidth, height: newHeight },
      newPosition: { x: newX, y: newY }
    };
  };
  var getClosestCorner = (position) => {
    const windowDims = getWindowDimensions();
    const distances = {
      "top-left": Math.hypot(position.x, position.y),
      "top-right": Math.hypot(windowDims.maxWidth - position.x, position.y),
      "bottom-left": Math.hypot(position.x, windowDims.maxHeight - position.y),
      "bottom-right": Math.hypot(
        windowDims.maxWidth - position.x,
        windowDims.maxHeight - position.y
      )
    };
    let closest = "top-left";
    for (const key in distances) {
      if (distances[key] < distances[closest]) {
        closest = key;
      }
    }
    return closest;
  };
  var getBestCorner = (mouseX, mouseY, initialMouseX, initialMouseY, threshold = 100) => {
    const deltaX = initialMouseX !== void 0 ? mouseX - initialMouseX : 0;
    const deltaY = initialMouseY !== void 0 ? mouseY - initialMouseY : 0;
    const windowCenterX = window.innerWidth / 2;
    const windowCenterY = window.innerHeight / 2;
    const movingRight = deltaX > threshold;
    const movingLeft = deltaX < -threshold;
    const movingDown = deltaY > threshold;
    const movingUp = deltaY < -threshold;
    if (movingRight || movingLeft) {
      const isBottom = mouseY > windowCenterY;
      return movingRight ? isBottom ? "bottom-right" : "top-right" : isBottom ? "bottom-left" : "top-left";
    }
    if (movingDown || movingUp) {
      const isRight = mouseX > windowCenterX;
      return movingDown ? isRight ? "bottom-right" : "bottom-left" : isRight ? "top-right" : "top-left";
    }
    return mouseX > windowCenterX ? mouseY > windowCenterY ? "bottom-right" : "top-right" : mouseY > windowCenterY ? "bottom-left" : "top-left";
  };

  // src/web/widget/resize-handle.tsx
  var ResizeHandle = ({ position }) => {
    const refContainer = A3(null);
    const prevWidth = A3(null);
    const prevHeight = A3(null);
    const prevCorner = A3(null);
    y3(() => {
      const container = refContainer.current;
      if (!container) return;
      const updateVisibility = () => {
        container.classList.remove("pointer-events-none");
        const isFocused = Store.inspectState.value.kind === "focused";
        const shouldShow = signalWidgetViews.value.view !== "none";
        const isVisible = (isFocused || shouldShow) && getHandleVisibility(
          position,
          signalWidget.value.corner,
          signalWidget.value.dimensions.isFullWidth,
          signalWidget.value.dimensions.isFullHeight
        );
        if (isVisible) {
          container.classList.remove(
            "hidden",
            "pointer-events-none",
            "opacity-0"
          );
        } else {
          container.classList.add("hidden", "pointer-events-none", "opacity-0");
        }
      };
      const unsubscribeSignalWidget = signalWidget.subscribe((state) => {
        if (prevWidth.current !== null && prevHeight.current !== null && prevCorner.current !== null && state.dimensions.width === prevWidth.current && state.dimensions.height === prevHeight.current && state.corner === prevCorner.current) {
          return;
        }
        updateVisibility();
        prevWidth.current = state.dimensions.width;
        prevHeight.current = state.dimensions.height;
        prevCorner.current = state.corner;
      });
      const unsubscribeInspectState = Store.inspectState.subscribe(() => {
        updateVisibility();
      });
      return () => {
        unsubscribeSignalWidget();
        unsubscribeInspectState();
        prevWidth.current = null;
        prevHeight.current = null;
        prevCorner.current = null;
      };
    }, []);
    const handleResize = q2(
      (e5) => {
        e5.preventDefault();
        e5.stopPropagation();
        const widget = signalRefWidget.value;
        if (!widget) return;
        const containerStyle = widget.style;
        const { dimensions } = signalWidget.value;
        const initialX = e5.clientX;
        const initialY = e5.clientY;
        const initialWidth = dimensions.width;
        const initialHeight = dimensions.height;
        const initialPosition = dimensions.position;
        signalWidget.value = {
          ...signalWidget.value,
          dimensions: {
            ...dimensions,
            isFullWidth: false,
            isFullHeight: false,
            width: initialWidth,
            height: initialHeight,
            position: initialPosition
          }
        };
        let rafId = null;
        const handlePointerMove = (e6) => {
          if (rafId) return;
          containerStyle.transition = "none";
          rafId = requestAnimationFrame(() => {
            const { newSize, newPosition } = calculateNewSizeAndPosition(
              position,
              { width: initialWidth, height: initialHeight },
              initialPosition,
              e6.clientX - initialX,
              e6.clientY - initialY
            );
            containerStyle.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0)`;
            containerStyle.width = `${newSize.width}px`;
            containerStyle.height = `${newSize.height}px`;
            const maxTreeWidth = Math.floor(newSize.width - MIN_CONTAINER_WIDTH / 2);
            const currentTreeWidth = signalWidget.value.componentsTree.width;
            const newTreeWidth = Math.min(
              maxTreeWidth,
              Math.max(MIN_CONTAINER_WIDTH, currentTreeWidth)
            );
            signalWidget.value = {
              ...signalWidget.value,
              dimensions: {
                isFullWidth: false,
                isFullHeight: false,
                width: newSize.width,
                height: newSize.height,
                position: newPosition
              },
              componentsTree: {
                ...signalWidget.value.componentsTree,
                width: newTreeWidth
              }
            };
            rafId = null;
          });
        };
        const handlePointerUp = () => {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          document.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("pointerup", handlePointerUp);
          const { dimensions: dimensions2, corner } = signalWidget.value;
          const windowDims = getWindowDimensions();
          const isCurrentFullWidth = windowDims.isFullWidth(dimensions2.width);
          const isCurrentFullHeight = windowDims.isFullHeight(dimensions2.height);
          const isFullScreen = isCurrentFullWidth && isCurrentFullHeight;
          let newCorner = corner;
          if (isFullScreen || isCurrentFullWidth || isCurrentFullHeight) {
            newCorner = getClosestCorner(dimensions2.position);
          }
          const newPosition = calculatePosition(
            newCorner,
            dimensions2.width,
            dimensions2.height
          );
          const onTransitionEnd = () => {
            widget.removeEventListener("transitionend", onTransitionEnd);
          };
          widget.addEventListener("transitionend", onTransitionEnd);
          containerStyle.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0)`;
          signalWidget.value = {
            ...signalWidget.value,
            corner: newCorner,
            dimensions: {
              isFullWidth: isCurrentFullWidth,
              isFullHeight: isCurrentFullHeight,
              width: dimensions2.width,
              height: dimensions2.height,
              position: newPosition
            },
            lastDimensions: {
              isFullWidth: isCurrentFullWidth,
              isFullHeight: isCurrentFullHeight,
              width: dimensions2.width,
              height: dimensions2.height,
              position: newPosition
            }
          };
          saveLocalStorage(LOCALSTORAGE_KEY, {
            corner: newCorner,
            dimensions: signalWidget.value.dimensions,
            lastDimensions: signalWidget.value.lastDimensions,
            componentsTree: signalWidget.value.componentsTree
          });
        };
        document.addEventListener("pointermove", handlePointerMove, {
          passive: true
        });
        document.addEventListener("pointerup", handlePointerUp);
      },
      []
    );
    const handleDoubleClick = q2(
      (e5) => {
        e5.preventDefault();
        e5.stopPropagation();
        const widget = signalRefWidget.value;
        if (!widget) return;
        const containerStyle = widget.style;
        const { dimensions, corner } = signalWidget.value;
        const windowDims = getWindowDimensions();
        const isCurrentFullWidth = windowDims.isFullWidth(dimensions.width);
        const isCurrentFullHeight = windowDims.isFullHeight(dimensions.height);
        const isFullScreen = isCurrentFullWidth && isCurrentFullHeight;
        const isPartiallyMaximized = (isCurrentFullWidth || isCurrentFullHeight) && !isFullScreen;
        let newWidth = dimensions.width;
        let newHeight = dimensions.height;
        const newCorner = getOppositeCorner(
          position,
          corner,
          isFullScreen,
          isCurrentFullWidth,
          isCurrentFullHeight
        );
        if (position === "left" || position === "right") {
          newWidth = isCurrentFullWidth ? dimensions.width : windowDims.maxWidth;
          if (isPartiallyMaximized) {
            newWidth = isCurrentFullWidth ? MIN_SIZE.width : windowDims.maxWidth;
          }
        } else {
          newHeight = isCurrentFullHeight ? dimensions.height : windowDims.maxHeight;
          if (isPartiallyMaximized) {
            newHeight = isCurrentFullHeight ? MIN_SIZE.initialHeight : windowDims.maxHeight;
          }
        }
        if (isFullScreen) {
          if (position === "left" || position === "right") {
            newWidth = MIN_SIZE.width;
          } else {
            newHeight = MIN_SIZE.initialHeight;
          }
        }
        const newPosition = calculatePosition(newCorner, newWidth, newHeight);
        const newDimensions = {
          isFullWidth: windowDims.isFullWidth(newWidth),
          isFullHeight: windowDims.isFullHeight(newHeight),
          width: newWidth,
          height: newHeight,
          position: newPosition
        };
        const maxTreeWidth = Math.floor(newWidth - MIN_SIZE.width / 2);
        const currentTreeWidth = signalWidget.value.componentsTree.width;
        const defaultWidth = Math.floor(newWidth * 0.3);
        const newTreeWidth = isCurrentFullWidth ? MIN_CONTAINER_WIDTH : (position === "left" || position === "right") && !isCurrentFullWidth ? Math.min(maxTreeWidth, Math.max(MIN_CONTAINER_WIDTH, defaultWidth)) : Math.min(
          maxTreeWidth,
          Math.max(MIN_CONTAINER_WIDTH, currentTreeWidth)
        );
        requestAnimationFrame(() => {
          signalWidget.value = {
            corner: newCorner,
            dimensions: newDimensions,
            lastDimensions: dimensions,
            componentsTree: {
              ...signalWidget.value.componentsTree,
              width: newTreeWidth
            }
          };
          containerStyle.transition = "all 0.25s cubic-bezier(0, 0, 0.2, 1)";
          containerStyle.width = `${newWidth}px`;
          containerStyle.height = `${newHeight}px`;
          containerStyle.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0)`;
        });
        saveLocalStorage(LOCALSTORAGE_KEY, {
          corner: newCorner,
          dimensions: newDimensions,
          lastDimensions: dimensions,
          componentsTree: {
            ...signalWidget.value.componentsTree,
            width: newTreeWidth
          }
        });
      },
      []
    );
    return /* @__PURE__ */ u6(
      "div",
      {
        ref: refContainer,
        onPointerDown: handleResize,
        onDblClick: handleDoubleClick,
        className: cn2(
          "absolute z-50",
          "flex items-center justify-center",
          "group",
          "transition-colors select-none",
          "peer",
          {
            "resize-left peer/left": position === "left",
            "resize-right peer/right z-10": position === "right",
            "resize-top peer/top": position === "top",
            "resize-bottom peer/bottom": position === "bottom"
          }
        ),
        children: /* @__PURE__ */ u6("span", { className: "resize-line-wrapper", children: /* @__PURE__ */ u6("span", { className: "resize-line", children: /* @__PURE__ */ u6(
          Icon,
          {
            name: "icon-ellipsis",
            size: 18,
            className: cn2(
              "text-neutral-400",
              (position === "left" || position === "right") && "rotate-90"
            )
          }
        ) }) })
      }
    );
  };

  // src/web/widget/index.tsx
  var COLLAPSED_SIZE = {
    horizontal: { width: 20, height: 48 },
    vertical: { width: 48, height: 20 }
  };
  var Widget = () => {
    const refWidget = A3(null);
    const refShouldOpen = A3(false);
    const refInitialMinimizedWidth = A3(0);
    const refInitialMinimizedHeight = A3(0);
    const refExpandingFromCollapsed = A3(false);
    const updateWidgetPosition = q2((shouldSave = true) => {
      if (!refWidget.current) return;
      const { corner } = signalWidget.value;
      let newWidth;
      let newHeight;
      if (signalWidgetCollapsed.value) {
        const orientation = signalWidgetCollapsed.value.orientation || "horizontal";
        const size = COLLAPSED_SIZE[orientation];
        newWidth = size.width;
        newHeight = size.height;
      } else if (refShouldOpen.current) {
        const lastDims = signalWidget.value.lastDimensions;
        newWidth = calculateBoundedSize(lastDims.width, 0, true);
        newHeight = calculateBoundedSize(lastDims.height, 0, false);
        if (refExpandingFromCollapsed.current) {
          refExpandingFromCollapsed.current = false;
        }
      } else {
        newWidth = refInitialMinimizedWidth.current;
        newHeight = refInitialMinimizedHeight.current;
      }
      const newPosition = calculatePosition(corner, newWidth, newHeight);
      let finalPosition = newPosition;
      if (signalWidgetCollapsed.value) {
        const { corner: collapsedCorner, orientation = "horizontal" } = signalWidgetCollapsed.value;
        const size = COLLAPSED_SIZE[orientation];
        switch (collapsedCorner) {
          case "top-left":
            finalPosition = orientation === "horizontal" ? { x: -1, y: SAFE_AREA } : { x: SAFE_AREA, y: -1 };
            break;
          case "bottom-left":
            finalPosition = orientation === "horizontal" ? { x: -1, y: window.innerHeight - size.height - SAFE_AREA } : { x: SAFE_AREA, y: window.innerHeight - size.height + 1 };
            break;
          case "top-right":
            finalPosition = orientation === "horizontal" ? { x: window.innerWidth - size.width + 1, y: SAFE_AREA } : { x: window.innerWidth - size.width - SAFE_AREA, y: -1 };
            break;
          case "bottom-right":
          default:
            finalPosition = orientation === "horizontal" ? {
              x: window.innerWidth - size.width + 1,
              y: window.innerHeight - size.height - SAFE_AREA
            } : {
              x: window.innerWidth - size.width - SAFE_AREA,
              y: window.innerHeight - size.height + 1
            };
            break;
        }
      }
      const isTooSmall = newWidth < MIN_SIZE.width || newHeight < MIN_SIZE.initialHeight;
      const shouldPersist = shouldSave && !isTooSmall;
      const container = refWidget.current;
      const containerStyle = container.style;
      let rafId = null;
      const onTransitionEnd = () => {
        updateDimensions();
        container.removeEventListener("transitionend", onTransitionEnd);
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
      container.addEventListener("transitionend", onTransitionEnd);
      containerStyle.transition = "all 0.25s cubic-bezier(0, 0, 0.2, 1)";
      rafId = requestAnimationFrame(() => {
        containerStyle.width = `${newWidth}px`;
        containerStyle.height = `${newHeight}px`;
        containerStyle.transform = `translate3d(${finalPosition.x}px, ${finalPosition.y}px, 0)`;
        rafId = null;
      });
      const newDimensions = {
        isFullWidth: newWidth >= window.innerWidth - SAFE_AREA * 2,
        isFullHeight: newHeight >= window.innerHeight - SAFE_AREA * 2,
        width: newWidth,
        height: newHeight,
        position: finalPosition
      };
      signalWidget.value = {
        corner,
        dimensions: newDimensions,
        lastDimensions: refShouldOpen ? signalWidget.value.lastDimensions : newWidth > refInitialMinimizedWidth.current ? newDimensions : signalWidget.value.lastDimensions,
        componentsTree: signalWidget.value.componentsTree
      };
      if (shouldPersist) {
        saveLocalStorage(LOCALSTORAGE_KEY, {
          corner: signalWidget.value.corner,
          dimensions: signalWidget.value.dimensions,
          lastDimensions: signalWidget.value.lastDimensions,
          componentsTree: signalWidget.value.componentsTree
        });
      }
      updateDimensions();
    }, []);
    const handleDrag = q2(
      (e5) => {
        e5.preventDefault();
        if (!refWidget.current || e5.target.closest("button"))
          return;
        const container = refWidget.current;
        const containerStyle = container.style;
        const { dimensions } = signalWidget.value;
        const initialMouseX = e5.clientX;
        const initialMouseY = e5.clientY;
        const initialX = dimensions.position.x;
        const initialY = dimensions.position.y;
        let currentX = initialX;
        let currentY = initialY;
        let rafId = null;
        let hasMoved = false;
        let lastMouseX = initialMouseX;
        let lastMouseY = initialMouseY;
        const handlePointerMove = (e6) => {
          if (rafId) return;
          hasMoved = true;
          lastMouseX = e6.clientX;
          lastMouseY = e6.clientY;
          rafId = requestAnimationFrame(() => {
            const deltaX = lastMouseX - initialMouseX;
            const deltaY = lastMouseY - initialMouseY;
            currentX = Number(initialX) + deltaX;
            currentY = Number(initialY) + deltaY;
            containerStyle.transition = "none";
            containerStyle.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            const widgetRight = currentX + dimensions.width;
            const widgetBottom = currentY + dimensions.height;
            const outsideLeft = Math.max(0, -currentX);
            const outsideRight = Math.max(0, widgetRight - window.innerWidth);
            const outsideTop = Math.max(0, -currentY);
            const outsideBottom = Math.max(0, widgetBottom - window.innerHeight);
            const horizontalOutside = Math.min(
              dimensions.width,
              outsideLeft + outsideRight
            );
            const verticalOutside = Math.min(
              dimensions.height,
              outsideTop + outsideBottom
            );
            const areaOutside = horizontalOutside * dimensions.height + verticalOutside * dimensions.width - horizontalOutside * verticalOutside;
            const totalArea = dimensions.width * dimensions.height;
            let shouldCollapse = areaOutside > totalArea * 0.35;
            if (!shouldCollapse && ReactScanInternals.options.value.showFPS) {
              const fpsRight = currentX + dimensions.width;
              const fpsLeft = fpsRight - 100;
              const fpsFullyOutside = fpsRight <= 0 || fpsLeft >= window.innerWidth || currentY + dimensions.height <= 0 || currentY >= window.innerHeight;
              shouldCollapse = fpsFullyOutside;
            }
            if (shouldCollapse) {
              const widgetCenterX = currentX + dimensions.width / 2;
              const widgetCenterY = currentY + dimensions.height / 2;
              const screenCenterX = window.innerWidth / 2;
              const screenCenterY = window.innerHeight / 2;
              let targetCorner;
              if (widgetCenterX < screenCenterX) {
                targetCorner = widgetCenterY < screenCenterY ? "top-left" : "bottom-left";
              } else {
                targetCorner = widgetCenterY < screenCenterY ? "top-right" : "bottom-right";
              }
              let orientation;
              const horizontalOverflow = Math.max(outsideLeft, outsideRight);
              const verticalOverflow = Math.max(outsideTop, outsideBottom);
              orientation = horizontalOverflow > verticalOverflow ? "horizontal" : "vertical";
              signalWidget.value = {
                ...signalWidget.value,
                corner: targetCorner,
                lastDimensions: {
                  ...dimensions,
                  position: calculatePosition(
                    targetCorner,
                    dimensions.width,
                    dimensions.height
                  )
                }
              };
              const collapsedPosition = {
                corner: targetCorner,
                orientation
              };
              signalWidgetCollapsed.value = collapsedPosition;
              saveLocalStorage(LOCALSTORAGE_COLLAPSED_KEY, collapsedPosition);
              saveLocalStorage(LOCALSTORAGE_KEY, signalWidget.value);
              updateWidgetPosition(false);
              document.removeEventListener("pointermove", handlePointerMove);
              document.removeEventListener("pointerup", handlePointerEnd);
              if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
              }
            }
            rafId = null;
          });
        };
        const handlePointerEnd = () => {
          if (!container) return;
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          document.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("pointerup", handlePointerEnd);
          const totalDeltaX = Math.abs(lastMouseX - initialMouseX);
          const totalDeltaY = Math.abs(lastMouseY - initialMouseY);
          const totalMovement = Math.sqrt(
            totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY
          );
          if (!hasMoved || totalMovement < 60) return;
          const newCorner = getBestCorner(
            lastMouseX,
            lastMouseY,
            initialMouseX,
            initialMouseY,
            Store.inspectState.value.kind === "focused" ? 80 : 40
          );
          if (newCorner === signalWidget.value.corner) {
            containerStyle.transition = "transform 0.25s cubic-bezier(0, 0, 0.2, 1)";
            const currentPosition = signalWidget.value.dimensions.position;
            requestAnimationFrame(() => {
              containerStyle.transform = `translate3d(${currentPosition.x}px, ${currentPosition.y}px, 0)`;
            });
            return;
          }
          const snappedPosition = calculatePosition(
            newCorner,
            dimensions.width,
            dimensions.height
          );
          if (currentX === initialX && currentY === initialY) return;
          const onTransitionEnd = () => {
            containerStyle.transition = "none";
            updateDimensions();
            container.removeEventListener("transitionend", onTransitionEnd);
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
          };
          container.addEventListener("transitionend", onTransitionEnd);
          containerStyle.transition = "transform 0.25s cubic-bezier(0, 0, 0.2, 1)";
          requestAnimationFrame(() => {
            containerStyle.transform = `translate3d(${snappedPosition.x}px, ${snappedPosition.y}px, 0)`;
          });
          signalWidget.value = {
            corner: newCorner,
            dimensions: {
              isFullWidth: dimensions.isFullWidth,
              isFullHeight: dimensions.isFullHeight,
              width: dimensions.width,
              height: dimensions.height,
              position: snappedPosition
            },
            lastDimensions: signalWidget.value.lastDimensions,
            componentsTree: signalWidget.value.componentsTree
          };
          saveLocalStorage(LOCALSTORAGE_KEY, {
            corner: newCorner,
            dimensions: signalWidget.value.dimensions,
            lastDimensions: signalWidget.value.lastDimensions,
            componentsTree: signalWidget.value.componentsTree
          });
        };
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerEnd);
      },
      []
    );
    const handleCollapsedDrag = q2(
      (e5) => {
        e5.preventDefault();
        if (!refWidget.current || !signalWidgetCollapsed.value) return;
        const { corner: collapsedCorner, orientation = "horizontal" } = signalWidgetCollapsed.value;
        const initialMouseX = e5.clientX;
        const initialMouseY = e5.clientY;
        let rafId = null;
        let hasExpanded = false;
        const DRAG_THRESHOLD = 50;
        const handlePointerMove = (e6) => {
          if (hasExpanded || rafId) return;
          const deltaX = e6.clientX - initialMouseX;
          const deltaY = e6.clientY - initialMouseY;
          let shouldExpand = false;
          if (orientation === "horizontal") {
            if (collapsedCorner.endsWith("left") && deltaX > DRAG_THRESHOLD) {
              shouldExpand = true;
            } else if (collapsedCorner.endsWith("right") && deltaX < -DRAG_THRESHOLD) {
              shouldExpand = true;
            }
          } else {
            if (collapsedCorner.startsWith("top") && deltaY > DRAG_THRESHOLD) {
              shouldExpand = true;
            } else if (collapsedCorner.startsWith("bottom") && deltaY < -DRAG_THRESHOLD) {
              shouldExpand = true;
            }
          }
          if (shouldExpand) {
            hasExpanded = true;
            signalWidgetCollapsed.value = null;
            saveLocalStorage(LOCALSTORAGE_COLLAPSED_KEY, null);
            if (refInitialMinimizedWidth.current === 0 && refWidget.current) {
              requestAnimationFrame(() => {
                if (refWidget.current) {
                  refWidget.current.style.width = "min-content";
                  const naturalWidth = refWidget.current.offsetWidth;
                  refInitialMinimizedWidth.current = naturalWidth || 300;
                  const lastDims = signalWidget.value.lastDimensions;
                  const targetWidth = calculateBoundedSize(
                    lastDims.width,
                    0,
                    true
                  );
                  const targetHeight = calculateBoundedSize(
                    lastDims.height,
                    0,
                    false
                  );
                  let newX = e6.clientX - targetWidth / 2;
                  let newY = e6.clientY - targetHeight / 2;
                  newX = Math.max(
                    SAFE_AREA,
                    Math.min(newX, window.innerWidth - targetWidth - SAFE_AREA)
                  );
                  newY = Math.max(
                    SAFE_AREA,
                    Math.min(newY, window.innerHeight - targetHeight - SAFE_AREA)
                  );
                  signalWidget.value = {
                    ...signalWidget.value,
                    dimensions: {
                      ...signalWidget.value.dimensions,
                      position: { x: newX, y: newY }
                    }
                  };
                  updateWidgetPosition(true);
                  const savedView = readLocalStorage(
                    LOCALSTORAGE_LAST_VIEW_KEY
                  );
                  signalWidgetViews.value = savedView || { view: "none" };
                  setTimeout(() => {
                    if (refWidget.current) {
                      const dragEvent = new PointerEvent("pointerdown", {
                        clientX: e6.clientX,
                        clientY: e6.clientY,
                        pointerId: e6.pointerId,
                        bubbles: true
                      });
                      refWidget.current.dispatchEvent(dragEvent);
                    }
                  }, 100);
                }
              });
            } else {
              updateWidgetPosition(true);
              const savedView = readLocalStorage(
                LOCALSTORAGE_LAST_VIEW_KEY
              );
              signalWidgetViews.value = savedView || { view: "none" };
            }
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerEnd);
          }
        };
        const handlePointerEnd = () => {
          document.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("pointerup", handlePointerEnd);
        };
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerEnd);
      },
      []
    );
    y3(() => {
      if (!refWidget.current) return;
      removeLocalStorage(LOCALSTORAGE_LAST_VIEW_KEY);
      if (!signalWidgetCollapsed.value) {
        refWidget.current.style.width = "min-content";
        refInitialMinimizedHeight.current = 36;
        refInitialMinimizedWidth.current = refWidget.current.offsetWidth;
      } else {
        refInitialMinimizedHeight.current = 36;
        refInitialMinimizedWidth.current = 0;
      }
      refWidget.current.style.maxWidth = `calc(100vw - ${SAFE_AREA * 2}px)`;
      refWidget.current.style.maxHeight = `calc(100vh - ${SAFE_AREA * 2}px)`;
      updateWidgetPosition();
      if (Store.inspectState.value.kind !== "focused" && !signalWidgetCollapsed.value && !refExpandingFromCollapsed.current) {
        signalWidget.value = {
          ...signalWidget.value,
          dimensions: {
            isFullWidth: false,
            isFullHeight: false,
            width: refInitialMinimizedWidth.current,
            height: refInitialMinimizedHeight.current,
            position: signalWidget.value.dimensions.position
          }
        };
      }
      signalRefWidget.value = refWidget.current;
      const unsubscribeSignalWidget = signalWidget.subscribe((widget) => {
        if (!refWidget.current) return;
        const { x: x5, y: y5 } = widget.dimensions.position;
        const { width, height } = widget.dimensions;
        const container = refWidget.current;
        requestAnimationFrame(() => {
          container.style.transform = `translate3d(${x5}px, ${y5}px, 0)`;
          container.style.width = `${width}px`;
          container.style.height = `${height}px`;
        });
      });
      const unsubscribeSignalWidgetViews = signalWidgetViews.subscribe(
        (state) => {
          refShouldOpen.current = state.view !== "none";
          updateWidgetPosition();
          if (!signalWidgetCollapsed.value) {
            if (state.view !== "none") {
              saveLocalStorage(LOCALSTORAGE_LAST_VIEW_KEY, state);
            } else {
              removeLocalStorage(LOCALSTORAGE_LAST_VIEW_KEY);
            }
          }
        }
      );
      const unsubscribeStoreInspectState = Store.inspectState.subscribe(
        (state) => {
          refShouldOpen.current = state.kind === "focused";
          updateWidgetPosition();
        }
      );
      const handleWindowResize = () => {
        updateWidgetPosition(true);
      };
      window.addEventListener("resize", handleWindowResize, { passive: true });
      return () => {
        window.removeEventListener("resize", handleWindowResize);
        unsubscribeSignalWidgetViews();
        unsubscribeStoreInspectState();
        unsubscribeSignalWidget();
        saveLocalStorage(LOCALSTORAGE_KEY, {
          ...defaultWidgetConfig,
          corner: signalWidget.value.corner
        });
      };
    }, []);
    const [_6, setTriggerRender] = d4(false);
    y3(() => {
      setTriggerRender(true);
    }, []);
    const isCollapsed = signalWidgetCollapsed.value;
    let arrowRotationClass = "";
    if (isCollapsed) {
      const { orientation = "horizontal", corner } = isCollapsed;
      if (orientation === "horizontal") {
        arrowRotationClass = corner?.endsWith("right") ? "rotate-180" : "";
      } else {
        arrowRotationClass = corner?.startsWith("bottom") ? "-rotate-90" : "rotate-90";
      }
    }
    return /* @__PURE__ */ u6(k2, { children: [
      /* @__PURE__ */ u6(ScanOverlay, {}),
      /* @__PURE__ */ u6(ToolbarElementContext.Provider, { value: refWidget.current, children: /* @__PURE__ */ u6(
        "div",
        {
          id: "react-scan-toolbar",
          dir: "ltr",
          ref: refWidget,
          onPointerDown: !isCollapsed ? handleDrag : handleCollapsedDrag,
          className: cn2(
            "fixed inset-0",
            isCollapsed ? (() => {
              const { orientation = "horizontal", corner } = isCollapsed;
              if (orientation === "horizontal") {
                return corner?.endsWith("right") ? "rounded-tl-lg rounded-bl-lg shadow-lg" : "rounded-tr-lg rounded-br-lg shadow-lg";
              } else {
                return corner?.startsWith("bottom") ? "rounded-tl-lg rounded-tr-lg shadow-lg" : "rounded-bl-lg rounded-br-lg shadow-lg";
              }
            })() : "rounded-lg shadow-lg",
            "flex flex-col",
            "font-mono text-[13px]",
            "user-select-none",
            "opacity-0",
            isCollapsed ? "cursor-pointer" : "cursor-move",
            "z-[124124124124]",
            "animate-fade-in animation-duration-300 animation-delay-300",
            "will-change-transform",
            "[touch-action:none]"
          ),
          style: { WebkitAppRegion: "no-drag" },
          children: isCollapsed ? /* @__PURE__ */ u6(
            "button",
            {
              type: "button",
              onClick: () => {
                signalWidgetCollapsed.value = null;
                saveLocalStorage(LOCALSTORAGE_COLLAPSED_KEY, null);
                if (refInitialMinimizedWidth.current === 0 && refWidget.current) {
                  requestAnimationFrame(() => {
                    if (refWidget.current) {
                      refWidget.current.style.width = "min-content";
                      const naturalWidth = refWidget.current.offsetWidth;
                      refInitialMinimizedWidth.current = naturalWidth || 300;
                      updateWidgetPosition(true);
                    }
                  });
                }
                const savedView = readLocalStorage(
                  LOCALSTORAGE_LAST_VIEW_KEY
                );
                signalWidgetViews.value = savedView || { view: "none" };
              },
              className: "flex items-center justify-center w-full h-full text-white",
              title: "Expand toolbar",
              children: /* @__PURE__ */ u6(
                Icon,
                {
                  name: "icon-chevron-right",
                  size: 16,
                  className: cn2("transition-transform", arrowRotationClass)
                }
              )
            }
          ) : /* @__PURE__ */ u6(k2, { children: [
            /* @__PURE__ */ u6(ResizeHandle, { position: "top" }),
            /* @__PURE__ */ u6(ResizeHandle, { position: "bottom" }),
            /* @__PURE__ */ u6(ResizeHandle, { position: "left" }),
            /* @__PURE__ */ u6(ResizeHandle, { position: "right" }),
            /* @__PURE__ */ u6(Content, {})
          ] })
        }
      ) })
    ] });
  };
  var ToolbarElementContext = K2(null);

  // src/web/components/svg-sprite/index.tsx
  var SvgSprite = () => {
    return /* @__PURE__ */ u6("svg", { xmlns: "http://www.w3.org/2000/svg", style: "display: none;", children: [
      /* @__PURE__ */ u6("title", { children: "React Scan Icons" }),
      /* @__PURE__ */ u6("symbol", { id: "icon-inspect", viewBox: "0 0 24 24", fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z" }),
        /* @__PURE__ */ u6("path", { d: "M5 3a2 2 0 0 0-2 2" }),
        /* @__PURE__ */ u6("path", { d: "M19 3a2 2 0 0 1 2 2" }),
        /* @__PURE__ */ u6("path", { d: "M5 21a2 2 0 0 1-2-2" }),
        /* @__PURE__ */ u6("path", { d: "M9 3h1" }),
        /* @__PURE__ */ u6("path", { d: "M9 21h2" }),
        /* @__PURE__ */ u6("path", { d: "M14 3h1" }),
        /* @__PURE__ */ u6("path", { d: "M3 9v1" }),
        /* @__PURE__ */ u6("path", { d: "M21 9v2" }),
        /* @__PURE__ */ u6("path", { d: "M3 14v1" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-focus", viewBox: "0 0 24 24", fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z" }),
        /* @__PURE__ */ u6("path", { d: "M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-next", viewBox: "0 0 24 24", fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: /* @__PURE__ */ u6("path", { d: "M6 9h6V5l7 7-7 7v-4H6V9z" }) }),
      /* @__PURE__ */ u6("symbol", { id: "icon-previous", viewBox: "0 0 24 24", fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: /* @__PURE__ */ u6("path", { d: "M18 15h-6v4l-7-7 7-7v4h6v6z" }) }),
      /* @__PURE__ */ u6("symbol", { id: "icon-close", viewBox: "0 0 24 24", fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
        /* @__PURE__ */ u6("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-replay", viewBox: "0 0 24 24", fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "M3 7V5a2 2 0 0 1 2-2h2" }),
        /* @__PURE__ */ u6("path", { d: "M17 3h2a2 2 0 0 1 2 2v2" }),
        /* @__PURE__ */ u6("path", { d: "M21 17v2a2 2 0 0 1-2 2h-2" }),
        /* @__PURE__ */ u6("path", { d: "M7 21H5a2 2 0 0 1-2-2v-2" }),
        /* @__PURE__ */ u6("circle", { cx: "12", cy: "12", r: "1" }),
        /* @__PURE__ */ u6("path", { d: "M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-ellipsis", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("circle", { cx: "12", cy: "12", r: "1" }),
        /* @__PURE__ */ u6("circle", { cx: "19", cy: "12", r: "1" }),
        /* @__PURE__ */ u6("circle", { cx: "5", cy: "12", r: "1" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-copy", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }),
        /* @__PURE__ */ u6("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: /* @__PURE__ */ u6("path", { d: "M20 6 9 17l-5-5" }) }),
      /* @__PURE__ */ u6("symbol", { id: "icon-chevron-right", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: /* @__PURE__ */ u6("path", { d: "m9 18 6-6-6-6" }) }),
      /* @__PURE__ */ u6("symbol", { id: "icon-settings", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }),
        /* @__PURE__ */ u6("circle", { cx: "12", cy: "12", r: "3" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-flame", viewBox: "0 0 24 24", children: /* @__PURE__ */ u6("path", { d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" }) }),
      /* @__PURE__ */ u6("symbol", { id: "icon-function", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }),
        /* @__PURE__ */ u6("path", { d: "M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3" }),
        /* @__PURE__ */ u6("path", { d: "M9 11.2h5.7" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-triangle-alert", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }),
        /* @__PURE__ */ u6("path", { d: "M12 9v4" }),
        /* @__PURE__ */ u6("path", { d: "M12 17h.01" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-gallery-horizontal-end", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "M2 7v10" }),
        /* @__PURE__ */ u6("path", { d: "M6 5v14" }),
        /* @__PURE__ */ u6("rect", { width: "12", height: "18", x: "10", y: "3", rx: "2" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-search", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("circle", { cx: "11", cy: "11", r: "8" }),
        /* @__PURE__ */ u6("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-lock", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }),
        /* @__PURE__ */ u6("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-lock-open", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }),
        /* @__PURE__ */ u6("path", { d: "M7 11V7a5 5 0 0 1 9.9-1" })
      ] }),
      /* @__PURE__ */ u6("symbol", { id: "icon-sanil", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", children: [
        /* @__PURE__ */ u6("path", { d: "M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0" }),
        /* @__PURE__ */ u6("circle", { cx: "10", cy: "13", r: "8" }),
        /* @__PURE__ */ u6("path", { d: "M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6" }),
        /* @__PURE__ */ u6("path", { d: "M18 3 19.1 5.2" })
      ] })
    ] });
  };

  // src/web/toolbar.tsx
  var ToolbarErrorBoundary = class extends x2 {
    constructor() {
      super(...arguments);
      this.state = { hasError: false, error: null };
      this.handleReset = () => {
        this.setState({ hasError: false, error: null });
      };
    }
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    render() {
      if (this.state.hasError) {
        return /* @__PURE__ */ u6("div", { className: "fixed bottom-4 right-4 z-[124124124124]", children: /* @__PURE__ */ u6("div", { className: "p-3 bg-black rounded-lg shadow-lg w-80", children: [
          /* @__PURE__ */ u6("div", { className: "flex items-center gap-2 mb-2 text-red-400 text-sm font-medium", children: [
            /* @__PURE__ */ u6(Icon, { name: "icon-flame", className: "text-red-500", size: 14 }),
            "React Scan ran into a problem"
          ] }),
          /* @__PURE__ */ u6("div", { className: "p-2 bg-black rounded font-mono text-xs text-red-300 mb-3 break-words", children: this.state.error?.message || JSON.stringify(this.state.error) }),
          /* @__PURE__ */ u6(
            "button",
            {
              type: "button",
              onClick: this.handleReset,
              className: "px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
              children: "Restart"
            }
          )
        ] }) });
      }
      return this.props.children;
    }
  };
  var createToolbar = (root) => {
    const container = document.createElement("div");
    container.id = "react-scan-toolbar-root";
    window.__REACT_SCAN_TOOLBAR_CONTAINER__ = container;
    root.appendChild(container);
    E2(
      /* @__PURE__ */ u6(ToolbarErrorBoundary, { children: /* @__PURE__ */ u6(k2, { children: [
        /* @__PURE__ */ u6(SvgSprite, {}),
        /* @__PURE__ */ u6(Widget, {})
      ] }) }),
      container
    );
    const originalRemove = container.remove.bind(container);
    container.remove = () => {
      window.__REACT_SCAN_TOOLBAR_CONTAINER__ = void 0;
      if (container.hasChildNodes()) {
        E2(null, container);
        E2(null, container);
      }
      originalRemove();
    };
    return container;
  };

  // package.json
  var package_default = {
    version: "0.5.2"};

  // src/core/index.ts
  var rootContainer = null;
  var shadowRoot = null;
  var initRootContainer = () => {
    if (rootContainer && shadowRoot) {
      return { rootContainer, shadowRoot };
    }
    rootContainer = document.createElement("div");
    rootContainer.id = "react-scan-root";
    shadowRoot = rootContainer.attachShadow({ mode: "open" });
    const cssStyles = document.createElement("style");
    cssStyles.textContent = styles_default;
    shadowRoot.appendChild(cssStyles);
    document.documentElement.appendChild(rootContainer);
    return { rootContainer, shadowRoot };
  };
  var Store = {
    wasDetailsOpen: d5(true),
    isInIframe: d5(IS_CLIENT && window.self !== window.top),
    inspectState: d5({
      kind: "uninitialized"
    }),
    fiberRoots: /* @__PURE__ */ new Set(),
    reportData: /* @__PURE__ */ new Map(),
    legacyReportData: /* @__PURE__ */ new Map(),
    lastReportTime: d5(0),
    interactionListeningForRenders: null,
    changesListeners: /* @__PURE__ */ new Map()
  };
  var ReactScanInternals = {
    instrumentation: null,
    componentAllowList: null,
    options: d5({
      enabled: true,
      log: false,
      showToolbar: true,
      animationSpeed: "fast",
      dangerouslyForceRunInProduction: false,
      showFPS: true,
      showNotificationCount: true,
      allowInIframe: false
    }),
    runInAllEnvironments: false,
    onRender: null,
    Store,
    version: package_default.version
  };
  if (IS_CLIENT && window.__REACT_SCAN_EXTENSION__) {
    window.__REACT_SCAN_VERSION__ = ReactScanInternals.version;
  }
  var applyLocalStorageOptions = (options) => {
    const {
      onCommitStart,
      onRender: onRender2,
      onCommitFinish,
      ...rest
    } = options;
    return rest;
  };
  var validateOptions = (options) => {
    const errors = [];
    const validOptions = {};
    for (const key in options) {
      const value = options[key];
      switch (key) {
        case "enabled":
        case "log":
        case "showToolbar":
        case "showNotificationCount":
        case "dangerouslyForceRunInProduction":
        case "showFPS":
        case "allowInIframe":
          if (typeof value !== "boolean") {
            errors.push(`- ${key} must be a boolean. Got "${value}"`);
          } else {
            validOptions[key] = value;
          }
          break;
        case "animationSpeed":
          if (!["slow", "fast", "off"].includes(value)) {
            errors.push(
              `- Invalid animation speed "${value}". Using default "fast"`
            );
          } else {
            validOptions[key] = value;
          }
          break;
        case "onCommitStart":
          if (typeof value !== "function") {
            errors.push(`- ${key} must be a function. Got "${value}"`);
          } else {
            validOptions.onCommitStart = value;
          }
          break;
        case "onCommitFinish":
          if (typeof value !== "function") {
            errors.push(`- ${key} must be a function. Got "${value}"`);
          } else {
            validOptions.onCommitFinish = value;
          }
          break;
        case "onRender":
          if (typeof value !== "function") {
            errors.push(`- ${key} must be a function. Got "${value}"`);
          } else {
            validOptions.onRender = value;
          }
          break;
        default:
          errors.push(`- Unknown option "${key}"`);
      }
    }
    if (errors.length > 0) {
      console.warn(`[React Scan] Invalid options:
${errors.join("\n")}`);
    }
    return validOptions;
  };
  var getReport = (type) => {
    if (type) {
      for (const reportData of Array.from(Store.legacyReportData.values())) {
        if (reportData.type === type) {
          return reportData;
        }
      }
      return null;
    }
    return Store.legacyReportData;
  };
  var setOptions = (userOptions) => {
    try {
      const validOptions = validateOptions(userOptions);
      if (Object.keys(validOptions).length === 0) {
        return;
      }
      const shouldInitToolbar = "showToolbar" in validOptions && validOptions.showToolbar !== void 0;
      const newOptions = {
        ...ReactScanInternals.options.value,
        ...validOptions
      };
      const { instrumentation } = ReactScanInternals;
      if (instrumentation && "enabled" in validOptions) {
        instrumentation.isPaused.value = validOptions.enabled === false;
      }
      ReactScanInternals.options.value = newOptions;
      try {
        const existing = readLocalStorage(
          "react-scan-options"
        )?.enabled;
        if (typeof existing === "boolean") {
          newOptions.enabled = existing;
        }
      } catch (e5) {
        if (ReactScanInternals.options.value._debug === "verbose") {
          console.error(
            "[React Scan Internal Error]",
            "Failed to create notifications outline canvas",
            e5
          );
        }
      }
      saveLocalStorage(
        "react-scan-options",
        applyLocalStorageOptions(newOptions)
      );
      if (shouldInitToolbar) {
        initToolbar(!!newOptions.showToolbar);
      }
      return newOptions;
    } catch (e5) {
      if (ReactScanInternals.options.value._debug === "verbose") {
        console.error(
          "[React Scan Internal Error]",
          "Failed to create notifications outline canvas",
          e5
        );
      }
    }
  };
  var getOptions = () => ReactScanInternals.options;
  var isProduction = null;
  var rdtHook;
  var getIsProduction = () => {
    if (isProduction !== null) {
      return isProduction;
    }
    rdtHook ??= h();
    for (const renderer of rdtHook.renderers.values()) {
      const buildType = L(renderer);
      if (buildType === "production") {
        isProduction = true;
      }
    }
    return isProduction;
  };
  var start = () => {
    try {
      if (!IS_CLIENT) {
        return;
      }
      if (!ReactScanInternals.runInAllEnvironments && getIsProduction() && !ReactScanInternals.options.value.dangerouslyForceRunInProduction) {
        return;
      }
      const localStorageOptions = readLocalStorage("react-scan-options");
      if (localStorageOptions) {
        const validLocalOptions = validateOptions(localStorageOptions);
        if (Object.keys(validLocalOptions).length > 0) {
          ReactScanInternals.options.value = {
            ...ReactScanInternals.options.value,
            ...validLocalOptions
          };
        }
      }
      const options = getOptions();
      initReactScanInstrumentation(() => {
        initToolbar(!!options.value.showToolbar);
      });
      if (IS_CLIENT) {
        setTimeout(() => {
          if (Ee()) return;
          console.error(
            "[React Scan] Failed to load. Must import React Scan before React runs."
          );
        }, 5e3);
      }
    } catch (e5) {
      if (ReactScanInternals.options.value._debug === "verbose") {
        console.error(
          "[React Scan Internal Error]",
          "Failed to create notifications outline canvas",
          e5
        );
      }
    }
  };
  var initToolbar = (showToolbar) => {
    window.reactScanCleanupListeners?.();
    const cleanupTimingTracking = startTimingTracking();
    const cleanupOutlineCanvas = createNotificationsOutlineCanvas();
    window.reactScanCleanupListeners = () => {
      cleanupTimingTracking();
      cleanupOutlineCanvas?.();
    };
    const windowToolbarContainer = window.__REACT_SCAN_TOOLBAR_CONTAINER__;
    if (!showToolbar) {
      windowToolbarContainer?.remove();
      return;
    }
    windowToolbarContainer?.remove();
    const { shadowRoot: shadowRoot2 } = initRootContainer();
    createToolbar(shadowRoot2);
  };
  var createNotificationsOutlineCanvas = () => {
    try {
      const highlightRoot = document.documentElement;
      return createHighlightCanvas(highlightRoot);
    } catch (e5) {
      if (ReactScanInternals.options.value._debug === "verbose") {
        console.error(
          "[React Scan Internal Error]",
          "Failed to create notifications outline canvas",
          e5
        );
      }
    }
  };
  var scan = (options = {}) => {
    setOptions(options);
    const isInIframe = Store.isInIframe.value;
    if (isInIframe && !ReactScanInternals.options.value.allowInIframe && !ReactScanInternals.runInAllEnvironments) {
      return;
    }
    if (options.enabled === false && options.showToolbar !== true) {
      return;
    }
    start();
  };
  var useScan = (options = {}) => {
    setOptions(options);
    start();
  };
  var onRender = (type, _onRender) => {
    const prevOnRender = ReactScanInternals.onRender;
    ReactScanInternals.onRender = (fiber, renders) => {
      prevOnRender?.(fiber, renders);
      if (I(fiber.type) === type) {
        _onRender(fiber, renders);
      }
    };
  };
  var ignoredProps = /* @__PURE__ */ new WeakSet();
  var ignoreScan = (node) => {
    if (node && typeof node === "object") {
      ignoredProps.add(node);
    }
  };

  // src/auto.ts
  if (IS_CLIENT) {
    scan();
    window.reactScan = scan;
  }
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

  exports.ReactScanInternals = ReactScanInternals;
  exports.Store = Store;
  exports.getIsProduction = getIsProduction;
  exports.getOptions = getOptions;
  exports.getReport = getReport;
  exports.ignoreScan = ignoreScan;
  exports.ignoredProps = ignoredProps;
  exports.onRender = onRender;
  exports.scan = scan;
  exports.setOptions = setOptions;
  exports.start = start;
  exports.useScan = useScan;

  return exports;

})({});
