import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inspectSvg,
  inspectThemeCss,
  normalizeUrlValue,
  rewriteThemeAssetUrls,
  stripRemoteCss,
} from '../../desktop/src/lib/themes/css-guard.ts';

const ASSETS = ['a.webp', 'f.woff2'];
const KEPT = true;
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const svgUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const svgBase64 = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const BAD_CSS = [
  [String.raw`a{background:\75 rl(https://x.test/a.png)}`, 'url'],
  [String.raw`a{background:u\72 l("https://x.test/a.png")}`, 'url'],
  [String.raw`@\69mport "https://x.test/a.css";`, 'at-rule'],
  [String.raw`a{background:url("https\3a //x.test/a.png")}`, 'url'],
  [String.raw`a{background:url("\2f\2f x.test/a.png")}`, 'url'],
  ['a{background:url(//x.test/a.png)}', 'url'],
  ['a{background:URL(HTTPS://x.test/a.png)}', 'url'],
  [String.raw`a{background:url("/\9/x.test/a.png")}`, 'url'],
  [String.raw`a{background:url("/\a/x.test/a.png")}`, 'url'],
  [String.raw`a{background:url("\1//x.test/a.png")}`, 'url'],
  ['a{background:url("/\t/x.test/a.png")}', 'url'],
  [String.raw`a{background:url("/\\x.test/a.png")}`, 'url'],
  ['a{background:url(" //x.test/a.png")}', 'url'],
  ['a{background:image-set("https://x.test/a.png" 1x)}', 'image-set'],
  ['a{--u:"https://x.test/a.png";background:image-set(var(--u) 1x)}', 'image-set'],
  ['a{background:image-set(url(assets/a.webp) type("https://x.test") 1x)}', 'image-set'],
  ['a{background:src(var(--u))}', 'function'],
  ['a{background:url(assets/../a.png)}', 'url', KEPT],
  ['a{background:url("assets/missing.webp")}', 'asset-missing', KEPT],
  ['a{background:url(data:text/html,hi)}', 'data-uri', KEPT],
  [
    `a{background:url("${svgUri('<svg><image href="https://x.test/a.png"/></svg>')}")}`,
    'data-uri',
    KEPT,
  ],
  ['@font-face{font-family:f;src:url(https://x.test/f.woff2)}', 'url'],
  ['a{-webkit-app-region:drag}', 'property', KEPT],
  ['a{content:attr(data-x type(<url>))}', 'attr', KEPT],
  ['a{content:"line\n"}', 'parse', KEPT],
  ['a{color:red}/* open', 'parse', KEPT],
  ['a{color:red', 'unbalanced', KEPT],
];

const GOOD_CSS = [
  'a{background:image-set(url(assets/a.webp) type("image/webp") 1x)}',
  String.raw`.hover\:bg-white\/10:hover{content:"\2022"}`,
  '@font-face{font-family:f;src:url(assets/f.woff2) format("woff2")}',
  'a{filter:url(#glow)}',
];

