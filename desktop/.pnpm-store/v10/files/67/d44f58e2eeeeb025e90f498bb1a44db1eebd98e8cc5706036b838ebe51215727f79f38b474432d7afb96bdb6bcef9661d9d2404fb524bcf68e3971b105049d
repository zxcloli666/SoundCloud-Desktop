import { transformAsync } from '@babel/core';
import { createFilter } from '@rollup/pluginutils';
import { createUnplugin } from 'unplugin';
import * as t2 from '@babel/types';

// src/react-component-name/index.ts

// src/react-component-name/babel/is-componentish-name.ts
function isComponentishName(name, flags) {
  return name[0] >= "A" && name[0] <= "Z" && !flags?.ignoreComponentSubstrings?.some(
    (substring) => name.includes(substring)
  );
}

// src/react-component-name/babel/is-path-valid.ts
var isPathValid = (path, key) => {
  return key(path.node);
};

// src/react-component-name/babel/is-nested-expression.ts
var isNestedExpression = (node) => {
  switch (node.type) {
    case "ParenthesizedExpression":
    case "TypeCastExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
    case "TSInstantiationExpression":
      return true;
    default:
      return false;
  }
};

// src/react-component-name/babel/unwrap.ts
var unwrapNode = (node, key) => {
  if (!node) {
    return void 0;
  }
  if (key(node)) {
    return node;
  }
  if (isNestedExpression(node)) {
    return unwrapNode(node.expression, key);
  }
  return void 0;
};
var unwrapPath = (path, key) => {
  if (isPathValid(path, key)) {
    return path;
  }
  if (isPathValid(path, isNestedExpression)) {
    return unwrapPath(path.get("expression"), key);
  }
  return void 0;
};

// src/react-component-name/babel/path-references-import.ts
var pathReferencesImport = (path, moduleSource, importName, asType, defaultNamespace = false) => {
  const identifier2 = unwrapPath(path, t2.isIdentifier);
  if (identifier2) {
    const binding = path.scope.getBinding(identifier2.node.name);
    if (binding && binding.kind === "module") {
      const importPath = binding.path;
      const importParent = importPath.parentPath;
      if (isPathValid(importParent, t2.isImportDeclaration) && importParent.node.source.value === moduleSource) {
        if (isPathValid(importPath, t2.isImportSpecifier)) {
          const key = t2.isIdentifier(importPath.node.imported) ? importPath.node.imported.name : importPath.node.imported.value;
          return importName.includes(key);
        }
        if (isPathValid(importPath, t2.isImportDefaultSpecifier)) {
          return importName.includes("default");
        }
        if (isPathValid(importPath, t2.isImportNamespaceSpecifier)) {
          return importName.includes("*");
        }
      }
    }
    return false;
  }
  const memberExpr = unwrapPath(path, t2.isMemberExpression) || unwrapPath(path, t2.isOptionalMemberExpression);
  if (memberExpr) {
    const object = unwrapPath(memberExpr.get("object"), t2.isIdentifier);
    if (!object) {
      return false;
    }
    const property = memberExpr.get("property");
    if (isPathValid(property, t2.isIdentifier)) {
      return importName.includes(property.node.name) && (pathReferencesImport(object, moduleSource, ["*"]) || defaultNamespace && pathReferencesImport(object, moduleSource, ["default"]));
    }
    if (isPathValid(property, t2.isStringLiteral)) {
      return importName.includes(property.node.value) && (pathReferencesImport(object, moduleSource, ["*"]) || defaultNamespace && pathReferencesImport(object, moduleSource, ["default"]));
    }
  }
  return false;
};

