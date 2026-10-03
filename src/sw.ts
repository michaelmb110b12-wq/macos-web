/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: (PrecacheEntry | string)[];
};

importScripts('/scram/scramjet.all.js');

const { ScramjetServiceWorker } = (self as any).$scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const serwist = new Serwist({
	precacheEntries: self.__WB_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
});

// Scramjet must receive requests before the normal PWA cache handler.
self.addEventListener(
	'fetch',
	(event) => {
		event.respondWith(
			(async () => {
				await scramjet.loadConfig();

				if (scramjet.route(event)) {
					return scramjet.fetch(event);
				}

				return fetch(event.request);
			})(),
		);
	},
	{ capture: true },
);

self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		event.waitUntil(self.skipWaiting());
	}
});

// Keep the original macOS PWA precaching behavior for normal app requests.
serwist.addEventListeners();
