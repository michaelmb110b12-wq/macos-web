importScripts("./scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

async function handleRequest(event) {
	try {
		await scramjet.loadConfig();

		if (scramjet.route(event)) {
			return await scramjet.fetch(event);
		}
	} catch (error) {
		console.error("[Scramjet] fetch failed:", error);
		if (["document", "iframe"].includes(event.request.destination)) {
			throw error;
		}
	}

	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});