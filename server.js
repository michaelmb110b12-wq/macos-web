import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';

import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const distPath = fileURLToPath(new URL('./dist/', import.meta.url));

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	dns_servers: ['1.1.1.1', '1.0.0.1'],
});

console.log('[startup] loading macOS Web server');
console.log('[startup] PORT =', process.env.PORT ?? '(not set)');
console.log('[startup] dist =', distPath);

const fastify = Fastify({
	logger: true,
});

fastify.addHook('onSend', async (_request, reply) => {
	reply.header('Cross-Origin-Opener-Policy', 'same-origin');
	reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
});

await fastify.register(fastifyStatic, {
	root: distPath,
	decorateReply: true,
});

await fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: '/scram/',
	decorateReply: false,
});

await fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: '/epoxy/',
	decorateReply: false,
});

await fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: '/baremux/',
	decorateReply: false,
});

fastify.get('/health', async () => ({ ok: true }));

fastify.setNotFoundHandler(async (_request, reply) => {
	try {
		return await reply.sendFile('index.html');
	} catch {
		return reply.code(500).type('text/plain').send('macOS Web frontend is not built.');
	}
});

fastify.server.on('upgrade', (req, socket, head) => {
	try {
		const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

		if (pathname === '/wisp/' || pathname === '/wisp') {
			req.url = '/wisp/';
			wisp.routeRequest(req, socket, head);
			return;
		}

		socket.destroy();
	} catch {
		socket.destroy();
	}
});

const port = Number(process.env.PORT || 8080);

try {
	const address = await fastify.listen({
		port,
		host: '0.0.0.0',
	});

	console.log(`[startup] macOS Web listening at ${address}`);
	console.log(`[startup] host = ${hostname()}`);
} catch (error) {
	console.error('[startup] FAILED TO LISTEN', error);
	process.exit(1);
}

const shutdown = async (signal) => {
	console.log(`[shutdown] received ${signal}`);
	try {
		await fastify.close();
	} finally {
		process.exit(0);
	}
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
