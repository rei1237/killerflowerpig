// Compare the real historical continuous-thorns runtime to the final charge runtime.
// node tools/nongun-paired-qa.mjs --phases=mid --seeds=1,2,...,30
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const routes = args.some(arg => arg.startsWith('--routes=')) ? [] : ['--routes=gunline,executioner,plague,butcher'];
const rows = [];
for (const variant of ['before', 'after']) {
    const command = [...(variant === 'before' ? ['--import', './tests/helpers/continuous-thorns-loader.mjs'] : []),
        './tools/nongun-wave-qa.mjs', ...args, ...routes, `--variant=${variant}`];
    const child = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (child.status !== 0) throw new Error(child.stderr || child.stdout);
    rows.push(JSON.parse(child.stdout));
}
const [before, after] = rows;
console.log(JSON.stringify({ ...after,
    method: 'Two fresh processes compare the captured continuous-thorns runtime with old nongun data against the final consumable-thorns runtime and tuned nongun data. Each uses actual finite enemies and identical seeds, positions and budgets.',
    baselineRuntime: before.runtimeBaseline,
    beforeSourceHashes: before.sourceHashes,
    limitations: [...after.limitations.filter(line => !line.startsWith('Data-only')),
        'Cannon/Bloom routes are excluded because a separate cannon redesign changed concurrently. Gunline and Executioner controls exercise unchanged gun runtime/data in both processes.',
        'This supersedes the earlier continuous-thorns-only30-seed report. No baseline module is used by the game or by production imports.'],
    summary: { ...before.summary, ...after.summary }, runs: [...before.runs, ...after.runs],
    sourceFilesChangedOnDiskDuringRun: [...new Set([...before.sourceFilesChangedOnDiskDuringRun, ...after.sourceFilesChangedOnDiskDuringRun])],
}, null, 2));
