<script lang="ts">
	import { apps } from '🍎/state/apps.svelte.ts';

	const cloudUrl = 'https://figure-cloud-cine.b-cdn.net/';
	const gnMathUrl = 'https://gn-math.com/';

	function openInSafari(url: string) {
		apps.open.safari = true;
		apps.active = 'safari';
		setTimeout(() => window.dispatchEvent(new CustomEvent('proxy-navigate', { detail: url })), 150);
	}
</script>

<section class="container">
	<header class="app-window-drag-handle">Games</header>
	<div class="buttons">
		<button onclick={() => openInSafari(cloudUrl)}>Open Cloud</button>
		<button onclick={() => openInSafari(gnMathUrl)}>Open GN Math</button>
	</div>
</section>

<style>
	.container{height:100%;background:var(--system-color-light);color:var(--system-color-light-contrast);border-radius:inherit;overflow:hidden}
	header{padding:1rem;text-align:center;font-weight:600}
	.buttons{height:calc(100% - 3.5rem);display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:center;padding:2rem}
	button{min-height:8rem;border:0;border-radius:1rem;background:hsla(var(--system-color-dark-hsl),.08);color:inherit;font:inherit;font-size:1.1rem;cursor:pointer}
	button:hover{background:hsla(var(--system-color-primary-hsl),.16)}
</style>