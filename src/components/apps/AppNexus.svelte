<script lang="ts">
	import type { AppID } from '🍎/state/apps.svelte';

	const {
		app_id,
		is_being_dragged,
	}: {
		app_id: AppID;
		is_being_dragged: boolean;
	} = $props();
</script>

{#if app_id === 'calendar'}
	{#await import('./Calendar/Calendar.svelte') then { default: Calendar }}
		<Calendar />
	{/await}
{:else if app_id === 'games'}
	{#await import('./Games/Games.svelte') then { default: Games }}
		<Games />
	{/await}
{:else if app_id === 'safari'}
	{#await import('./Safari/Safari.svelte') then { default: Safari }}
		<Safari {is_being_dragged} />
	{/await}
{:else if app_id === 'calculator'}
	{#await import('./Calculator/Calculator.svelte') then { default: Calculator }}
		<Calculator />
	{/await}
{:else if app_id === 'wallpapers'}
	{#await import('./WallpaperApp/WallpaperSelectorApp.svelte') then { default: WallpaperSelector }}
		<WallpaperSelector />
	{/await}
{:else}
	{#await import('./AppStore/AppStore.svelte') then { default: AppStore }}
		<AppStore {app_id} />
	{/await}
{/if}