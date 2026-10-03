<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	const { is_being_dragged }: { is_being_dragged: boolean } = $props();

	let browserHost = $state<HTMLDivElement>();
	let address = $state('https://example.com');
	let status = $state('Starting proxy…');
	let error = $state('');
	let frame: any = null;
	let initialized = false;

	function loadScript(src: string) {
		return new Promise<void>((resolve, reject) => {
			const selector = `script[data-proxy-src="${src}"]`;
			const existing = document.querySelector(selector) as HTMLScriptElement | null;

			if (existing) {
				if ((existing as any).__loaded) return resolve();
				existing.addEventListener('load', () => resolve(), { once: true });
				existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
				return;
			}

			const script = document.createElement('script');
			script.src = src;
			script.dataset.proxySrc = src;
			script.onload = () => {
				(script as any).__loaded = true;
				resolve();
			};
			script.onerror = () => reject(new Error(`Failed to load ${src}`));
			document.head.appendChild(script);
		});
	}

	async function ensureServiceWorkerControl() {
		const registration = await navigator.serviceWorker.register('/sw.js', {
			scope: '/',
			updateViaCache: 'none',
		});

		await navigator.serviceWorker.ready;

		if (navigator.serviceWorker.controller) return;

		const active = registration.active;
		if (active) active.postMessage({ type: 'SKIP_WAITING' });

		await new Promise<void>((resolve, reject) => {
			const timeout = window.setTimeout(() => {
				reject(new Error('Proxy service worker did not take control. Reload the page once and try again.'));
			}, 10000);

			navigator.serviceWorker.addEventListener(
				'controllerchange',
				() => {
					window.clearTimeout(timeout);
					resolve();
				},
				{ once: true },
			);
		});
	}

	async function initProxy() {
		status = 'Loading proxy…';

		await loadScript('/baremux/index.js');
		await loadScript('/scram/scramjet.all.js');
		await ensureServiceWorkerControl();

		const bare = (window as any).BareMux;
		if (!bare?.BareMuxConnection) throw new Error('BareMux failed to load.');

		const connection = new bare.BareMuxConnection('/baremux/worker.js');
		const scheme = location.protocol === 'https:' ? 'wss' : 'ws';

		await connection.setTransport('/epoxy/index.mjs', [
			{ wisp: `${scheme}://${location.host}/wisp/` },
		]);

		const loader = (window as any).$scramjetLoadController;
		if (!loader) throw new Error('Scramjet controller failed to load.');

		const { ScramjetController } = loader();

		const controller = new ScramjetController({
			files: {
				wasm: '/scram/scramjet.wasm.wasm',
				all: '/scram/scramjet.all.js',
				sync: '/scram/scramjet.sync.js',
			},
		});

		await controller.init();
		frame = controller.createFrame();

		const element = frame.frame ?? frame.element;
		if (!element) throw new Error('Scramjet frame was not created.');

		element.style.width = '100%';
		element.style.height = '100%';
		element.style.border = '0';
		element.style.display = 'block';
		element.setAttribute('title', 'Safari Browser');
		element.setAttribute('draggable', 'false');

		browserHost?.appendChild(element);

		frame.addEventListener?.('urlchange', () => {
			if (frame.url) address = frame.url;
		});

		initialized = true;
		status = 'Ready';
		frame.go(address);
	}

	function navigate(url = address) {
		const value = url.trim();
		if (!value) return;

		const target = /^https?:\/\//i.test(value) ? value : `https://${value}`;
		address = target;

		if (!initialized || !frame) {
			status = 'Starting proxy…';
			return;
		}

		try {
			frame.go(target);
			status = 'Ready';
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			status = 'Proxy error';
		}
	}

	function reload() {
		if (frame?.url) {
			frame.go(frame.url);
			return;
		}

		if (frame) frame.go(address);
	}

	function launchHandler(event: Event) {
		const url = (event as CustomEvent<string>).detail;
		if (url) navigate(url);
	}

	onMount(async () => {
		window.addEventListener('proxy-navigate', launchHandler);

		try {
			await initProxy();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			status = 'Proxy failed';
			console.error('[Safari proxy]', e);
		}
	});

	onDestroy(() => {
		window.removeEventListener('proxy-navigate', launchHandler);
		try {
			frame?.frame?.remove();
		} catch {}
	});
</script>

<section class:dragging={is_being_dragged} class="container">
	<header class="app-window-drag-handle">Safari</header>

	<div class="toolbar">
		<button type="button" onclick={reload} aria-label="Reload">↻</button>
		<input
			bind:value={address}
			onkeydown={(event) => event.key === 'Enter' && navigate()}
			spellcheck="false"
			aria-label="Address"
		/>
		<button type="button" onclick={() => navigate()}>Go</button>
	</div>

	<div class="status">{status}{#if error} — {error}{/if}</div>
	<div class="browser-host" bind:this={browserHost}></div>
</section>

<style>
	.container {
		background: var(--system-color-light);
		border-radius: inherit;
		display: grid;
		grid-template-rows: auto auto auto 1fr;
		overflow: hidden;
		color: var(--system-color-light-contrast);
		height: 100%;
		min-height: 0;
	}

	header {
		min-height: 3rem;
		padding: 0.9rem 1rem 0.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.toolbar {
		display: grid;
		grid-template-columns: 2.5rem 1fr 3.5rem;
		gap: 0.4rem;
		padding: 0.45rem 0.6rem;
		border-top: 1px solid color-mix(in srgb, var(--system-color-dark) 12%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--system-color-dark) 12%, transparent);
	}

	.toolbar button,
	.toolbar input {
		border: 0;
		border-radius: 0.45rem;
		min-height: 2rem;
		font: inherit;
	}

	.toolbar button {
		background: color-mix(in srgb, var(--system-color-dark) 10%, transparent);
		cursor: pointer;
	}

	.toolbar input {
		padding: 0 0.7rem;
		background: color-mix(in srgb, var(--system-color-dark) 8%, transparent);
		color: inherit;
		outline: none;
	}

	.status {
		font-size: 0.78rem;
		opacity: 0.65;
		padding: 0.25rem 0.65rem;
		min-height: 1.15rem;
	}

	.browser-host {
		min-height: 0;
		overflow: hidden;
		background: white;
	}

	.browser-host :global(iframe) {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
	}

	.dragging {
		pointer-events: none;
	}
</style>
