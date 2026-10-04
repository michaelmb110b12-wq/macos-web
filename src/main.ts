import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

registerSW({
	immediate: true,
});

export default desktop;
