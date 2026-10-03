import { mount } from 'svelte';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

// Register the PWA worker after the desktop has mounted.
// Keeping this separate prevents a PWA/runtime registration problem from
// preventing the entire macOS UI from rendering on Cloudflare Pages.
if ('serviceWorker' in navigator) {
	import('virtual:pwa-register')
		.then(({ registerSW }) => {
			registerSW({ immediate: true });
		})
		.catch((error) => {
			console.warn('[pwa] service worker registration skipped:', error);
		});
}

export default desktop;
