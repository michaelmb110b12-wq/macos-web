import { cp, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function resolveBrowserEntry(pkg, candidates = []) {
	let resolved;
	try {
		resolved = require.resolve(pkg);
	} catch (error) {
		throw new Error(
			`Could not resolve ${pkg}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const resolvedDir = dirname(resolved);

	// Most Mercury Workshop transport releases resolve to their browser ESM
	// entrypoint. Copy that exact resolved file instead of guessing the package
	// directory layout.
	if (/\.mjs$/i.test(resolved) && (await exists(resolved))) {
		return {
			esModule: resolved,
			commonJs: (await exists(join(resolvedDir, 'index.js')))
				? join(resolvedDir, 'index.js')
				: null,
		};
	}

	const searchDirs = [
		resolvedDir,
		join(resolvedDir, 'dist'),
		join(resolvedDir, 'lib'),
		dirname(resolvedDir),
		join(dirname(resolvedDir), 'dist'),
		join(dirname(resolvedDir), 'lib'),
	];

	for (const dir of searchDirs) {
		for (const file of ['index.mjs', 'index.js']) {
			const path = join(dir, file);
			if (!(await exists(path))) continue;

			if (file === 'index.mjs') {
				return {
					esModule: path,
					commonJs: (await exists(join(dir, 'index.js')))
						? join(dir, 'index.js')
						: null,
				};
			}
		}
	}

	throw new Error(
		`No browser bundle found for ${pkg}. Resolved entry: ${resolved}. Checked: ${searchDirs.join(', ')}`,
	);
}

async function stage(pkg, output) {
	const bundle = await resolveBrowserEntry(pkg);
	const target = join(root, 'public', output);

	await mkdir(target, { recursive: true });

	await cp(bundle.esModule, join(target, 'index.mjs'));

	if (bundle.commonJs) {
		await cp(bundle.commonJs, join(target, 'index.js'));
	}

	console.log(
		`[proxy-assets] staged ${pkg}: ${bundle.esModule}${bundle.commonJs ? `, ${bundle.commonJs}` : ''}`,
	);
}

await stage('@mercuryworkshop/epoxy-transport', 'epoxy');
await stage('@mercuryworkshop/libcurl-transport', 'libcurl');
