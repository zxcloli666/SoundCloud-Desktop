"use strict";
require('../../context-DpcDg_HU.cjs');
const require_webpack_like = require('../../webpack-like-CcGmGwl8.cjs');
const require_context$1 = require('../../context-wnIdYOoj.cjs');

//#region src/webpack/loaders/load.ts
async function load(source, map) {
	const callback = this.async();
	const { plugin } = this.query;
	let id = this.resource;
	if (!plugin?.load || !id) return callback(null, source, map);
	if (id.startsWith(plugin.__virtualModulePrefix)) id = decodeURIComponent(id.slice(plugin.__virtualModulePrefix.length));
	const context = require_context$1.createContext(this);
	const res = await plugin.load.call(Object.assign({}, require_context$1.createBuildContext({
		addWatchFile: (file) => {
			this.addDependency(file);
		},
		getWatchFiles: () => {
			return this.getDependencies();
		}
	}, this._compiler, this._compilation, this), context), require_webpack_like.normalizeAbsolutePath(id));
	if (res == null) callback(null, source, map);
else if (typeof res !== "string") callback(null, res.code, res.map ?? map);
else callback(null, res, map);
}

//#endregion
module.exports = load;