const BAD_SVG = [
  '<svg><x:script>1</x:script></svg>',
  '<svg><svg:foreignObject/></svg>',
  '<svg><a><set attributeName="href" to="https://x.test"/></a></svg>',
  '<svg><animate attributeName="xlink:href" values="https://x.test"/></svg>',
  String.raw`<svg><style>a{fill:u\72 l(https://x.test)}</style></svg>`,
  String.raw`<svg><rect style="fill:u\72 l(https://x.test)"/></svg>`,
  '<svg><rect style="fill:&#117;rl(https://x.test)"/></svg>',
  '<svg><image xlink:href="https://x.test/a.png"/></svg>',
  '<svg><a:image b:href="https://x.test/a.png"/></svg>',
  '<?xml-stylesheet href="https://x.test/a.css"?><svg/>',
  '<svg onload="1"/>',
  '<svg><style>a{fill:u<!---->rl(https://x.test)}</style></svg>',
  '<svg><style>a{fill:u<x/>rl(https://x.test)}</style></svg>',
  '<svg><style>@im<![CDATA[]]>port "https://x.test/a.css";</style></svg>',
  '<?xml version="1.0" encoding="UTF-16"?><svg/>',
  '<svg>\0<\0s\0c\0r\0i\0p\0t\0></svg>',
  `<svg><image href="${svgBase64('<svg><script>1</script></svg>')}"/></svg>`,
  '<svg><漢:script xmlns:漢="http://www.w3.org/2000/svg">1</漢:script></svg>',
  '<svg xmlns:漢="http://www.w3.org/1999/xlink"><image 漢:href="https://x.test/a.png"/></svg>',
  '<svg><set attributeName="漢:href" to="https://x.test/a.png"/></svg>',
  '<svg><h:img xmlns:h="http://www.w3.org/1999/xhtml" srcset="https://x.test/a.png"/></svg>',
  '<svg><video poster="https://x.test/a.png"/></svg>',
  '<svg><meta http-equiv="refresh" content="0;url=https://x.test"/></svg>',
  '<svg xml:base="https://x.test/"><use href="#a"/></svg>',
  '<svg xmlns="http://www.w3.org/1999/xhtml"/>',
  '<svg><a:b:script>1</a:b:script></svg>',
];

const codes = (css, assets = ASSETS) => inspectThemeCss(css, assets).errors.map((e) => e.code);

for (const [css, code, kept] of BAD_CSS) {
  test(`inspect: ${JSON.stringify(css)} -> ${code}`, () => {
    assert.ok(codes(css).includes(code), `got ${codes(css).join(', ')}`);
  });
  test(`strip: ${JSON.stringify(css)}`, () => {
    const out = stripRemoteCss(css);
    if (kept) {
      assert.equal(out.blocked, 0);
      assert.equal(out.css, css);
    } else {
      assert.ok(out.blocked >= 1, out.css);
    }
  });
}

for (const css of GOOD_CSS) {
  test(`inspect passes: ${css}`, () => {
    const report = inspectThemeCss(css, ASSETS);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
  });
}

for (const svg of BAD_SVG) {
  test(`svg: ${JSON.stringify(svg)}`, () => {
    assert.ok(inspectSvg(svg).errors.length > 0);
  });
  test(`svg in css: ${JSON.stringify(svg)}`, () => {
    for (const uri of [svgUri(svg), svgBase64(svg)]) {
      const css = `a{background:url("${uri}")}`;
      assert.ok(codes(css).includes('data-uri'));
      assert.deepEqual(stripRemoteCss(css), { css, blocked: 0 });
    }
  });
}

test('svg with text only warns', () => {
  const svg = '<svg><text>hi</text></svg>';
  const report = inspectSvg(svg);
  assert.deepEqual(report.errors, []);
  assert.equal(report.warnings.length, 1);
  const css = `a{background:url("${svgUri(svg)}")}`;
  const cssReport = inspectThemeCss(css, []);
  assert.deepEqual(cssReport.errors, []);
  assert.deepEqual(
    cssReport.warnings.map((w) => w.code),
    ['svg-text'],
  );
});

test('a plain svg passes', () => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 8"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><circle cx="4" cy="4" r="1" fill="url(#g)"/><use xlink:href="#g"/><image href="data:image/png;base64,${PNG_1X1}"/></svg>`;
  assert.deepEqual(inspectSvg(svg), { errors: [], warnings: [] });
});

test('nested css, media, keyframes and font-face pass', () => {
  const css = `
@media (min-width: 900px) {
  [data-ui="sidebar"] {
    background: url( assets/a.webp ) center / cover;
    & .item:hover { color: var(--color-accent); }
  }
}
@supports (backdrop-filter: blur(1px)) { [data-ui="player"] { backdrop-filter: blur(20px); } }
@keyframes drift { from { transform: translateY(0); } to { transform: translateY(-4px); } }
@-webkit-keyframes drift { 50% { opacity: .5 } }
@layer theme { :root { --x: 1 } }
@font-face {
  font-family: "Theme Sans";
  src: url("assets/f.woff2") format("woff2"), local(Arial);
  unicode-range: U+0000-00FF, U+0131;
}
html[data-perf="light"] [data-ui="app"] { animation: none; }
a { background: url( "assets/a.webp" ), url(assets/a.webp), url("#glow"); }
b { background-image: url("data:image/png;base64,${PNG_1X1}"); }
`;
  const report = inspectThemeCss(css, ASSETS);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.assets, ['a.webp', 'f.woff2']);
});

