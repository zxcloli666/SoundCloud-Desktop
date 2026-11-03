"use strict";
require('../../context-DpcDg_HU.cjs');
const require_context$1 = require('../../context-wnIdYOoj.cjs');

//#region src/webpack/loaders/transform.ts
async function transform(source, map) {
	const callback = this.async();
	const { plugin } = this.query;
	if (!plugin?.transform) return callback(null, source, map);
	const context = require_context$1.createContext(this);
	const res = await plugin.transform.call(Object.assign({}, require_context$1.createBuildContext({
		addWatchFile: (file) => {
			this.addDependency(file);
		},
		getWatchFiles: () => {
			return this.getDependencies();
		}
	}, this._compiler, this._compilation, this), context), source, this.resource);
	if (res == null) callback(null, source, map);
else if (typeof res !== "string") callback(null, res.code, map == null ? map : res.map || map);
else callback(null, res, map);
}

//#endregion
module.exports = transform;