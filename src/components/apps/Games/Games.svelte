<script lang="ts">
	import { apps } from '🍎/state/apps.svelte.ts';

	const assetBase = import.meta.env.BASE_URL;

	const cloudUrl = 'https://michaelmb110b12-wq.github.io/Cine-Cloud-SRC/src/';
	const gnMathUrl = new URL('gnmath/index.html', new URL(assetBase, location.origin)).href;

	function openInSafari(url: string) {
		apps.pending_navigation = new URL(url, location.origin).href;
		apps.open.safari = true;
		apps.active = 'safari';
	}
</script>

<section class="container">
	<header class="app-window-drag-handle">Games</header>
	<div class="buttons">
		<button onclick={() => openInSafari(cloudUrl)}>Open Cloud</button>
		<button class="game-button" onclick={() => openInSafari(gnMathUrl)}>
			<img class="game-icon" src={assetBase + 'app-icons/gnmath.svg'} alt="GN Math" />
			<span>Open GN Math</span>
		</button>
	</div>
</section>

<style>
	.container{height:100%;background:var(--system-color-light);color:var(--system-color-light-contrast);border-radius:inherit;overflow:hidden}
	header{padding:1rem;text-align:center;font-weight:600}
	.buttons{height:calc(100% - 3.5rem);display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:center;padding:2rem}
	button{min-height:8rem;border:0;border-radius:1rem;background:hsla(var(--system-color-dark-hsl),.08);color:inherit;font:inherit;font-size:1.1rem;cursor:pointer}
	button:hover{background:hsla(var(--system-color-primary-hsl),.16)}
	.game-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8rem}
	.game-icon{width:3.5rem;height:3.5rem;border-radius:.8rem;object-fit:cover;background:#05060d}
</style>