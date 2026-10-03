import { create_app_config } from '🍎/helpers/create-app-config.ts';

const wallpapers = create_app_config({
	title: 'Wallpapers',
	resizable: true,
	height: 600,
	width: 800,
	dock_breaks_before: true,
});

const calculator = create_app_config({
	title: 'Calculator',
	expandable: true,
	resizable: false,
	height: 250 * 1.414,
	width: 250,
});

const calendar = create_app_config({
	title: 'Calendar',
	resizable: true,
});

const games = create_app_config({
	title: 'Games',
	resizable: true,
	height: 500,
	width: 700,
});

const finder = create_app_config({
	title: 'Finder',
	resizable: true,
	should_open_window: false,
});

const safari = create_app_config({
	title: 'Safari',
	resizable: true,
	height: 650,
	width: 1000,
});

const appstore = create_app_config({
	title: 'App Store',
	resizable: true,
});

const linuxVm = create_app_config({
	title: 'Linux VM',
	resizable: true,
	should_open_window: false,
});

export const apps_config = {
	finder,
	wallpapers,
	calculator,
	calendar,
	games,
	safari,
	appstore,
	'view-source': linuxVm,
};