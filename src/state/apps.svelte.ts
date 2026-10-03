import type { apps_config } from '🍎/configs/apps/apps-config';

export type AppID = keyof typeof apps_config;

export const apps = $state({
	open: {
		wallpapers: false,
		finder: true,
		calculator: false,
		calendar: false,
		games: false,
		safari: false,
		appstore: false,
		'view-source': true,
	} as Record<AppID, boolean>,

	active: 'finder' satisfies AppID,
	active_z_index: -2,

	z_indices: {
		wallpapers: 0,
		finder: 0,
		calculator: 0,
		calendar: 0,
		games: 0,
		safari: 0,
		appstore: 0,
		'view-source': 0,
	} as Record<AppID, number>,

	is_being_dragged: false as boolean,
	pending_navigation: null as string | null,

	fullscreen: {
		wallpapers: false,
		finder: false,
		calculator: false,
		calendar: false,
		games: false,
		safari: false,
		appstore: false,
		'view-source': false,
	} as Record<AppID, boolean>,
});