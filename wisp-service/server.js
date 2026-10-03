import http from "node:http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const port = Number(process.env.PORT || 8080);

logging.set_level(logging.NONE);

Object.assign(wisp.options, {
	wisp_version: 2,
	allow_private_ips: false,
	allow_loopback_ips: false,
	dns_servers: ["1.1.1.1", "1.0.0.1"],
	dns_result_order: "ipv4first",
});

const server = http.createServer((req, res) => {
	const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

	if (pathname === "/" || pathname === "/health") {
		res.writeHead(200, {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
		});
		res.end("Wisp server is running.");
		return;
	}

	res.writeHead(404, {
		"Content-Type": "text/plain; charset=utf-8",
	});
	res.end("Not found");
});

server.on("upgrade", (req, socket, head) => {
	const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

	if (pathname === "/wisp" || pathname === "/wisp/") {
		req.url = "/wisp/";
		wisp.routeRequest(req, socket, head);
		return;
	}

	socket.destroy();
});

server.listen(port, "0.0.0.0", () => {
	console.log("[wisp] listening on 0.0.0.0:" + port);
	console.log("[wisp] endpoint: /wisp/");
});