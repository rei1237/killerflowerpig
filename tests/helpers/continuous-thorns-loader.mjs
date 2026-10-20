// Read-only historical runtime used ONLY by the finite-wave before process.
// All ordinary gun paths are unchanged; cannon rows are deliberately excluded.
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const target = new URL('../../src/game/weapons.js', import.meta.url).href;
const file = new URL('../fixtures/continuous-thorns-runtime.js.txt', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
globalThis.__nongunRuntimeBaseline = { name: 'continuous-thorns before user charge override',
    sha256: createHash('sha256').update(source).digest('hex') };
registerHooks({ load(url, context, nextLoad) {
    if (url === target) return { format: 'module', source, shortCircuit: true };
    return nextLoad(url, context);
} });
