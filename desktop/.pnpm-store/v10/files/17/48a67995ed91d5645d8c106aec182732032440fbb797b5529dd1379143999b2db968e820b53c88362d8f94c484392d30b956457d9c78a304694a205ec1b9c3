"use strict";
require('../../context-DpcDg_HU.cjs');
const require_context$1 = require('../../context-BMwTIisg.cjs');

//#region src/rspack/loaders/transform.ts
async function transform(source, map) {
	const callback = this.async();
	const { plugin } = this.query;
	if (!plugin?.transform) return callback(null, source, map);
	const id = this.resource;
	const context = require_context$1.createContext$1(this);
	const res = await plugin.transform.call(Object.assign({}, this._compilation && require_context$1.createBuildContext$1(this._compiler, this._compilation, this), context), source, id);
	if (res == null) callback(null, source, map);
else if (typeof res !== "string") callback(null, res.code, map == null ? map : res.map || map);
else callback(null, res, map);
}

//#endregion
module.exports = transform;