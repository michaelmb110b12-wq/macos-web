import http from "node:http";

const port = Number(process.env.PORT || 8080);

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

server.listen(port, "0.0.0.0", () => {
	console.log("[wisp-health] listening on 0.0.0.0:" + port);
});
