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
const wispUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/wisp/';
await connection.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);

const registration = await navigator.serviceWorker.register('/proxy/sw.js', {
	scope: '/proxy/',
	updateViaCache: 'none',
});

await navigator.serviceWorker.ready;

if (!navigator.serviceWorker.controller) {
	registration.active?.postMessage({ type: 'SKIP_WAITING' });

	await new Promise((resolve) => {
		const timeout = window.setTimeout(resolve, 5000);
		navigator.serviceWorker.addEventListener(
			'controllerchange',
			() => {
				window.clearTimeout(timeout);
				resolve();
			},
			{ once: true },
		);
	});
}

const frame = scramjet.createFrame();
const element = frame.frame ?? frame.element;
document.body.appendChild(element);

element.style.cssText =
	'width:100%;height:100%;border:0;margin:0;padding:0;display:block;background:#fff;';

let current = new URLSearchParams(location.search).get('url') || 'https://example.com';

function tellParent(type, url) {
	if (window.parent === window) return;

	window.parent.postMessage(
		{ type, url },
		location.origin,
	);
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
go(current);
