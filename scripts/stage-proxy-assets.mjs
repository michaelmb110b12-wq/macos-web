import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();

async function packageDir(pkg) {
	const resolved = require.resolve(pkg);
	let dir = dirname(resolved);

	// Most package versions resolve directly to dist/index.js. Find the
	// directory that contains the matching ESM build.
	for (let i = 0; i < 3; i++) {
		try {
			await readFile(join(dir, 'index.mjs'));
			return dir;
		} catch {}

		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	throw new Error(`Could not locate browser bundle for ${pkg}`);
}

async function stage(pkg, output) {
	const dir = await packageDir(pkg);
	const target = join(root, 'public', output);
	await mkdir(target, { recursive: true });

	for (const file of ['index.mjs', 'index.js']) {
		try {
			await cp(join(dir, file), join(target, file));
		} catch {}
	}

	console.log(`[proxy-assets] staged ${pkg} -> public/${output}`);
}

await stage('@mercuryworkshop/epoxy-transport', 'epoxy');
await stage('@mercuryworkshop/libcurl-transport', 'libcurl');
