"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

// Match the upstream Scramjet-App initialization pattern.
scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function showError(error) {
	document.body.replaceChildren();

	const box = document.createElement("pre");
	box.textContent =
		"Proxy failed: " +
		(error instanceof Error ? error.stack || error.message : String(error));

	box.style.cssText =
		"position:fixed;inset:0;margin:0;padding:20px;box-sizing:border-box;" +
		"background:#fff;color:#b00020;font:14px/1.5 monospace;" +
		"white-space:pre-wrap;overflow:auto;";
	document.body.appendChild(box);
}

function getWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/"
	);
}

async function configureTransport() {
	const wispUrl = getWispUrl();

	// Epoxy is the preferred transport for this build.
	try {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		console.log("[proxy] Epoxy transport active");
		return "epoxy";
	} catch (epoxyError) {
		console.warn("[proxy] Epoxy failed, falling back to libcurl.", epoxyError);

		await connection.setTransport("/libcurl/index.mjs", [
			{ websocket: wispUrl },
		]);

		console.log("[proxy] libcurl transport active");
		return "libcurl";
	}
}

async function start() {
	try {
		// Register the dedicated worker exactly like the upstream demo, without
		// blocking Scramjet controller initialization on service-worker control.
		await registerSW();

		await configureTransport();

		const frame = scramjet.createFrame();
		frame.frame.id = "sj-frame";
		frame.frame.style.cssText =
			"width:100%;height:100%;border:0;margin:0;padding:0;" +
			"display:block;background:#fff;";

		document.body.appendChild(frame.frame);

		const sendUrl = (url) => {
			if (window.parent !== window) {
				window.parent.postMessage(
					{ type: "proxy-urlchange", url },
					location.origin,
				);
			}
		};

		const go = (url) => {
			if (!url || url === "about:blank") return;

			const target = /^https?:\/\//i.test(url)
				? url
				: "https://" + url;

			frame.go(target);
			sendUrl(target);
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
