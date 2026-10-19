// Run: node --test tests/menu-layout.mjs
// Deterministic CSS/markup contracts, not rendered browser QA. The small cascade
// reader below handles this project's selectors/media rules so earlier legacy
// declarations cannot falsely satisfy a regression check after a later override.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = [...html.matchAll(/<link\b[^>]*>/g)]
    .filter(([tag]) => /rel="stylesheet"/.test(tag))
    .map(([tag]) => tag.match(/href="([^"]+)"/)?.[1])
    .filter(href => href && !/^(?:https?:)?\/\//.test(href))
    .map(href => fs.readFileSync(new URL('../' + href, import.meta.url), 'utf8'))
    .join('\n');

function parseRules(source, media = [], rules = []) {
    source = source.replace(/\/\*[\s\S]*?\*\//g, '');
    for (let cursor = 0; cursor < source.length;) {
        const open = source.indexOf('{', cursor);
        if (open < 0) break;
        const selector = source.slice(cursor, open).trim();
        let close = open + 1, depth = 1;
        for (; close < source.length && depth; close++) {
            if (source[close] === '{') depth++;
            if (source[close] === '}') depth--;
        }
        assert.equal(depth, 0, 'CSS must have balanced rule blocks');
        const body = source.slice(open + 1, close - 1);
        if (selector.startsWith('@media')) parseRules(body, [...media, selector.slice(6).trim()], rules);
        else if (!selector.startsWith('@')) {
            const declarations = body.split(';').filter(s => s.includes(':')).map(s => {
                const colon = s.indexOf(':');
                return { property: s.slice(0, colon).trim(), value: s.slice(colon + 1).replace(/!important\s*$/, '').trim(), important: /!important\s*$/.test(s) };
            });
            for (const s of selector.split(',')) rules.push({ selector: s.trim(), declarations, media });
        }
        cursor = close;
    }
    return rules;
}

function mediaMatches(query, { width, height }) {
    return query.split(',').some(alternative => alternative.split(/\s+and\s+/).every(part => {
        const dimension = part.trim().match(/^\((min|max)-(width|height):\s*(\d+)px\)$/);
        if (dimension) {
            const actual = dimension[2] === 'width' ? width : height;
            return dimension[1] === 'min' ? actual >= +dimension[3] : actual <= +dimension[3];
        }
        const orientation = part.trim().match(/^\(orientation:\s*(portrait|landscape)\)$/);
        if (orientation) return orientation[1] === (width > height ? 'landscape' : 'portrait');
        if (/^\(prefers-reduced-motion:\s*reduce\)$/.test(part.trim())) return false;
        throw new Error('Unsupported media condition: ' + part);
    }));
}

function parseHTML(source) {
    const nodes = [], stack = [];
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const match of source.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
        const [, closing, tag, raw] = match;
        if (closing) {
            while (stack.length && stack.pop().tag !== tag.toLowerCase()) { /* close ancestor */ }
            continue;
        }
        const attrs = Object.fromEntries([...raw.matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)].map(([, key, a, b]) => [key, a ?? b ?? '']));
        const node = { tag: tag.toLowerCase(), attrs, parent: stack.at(-1) };
        nodes.push(node);
        if (!voidTags.has(node.tag)) stack.push(node);
    }
    return nodes;
}

