import { mount } from 'svelte';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

// Remove any old root PWA worker left behind by earlier Cloudflare/Bunny-style builds.
// The embedded browser needs the /scramjet/ worker to own only its own scope.
if ('serviceWorker' in navigator) {
	const rootScope = new URL('./', location.href).href;
	navigator.serviceWorker.getRegistrations().then(async (registrations) => {
		const rootRegistrations = registrations.filter(
			(registration) => registration.scope === rootScope,
		);

		if (!rootRegistrations.length) return;

		await Promise.all(rootRegistrations.map((registration) => registration.unregister()));
		location.reload();
	});
}

// The Cloudflare deployment intentionally does not install a new root PWA worker.
// Safari/Scramjet registers its own dedicated /scramjet/ service worker.

export default desktop;
