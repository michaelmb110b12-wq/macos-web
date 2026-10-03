const params = new URLSearchParams(location.search);
const initialUrl = params.get('url') || 'about:blank';

async function prepareServiceWorker() {
	// Older builds registered a separate /proxy/ service worker. Remove it so
	// Scramjet uses the same root service worker as the original macOS app.
	const registrations = await navigator.serviceWorker.getRegistrations();
	for (const registration of registrations) {
		const scriptUrl = registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || '';
		if (new URL(scriptUrl || location.href).pathname === '/proxy/sw.js') {
			await registration.unregister();
		}
	}

	const registration =
		(await navigator.serviceWorker.getRegistration('/')) ||
		(await navigator.serviceWorker.register('/sw.js', {
			scope: '/',
			updateViaCache: 'none',
		}));

	await registration.update();
	await navigator.serviceWorker.ready;

	// clientsClaim() in the root service worker should normally control us.
	// On the very first visit the browser may need one reload to attach it.
	if (!navigator.serviceWorker.controller) {
		if (sessionStorage.getItem('macos-proxy-sw-reloaded') !== '1') {
			sessionStorage.setItem('macos-proxy-sw-reloaded', '1');
			location.reload();
			return false;
		}
		throw new Error('The root Scramjet service worker is not controlling this page.');
	}

	sessionStorage.removeItem('macos-proxy-sw-reloaded');
	return true;
}

if (await prepareServiceWorker()) {
	const { ScramjetController } = $scramjetLoadController();

	const scramjet = new ScramjetController({
		files: {
			wasm: '/scram/scramjet.wasm.wasm',
			all: '/scram/scramjet.all.js',
			sync: '/scram/scramjet.sync.js',
		},
	});

	await scramjet.init();

	const connection = new BareMux.BareMuxConnection('/baremux/worker.js');
	const wispUrl =
		(location.protocol === 'https:' ? 'wss' : 'ws') +
		'://' +
		location.host +
		'/wisp/';

	// Epoxy is the primary transport used by this build.
	await connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);

	const frame = scramjet.createFrame();
	const element = frame.frame;
	document.body.appendChild(element);

	element.id = 'scramjet-frame';
	element.style.cssText =
		'position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;display:block;background:#fff;';

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