import { mount } from 'svelte';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

// Remove any old broad-scope worker from previous builds.
// Scramjet now uses only the dedicated /proxy/ worker.
async function removeLegacyRootWorker() {
	if (!('serviceWorker' in navigator)) return;

	const siteRoot = new URL('./', window.location.href);
	const registrations = await navigator.serviceWorker.getRegistrations();
	let removed = false;

	for (const registration of registrations) {
		if (registration.scope === siteRoot.href) {
			removed = (await registration.unregister()) || removed;
		}
	}

	if (removed && sessionStorage.getItem('__legacy_root_sw_removed') !== '1') {
		sessionStorage.setItem('__legacy_root_sw_removed', '1');
		window.location.reload();
		return;
	}

	sessionStorage.removeItem('__legacy_root_sw_removed');
}

removeLegacyRootWorker().catch((error) => {
	console.warn('[macos-web] worker cleanup failed:', error);
});

export default desktop;
