<script lang="ts">
	import {
		bounds,
		BoundsFrom,
		Compartment,
		ControlFrom,
		controls,
		disabled,
		draggable,
		events,
		position,
	} from '@neodrag/svelte';
	import { onMount, untrack } from 'svelte';
	import { sineInOut } from 'svelte/easing';
	import { elevation } from '🍎/actions';
	import { apps_config } from '🍎/configs/apps/apps-config.ts';
	import { rand_int } from '🍎/helpers/random.ts';
	import { sleep } from '🍎/helpers/sleep';
	import { apps, type AppID } from '🍎/state/apps.svelte.ts';
	import { preferences } from '🍎/state/preferences.svelte.ts';

	import AppNexus from '../../apps/AppNexus.svelte';
	import TrafficLights from './TrafficLights.svelte';

	const { app_id }: { app_id: AppID } = $props();

	let dragging_enabled = $state(true);

	let is_maximized = $state(false);
	let minimized_transform = $state<string>();

	let windowEl = $state<HTMLElement>();

	const { height, width } = $derived(apps_config[app_id]);

	const remModifier = $derived(+height * 1.2 >= window.innerHeight ? 24 : 16);

	const randX = rand_int(-600, 600);
	const randY = rand_int(-100, 100);

	let defaultPosition = {
		x: (document.body.clientWidth / 2 + randX) / 2,
		y: (100 + randY) / 2,
	};

	const disabledComp = Compartment.of(() => disabled(!dragging_enabled));

	$effect(() => {
		apps.active_z_index;

		if (apps.active === app_id) {
			untrack(() => (apps.z_indices[app_id] = apps.active_z_index));
		}
	});

	function focusApp() {
		apps.active = app_id;
	}

	function windowCloseTransition(
		el: HTMLElement,
		{ duration = preferences.reduced_motion ? 0 : 300 }: SvelteTransitionConfig = {},
	): SvelteTransitionReturnType {
		const existingTransform = getComputedStyle(el).transform;

		return {
			duration,
			easing: sineInOut,
			css: (t) => `opacity: ${t}; transform: ${existingTransform} scale(${t})`,
		};
	}

	async function maximizeApp() {
		if (!windowEl) return;

		if (!preferences.reduced_motion) {
			windowEl.style.transition =
				'left 0.25s ease, top 0.25s ease, right 0.25s ease, bottom 0.25s ease, width 0.25s ease, height 0.25s ease, transform 0.25s ease';
		}

		if (!is_maximized) {
			minimized_transform = windowEl.style.transform || 'none';
			dragging_enabled = false;

			windowEl.classList.add('maximized');
			windowEl.style.left = '0';
			windowEl.style.top = '0';
			windowEl.style.right = '0';
			windowEl.style.bottom = '0';
			windowEl.style.width = '100%';
			windowEl.style.height = '100%';
			windowEl.style.transform = 'none';
		} else {
			dragging_enabled = true;

			windowEl.classList.remove('maximized');
			windowEl.style.left = '';
			windowEl.style.top = '';
			windowEl.style.right = '';
			windowEl.style.bottom = '';
			windowEl.style.width = `${+width / remModifier}rem`;
			windowEl.style.height = `${+height / remModifier}rem`;
			windowEl.style.transform = minimized_transform || 'none';
		}

		is_maximized = !is_maximized;
		apps.fullscreen[app_id] = is_maximized;

		await sleep(250);

		if (!preferences.reduced_motion) windowEl.style.transition = '';
	}

	function closeApp() {
		apps.open[app_id] = false;
		apps.fullscreen[app_id] = false;
	}

	function minimizeApp() {
		apps.open[app_id] = false;
		apps.fullscreen[app_id] = false;
	}

	function onAppDragStart() {
		focusApp();
		apps.is_being_dragged = true;
	}

	function onAppDragEnd() {
		apps.is_being_dragged = false;
	}

	onMount(() => windowEl?.focus());
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	role="application"
	class="container"
	class:dark={preferences.theme.scheme === 'dark'}
	class:active={apps.active === app_id}
	class:maximized={is_maximized}
	style:width="{+width / remModifier}rem"
	style:height="{+height / remModifier}rem"
	style:z-index={apps.z_indices[app_id] || 0}
	tabindex="-1"
	bind:this={windowEl}
	{@attach draggable(() => [
		controls({ allow: ControlFrom.selector('.app-window-drag-handle') }),
		bounds(BoundsFrom.viewport({ bottom: -120, top: 27.2, left: -120, right: -120 })),
		disabledComp,
		position({ default: defaultPosition }),
		events({ onDragStart: onAppDragStart, onDragEnd: onAppDragEnd }),
	])}
	onclick={focusApp}
	onkeydown={() => {}}
	out:windowCloseTransition
>
	<div class="tl-container {app_id}" use:elevation={'window-traffic-lights'}>
		<TrafficLights {app_id} on_maximize_click={maximizeApp} on_minimize_click={minimizeApp} on_close_app={closeApp} />
	</div>

	<AppNexus {app_id} is_being_dragged={apps.is_being_dragged} />
</section>

<style>
	.container {
		--elevated-shadow: 0px 8.5px 10px rgba(0, 0, 0, 0.115), 0px 68px 80px rgba(0, 0, 0, 0.23);

		width: 100%;
		height: 100%;

		display: grid;
		grid-template-rows: 1fr;

		position: absolute;

		will-change: left, top, width, height, transform;

		border-radius: 0.75rem;
		box-shadow: var(--elevated-shadow);

		cursor: var(--system-cursor-default), auto;

		&.maximized {
			inset: 0 !important;
			left: 0 !important;
			top: 0 !important;
			right: 0 !important;
			bottom: 0 !important;
			transform: none !important;
			width: 100% !important;
			height: 100% !important;
			border-radius: 0;
		}

		&.active {
			/* // --elevated-shadow: 0px 6.7px 12px rgba(0, 0, 0, 0.218), 0px 22.3px 40.2px rgba(0, 0, 0, 0.322),
      //   0px 100px 180px rgba(0, 0, 0, 0.54); */
			--elevated-shadow: 0px 8.5px 10px rgba(0, 0, 0, 0.28), 0px 68px 80px rgba(0, 0, 0, 0.56);
		}

		&.dark {
			& > :global(section),
			& > :global(div) {
				border-radius: inherit;
				box-shadow:
					inset 0 0 0 0.9px hsla(var(--system-color-dark-hsl), 0.3),
					0 0 0 1px hsla(var(--system-color-light-hsl), 0.5),
					var(--elevated-shadow);
			}
		}
	}

	.tl-container {
		position: absolute;
		top: 0.85rem;
		left: 0.85rem;
		z-index: 100;
		pointer-events: auto;

		/* // Necessary, as `.container` tries to apply shadow on it */
		box-shadow: none !important;
	}
</style>
