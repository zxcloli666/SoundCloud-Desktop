"use strict";
require('../../context-DpcDg_HU.cjs');
const require_webpack_like = require('../../webpack-like-CcGmGwl8.cjs');
const require_context$1 = require('../../context-BMwTIisg.cjs');
const require_utils = require('../../utils-CTvyqQEm.cjs');

//#region src/rspack/loaders/load.ts
async function load(source, map) {
	const callback = this.async();
	const { plugin } = this.query;
	let id = this.resource;
	if (!plugin?.load || !id) return callback(null, source, map);
	if (require_utils.isVirtualModuleId(id, plugin)) id = require_utils.decodeVirtualModuleId(id, plugin);
	const context = require_context$1.createContext$1(this);
	const res = await plugin.load.call(Object.assign({}, this._compilation && require_context$1.createBuildContext$1(this._compiler, this._compilation, this), context), require_webpack_like.normalizeAbsolutePath(id));
	if (res == null) callback(null, source, map);
else if (typeof res !== "string") callback(null, res.code, res.map ?? map);
else callback(null, res, map);
}

//#endregion
module.exports = load;