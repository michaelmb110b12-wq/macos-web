<script lang="ts">
	import ExpandSvg from './ExpandSVG.svelte';
	import StretchSvg from './StretchSVG.svelte';
	import RestoreSvg from './RestoreSVG.svelte';

	let { expandable = false, maximized = false }: {
		expandable?: boolean;
		maximized?: boolean;
	} = $props();
</script>

{#if maximized}
	<RestoreSvg />
{:else if expandable}
	<ExpandSvg />
{:else}
	<StretchSvg />
{/if}
