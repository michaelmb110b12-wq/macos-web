importScripts("../scram/scramjet.all.js");

const REQUIRED_STORES = [
	"config",
	"cookies",
	"redirectTrackers",
	"referrerPolicies",
	"publicSuffixList",
];

function openDatabase(version) {
	return new Promise((resolve, reject) => {
		const request =
			version === undefined
				? indexedDB.open("$scramjet")
				: indexedDB.open("$scramjet", version);

		request.onerror = () =>
			reject(request.error || new Error("Unable to open Scramjet IndexedDB."));

		request.onupgradeneeded = () => {
			const db = request.result;
			for (const store of REQUIRED_STORES) {
				if (!db.objectStoreNames.contains(store)) {
					db.createObjectStore(store);
				}
			}
		};

		request.onsuccess = () => {
			resolve(request.result);
		};
	});
}

const databaseReady = (async () => {
	let db = await openDatabase();
	const missing = REQUIRED_STORES.filter(
		(store) => !db.objectStoreNames.contains(store),
	);

	if (missing.length) {
		const nextVersion = db.version + 1;
		db.close();
		db = await openDatabase(nextVersion);
	}

	db.close();
})();

let scramjetPromise;

async function getScramjet() {
	await databaseReady;

	if (!scramjetPromise) {
		scramjetPromise = Promise.resolve(
			new $scramjetLoadWorker().ScramjetServiceWorker(),
		);
	}

	return scramjetPromise;
}

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			await databaseReady;
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("message", (event) => {
	if (event.data?.scramjet$type === "loadConfig") {
		// The controller sends its current configuration to whichever
		// Scramjet worker controls the proxy client. No special handling needed.
	}
});

async function handleRequest(event) {
	const scramjet = await getScramjet();
	await scramjet.loadConfig();

	if (scramjet.route(event)) {
		return scramjet.fetch(event);
	}

	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
