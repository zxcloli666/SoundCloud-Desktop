'use strict';

var submenu = require('./menu/submenu.cjs');
var menuItem = require('./menu/menuItem.cjs');
var menu = require('./menu/menu.cjs');
var checkMenuItem = require('./menu/checkMenuItem.cjs');
var iconMenuItem = require('./menu/iconMenuItem.cjs');
var predefinedMenuItem = require('./menu/predefinedMenuItem.cjs');

// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT
/**
 * Build native application, window and context menus.
 *
 * A {@linkcode Menu} holds items ({@linkcode MenuItem}, {@linkcode CheckMenuItem},
 * {@linkcode IconMenuItem}, {@linkcode PredefinedMenuItem}) and {@linkcode Submenu}s.
 * Use `Menu.setAsAppMenu()` for the macOS application menu, `Menu.setAsWindowMenu()`
 * for the Windows/Linux window menu bar, or `Menu.popup()` for a context menu.
 *
 * Menus live on the Rust side, the frontend only holds handles to them, so keep a
 * reference to a menu for as long as it is in use.
 *
 * This package is also accessible with `window.__TAURI__.menu` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
 *
 * @remarks All commands used by this module are part of the `core:menu:default`
 * permission set, which is enabled by default, so no extra capability
 * configuration is needed. Menu item icons additionally require the `image-png` /
 * `image-ico` Cargo features of the `tauri` crate.
 *
 * @module
 */

exports.Submenu = submenu.Submenu;
exports.itemFromKind = submenu.itemFromKind;
exports.MenuItem = menuItem.MenuItem;
exports.Menu = menu.Menu;
exports.CheckMenuItem = checkMenuItem.CheckMenuItem;
exports.IconMenuItem = iconMenuItem.IconMenuItem;
Object.defineProperty(exports, "NativeIcon", {
	enumerable: true,
	get: function () { return iconMenuItem.NativeIcon; }
});
exports.PredefinedMenuItem = predefinedMenuItem.PredefinedMenuItem;
