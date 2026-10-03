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
	skipWaiting: false,
	clientsClaim: true,
	navigationPreload: true,
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	event.stopImmediatePropagation();
	event.respondWith((async () => {
		await scramjet.loadConfig();
		if (scramjet.route(event)) return scramjet.fetch(event);
		return fetch(event.request);
	})());
}, { capture: true });

serwist.addEventListeners();
