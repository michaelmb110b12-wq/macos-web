<script lang="ts">
	import CloseIcon from '🍎/components/SVG/traffic-lights/CloseSVG.svelte';
	import GreenLight from '🍎/components/SVG/traffic-lights/GreenLight.svelte';
	import MinimizeSvg from '🍎/components/SVG/traffic-lights/MinimizeSVG.svelte';
	import { apps_config } from '🍎/configs/apps/apps-config.ts';
	import { apps, type AppID } from '🍎/state/apps.svelte.ts';

	const {
		app_id,
		on_close_app,
		on_minimize_click,
		on_maximize_click,
	}: {
		app_id: AppID;
		on_close_app: () => void;
		on_minimize_click: () => void;
		on_maximize_click: () => void;
	} = $props();
</script>

<div class="container" class:unfocused={apps.active !== app_id}>
	<button type="button" class="close-light" onclick={(event) => { event.stopPropagation(); on_close_app(); }} aria-label="Close window"> <CloseIcon /> </button>
	<button type="button" class="minimize-light" onclick={(event) => { event.stopPropagation(); on_minimize_click(); }} aria-label="Minimize window"> <MinimizeSvg /> </button>
	<button type="button" class="stretch-light" onclick={(event) => { event.stopPropagation(); on_maximize_click(); }} aria-label="Maximize window">
		<GreenLight expandable={apps_config[app_id].expandable} />
	</button>
</div>

<style>
	.container {
		--button-size: 0.85rem;

		/* // pointer-events: none; */

		display: grid;
		grid-template-columns: repeat(3, var(--button-size));
		align-items: center;
		gap: 0.55rem;

		height: 100%;

		&.unfocused button {
			--bgcolor: #b6b6b7;
			--border-color: hsla(var(--system-color-dark-hsl), 0.5);
		}

		:global(svg) {
			opacity: 0;
		}

		&:hover {
			button {
				transform: scale(1.2);
			}

			:global(svg) {
				opacity: 1;
			}
		}
	}

	button {
		height: var(--button-size);
		width: var(--button-size);
		padding: 0;
		margin: 0;
		border: 0;
		display: grid;
		place-items: center;
		position: relative;
		z-index: 1;

		/* // pointer-events: initial; */

		border-radius: 50%;

		background-color: var(--bgcolor);
		box-shadow: 0 0 0 0.5px var(--border-color);

		transition: transform 100ms ease-in;
	}

	.close-light {
		--bgcolor: #ff5f56;
		--border-color: #e0443e;
	}

	.stretch-light {
		--bgcolor: #27c93f;
		--border-color: #1aab29;

		:global(svg) {
			transform: rotate(90deg);
		}
	}

	.minimize-light {
		--bgcolor: #ffbd2e;
		--border-color: #dea123;
	}
</style>