test('reports the line and column of the first error', () => {
  const css =
    'a { color: red; }\n\n  b {\n    background: url(https://x.test/a.png);\n    behavior: url(x.htc);\n  }\n';
  const report = inspectThemeCss(css, []);
  assert.deepEqual(
    { code: report.errors[0].code, line: report.errors[0].line, column: report.errors[0].column },
    { code: 'url', line: 4, column: 17 },
  );
  assert.deepEqual(
    report.errors.map((e) => [e.code, e.line, e.column]),
    [
      ['url', 4, 17],
      ['property', 5, 5],
      ['url', 5, 15],
    ],
  );
});

test('every remaining error code fires', () => {
  assert.ok(codes('a{color:red}\u0001').includes('control'));
  assert.ok(codes('@import url(assets/a.webp);').includes('at-rule'));
  assert.ok(codes('@namespace svg "x";').includes('at-rule'));
  assert.ok(codes('a{b:c)}').includes('unbalanced'));
  assert.ok(codes('a{b:(c]}').includes('unbalanced'));
  assert.ok(codes('a{b:image(x)}').includes('function'));
  assert.ok(codes('a{b:-moz-element(#x)}').includes('function'));
  assert.ok(codes('a{b:expression(1)}').includes('function'));
  assert.ok(codes('a{b:cross-fade(url(assets/a.webp), env(x))}').includes('image-set'));
  assert.ok(codes('a{b:-webkit-image-set(attr(x) 1x)}').includes('image-set'));
  assert.ok(codes('a{b:image-set(foo(type("image/png")) 1x)}').includes('image-set'));
  assert.ok(codes('a{b:attr(x px)}').includes('attr'));
  assert.ok(codes('a{b:attr(x, "y")}').length === 0);
  assert.ok(codes('a{BEHAVIOR : url(#x)}').includes('property'));
  assert.ok(codes(String.raw`a{-webkit-app-\72 egion/**/:drag}`).includes('property'));
  assert.ok(codes('a{b:url("a" "b")}').includes('url'));
  assert.ok(codes('a{b:url(x y)}').includes('parse'));
  assert.ok(codes('a{b:url(x"y)}').includes('parse'));
  assert.ok(codes('a{b:c}\\').includes('parse'));
  assert.ok(codes('a{b:c}\\\n').includes('parse'));
  assert.ok(codes('a{b:url(data:image/png;base64,AAAA').includes('parse'));
  assert.ok(codes(`a{b:url(data:image/png;base64,${'A'.repeat(70000)})}`).includes('data-uri'));
  assert.ok(codes('a{b:url("data:image/svg+xml;base64,%%%")}').includes('data-uri'));
  assert.ok(codes(`a{b:url(${'x'.repeat(10)})}${'/*'.padEnd(300000, 'x')}*/`).includes('size'));
  assert.ok(codes('a{b:url(#)}').includes('url'));
  assert.ok(codes('a{b:url(ASSETS/a.webp)}').includes('url'));
});

