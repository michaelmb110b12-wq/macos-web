"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";

const COOKIE_DB = "__scramjet_controller";
const COOKIE_STORE = "state";

function normalizeUrl(value) {
	const trimmed = String(value || "").trim();
	if (!trimmed) return "";

	if (/^about:/i.test(trimmed)) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;

	if (trimmed.startsWith("/")) {
		return new URL(trimmed, location.origin).href;
	}

	return "https://" + trimmed;
}

function showError(error) {
	document.body.replaceChildren();

	const box = document.createElement("pre");
	box.textContent =
		"Proxy failed: " +
		(error instanceof Error ? error.stack || error.message : String(error));

	box.style.cssText =
		"position:fixed;inset:0;margin:0;padding:24px;box-sizing:border-box;" +
		"background:#fff;color:#b00020;font:14px/1.5 monospace;" +
		"white-space:pre-wrap;overflow:auto;";

	document.body.appendChild(box);
}

function ensureScramjetDatabase() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(COOKIE_DB);

		request.onerror = () => {
			reject(request.error || new Error("Could not open Scramjet IndexedDB."));
		};

		request.onupgradeneeded = () => {
			const db = request.result;

			if (!db.objectStoreNames.contains(COOKIE_STORE)) {
				db.createObjectStore(COOKIE_STORE);
			}
		};

		request.onsuccess = () => {
			const db = request.result;

			if (db.objectStoreNames.contains(COOKIE_STORE)) {
				db.close();
				resolve();
				return;
			}

			const nextVersion = db.version + 1;
			db.close();

			const upgrade = indexedDB.open(COOKIE_DB, nextVersion);

			upgrade.onerror = () => {
				reject(
					upgrade.error ||
						new Error("Could not repair the Scramjet IndexedDB schema."),
				);
			};

			upgrade.onblocked = () => {
				reject(
					new Error(
						"Scramjet storage is locked by another tab. Close other proxy tabs and reload.",
					),
				);
			};

			upgrade.onupgradeneeded = () => {
				const repaired = upgrade.result;

				if (!repaired.objectStoreNames.contains(COOKIE_STORE)) {
					repaired.createObjectStore(COOKIE_STORE);
				}
			};

			upgrade.onsuccess = () => {
				upgrade.result.close();
				resolve();
			};
		};
	});
}

async function registerProxyServiceWorker() {
	if (!navigator.serviceWorker) {
		throw new Error("Your browser does not support service workers.");
	}

	const registration = await navigator.serviceWorker.register("./sw.js", {
		scope: "./",
		updateViaCache: "none",
	});

	await registration.update();
	await navigator.serviceWorker.ready;

	const expectedController = new URL("./sw.js", location.href).href;
	const currentController =
		navigator.serviceWorker.controller?.scriptURL || "";

	if (currentController === expectedController) {
		sessionStorage.removeItem("__macos_proxy_scope_reload");
		return true;
	}

	// A previous root PWA worker can still control the document. One reload
	// lets the newly-active /proxy/ worker become the controller.
	if (sessionStorage.getItem("__macos_proxy_scope_reload") !== "1") {
		sessionStorage.setItem("__macos_proxy_scope_reload", "1");
		location.reload();
		return false;
	}

	throw new Error(
		"The /proxy/ service worker is installed but this tab is still controlled by another worker.",
	);
}

const DEFAULT_WISP_URL = "wss://wisp-scramjet-mac.hostless.app/wisp/";

function getWispUrl() {
	const configured = localStorage.getItem("wispUrl");
	return configured || DEFAULT_WISP_URL;
}

async function configureTransport() {
	const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
	const wispUrl = getWispUrl();

	// Epoxy is the preferred transport requested for this build.
	try {
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}

		console.log("[proxy] Epoxy transport active");
		return connection;
	} catch (epoxyError) {
		console.warn("[proxy] Epoxy unavailable, falling back to libcurl.", epoxyError);

		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [
				{ websocket: wispUrl },
			]);
		}

		console.log("[proxy] libcurl transport active");
		return connection;
	}
}

async function createScramjetController() {
	await ensureScramjetDatabase();

	const { ScramjetController } = $scramjetLoadController();

	const controller = new ScramjetController({
		files: {
			wasm: "/scram/scramjet.wasm.wasm",
			all: "/scram/scramjet.all.js",
			sync: "/scram/scramjet.sync.js",
		},
	});

	controller.init();
	return controller;
}

async function start() {
	try {
		const controlled = await registerProxyServiceWorker();
		if (!controlled) return;

		const scramjet = await createScramjetController();
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

		const go = (value) => {
			const url = normalizeUrl(value);

			if (!url || url === "about:blank") return;

			frame.go(url);
			postUrl(url);
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
				if (typeof frame.reload === "function") {
					frame.reload();
				} else if (frame.url) {
					frame.go(frame.url);
				}
			}
		});

		if (window.parent !== window) {
			window.parent.postMessage(
				{ type: "proxy-ready", url: initialUrl },
				location.origin,
			);
		}

		if (initialUrl !== "about:blank") {
			go(initialUrl);
		}
	} catch (error) {
		console.error("[proxy] startup failed", error);
		showError(error);

		if (window.parent !== window) {
			window.parent.postMessage(
				{
					type: "proxy-error",
					error: error instanceof Error ? error.message : String(error),
				},
				location.origin,
			);
		}
	}
}

start();
