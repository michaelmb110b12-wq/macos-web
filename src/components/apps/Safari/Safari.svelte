<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { apps } from '🍎/state/apps.svelte.ts';

	const { is_being_dragged }: { is_being_dragged: boolean } = $props();

	const siteBase = new URL(import.meta.env.BASE_URL, location.origin);
	const isBunnyCdn = /\\.b-cdn\\.net$/i.test(location.hostname);
	const proxyPath = 'proxy/index.html' + (isBunnyCdn ? '?v=20261003-bunny-v1' : '');
	const proxyEntry = new URL(proxyPath, siteBase).href;
	const browserHome = new URL('blueberry_mac_os_banner.html', siteBase).href;

	type Tab = {
		id: number;
		title: string;
		url: string;
		srcUrl: string;
	};

	let tabs = $state<Tab[]>([
		{ id: 1, title: 'Blueberry Mac OS', url: browserHome, srcUrl: browserHome },
	]);
	let activeTabId = $state(1);
	let nextTabId = 2;
	let address = $state(browserHome);

	function activeTab() {
		return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
	}

	function normalizeUrl(value: string) {
		const trimmed = value.trim();
		if (!trimmed) return '';
		if (/^about:/i.test(trimmed)) return trimmed;
		if (/^https?:\/\//i.test(trimmed)) return trimmed;
		if (trimmed.startsWith('/')) return new URL(trimmed, location.origin).href;
		return `https://${trimmed}`;
	}

	function isLocalUrl(url: string) {
		try {
			return new URL(url, location.href).origin === location.origin;
		} catch {
			return false;
		}
	}

	function iframeSrc(tab: Tab) {
		if (isLocalUrl(tab.srcUrl)) return tab.srcUrl;
		return `${proxyEntry}?tab=${tab.id}&url=${encodeURIComponent(tab.srcUrl)}`;
	}

	function sendToTab(type: string, url?: string) {
		const iframe = document.querySelector(
			`iframe[data-proxy-tab="${activeTabId}"]`,
		) as HTMLIFrameElement | null;

		if (!iframe) return;

		if (type === 'reload' && isLocalUrl(activeTab()?.srcUrl ?? '')) {
			try {
				iframe.contentWindow?.location.reload();
			} catch {}
			return;
		}

		if (!iframe.contentWindow) return;

		iframe.contentWindow.postMessage(
			url ? { type, url } : { type },
			location.origin,
		);
	}

	function navigate(value = address) {
		const target = normalizeUrl(value);
		if (!target) return;

		address = target;

		const tab = activeTab();
		if (tab) {
			tab.url = target;
			tab.srcUrl = target;
			try {
				tab.title = new URL(target).hostname || 'New Tab';
			} catch {
				tab.title = 'New Tab';
			}
		}

	}

	function reload() {
		sendToTab('reload');
	}

	function selectTab(id: number) {
		activeTabId = id;
		const tab = activeTab();
		address = tab?.url ?? 'about:blank';
	}

	function addTab() {
		const id = nextTabId++;
		tabs = [
			...tabs,
			{ id, title: 'Blueberry Mac OS', url: browserHome, srcUrl: browserHome },
		];
		activeTabId = id;
		address = browserHome;
	}

	function closeTab(id: number) {
		if (tabs.length === 1) {
			tabs = [{ id: 1, title: 'Blueberry Mac OS', url: browserHome, srcUrl: browserHome }];
			activeTabId = 1;
			nextTabId = Math.max(nextTabId, 2);
			return;
		}

		const index = tabs.findIndex((tab) => tab.id === id);
		tabs = tabs.filter((tab) => tab.id !== id);

		if (id === activeTabId) {
			const replacement = tabs[Math.max(0, index - 1)] ?? tabs[0];
			activeTabId = replacement.id;
			address = replacement.url;
		}
	}

	$effect(() => {
		const pending = apps.pending_navigation;
		if (!pending || !apps.open.safari || apps.active !== 'safari') return;

		const target = normalizeUrl(pending);
		if (!target) {
			apps.pending_navigation = null;
			return;
		}

		const tab = activeTab();
		if (tab) {
			tab.url = target;
			tab.srcUrl = target;
			try {
				tab.title = new URL(target).hostname || 'New Tab';
			} catch {
				tab.title = 'New Tab';
			}
		}

		address = target;
		apps.pending_navigation = null;
	});


	function handleMessage(event: MessageEvent) {
		if (event.origin !== location.origin) return;

		const data = event.data;
		if (!data?.type) return;

		if (data.type === 'proxy-error') {
			const frames = Array.from(
				document.querySelectorAll<HTMLIFrameElement>('iframe[data-proxy-tab]'),
			);
			const iframe = frames.find((item) => item.contentWindow === event.source);
			if (!iframe) return;
			address = 'Proxy error';
		}

		if (data.type === 'proxy-ready' || data.type === 'proxy-urlchange') {
			const frames = Array.from(
				document.querySelectorAll<HTMLIFrameElement>('iframe[data-proxy-tab]'),
			);

			const iframe = frames.find((item) => item.contentWindow === event.source);
			if (!iframe) return;

			const id = Number(iframe.dataset.proxyTab);
			const tab = tabs.find((item) => item.id === id);
			if (!tab || typeof data.url !== 'string') return;

			tab.url = data.url;
			try {
				tab.title = new URL(data.url).hostname || 'New Tab';
			} catch {
				tab.title = 'New Tab';
			}

			if (id === activeTabId) address = data.url;
		}
	}

	onMount(() => {
		window.addEventListener('message', handleMessage);
	});

	onDestroy(() => {
		window.removeEventListener('message', handleMessage);
	});
</script>

<section class:dragging={is_being_dragged} class="container">
	<header class="titlebar">
		<strong>Safari</strong>

		<button class="new-tab" type="button" onclick={addTab} aria-label="New tab">+</button>
	</header>

	<nav class="tabs" aria-label="Browser tabs">
		{#each tabs as tab}
			<button
				type="button"
				class:active={tab.id === activeTabId}
				class="tab"
				onclick={() => selectTab(tab.id)}
			>
				<span>{tab.title}</span>
				<span class="tab-close" onclick={(event) => { event.stopPropagation(); closeTab(tab.id); }}>×</span>
			</button>
		{/each}
	</nav>

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

	<div class="browser-host">
		{#each tabs as tab}
			<iframe
				src={iframeSrc(tab)}
				data-proxy-tab={tab.id}
				title={tab.title}
				class:hidden={tab.id !== activeTabId}
			></iframe>
		{/each}
	</div>
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

	.titlebar {
		position: relative;
		min-height: 3rem;
		padding: 0.55rem 4rem 0.45rem 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid color-mix(in srgb, var(--system-color-dark) 12%, transparent);
	}

	.new-tab {
		position: absolute;
		right: 0.8rem;
		width: 1.8rem;
		height: 1.8rem;
		border: 0;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--system-color-dark) 10%, transparent);
		color: inherit;
		font-size: 1.2rem;
		cursor: pointer;
	}

	.tabs {
		display: flex;
		align-items: stretch;
		gap: 0.15rem;
		padding: 0.3rem 0.45rem 0;
		overflow-x: auto;
		background: color-mix(in srgb, var(--system-color-dark) 5%, transparent);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		max-width: 13rem;
		min-width: 7rem;
		padding: 0.45rem 0.65rem;
		border: 0;
		border-radius: 0.5rem 0.5rem 0 0;
		background: transparent;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
	}

	.tab.active {
		background: color-mix(in srgb, var(--system-color-dark) 10%, transparent);
		opacity: 1;
	}

	.tab span:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.tab-close {
		opacity: 0.7;
		font-size: 1rem;
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

	.browser-host {
		position: relative;
		min-height: 0;
		overflow: hidden;
		background: white;
	}

	.browser-host iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
	}

	.browser-host iframe.hidden {
		display: none;
	}

	.dragging {
		pointer-events: none;
	}
</style>
