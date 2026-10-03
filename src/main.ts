import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

const isBunnyCdn = /\.b-cdn\.net$/i.test(location.hostname);

if (isBunnyCdn && 'serviceWorker' in navigator) {
	const reloadKey = '__bunny_sw_cleanup_v2';
	navigator.serviceWorker.getRegistrations().then(async (registrations) => {
		const rootScope = new URL('./', location.href).href;
		const rootRegistrations = registrations.filter((registration) => registration.scope === rootScope);
		if (rootRegistrations.length && sessionStorage.getItem(reloadKey) !== '1') {
			await Promise.all(rootRegistrations.map((registration) => registration.unregister()));
			sessionStorage.setItem(reloadKey, '1');
			location.reload();
		}
	});
} else {
	registerSW({
		immediate: true,
	});
}

export default desktop;
