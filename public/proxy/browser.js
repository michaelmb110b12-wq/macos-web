"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";

const formUrl = (value) => {
	if (!value) return "";
	return /^https?:\/\//i.test(value) ? value : "https://" + value;
};

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

// This intentionally matches the upstream Scramjet-App behavior.
// Do not await init(): controller cookie/state initialization is asynchronous.
scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function useTransport() {
	const wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";

	// Epoxy support requested for this build. Fall back to the upstream
	// libcurl transport if Epoxy is not available on this connection.
	try {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		console.log("[scramjet] Epoxy transport active");
		return "epoxy";
	} catch (error) {
		console.warn("[scramjet] Epoxy transport failed, using libcurl", error);
		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);
		console.log("[scramjet] libcurl transport active");
		return "libcurl";
	}
}

function showError(error) {
	document.body.replaceChildren();

	const box = document.createElement("pre");
	box.textContent =
		"Proxy failed: " +
		(error instanceof Error ? error.message : String(error));
	box.style.cssText =
		"position:fixed;inset:0;margin:0;padding:24px;box-sizing:border-box;" +
		"white-space:pre-wrap;overflow:auto;background:#fff;color:#b00020;" +
		"font:14px/1.5 monospace;";
	document.body.appendChild(box);
}

async function start() {
	try {
		await registerSW();
		await useTransport();

		const frame = scramjet.createFrame();
		frame.frame.id = "sj-frame";
		frame.frame.style.cssText =
			"width:100%;height:100%;border:0;margin:0;padding:0;display:block;background:#fff;";

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
			const target = formUrl(url);
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
		console.error("[scramjet] proxy startup failed", error);
		showError(error);
	}
}

start();