import "../../context-CyqyI0ug.js";
import { createBuildContext, createContext } from "../../context-BIfGOl2h.js";

//#region src/rspack/loaders/transform.ts
async function transform(source, map) {
	const callback = this.async();
	const { plugin } = this.query;
	if (!plugin?.transform) return callback(null, source, map);
	const id = this.resource;
	const context = createContext(this);
	const res = await plugin.transform.call(Object.assign({}, this._compilation && createBuildContext(this._compiler, this._compilation, this), context), source, id);
	if (res == null) callback(null, source, map);
else if (typeof res !== "string") callback(null, res.code, map == null ? map : res.map || map);
else callback(null, res, map);
}

//#endregion
export { transform as default };