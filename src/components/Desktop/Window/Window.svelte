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
	let previousWindowStyles: Record<string, { value: string; priority: string }> | null = null;
	const windowStyleProperties = [
		'position',
		'top',
		'right',
		'bottom',
		'left',
		'width',
		'height',
		'transform',
		'border-radius',
	];

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

		const shouldMaximize = !is_maximized;

		if (!preferences.reduced_motion) {
			windowEl.style.transition =
				'height 0.3s ease, width 0.3s ease, transform 0.3s ease, top 0.3s ease, left 0.3s ease';
		}

		if (shouldMaximize) {
			// Save the exact inline geometry so restore preserves the window's
			// previous position and any size chosen by the user.
			previousWindowStyles = {};
			for (const property of windowStyleProperties) {
				previousWindowStyles[property] = {
					value: windowEl.style.getPropertyValue(property),
					priority: windowEl.style.getPropertyPriority(property),
				};
			}

			dragging_enabled = false;
			windowEl.style.setProperty('position', 'absolute', 'important');
			windowEl.style.setProperty('top', '0', 'important');
			windowEl.style.setProperty('right', '0', 'important');
			windowEl.style.setProperty('bottom', '0', 'important');
			windowEl.style.setProperty('left', '0', 'important');
			windowEl.style.setProperty('width', '100%', 'important');
			windowEl.style.setProperty('height', '100%', 'important');
			windowEl.style.setProperty('transform', 'none', 'important');
			windowEl.style.setProperty('border-radius', '0', 'important');
			is_maximized = true;
		} else {
			dragging_enabled = true;

			if (previousWindowStyles) {
				for (const property of windowStyleProperties) {
					const saved = previousWindowStyles[property];
					if (saved?.value) {
						windowEl.style.setProperty(property, saved.value, saved.priority);
					} else {
						windowEl.style.removeProperty(property);
					}
				}
			}
			previousWindowStyles = null;
			is_maximized = false;
		}

		apps.fullscreen[app_id] = shouldMaximize;

		await sleep(300);

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

	type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se';

	function resizeFromCorner(event: PointerEvent, direction: ResizeDirection) {
		if (!windowEl || apps_config[app_id].resizable === false || is_maximized) return;

		event.preventDefault();
		event.stopPropagation();

		const rect = windowEl.getBoundingClientRect();
		const startWidth = rect.width;
		const startHeight = rect.height;
		const startLeft = rect.left;
		const startTop = rect.top;
		const startTransform = getComputedStyle(windowEl).transform;
		let transformX = 0;
		let transformY = 0;

		try {
			const matrix = new DOMMatrix(startTransform);
			transformX = matrix.m41;
			transformY = matrix.m42;
		} catch {
			// Keep the transform at zero if the browser cannot parse it.
		}

		const minWidth = 360;
		const minHeight = 240;
		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startY = event.clientY;

		const move = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;

			let nextWidth = startWidth;
			let nextHeight = startHeight;
			let nextTransformX = transformX;
			let nextTransformY = transformY;

			if (direction.includes('e')) nextWidth = startWidth + dx;
			if (direction.includes('s')) nextHeight = startHeight + dy;

			if (direction.includes('w')) {
				nextWidth = startWidth - dx;

				if (nextWidth < minWidth) {
					nextWidth = minWidth;
					nextTransformX = transformX - (minWidth - startWidth);
				} else {
					nextTransformX = transformX + dx;
				}
			}

			if (direction.includes('n')) {
				nextHeight = startHeight - dy;

				if (nextHeight < minHeight) {
					nextHeight = minHeight;
					nextTransformY = transformY - (minHeight - startHeight);
				} else {
					nextTransformY = transformY + dy;
				}
			}

			nextWidth = Math.max(minWidth, nextWidth);
			nextHeight = Math.max(minHeight, nextHeight);

			windowEl.style.width = `${nextWidth}px`;
			windowEl.style.height = `${nextHeight}px`;

			if (direction.includes('w') || direction.includes('n')) {
				windowEl.style.transform =
					`translate(${nextTransformX}px, ${nextTransformY}px)`;
			}
		};

		const stop = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', stop);
			window.removeEventListener('pointercancel', stop);
			windowEl?.releasePointerCapture?.(pointerId);
		};

		windowEl.setPointerCapture?.(pointerId);
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', stop, { once: true });
		window.addEventListener('pointercancel', stop, { once: true });
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
		<TrafficLights
			{app_id}
			on_maximize_click={maximizeApp}
			on_minimize_click={minimizeApp}
			on_close_app={closeApp}
		/>
	</div>

	{#if apps_config[app_id].resizable !== false && !is_maximized}
		<div class="resize-handle resize-nw" aria-hidden="true" onpointerdown={(event) => resizeFromCorner(event, 'nw')}></div>
		<div class="resize-handle resize-ne" aria-hidden="true" onpointerdown={(event) => resizeFromCorner(event, 'ne')}></div>
		<div class="resize-handle resize-sw" aria-hidden="true" onpointerdown={(event) => resizeFromCorner(event, 'sw')}></div>
		<div class="resize-handle resize-se" aria-hidden="true" onpointerdown={(event) => resizeFromCorner(event, 'se')}></div>
	{/if}

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

		will-change: width, height;

		border-radius: 0.75rem;
		box-shadow: var(--elevated-shadow);

		cursor: var(--system-cursor-default), auto;

		&.maximized {
			top: 0;
			left: 0;
			width: 100% !important;
			height: 100% !important;
			transform: none !important;
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

	.resize-handle {
		position: absolute;
		z-index: 120;
		width: 14px;
		height: 14px;
		background: transparent;
		touch-action: none;
		user-select: none;
	}

	.resize-nw {
		top: 0;
		left: 0;
		cursor: nwse-resize;
	}

	.resize-ne {
		top: 0;
		right: 0;
		cursor: nesw-resize;
	}

	.resize-sw {
		bottom: 0;
		left: 0;
		cursor: nesw-resize;
	}

	.resize-se {
		bottom: 0;
		right: 0;
		cursor: nwse-resize;
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
