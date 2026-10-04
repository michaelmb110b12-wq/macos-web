import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

const isBunnyCdn = /\.b-cdn\.net$/i.test(location.hostname);

if (isBunnyCdn && 'serviceWorker' in navigator) {
	// A previous Bunny deployment may already have the root PWA installed.
	// Remove it so the dedicated /scramjet/ worker can own proxy requests.
	const cleanupKey = '__bunny_root_pwa_cleanup_v8';
	if (sessionStorage.getItem(cleanupKey) !== '1') {
		navigator.serviceWorker.getRegistrations().then(async (registrations) => {
			const rootScope = new URL('./', location.href).href;
			const rootRegistrations = registrations.filter(
				(registration) => registration.scope === rootScope,
			);
			if (rootRegistrations.length) {
				await Promise.all(rootRegistrations.map((registration) => registration.unregister()));
				sessionStorage.setItem(cleanupKey, '1');
				location.reload();
			}
		});
	}
} else {
	registerSW({
		immediate: true,
	});
}

export default desktop;
