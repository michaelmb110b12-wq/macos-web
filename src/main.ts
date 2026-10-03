import { mount } from 'svelte';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

const siteRoot = new URL('./', window.location.href);
const serviceWorkerUrl = new URL('sw.js', siteRoot).href;

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register(serviceWorkerUrl, {
		scope: siteRoot.pathname,
		updateViaCache: 'none',
	}).catch((error) => {
		console.warn('[macos-web] service worker registration failed:', error);
	});
}

export default desktop;
