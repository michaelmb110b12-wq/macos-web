"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";
const ROOT = new URL("../", location.href);
const SW_URL = new URL("scramjet/sw.js?v=20261003-bunny-v8", ROOT).href;
const SW_SCOPE = new URL("scramjet/", ROOT).pathname;

function normalizeUrl(value) {
	const trimmed = String(value || "").trim();
	if (!trimmed) return "";
	if (/^about:/i.test(trimmed)) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (trimmed.startsWith("/")) return new URL(trimmed, location.origin).href;
	return "https://" + trimmed;
}

async function prepareBunnyRuntime() {
	const reloadKey = "__bunny_root_sw_cleanup_v8";

	if ("serviceWorker" in navigator) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		const rootRegistrations = registrations.filter(
			(registration) => !registration.scope.endsWith("/scramjet/"),
		);

		if (rootRegistrations.length) {
			await Promise.all(
				rootRegistrations.map((registration) => registration.unregister()),
			);

			// The old root worker can remain the controller until navigation.
			// Reload exactly once after removing it.
			if (
				navigator.serviceWorker.controller &&
				sessionStorage.getItem(reloadKey) !== "1"
			) {
				sessionStorage.setItem(reloadKey, "1");
				location.reload();
				throw new Error("Reloading after removing the old Bunny root service worker.");
			}
		}
	}

	await ensureScramjetDatabase();
}

async function ensureScramjetDatabase() {
	const stores = [
		"config",
		"cookies",
		"redirectTrackers",
		"referrerPolicies",
		"publicSuffixList",
	];

	await new Promise((resolve, reject) => {
		const request = indexedDB.open("$scramjet");

		request.onerror = () => reject(request.error || new Error("Could not open Scramjet IndexedDB."));
		request.onupgradeneeded = () => {
			const db = request.result;
			for (const store of stores) {
				if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
			}
		};

		request.onsuccess = () => {
			const db = request.result;
			const missing = stores.filter((store) => !db.objectStoreNames.contains(store));
			const currentVersion = db.version;
			db.close();

			if (!missing.length) {
				resolve();
				return;
			}

			const upgrade = indexedDB.open("$scramjet", currentVersion + 1);
			upgrade.onerror = () =>
				reject(upgrade.error || new Error("Could not repair Scramjet IndexedDB."));
			upgrade.onupgradeneeded = () => {
				const database = upgrade.result;
				for (const store of missing) {
					if (!database.objectStoreNames.contains(store)) {
						database.createObjectStore(store);
					}
				}
			};
			upgrade.onsuccess = () => {
				upgrade.result.close();
				resolve();
			};
		};
	});
}


function showError(error) {
	document.body.replaceChildren();
	const box = document.createElement("pre");
	box.style.cssText =
		"position:fixed;inset:0;margin:0;padding:24px;box-sizing:border-box;" +
		"background:#fff;color:#b00020;font:14px/1.5 monospace;white-space:pre-wrap;overflow:auto;";
	box.textContent = "Proxy failed:\n" +
		(error instanceof Error ? error.stack || error.message : String(error));
	document.body.appendChild(box);
}

async function registerScramjetWorker() {
	if (!navigator.serviceWorker) throw new Error("Service workers are not supported.");

	const registration = await navigator.serviceWorker.register(SW_URL, {
		scope: SW_SCOPE,
		updateViaCache: "none",
	});

	await registration.update();
	await navigator.serviceWorker.ready;

	if (!registration.active) {
		throw new Error("Scramjet service worker did not activate.");
	}
}

async function configureTransport() {
	const connection = new BareMux.BareMuxConnection(
		new URL("../baremux/worker.js", ROOT).href,
	);
	const wisp = "wss://anura.pro/";
	const epoxy = new URL("../epoxy/index.mjs", ROOT).href;

	await connection.setTransport(epoxy, [{ wisp }]);
}

async function start() {
	try {
		await prepareBunnyRuntime();
		await registerScramjetWorker();

		const { ScramjetController } = $scramjetLoadController();
		const controller = new ScramjetController({
			prefix: SW_SCOPE,
			files: {
				wasm: new URL("scram/scramjet.wasm.wasm", ROOT).pathname,
				all: new URL("scram/scramjet.all.js", ROOT).pathname,
				sync: new URL("scram/scramjet.sync.js", ROOT).pathname,
			},
		});

		await controller.init();
		await configureTransport();

		const frame = controller.createFrame();
		frame.frame.id = "sj-frame";
		frame.frame.style.cssText =
			"position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;display:block;background:#fff;";
		document.body.appendChild(frame.frame);

		if (initialUrl !== "about:blank") {
			const target = normalizeUrl(initialUrl);
			if (target) frame.go(target);
		}
	} catch (error) {
		console.error("[bunny-proxy]", error);
		showError(error);
	}
}

start();
