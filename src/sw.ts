/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: (PrecacheEntry | string)[];
};

const serwist = new Serwist({
	precacheEntries: self.__WB_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

serwist.addEventListeners();
