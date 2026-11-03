"use strict";
const require_context = require('./context-DpcDg_HU.cjs');
const node_path = require_context.__toESM(require("node:path"));

//#region src/utils/webpack-like.ts
function transformUse(data, plugin, transformLoader) {
	if (data.resource == null) return [];
	const id = normalizeAbsolutePath(data.resource + (data.resourceQuery || ""));
	if (!plugin.transformInclude || plugin.transformInclude(id)) return [{
		loader: transformLoader,
		options: { plugin },
		ident: plugin.name
	}];
	return [];
}
function normalizeAbsolutePath(path) {
	if ((0, node_path.isAbsolute)(path)) return (0, node_path.normalize)(path);
else return path;
}

//#endregion
Object.defineProperty(exports, 'normalizeAbsolutePath', {
  enumerable: true,
  get: function () {
    return normalizeAbsolutePath;
  }
});Object.defineProperty(exports, 'transformUse', {
  enumerable: true,
  get: function () {
    return transformUse;
  }
});