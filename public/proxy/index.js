"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";

const COOKIE_DB = "__scramjet_controller";
const COOKIE_STORE = "state";

function normalizeUrl(value) {
	if (!value) return "";
	return /^https?:\/\//i.test(value) ? value : "https://" + value;
}

function showError(error) {
	document.body.replaceChildren();

	const box = document.createElement("pre");
	box.textContent =
		"Proxy failed: " +
		(error instanceof Error ? error.stack || error.message : String(error));
	box.style.cssText =
		"position:fixed;inset:0;margin:0;padding:24px;box-sizing:border-box;" +
		"white-space:pre-wrap;overflow:auto;background:#fff;color:#b00020;" +
		"font:14px/1.5 monospace;";
	document.body.appendChild(box);
}

async function registerAndTakeControl() {
	const registration = await navigator.serviceWorker.register("./sw.js", {
		scope: "./",
		updateViaCache: "none",
	});

	await registration.update();
	await navigator.serviceWorker.ready;

	if (!navigator.serviceWorker.controller) {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Scramjet service worker did not take control.")),
				10000,
			);

			navigator.serviceWorker.addEventListener(
				"controllerchange",
				() => {
					clearTimeout(timeout);
					resolve();
				},
				{ once: true },
			);
		});
	}

	if (!navigator.serviceWorker.controller) {
		throw new Error("This Safari tab is not controlled by the Scramjet service worker.");
	}
}

function deleteCookieDatabase() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(COOKIE_DB);

		request.onsuccess = resolve;
		request.onerror = () =>
			reject(request.error || new Error("Could not reset Scramjet storage."));
		request.onblocked = () =>
			reject(
				new Error(
					"Scramjet storage is locked by another proxy tab. Close other proxy tabs and reload.",
				),
			);
	});
}

async function ensureScramjetDatabase() {
	if (!("indexedDB" in window)) return;

	const stateExists = await new Promise((resolve, reject) => {
		const request = indexedDB.open(COOKIE_DB);

		request.onupgradeneeded = () => {
			const db = request.result;

			// A fresh Scramjet database starts at version 1 with the "state" store.
			if (!db.objectStoreNames.contains(COOKIE_STORE)) {
				db.createObjectStore(COOKIE_STORE);
			}
		};

		request.onerror = () =>
			reject(request.error || new Error("Could not open Scramjet storage."));

		request.onsuccess = () => {
			const db = request.result;
			const exists = db.objectStoreNames.contains(COOKIE_STORE);
			db.close();
			resolve(exists);
		};
	});

	if (stateExists) return;

	// An older build can leave version 1 without the expected object store.
	// Repair it before ScramjetController opens the database.
	await deleteCookieDatabase();
}

async function createController() {
	const { ScramjetController } = $scramjetLoadController();

	const controller = new ScramjetController({
		files: {
			wasm: "/scram/scramjet.wasm.wasm",
			all: "/scram/scramjet.all.js",
			sync: "/scram/scramjet.sync.js",
		},
	});

	try {
		await controller.init();
		return controller;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		if (!message.includes("One of the specified object stores was not found")) {
			throw error;
		}

		console.warn("[scramjet] stale IndexedDB schema; resetting it once");
		await deleteCookieDatabase();

		const repaired = new ScramjetController({
			files: {
				wasm: "/scram/scramjet.wasm.wasm",
				all: "/scram/scramjet.all.js",
				sync: "/scram/scramjet.sync.js",
			},
		});

		await repaired.init();
		return repaired;
	}
}

async function configureTransport() {
	const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

	const wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";

	// Prefer Epoxy. If it cannot initialize, use the upstream libcurl transport.
	try {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		console.log("[scramjet] Epoxy transport active");
	} catch (epoxyError) {
		console.warn("[scramjet] Epoxy failed; falling back to libcurl", epoxyError);

		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);

		console.log("[scramjet] libcurl transport active");
	}
}

async function start() {
	try {
		await registerAndTakeControl();
		await ensureScramjetDatabase();

		const scramjet = await createController();

		await configureTransport();

		const frame = scramjet.createFrame();
		frame.frame.id = "sj-frame";
		frame.frame.style.cssText =
			"position:absolute;inset:0;width:100%;height:100%;" +
			"border:0;margin:0;padding:0;display:block;background:#fff;";

		document.body.appendChild(frame.frame);

		const postUrl = (url) => {
			if (window.parent !== window) {
				window.parent.postMessage(
					{ type: "proxy-urlchange", url },
					location.origin,
				);
			}
		};

		const go = (url) => {
			const target = normalizeUrl(url);
			if (!target) return;

			frame.go(target);
			postUrl(target);
		};

		window.addEventListener("message", (event) => {
			if (event.origin !== location.origin) return;

			if (
				event.data?.type === "navigate" &&
				typeof event.data.url === "string"
			) {
				go(event.data.url);
			}

			if (event.data?.type === "reload") {
				frame.reload();
			}
		});

		postUrl(initialUrl);

		if (initialUrl !== "about:blank") {
			go(initialUrl);
		}
	} catch (error) {
		console.error("[scramjet] startup failed", error);
		showError(error);
	}
}

start();