// src/react-component-name/babel/index.ts
function getAssignedDisplayNames(path) {
  const names = /* @__PURE__ */ new Set();
  path.traverse({
    AssignmentExpression(path2) {
      const { node } = path2;
      const memberExpr = unwrapNode(node.left, t2.isMemberExpression);
      if (!memberExpr) {
        return;
      }
      const object = unwrapNode(memberExpr.object, t2.isIdentifier);
      if (!object) {
        return;
      }
      if (t2.isIdentifier(memberExpr.property) && memberExpr.property.name === "displayName") {
        names.add(object.name);
      }
    }
  });
  return names;
}
function isValidFunction(node) {
  return t2.isArrowFunctionExpression(node) || t2.isFunctionExpression(node);
}
function assignDisplayName(statement, name, dontAddTryCatch = false) {
  if (dontAddTryCatch) {
    statement.insertAfter([
      t2.expressionStatement(
        t2.assignmentExpression(
          "=",
          t2.memberExpression(t2.identifier(name), t2.identifier("displayName")),
          t2.stringLiteral(name)
        )
      )
    ]);
  } else {
    statement.insertAfter([
      t2.tryStatement(
        t2.blockStatement([
          t2.expressionStatement(
            t2.assignmentExpression(
              "=",
              t2.memberExpression(
                t2.identifier(name),
                t2.identifier("displayName")
              ),
              t2.stringLiteral(name)
            )
          )
        ]),
        t2.catchClause(t2.identifier("error"), t2.blockStatement([]))
      )
    ]);
  }
}
var REACT_CLASS = ["Component", "PureComponent"];
function isNamespaceExport(namespace, moduleExports, path) {
  const identifier2 = unwrapPath(path, t2.isIdentifier);
  if (identifier2) {
    return moduleExports.includes(identifier2.node.name);
  }
  const memberExpr = unwrapPath(path, t2.isMemberExpression);
  if (memberExpr) {
    const object = unwrapPath(memberExpr.get("object"), t2.isIdentifier);
    if (object && object.node.name === namespace) {
      const property = memberExpr.get("property");
      return property.isIdentifier() && moduleExports.includes(property.node.name);
    }
  }
  return false;
}
function isReactClassComponent(path) {
  const superClass = path.get("superClass");
  if (!superClass.isExpression()) {
    return false;
  }
  if (isNamespaceExport("React", REACT_CLASS, superClass)) {
    return true;
  }
  if (pathReferencesImport(superClass, "react", REACT_CLASS, false, true)) {
    return true;
  }
  return false;
}
function isStyledComponent(moduleName, importName, path) {
  function isStyledImport(path2) {
    return path2.isIdentifier() && path2.node.name === "styled" || pathReferencesImport(path2, moduleName, importName, false, false);
  }
  const callExpr = unwrapPath(path, t2.isCallExpression);
  if (callExpr) {
    const callee = callExpr.get("callee");
    if (isStyledImport(callee)) {
      return true;
    }
    const memberExpr = unwrapPath(callee, t2.isMemberExpression);
    if (memberExpr) {
      const object = unwrapPath(memberExpr.get("object"), t2.isIdentifier);
      if (object && isStyledImport(object)) {
        return true;
      }
    }
    return false;
  }
  const taggedExpr = unwrapPath(path, t2.isTaggedTemplateExpression);
  if (taggedExpr) {
    const tag = taggedExpr.get("tag");
    const memberExpr = unwrapPath(tag, t2.isMemberExpression);
    if (memberExpr) {
      const object = unwrapPath(memberExpr.get("object"), t2.isIdentifier);
      if (object && isStyledImport(object)) {
        return true;
      }
      return false;
    }
    const callExpr2 = unwrapPath(tag, t2.isCallExpression);
    if (callExpr2) {
      const callee = callExpr2.get("callee");
      if (isStyledImport(callee)) {
        return true;
      }
      return false;
    }
  }
  return false;
}
var REACT_FACTORY = [
  "forwardRef",
  "memo",
  "createClass"
  // 'lazy',
];
function isReactComponent(expr, flags) {
  const classExpr = unwrapPath(expr, t2.isClassExpression);
  if (classExpr && isReactClassComponent(classExpr)) {
    return true;
  }
  const funcExpr = unwrapPath(expr, isValidFunction);
  if (funcExpr && !funcExpr.node.generator && funcExpr.node.params.length < 3) {
    return true;
  }
  const callExpr = unwrapPath(expr, t2.isCallExpression);
  if (callExpr) {
    const callee = callExpr.get("callee");
    [...REACT_FACTORY];
    if (!flags?.noCreateContext) ;
    if (callee.isExpression() && isNamespaceExport("React", REACT_FACTORY, callee) || pathReferencesImport(callee, "react", REACT_FACTORY, false, true)) {
      return true;
    }
    const identifier2 = unwrapPath(callee, t2.isIdentifier);
    if (identifier2) {
      if (identifier2.node.name === "createReactClass") {
        return true;
      }
      if (/^with[A-Z]/.test(identifier2.node.name)) {
        return true;
      }
    }
  }
  if (flags?.noStyledComponents) return false;
  if (isStyledComponent("@emotion/styled", ["default"], expr)) {
    return true;
  }
  if (isStyledComponent("styled-components", ["default"], expr)) {
    return true;
  }
  return false;
}
var reactScanComponentNamePlugin = (options) => ({
  name: "react-scan/component-name",
  visitor: {
    Program(path) {
      const assignedNames = getAssignedDisplayNames(path);
      path.traverse({
        ClassDeclaration(path2) {
          if (isReactClassComponent(path2)) {
            if (!path2.node.id) {
              return;
            }
            const name = path2.node.id.name;
            if (assignedNames.has(name)) {
              return;
            }
            assignDisplayName(path2, name, options?.flags?.noTryCatchDisplayNames);
          }
        },
        FunctionDeclaration(path2) {
          const decl = path2.node;
          if (
            // Check if the declaration has an identifier, and then check
            decl.id && // if the name is component-ish
            isComponentishName(decl.id.name, options?.flags) && !decl.generator && // Might be component-like, but the only valid components
            // have zero, one or two (forwardRef) parameters
            decl.params.length < 3
          ) {
            if (!path2.node.id) {
              return;
            }
            const name = path2.node.id.name;
            if (assignedNames.has(name)) {
              return;
            }
            assignDisplayName(path2, name, options?.flags?.noTryCatchDisplayNames);
          }
        },
        VariableDeclarator(path2) {
          if (!path2.parentPath.isVariableDeclaration()) {
            return;
          }
          const identifier2 = path2.node.id;
          const init = path2.get("init");
          if (!(init.isExpression() && t2.isIdentifier(identifier2))) {
            return;
          }
          if (!isComponentishName(identifier2.name, options?.flags)) {
            return;
          }
          if (isReactComponent(init, options?.flags)) {
            const name = identifier2.name;
            if (!assignedNames.has(name)) {
              assignDisplayName(
                path2.parentPath,
                name,
                options?.flags?.noTryCatchDisplayNames
              );
            }
          }
        }
      });
    }
  }
});

