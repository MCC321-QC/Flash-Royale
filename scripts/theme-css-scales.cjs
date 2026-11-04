"use strict";

// Build-time rewrite that lets a theme scale corner roundness and shadow size with two CSS variables:
// pixel radii become `calc(Npx * var(--fr-roundness, 1))`, and the lengths of real shadows become
// `calc(L * var(--fr-shadow-scale, 1))`. Pills/circles (radius >= 100px) and border-like shadow rings
// (no blur, and inset or without offset, such as `0 0 0 2px`) keep their size, so they never vanish or square off.

const PILL_RADIUS = 100;
const LENGTH = /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)?$/;

function splitTopLevel(value, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (depth === 0 && (separator === " " ? /\s/.test(char) : char === separator)) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return separator === " " ? parts.filter(Boolean) : parts;
}

const isZero = (token) => parseFloat(token) === 0;
const scaled = (token, variable) => isZero(token) ? token : `calc(${token} * var(${variable}, 1))`;

function scaleRadius(value) {
  if (value.includes("(")) return value;
  return value.replace(/(^|[\s/])(\d+\.?\d*|\.\d+)px(?=$|[\s/])/g, (match, before, number) =>
    Number(number) === 0 || Number(number) >= PILL_RADIUS ? match : `${before}${scaled(`${number}px`, "--fr-roundness")}`);
}

function scaleShadowLayer(layer) {
  const tokens = splitTopLevel(layer.trim(), " ");
  const lengths = tokens.map((token, index) => LENGTH.test(token) ? index : -1).filter((index) => index >= 0);
  if (lengths.length < 2) return layer;
  const inset = tokens.includes("inset");
  const [x, y, blur] = lengths.map((index) => tokens[index]);
  const hasBlur = blur !== undefined && !isZero(blur);
  if (!hasBlur && (inset || (isZero(x) && isZero(y)))) return layer;
  for (const index of lengths) tokens[index] = scaled(tokens[index], "--fr-shadow-scale");
  return tokens.join(" ");
}

function scaleShadow(value) {
  if (/^\s*(none|inherit|initial|unset|revert|var\([^()]*\))\s*$/.test(value)) return value;
  return splitTopLevel(value, ",").map(scaleShadowLayer).join(", ");
}

function rewriteDeclarations(css, property, transform) {
  return css.replace(new RegExp(`(^|[;{\\s])(${property})(\\s*:\\s*)([^;{}]+?)(\\s*!important)?(?=\\s*[;}])`, "g"),
    (_match, before, name, colon, value, important = "") => `${before}${name}${colon}${transform(value)}${important}`);
}

function scaleThemeCss(css) {
  let output = rewriteDeclarations(css, "border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius", scaleRadius);
  output = rewriteDeclarations(output, "(?:box|text)-shadow", scaleShadow);
  return output;
}

function themeCssScalesPlugin() {
  return {
    name: "flash-royale-theme-css-scales",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0].replace(/\\/g, "/");
      if (!/\/src\/.+\.css$/.test(file)) return null;
      return { code: scaleThemeCss(code), map: null };
    },
  };
}

module.exports = { scaleThemeCss, themeCssScalesPlugin };
