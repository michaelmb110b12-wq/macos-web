/// <reference lib="webworker" />

import type { PrecacheEntry } from 'serwist';
import { Serwist } from 'serwist';

declare global {
	interface WorkerGlobalScope {
		__WB_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

importScripts('./scram/scramjet.all.js');

const { ScramjetServiceWorker } = self.$scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const serwist = new Serwist({
	precacheEntries: self.__WB_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
});

self.skipWaiting();

self.addEventListener('install', serwist.handleInstall);

self.addEventListener('activate', (event) => {
	self.clients.claim();
	serwist.handleActivate(event);
});

self.addEventListener('fetch', (event) => {
	event.respondWith(
		(async () => {
			try {
				await scramjet.loadConfig();

				// Scramjet only handles its encoded /scramjet/ URLs.
				// The normal /proxy/index.html page is therefore left alone.
				if (scramjet.route(event)) {
					return await scramjet.fetch(event);
				}
			} catch (error) {
				console.error('[Scramjet] request failed:', error);
				if (new URL(event.request.url).pathname.includes('/scramjet/')) {
					return new Response('Scramjet request failed.', {
						status: 502,
						headers: { 'Content-Type': 'text/plain; charset=utf-8' },
					});
				}
			}

			const cached = await serwist.handleRequest({
				request: event.request,
				event,
			});

			return cached || fetch(event.request);
		})(),
	);
});
