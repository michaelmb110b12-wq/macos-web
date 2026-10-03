/// <reference lib="webworker" />

// The root service worker doubles as the site's PWA worker and Scramjet's
// network interception worker. Keeping it at the site root is important:
// GitHub Pages uses /macos-web/ while Bunny serves the same files at /.
// Relative loading makes the same worker work on both hosts.

importScripts("./scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

async function handleRequest(event: FetchEvent) {
	await scramjet.loadConfig();

	if (scramjet.route(event)) {
		return scramjet.fetch(event);
	}

	return fetch(event.request);
}

self.addEventListener("fetch", (event: FetchEvent) => {
	event.respondWith(handleRequest(event));
});
