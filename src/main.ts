import { mount } from 'svelte';
import Desktop from './components/Desktop/Desktop.svelte';
import './css/global.css';

const desktop = mount(Desktop, {
	target: document.getElementById('root'),
});

// The Cloudflare deployment intentionally does not install the root PWA worker.
// Safari/Scramjet registers its own dedicated /scramjet/ service worker.

export default desktop;
