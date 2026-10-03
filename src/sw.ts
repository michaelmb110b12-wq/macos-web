/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: (PrecacheEntry | string)[];
	$scramjetLoadWorker?: () => { ScramjetServiceWorker: new () => any };
};

importScripts('./scram/scramjet.all.js');

const ScramjetServiceWorker = self.$scramjetLoadWorker?.().ScramjetServiceWorker;
const scramjet = ScramjetServiceWorker ? new ScramjetServiceWorker() : null;

const serwist = new Serwist({
	precacheEntries: self.__WB_MANIFEST,
	skipWaiting: false,
	clientsClaim: true,
	navigationPreload: true,
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

if (scramjet) {
	self.addEventListener('fetch', (event) => {
		event.respondWith(
			(async () => {
				await scramjet.loadConfig();
				if (scramjet.route(event)) {
					return scramjet.fetch(event);
				}
				return fetch(event.request);
			})(),
		);
	});
}

serwist.addEventListeners();