function matchesSimple(node, selector) {
    // Interactive state and pseudo-element declarations cannot affect resting
    // layout. None of the asserted contracts relies on a structural pseudo-class.
    if (!node || /:/.test(selector)) return false;
    const attributes = [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
    for (const [, attr, value] of attributes) {
        if (!(attr in node.attrs) || (value !== undefined && node.attrs[attr] !== value)) return false;
    }
    selector = selector.replace(/\[[^\]]+\]/g, '');
    const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && tag.toLowerCase() !== node.tag) return false;
    for (const [, id] of selector.matchAll(/#([\w-]+)/g)) if (node.attrs.id !== id) return false;
    for (const [, cls] of selector.matchAll(/\.([\w-]+)/g)) if (!(node.attrs.class || '').split(/\s+/).includes(cls)) return false;
    return true;
}

function matches(node, selector) {
    const parts = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
    function matchPart(current, index) {
        if (!matchesSimple(current, parts[index])) return false;
        if (index === 0) return true;
        if (parts[index - 1] === '>') return matchPart(current.parent, index - 2);
        for (let parent = current.parent; parent; parent = parent.parent) if (matchPart(parent, index - 1)) return true;
        return false;
    }
    return matchPart(node, parts.length - 1);
}

function specificity(selector) {
    const ids = (selector.match(/#[\w-]+/g) || []).length;
    const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length;
    const tags = selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]/g, '').split(/[\s>+~]+/).filter(s => /^[a-z][\w-]*$/i.test(s)).length;
    return ids * 10000 + classes * 100 + tags;
}

function computed(node, viewport, rules = parseRules(css)) {
    const values = {}, priority = {};
    for (const rule of rules) {
        if (!rule.media.every(query => mediaMatches(query, viewport)) || !matches(node, rule.selector)) continue;
        for (const declaration of rule.declarations) {
            const { property, value, important } = declaration;
            const rank = Number(important) * 1e8 + specificity(rule.selector);
            // Expand the one relevant shorthand to preserve source order when
            // overflow-y overrides (or is overridden by) overflow.
            const properties = property === 'overflow' ? ['overflow', 'overflow-x', 'overflow-y'] : [property];
            for (const key of properties) if (priority[key] === undefined || rank >= priority[key]) {
                priority[key] = rank;
                values[key] = property === 'overflow' && key === 'overflow-y' ? (value.split(/\s+/)[1] || value) : value;
            }
        }
    }
    return values;
}

const nodes = parseHTML(html);
const one = selector => {
    const found = nodes.filter(node => matches(node, selector));
    assert.equal(found.length, 1, 'Expected one HTML element for ' + selector);
    return found[0];
};
const rules = parseRules(css);
const viewports = [
    { width: 1440, height: 900 }, { width: 1040, height: 681 },
    { width: 1024, height: 600 }, { width: 844, height: 390 },
    { width: 740, height: 360 }, { width: 700, height: 700 },
    { width: 641, height: 480 }, { width: 640, height: 480 },
    { width: 600, height: 360 }, { width: 480, height: 320 },
    { width: 390, height: 844 }, { width: 360, height: 640 },
    { width: 320, height: 568 }, { width: 320, height: 480 },
    { width: 320, height: 320 },
];
const style = (selector, viewport) => computed(one(selector), viewport, rules);
const size = viewport => `${viewport.width}×${viewport.height}`;
const compact = value => value?.replace(/\s+/g, '');

// The harness checks its important cascade edges, rather than assuming that a
// matching declaration anywhere in the file is the effective declaration.
test('layout contract reader respects selectors, specificity, media and important source order', () => {
    const sample = parseRules('.story-visual > img{object-fit:cover!important} #story-art{object-fit:fill} @media(max-width:640px) and (orientation:portrait){.story-visual > img{object-fit:contain!important}}');
    assert.equal(computed(one('#story-art'), { width: 1440, height: 900 }, sample)['object-fit'], 'cover');
    assert.equal(computed(one('#story-art'), { width: 390, height: 844 }, sample)['object-fit'], 'contain');
    assert.equal(computed(one('#story-art'), { width: 600, height: 360 }, sample)['object-fit'], 'cover');
    const cascade = parseRules('#title{overflow-y:hidden} .screen{overflow:auto!important} #title{overflow-y:scroll!important}');
    assert.equal(computed(one('#title'), viewports[0], cascade)['overflow-y'], 'scroll');
});

test('chapter artwork always preserves the full illustration instead of cropping to fill', () => {
    for (const viewport of viewports) {
        const art = style('#story-art', viewport);
        assert.equal(art['object-fit'], 'contain', 'Story artwork is cropped at ' + size(viewport));
        assert.ok(['center', 'center center', '50% 50%'].includes(art['object-position']), 'Story illustration must stay centered at ' + size(viewport));
        assert.equal(art.width, '100%');
        assert.equal(art.height, '100%');
    }
});

test('story copy can shrink and scroll while navigation stays outside the scroll area', () => {
    const actions = one('.story-actions');
    assert.equal(actions.parent, one('.story-copy'));
    assert.equal(one('#story-text').parent, actions.parent);
    for (const viewport of viewports) {
        const copy = style('.story-copy', viewport);
        const prose = style('#story-text', viewport);
        const controls = style('.story-actions', viewport);
        assert.equal(copy['min-height'], '0', 'Copy must shrink at ' + size(viewport));
        assert.equal(copy['min-width'], '0', 'Copy must not widen a narrow track at ' + size(viewport));
        assert.equal(prose['min-height'], '0', 'Text must relinquish space to actions at ' + size(viewport));
        assert.equal(prose['overflow-y'], 'auto', 'Long chapters must scroll at ' + size(viewport));
        assert.equal(controls['flex-shrink'], '0', 'Story actions must keep their size at ' + size(viewport));
    }
});

test('story has zero-minimum grid tracks on desktop and bounded art rows on phones', () => {
    for (const viewport of viewports) {
        const panel = style('.story-panel', viewport);
        assert.equal(panel.display, 'grid');
        const columns = compact(panel['grid-template-columns']);
        const rows = compact(panel['grid-template-rows']);
        if (viewport.width <= 640 && !(viewport.height <= 520 && viewport.width > viewport.height)) {
            assert.equal(columns, 'minmax(0,1fr)', 'Narrow portrait uses one shrinkable column at ' + size(viewport));
            assert.match(rows, /minmax\(0,1fr\)$/, 'Text row must shrink at ' + size(viewport));
            assert.ok(rows !== 'minmax(0,1fr)', 'Portrait art must have a separate bounded row at ' + size(viewport));
        } else {
            assert.match(columns, /^minmax\(0,[^)]+\)minmax\(0,[^)]+\)$/, 'Side-by-side content needs two shrinkable columns at ' + size(viewport));
            assert.equal(rows, 'minmax(0,1fr)', 'Short layouts must not retain an unused portrait row at ' + size(viewport));
        }
    }
});

