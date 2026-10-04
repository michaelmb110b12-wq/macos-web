importScripts("../scram/scramjet.all.js");

async function removeIncompatibleDatabase() {
	await new Promise((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			resolve();
		};

		try {
			const request = indexedDB.open("$scramjet");

			request.onerror = finish;

			request.onupgradeneeded = () => {
				// Creating the database without an explicit version gives Scramjet
				// its normal starting version. Close it immediately.
				try {
					request.result.close();
				} catch {}
			};

			request.onsuccess = () => {
				const db = request.result;
			const version = db.version;
			db.close();

			// Older experimental workers created version 2, while Scramjet 1.1
			// opens this database at version 1. IndexedDB cannot downgrade, so
			// remove the incompatible database and let Scramjet recreate it.
			if (version > 1) {
				const deletion = indexedDB.deleteDatabase("$scramjet");
				deletion.onsuccess = finish;
				deletion.onerror = finish;
				deletion.onblocked = () => {
					setTimeout(() => {
						try {
							const retry = indexedDB.deleteDatabase("$scramjet");
							retry.onsuccess = finish;
							retry.onerror = finish;
							retry.onblocked = finish;
						} catch {
							finish();
						}
					}, 250);
				};
				return;
			}

			finish();
		};
	} catch {
		resolve();
	}
});
}

let scramjetPromise;

async function getScramjet() {
	if (!scramjetPromise) {
		const { ScramjetServiceWorker } = $scramjetLoadWorker();
		scramjetPromise = Promise.resolve(new ScramjetServiceWorker());
	}
	return scramjetPromise;
}

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			await removeIncompatibleDatabase();
			await self.clients.claim();
		})(),
	);
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
