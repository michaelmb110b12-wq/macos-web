"use strict";

const stockSW = "./sw.js";

async function registerSW() {
	if (!navigator.serviceWorker) {
		throw new Error("Your browser does not support service workers.");
	}

	if (
		location.protocol !== "https:" &&
		location.hostname !== "localhost" &&
		location.hostname !== "127.0.0.1"
	) {
		throw new Error("Service workers require HTTPS.");
	}

	const registration = await navigator.serviceWorker.register(stockSW, {
		scope: "./",
		updateViaCache: "none",
	});

	await registration.update();
	return registration;
}