test('chapter runtime cannot restore stage-specific off-center focal crops', () => {
    const screens = fs.readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
    const assignments = [...screens.matchAll(/art\.style\.objectPosition\s*=\s*([^;]+);/g)];
    assert.ok(assignments.length > 0, 'Chapter runtime must explicitly reset reused art positioning');
    for (const [, value] of assignments) assert.match(value, /^['"]center['"]$/);
});

test('home illustration stays within its frame and narrow layouts put launch before artwork', () => {
    for (const viewport of viewports) {
        for (const selector of ['.menu-hero']) {
            const art = style(selector, viewport);
            assert.equal(art['object-fit'], 'contain', `${selector} must preserve its illustration at ${size(viewport)}`);
            const edge = selector === '.menu-hero' ? art.left : art.right;
            for (const value of [art.width, art.height, art.bottom, edge]) {
                assert.match(value, /^(?:0|\d+(?:\.\d+)?%)$/, 'Art dimensions must stay within the frame');
            }
            assert.ok(parseFloat(art.width) + parseFloat(edge) <= 100, `${selector} extends horizontally beyond frame at ${size(viewport)}`);
            assert.ok(parseFloat(art.height) + parseFloat(art.bottom) <= 100, `${selector} extends vertically beyond frame at ${size(viewport)}`);
        }
        if (viewport.width <= 760) {
            const wrap = style('.title-wrap', viewport);
            assert.equal(compact(wrap['grid-template-columns']), 'minmax(0,1fr)');
            const areas = wrap['grid-template-areas'];
            assert.ok(areas.indexOf('"launch"') >= 0 && areas.indexOf('"launch"') < areas.indexOf('"art"'), 'Narrow menu launch action should precede artwork');
            assert.equal(compact(style('.menu-utility', viewport)['grid-template-columns']), 'repeat(2,minmax(0,1fr))');
        }
    }
});

test('overflowing title remains top-aligned and vertically scrollable', () => {
    for (const viewport of viewports) {
        const title = style('#title', viewport);
        const wrap = style('.title-wrap', viewport);
        assert.ok(['auto', 'scroll'].includes(title['overflow-y']), 'Title must scroll at ' + size(viewport));
        assert.ok(['flex-start', 'start'].includes(title['align-items']), 'Centered overflow clips menu top at ' + size(viewport));
        assert.equal(wrap['max-height'], 'none', 'Menu content may grow beyond viewport at ' + size(viewport));
        assert.equal(wrap['min-width'], '0', 'Title grid must shrink horizontally at ' + size(viewport));
    }
});

test('title menu and story navigation preserve at least 44 px touch targets', () => {
    const controls = nodes.filter(node => matches(node, '#title button') || matches(node, '.story-actions button') || matches(node, '#title summary'));
    assert.ok(controls.length >= 10, 'Test must include launch, utilities, secret and story controls');
    for (const viewport of viewports) for (const control of controls) {
        const actual = computed(control, viewport, rules);
        assert.ok(/^\d+(?:\.\d+)?px$/.test(actual['min-height']) && parseFloat(actual['min-height']) >= 44,
            `${control.attrs.id || control.tag} target shrinks below 44 px at ${size(viewport)}: ${actual['min-height']}`);
    }
});

test('role-specific command cards separate system controls and keep terminal in scroll flow',()=>{
 for(const id of ['shop','tutorial','intel']){
  const node=one(`#btn-${id}`);assert.ok(matches(node,'.menu-utility .menu-card'));
 }
 assert.ok(matches(one('#btn-settings'),'.menu-system button'));
 assert.ok(matches(one('#btn-install'),'.menu-system button'));
 const terminal=one('#secret');terminal.attrs.open='';
 for(const viewport of viewports){
  const st=style('#secret',viewport);
  assert.equal(st.position,'relative');assert.equal(st['grid-column'],'1/-1');assert.equal(st['max-height'],'none');
 }
 delete terminal.attrs.open;
 assert.match(one('.menu-hero').attrs.src,/menu-yeoni.webp$/);
 assert.equal(nodes.filter(n=>matches(n,'.menu-enemy')).length,0);
});
test('chapter backdrop echoes image while foreground remains uncropped',()=>{
 assert.ok(one('#story-visual-backdrop'));
 const source=fs.readFileSync(new URL('../src/ui/screens.js',import.meta.url),'utf8');
 assert.match(source,/story-visual-backdrop.*backgroundImage/);
 for(const viewport of viewports){assert.equal(style('#story-art',viewport)['object-fit'],'contain');}
});
