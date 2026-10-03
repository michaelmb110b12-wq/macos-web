"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";
const SITE_ROOT = new URL("../", location.href);


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
	const connection = new BareMux.BareMuxConnection(new URL("baremux/worker.js", SITE_ROOT).href);

	const wispUrl = getWispUrl();

	// Both transports are published as browser ESM bundles. Use the exact
	// 2.x transport version compatible with the Scramjet 1.1 / bare-mux 2 setup.
	const epoxyUrl = new URL("../epoxy/index.mjs", SITE_ROOT).href;

	const libcurlUrl =
		"https://unpkg.com/@mercuryworkshop/libcurl-transport@1.5.2/dist/index.mjs";

	try {
		await connection.setTransport(epoxyUrl, [{ wisp: wispUrl }]);
		console.log("[proxy] Epoxy transport active");
		return connection;
	} catch (epoxyError) {
		console.warn("[proxy] Epoxy failed, using libcurl.", epoxyError);
		await connection.setTransport(libcurlUrl, [{ websocket: wispUrl }]);
		console.log("[proxy] libcurl transport active");
		return connection;
	}
}

async function createScramjetController() {
	const { ScramjetController } = $scramjetLoadController();

	const controller = new ScramjetController({
		// Keep Scramjet's rewritten URLs inside /proxy/ so the scoped
		// /proxy/sw.js service worker can intercept them on GitHub Pages.
		prefix: new URL("proxy/scramjet/", SITE_ROOT).pathname,
		files: {
			wasm: new URL("scram/scramjet.wasm.wasm", SITE_ROOT).pathname,
			all: new URL("scram/scramjet.all.js", SITE_ROOT).pathname,
			sync: new URL("scram/scramjet.sync.js", SITE_ROOT).pathname,
		},
	});

	await controller.init();
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