test('data: images must be readable and not too big', () => {
  const png = Buffer.from(PNG_1X1, 'base64');
  const percent = [...png].map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
  assert.deepEqual(codes(`a{b:url(data:image/png;base64,${PNG_1X1})}`), []);
  assert.deepEqual(codes(`a{b:url("data:image/png,${percent}")}`), []);
  assert.deepEqual(codes('a{src:url(data:font/woff2;base64,d09GMgAB)}'), []);
  png.writeUInt32BE(5000, 16);
  const huge = inspectThemeCss(`a{b:url(data:image/png;base64,${png.toString('base64')})}`, []);
  assert.deepEqual(
    huge.errors.map((issue) => [issue.code, issue.message]),
    [['data-uri', 'data: image is 5000x1, too big']],
  );
  assert.deepEqual(codes('a{b:url(data:image/png;base64,AAAA)}'), ['data-uri']);
  assert.deepEqual(codes('a{b:url(data:image/gif;base64,%%%)}'), ['data-uri']);
  assert.deepEqual(codes(`a{b:url("data:image/png,${encodeURIComponent('<svg/>')}")}`), [
    'data-uri',
  ]);

  const svg = (href) => `<svg xmlns="http://www.w3.org/2000/svg"><image href="${href}"/></svg>`;
  assert.deepEqual(inspectSvg(svg(`data:image/png;base64,${PNG_1X1}`)).errors, []);
  assert.deepEqual(inspectSvg(svg(`data:image/png;base64,${png.toString('base64')}`)).errors, [
    'embedded image is 5000x1, too big',
  ]);
  assert.deepEqual(inspectSvg(svg('data:image/gif;base64,R0lGODlh')).errors, [
    'embedded image cannot be read',
  ]);
  const inCss = `a{b:url("${svgBase64(svg(`data:image/png;base64,${png.toString('base64')}`))}")}`;
  assert.deepEqual(codes(inCss), ['data-uri']);
});

test('content-text warns on long strings per declaration', () => {
  const short = inspectThemeCss('a::before{content:"Now playing"}', []);
  assert.deepEqual(short.warnings, []);
  const long = inspectThemeCss(
    'a{color:red}\nb::before{content:"Your subscription expired, " "click here to renew"}',
    [],
  );
  assert.deepEqual(
    long.warnings.map((w) => [w.code, w.line, w.column]),
    [['content-text', 2, 11]],
  );
  const urls = inspectThemeCss(
    `a{background:image-set(url("assets/a.webp") type("image/webp") 1x, url("assets/a.webp") type("image/webp") 2x)}`,
    ASSETS,
  );
  assert.deepEqual(urls.warnings, []);
});

test('normalizeUrlValue strips like the URL parser', () => {
  assert.equal(normalizeUrlValue('\u0001 //x\t.te\nst/\r '), '//x.test/');
  assert.equal(normalizeUrlValue('a b'), 'a b');
});

test('rewriteThemeAssetUrls rewrites only asset urls and keeps every other byte', () => {
  const css =
    '/* keep */ a{background:url(assets/a.webp) , url( "assets/f.woff2" ) ,url(#f),url("data:image/png;base64,AA")}\r\nb{x:URL(  assets/a.webp  )}';
  const out = rewriteThemeAssetUrls(css, (name) => `http://127.0.0.1:9/theme-files/${name}`);
  assert.equal(
    out,
    '/* keep */ a{background:url("http://127.0.0.1:9/theme-files/a.webp") , url("http://127.0.0.1:9/theme-files/f.woff2") ,url(#f),url("data:image/png;base64,AA")}\r\nb{x:url("http://127.0.0.1:9/theme-files/a.webp")}',
  );
  assert.equal(
    rewriteThemeAssetUrls('a{b:url("x\\"y")}', () => 'z'),
    'a{b:url("x\\"y")}',
  );
  assert.equal(
    rewriteThemeAssetUrls('a{b:url(assets/a.webp)}', () => 'a"b\\c'),
    'a{b:url("a\\"b\\\\c")}',
  );
});

test('stripRemoteCss keeps local urls', () => {
  const css = [
    'a{background:url(data:image/png;base64,AAAA)}',
    'b{background:url("blob:http://tauri.localhost/1-2")}',
    'c{background:url(asset://localhost/x.png)}',
    'd{background:url("https://asset.localhost/x.png")}',
    'e{background:url("sc-assets/bg.webp")}',
    'f{background:url(/assets/x.png)}',
    'g{filter:url(#f)}',
    'h{background:url()}',
    'i{background:url("")}',
    'j{background:image-set("sc-assets/a.webp" type("image/svg+xml") 1x)}',
  ].join('\n');
  assert.deepEqual(stripRemoteCss(css), { css, blocked: 0 });
});

