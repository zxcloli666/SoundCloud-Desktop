import "../../context-CyqyI0ug.js";
import { normalizeAbsolutePath } from "../../webpack-like-D2Xnrc0I.js";
import { createBuildContext, createContext } from "../../context-BIfGOl2h.js";
import { decodeVirtualModuleId, isVirtualModuleId } from "../../utils-B98x5nrp.js";

//#region src/rspack/loaders/load.ts
async function load(source, map) {
	const callback = this.async();
	const { plugin } = this.query;
	let id = this.resource;
	if (!plugin?.load || !id) return callback(null, source, map);
	if (isVirtualModuleId(id, plugin)) id = decodeVirtualModuleId(id, plugin);
	const context = createContext(this);
	const res = await plugin.load.call(Object.assign({}, this._compilation && createBuildContext(this._compiler, this._compilation, this), context), normalizeAbsolutePath(id));
	if (res == null) callback(null, source, map);
else if (typeof res !== "string") callback(null, res.code, res.map ?? map);
else callback(null, res, map);
}

//#endregion
export { load as default };