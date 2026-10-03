"use strict";

let reloadAttempted = sessionStorage.getItem("__macos_proxy_sw_reload") === "1";

async function registerSW() {
	if (!navigator.serviceWorker) {
		throw new Error("Service workers are unavailable.");
	}

	// Use the original macOS service worker at the site root. It already
	// contains the Scramjet fetch handler and has scope over /proxy/.
	const registration = await navigator.serviceWorker.register("/sw.js", {
		scope: "/",
		updateViaCache: "none",
	});

	await registration.update();
	await navigator.serviceWorker.ready;

	if (navigator.serviceWorker.controller) {
		sessionStorage.removeItem("__macos_proxy_sw_reload");
		return registration;
	}

	// A newly installed root worker cannot control the current document until
	// the document is navigated/reloaded. Do that once, then verify control.
	if (!reloadAttempted) {
		sessionStorage.setItem("__macos_proxy_sw_reload", "1");
		location.reload();
		return registration;
	}

	throw new Error(
		"The root Scramjet service worker is installed but is not controlling this tab. Reload the page once more.",
	);
}