test('stripRemoteCss replaces remote urls and removes imports', () => {
  assert.deepEqual(stripRemoteCss('a{}@import "https://x.test/a.css";b{}'), {
    css: 'a{}/**/b{}',
    blocked: 1,
  });
  assert.deepEqual(
    stripRemoteCss('@import url(https://x.test/a.css) supports(display: grid) screen;a{}'),
    {
      css: '/**/a{}',
      blocked: 1,
    },
  );
  assert.deepEqual(stripRemoteCss('a{@import "x"}b{}'), { css: 'a{/**/}b{}', blocked: 1 });
  assert.deepEqual(stripRemoteCss('u@import "x";rl(https://x.test/a.png)'), {
    css: 'u/**/rl(https://x.test/a.png)',
    blocked: 1,
  });
  assert.deepEqual(stripRemoteCss('a{b:url(https://x.test/a.png) url(sc-assets/a.png)}'), {
    css: 'a{b:none url(sc-assets/a.png)}',
    blocked: 1,
  });
  assert.deepEqual(
    stripRemoteCss('a{b:image-set(url(https://x.test/a.png) 1x, "sc-assets/b.png" 2x)}'),
    {
      css: 'a{b:image-set(none 1x, "sc-assets/b.png" 2x)}',
      blocked: 1,
    },
  );
  assert.deepEqual(
    stripRemoteCss('a{b:cross-fade(image-set("https://x.test/a.png" 1x), url(sc-assets/b.png))}'),
    {
      css: 'a{b:cross-fade(none, url(sc-assets/b.png))}',
      blocked: 1,
    },
  );
  assert.deepEqual(stripRemoteCss('a{b:image("https://x.test/a.png")}c{d:paint(x)}'), {
    css: 'a{b:none}c{d:none}',
    blocked: 2,
  });
  assert.deepEqual(stripRemoteCss('a{b:url(x"y)}'), { css: 'a{b:none}', blocked: 1 });
  assert.equal(stripRemoteCss('a{b:url("https://x.test/a.png"').css, 'a{b:none');
  assert.equal(stripRemoteCss('a{b:u+1url(https://x.test/a.png)}').css, 'a{b:u+1none}');
});

test('the guard survives hostile input', () => {
  const deep = `a{b:${'('.repeat(100000)}"x"`;
  assert.ok(codes(deep).includes('unbalanced'));
  assert.equal(stripRemoteCss(deep).blocked, 0);
  const started = Date.now();
  inspectSvg(`<svg ${'a'.repeat(300000)}${'<!--'.repeat(50000)}${'<'.repeat(50000)}`);
  inspectThemeCss(`a{b:url(data:image/png;${';a'.repeat(30000)}`, []);
  assert.ok(Date.now() - started < 2000);
});

test('stripRemoteCss stays linear on unclosed imports', () => {
  const started = Date.now();
  assert.deepEqual(stripRemoteCss('@import '.repeat(30000)), { css: '/**/', blocked: 1 });
  assert.equal(stripRemoteCss(`a{${'@import{'.repeat(20000)}`).blocked, 1);
  assert.ok(Date.now() - started < 2000);
});

test('inspectSvg stays linear on repeated data: images', () => {
  const started = Date.now();
  for (const unit of ['data:image/png;', 'data:image/png;x', 'data:image/png,']) {
    inspectSvg(`<svg>${unit.repeat(32000)}`);
  }
  assert.ok(Date.now() - started < 2000);
});

test('svg error text has no line breaks', () => {
  const { errors } = inspectSvg('<svg><image href="\n::error::x"/><a b="&\n::error::y"/></svg>');
  assert.ok(errors.length >= 2);
  for (const message of errors) assert.ok(!/[\r\n]/.test(message), message);
});