// src/react-component-name/index.ts
var transform = async (code, id, filter, options) => {
  if (!filter(id)) return null;
  try {
    const result = await transformAsync(code, {
      plugins: [reactScanComponentNamePlugin(options)],
      ignore: [/\/(?<c>build|node_modules)\//],
      parserOpts: {
        plugins: ["jsx", "typescript", "decorators"]
      },
      cloneInputAst: false,
      filename: id,
      ast: false,
      highlightCode: false,
      sourceMaps: true,
      configFile: false,
      babelrc: false,
      generatorOpts: {
        jsescOption: {
          quotes: "single",
          minimal: true
        }
      }
    });
    if (result?.code) {
      return { code: result.code ?? "", map: result.map };
    }
    return null;
  } catch (error) {
    console.error("Error processing file:", id, error);
    return null;
  }
};
var DEFAULT_INCLUDE = "**/*.{mtsx,mjsx,tsx,jsx}";
var DEFAULT_EXCLUDE = "**/node_modules/**";
var reactComponentNamePlugin = createUnplugin(
  (options) => {
    const filter = createFilter(
      options?.include || DEFAULT_INCLUDE,
      options?.exclude || [
        DEFAULT_EXCLUDE,
        // Next.js pages dir specific
        "**/_app.{jsx,tsx,js,ts}",
        "**/_document.{jsx,tsx,js,ts}",
        "**/api/**/*",
        // Million.js specific
        "**/.million/**/*"
      ]
    );
    return {
      name: "react-component-name",
      enforce: "post",
      async transform(code, id) {
        return transform(code, id, filter, options);
      }
    };
  }
);

// src/react-component-name/esbuild.ts
var esbuild_default = reactComponentNamePlugin.esbuild;

export { esbuild_default as default };
