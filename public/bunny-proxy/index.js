"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";
const ROOT = new URL("../", location.href);
const SW_URL = new URL("scramjet/sw.js?v=20261003-bunny-v7", ROOT).href;
const SW_SCOPE = new URL("scramjet/", ROOT).pathname;

function normalizeUrl(value) {
	const trimmed = String(value || "").trim();
	if (!trimmed) return "";
	if (/^about:/i.test(trimmed)) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (trimmed.startsWith("/")) return new URL(trimmed, location.origin).href;
	return "https://" + trimmed;
}

async function resetBrokenBunnyRuntime() {
	const resetKey = "__bunny_scramjet_runtime_reset_v6";

	if (sessionStorage.getItem(resetKey) === "1") return;

	// Remove stale root service workers left by earlier Bunny deployments.
	// The dedicated /scramjet/ worker is intentionally kept.
	if ("serviceWorker" in navigator) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(
			registrations
				.filter((registration) => !registration.scope.endsWith("/scramjet/"))
				.map((registration) => registration.unregister()),
		);
	}

	// Older Bunny deployments could leave a partially-created $scramjet
	// IndexedDB database behind. Scramjet 1.1 expects its complete schema
	// (config, cookies, redirectTrackers, referrerPolicies, publicSuffixList).
	await new Promise((resolve) => {
		try {
			const request = indexedDB.deleteDatabase("$scramjet");
			request.onsuccess = resolve;
			request.onerror = resolve;
			request.onblocked = () => setTimeout(resolve, 250);
		} catch {
			resolve();
		}
	});

	sessionStorage.setItem(resetKey, "1");
	location.reload();
	throw new Error("Reloading Bunny proxy after clearing stale Scramjet state.");
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
		await resetBrokenBunnyRuntime();
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
