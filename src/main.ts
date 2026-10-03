import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

async function setupServiceWorker() {
	if (!('serviceWorker' in navigator)) return;

	try {
		const registrations = await navigator.serviceWorker.getRegistrations();

		// Remove service workers from older experimental Scramjet layouts.
		for (const registration of registrations) {
			const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || '';
			if (
				script.includes('/proxy/sw.js') ||
				script.includes('/scramjet/sw.js') ||
				(script.endsWith('/sw.js') && registration.scope.endsWith('/macos-web/'))
			) {
				await registration.unregister();
			}
		}

		await registerSW({ immediate: true });
	} catch (error) {
		console.warn('[macos-web] service worker setup failed:', error);
	}
}

setupServiceWorker();

export default desktop;
