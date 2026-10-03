import { mount } from 'svelte';
import './css/global.css';

const root = document.getElementById('root');

function showRuntimeError(error: unknown) {
	if (!root) return;
	root.innerHTML = '';
	const box = document.createElement('div');
	box.style.cssText =
		'box-sizing:border-box;width:100vw;height:100vh;padding:32px;background:#111;color:#fff;' +
		'font:16px/1.5 system-ui,sans-serif;white-space:pre-wrap;overflow:auto;';
	const title = document.createElement('h1');
	title.textContent = 'macOS Web failed to start';
	title.style.margin = '0 0 12px';
	const message = document.createElement('pre');
	message.textContent = error instanceof Error ? error.stack || error.message : String(error);
	message.style.cssText = 'margin:0;color:#ffb4b4;white-space:pre-wrap;';
	box.append(title, message);
	root.appendChild(box);
	console.error('[macos-web] startup error:', error);
}

async function start() {
	try {
		// Import the desktop lazily so Cloudflare Pages/runtime errors become
		// visible instead of leaving a completely blank document.
		const { default: Desktop } = await import('./components/Desktop/Desktop.svelte');
		if (!root) throw new Error('Missing #root element');
		mount(Desktop, { target: root });

		// Register the PWA worker after the desktop has mounted.
		if ('serviceWorker' in navigator) {
			import('virtual:pwa-register')
				.then(({ registerSW }) => registerSW({ immediate: true }))
				.catch((error) => console.warn('[pwa] registration skipped:', error));
		}
	} catch (error) {
		showRuntimeError(error);
	}
}

start();
