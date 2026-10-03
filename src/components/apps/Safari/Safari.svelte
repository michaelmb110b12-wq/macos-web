<script lang="ts">
	import { onMount } from 'svelte';
	const { is_being_dragged }: { is_being_dragged: boolean } = $props();
	let address = $state('https://example.com');
	let browser = $state<HTMLIFrameElement>();

	function navigate(url=address) {
		const value = url.trim();
		if (!value) return;
		const target = /^https?:\/\//i.test(value) ? value : `https://${value}`;
		address = target;
		browser?.contentWindow?.postMessage({ type:'navigate', url:target }, location.origin);
	}
	function reload() {
		browser?.contentWindow?.postMessage({ type:'reload' }, location.origin);
	}
	onMount(() => {
		const handler = (e: MessageEvent) => {
			if (e.origin === location.origin && e.data?.type === 'proxy-urlchange') address = e.data.url;
		};
		window.addEventListener('message', handler);
		return () => window.removeEventListener('message', handler);
	});
</script>

<section class:dragging={is_being_dragged} class="container">
	<header class="app-window-drag-handle">Safari</header>
	<div class="toolbar">
		<button onclick={reload} aria-label="Reload">↻</button>
		<input bind:value={address} onkeydown={(e)=>e.key==='Enter'&&navigate()} spellcheck="false" />
		<button onclick={()=>navigate()}>Go</button>
	</div>
	<iframe bind:this={browser} src="/proxy/" title="Safari proxy browser"></iframe>
</section>

<style>
	.container{height:100%;display:grid;grid-template-rows:auto auto 1fr;background:var(--system-color-light);border-radius:inherit;overflow:hidden}
	header{padding:1rem;text-align:center;font-weight:600;color:var(--system-color-light-contrast)}
	.toolbar{display:grid;grid-template-columns:2.5rem 1fr 3.5rem;gap:.4rem;padding:.45rem .6rem;border-block:1px solid hsla(var(--system-color-dark-hsl),.12)}
	input,button{min-height:2rem;border:0;border-radius:.45rem;font:inherit}
	input{padding:0 .7rem;background:hsla(var(--system-color-dark-hsl),.08);color:inherit}
	button{background:hsla(var(--system-color-dark-hsl),.1);cursor:pointer}
	iframe{width:100%;height:100%;border:0;background:white}
	.dragging{pointer-events:none}
</style>