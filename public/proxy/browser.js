const params = new URLSearchParams(location.search);
const initialUrl = params.get('url') || 'about:blank';

const SCRAMJET_COOKIE_DB = '__scramjet_controller';
const SCRAMJET_COOKIE_STORE = 'state';

async function repairScramjetDatabase() {
	if (!('indexedDB' in window)) return;

	const hasStore = await new Promise((resolve, reject) => {
		const request = indexedDB.open(SCRAMJET_COOKIE_DB, 1);

		request.onupgradeneeded = () => {
			const db = request.result;

			// If the database does not exist yet, create the exact schema
			// expected by ScramjetController.
			if (!db.objectStoreNames.contains(SCRAMJET_COOKIE_STORE)) {
				db.createObjectStore(SCRAMJET_COOKIE_STORE);
			}
		};

		request.onerror = () =>
			reject(request.error ?? new Error('Unable to inspect Scramjet IndexedDB.'));

		request.onsuccess = () => {
			const db = request.result;
			const exists = db.objectStoreNames.contains(SCRAMJET_COOKIE_STORE);
			db.close();
			resolve(exists);
		};
	});

	if (hasStore) return;

	console.warn('[proxy] resetting stale Scramjet IndexedDB schema');

	await new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(SCRAMJET_COOKIE_DB);

		request.onerror = () =>
			reject(request.error ?? new Error('Failed to reset Scramjet IndexedDB.'));

		request.onblocked = () =>
			reject(
				new Error(
					'The old Scramjet database is still open. Close other proxy tabs and reload.',
				),
			);

		request.onsuccess = resolve;
	});
}

async function startProxy() {
	if (!navigator.serviceWorker) {
		throw new Error('Service workers are unavailable.');
	}

	// Remove stale root/proxy registrations created by previous builds.
	for (const registration of await navigator.serviceWorker.getRegistrations()) {
		const scriptUrl =
			registration.active?.scriptURL ||
			registration.installing?.scriptURL ||
			registration.waiting?.scriptURL ||
			'';

		if (!scriptUrl) continue;

		const pathname = new URL(scriptUrl, location.href).pathname;
		if (pathname === '/sw.js' || pathname === '/proxy/sw.js') {
			if (pathname === '/sw.js') {
				// Leave the original macOS PWA registration alone.
				continue;
			}
			await registration.unregister();
		}
	}

	const registration = await navigator.serviceWorker.register('/proxy/sw.js', {
		scope: '/proxy/',
		updateViaCache: 'none',
	});

	await registration.update();

	if (!navigator.serviceWorker.controller) {
		await new Promise((resolve, reject) => {
			const timeout = window.setTimeout(
				() => reject(new Error('Scramjet proxy service worker did not take control.')),
				15000,
			);

			const onControllerChange = () => {
				window.clearTimeout(timeout);
				navigator.serviceWorker.removeEventListener(
					'controllerchange',
					onControllerChange,
				);
				resolve();
			};

			navigator.serviceWorker.addEventListener(
				'controllerchange',
				onControllerChange,
				{ once: true },
			);
		});
	}

	if (!navigator.serviceWorker.controller) {
		throw new Error('Scramjet proxy service worker is not controlling this page.');
	}

	const { ScramjetController } = $scramjetLoadController();

	let scramjet = new ScramjetController({
		files: {
			wasm: '/scram/scramjet.wasm.wasm',
			all: '/scram/scramjet.all.js',
			sync: '/scram/scramjet.sync.js',
		},
	});

	try {
		await scramjet.init();
	} catch (firstError) {
		const message =
			firstError instanceof Error ? firstError.message : String(firstError);

		if (!message.includes('One of the specified object stores was not found')) {
			throw firstError;
		}

		console.warn('[proxy] stale Scramjet IndexedDB detected; resetting and retrying');
		await repairScramjetDatabase();

		scramjet = new ScramjetController({
			files: {
				wasm: '/scram/scramjet.wasm.wasm',
				all: '/scram/scramjet.all.js',
				sync: '/scram/scramjet.sync.js',
			},
		});

		await scramjet.init();
	}

	const connection = new BareMux.BareMuxConnection('/baremux/worker.js');
	const wispUrl =
		(location.protocol === 'https:' ? 'wss' : 'ws') +
		'://' +
		location.host +
		'/wisp/';

	await connection.setTransport('/libcurl/index.mjs', [{ websocket: wispUrl }]);

	const frame = scramjet.createFrame();
	const element = frame.frame;

	element.id = 'scramjet-frame';
	element.style.cssText =
		'position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;display:block;background:#fff;';

	document.body.appendChild(element);

	let current = initialUrl;

	function tellParent(type, url) {
		if (window.parent === window) return;
		window.parent.postMessage({ type, url }, location.origin);
	}

	function go(url) {
		current = url;
		frame.go(url);
		tellParent('proxy-urlchange', url);
	}

	frame.addEventListener?.('urlchange', () => {
		if (frame.url) {
			current = frame.url;
			tellParent('proxy-urlchange', frame.url);
		}
	});

	window.addEventListener('message', (event) => {
		if (event.origin !== location.origin) return;

		if (event.data?.type === 'navigate' && typeof event.data.url === 'string') {
			go(event.data.url);
		}

		if (event.data?.type === 'reload') {
			go(current);
		}
	});

	tellParent('proxy-ready', current);

	if (current !== 'about:blank') {
		go(current);
	}
}

startProxy().catch((error) => {
	console.error('[proxy] startup failed', error);

	const pre = document.createElement('pre');
	pre.textContent =
		'Proxy failed: ' +
		(error instanceof Error ? error.message : String(error));
	pre.style.cssText =
		'position:absolute;inset:0;margin:0;padding:24px;white-space:pre-wrap;font:14px/1.5 monospace;background:#fff;color:#b00020;overflow:auto;';
	document.body.appendChild(pre);

	if (window.parent !== window) {
		window.parent.postMessage(
			{ type: 'proxy-error', error: pre.textContent },
			location.origin,
		);
	}
});
