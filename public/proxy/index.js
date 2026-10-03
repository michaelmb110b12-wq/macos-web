"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";
const SITE_ROOT = new URL("../", location.href);

function normalizeUrl(value) {
	const trimmed = String(value || "").trim();
	if (!trimmed) return "";
	if (/^about:/i.test(trimmed)) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (trimmed.startsWith("/")) return new URL(trimmed, location.origin).href;
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

const DEFAULT_WISP_URL = "wss://anura.pro/";

function getWispUrl() {
	const configured = (localStorage.getItem("wispUrl") || "").trim();
	if (!configured || /hostless\.app/i.test(configured)) {
		localStorage.setItem("wispUrl", DEFAULT_WISP_URL);
		return DEFAULT_WISP_URL;
	}
	return configured;
}

async function registerProxyServiceWorker() {
	// The site-root service worker handles both the macOS app and Scramjet.
	// Do not install a second worker under /proxy/; that caused stale
	// configurations to intercept /proxy/index.html itself.
	if (!navigator.serviceWorker) {
		throw new Error("Your browser does not support service workers.");
	}
	await navigator.serviceWorker.ready;
	return true;
}

async function configureTransport() {
	if (!globalThis.BareMux?.BareMuxConnection) {
		throw new Error("BareMux failed to load.");
	}

	const connection = new BareMux.BareMuxConnection(
		new URL("baremux/worker.js", SITE_ROOT).href,
	);

	const wispUrl = getWispUrl();
	const epoxyUrl = new URL("epoxy/index.mjs", SITE_ROOT).href;

	await connection.setTransport(epoxyUrl, [{ wisp: wispUrl }]);
	return connection;
}

async function createScramjetController() {
	if (typeof globalThis.$scramjetLoadController !== "function") {
		throw new Error("Scramjet runtime failed to load.");
	}

	const { ScramjetController } = globalThis.$scramjetLoadController();

	const controller = new ScramjetController({
		// The proxy worker is scoped to /proxy/, so keep Scramjet's
		// rewritten URLs in that exact scope.
		prefix: new URL("scramjet/", SITE_ROOT).pathname,
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
		await registerProxyServiceWorker();

		const scramjet = await createScramjetController();
		await configureTransport();

		const iframe = document.createElement("iframe");
		iframe.id = "sj-frame";
		iframe.style.cssText =
			"position:absolute;inset:0;width:100%;height:100%;" +
			"border:0;margin:0;padding:0;display:block;background:#fff;";
		document.body.appendChild(iframe);

		const frame = scramjet.createFrame(iframe);

		const postUrl = (url) => {
			if (window.parent !== window) {
				window.parent.postMessage({ type: "proxy-urlchange", url }, location.origin);
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
				if (typeof frame.reload === "function") frame.reload();
			}
		});

		if (window.parent !== window) {
			window.parent.postMessage(
				{ type: "proxy-ready", url: initialUrl },
				location.origin,
			);
		}

		if (initialUrl !== "about:blank") go(initialUrl);
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
