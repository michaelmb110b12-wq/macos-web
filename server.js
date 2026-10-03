import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { readFile } from 'node:fs/promises';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';

import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const distPath = fileURLToPath(new URL('./dist/', import.meta.url));
const proxyPath = fileURLToPath(new URL('./public/proxy/', import.meta.url));

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	dns_servers: ['1.1.1.1', '1.0.0.1'],
});

const fastify = Fastify({
	logger: true,
	serverFactory: (handler) =>
		createServer()
			.on('request', (req, res) => {
				res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
				res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
				handler(req, res);
			})
			.on('upgrade', (req, socket, head) => {
				const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

				if (pathname === '/wisp/' || pathname === '/wisp') {
					req.url = '/wisp/';
					wisp.routeRequest(req, socket, head);
				} else {
					socket.destroy();
				}
			}),
});

fastify.get('/', async (_request, reply) => {
	const html = await readFile(fileURLToPath(new URL('./dist/index.html', import.meta.url)), 'utf8');
	return reply.type('text/html; charset=utf-8').send(html);
});

fastify.get('/index.html', async (_request, reply) => {
	const html = await readFile(fileURLToPath(new URL('./dist/index.html', import.meta.url)), 'utf8');
	return reply.type('text/html; charset=utf-8').send(html);
});

await fastify.register(fastifyStatic, {
	root: proxyPath,
	prefix: '/proxy/',
	index: 'index.html',
	decorateReply: false,
});

await fastify.register(fastifyStatic, {
	root: distPath,
	index: 'index.html',
	decorateReply: true,
});

await fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: '/scram/',
	decorateReply: false,
});

await fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: '/libcurl/',
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

fastify.get('/proxy', async (_request, reply) => {
	return reply.redirect('/proxy/');
});

fastify.setNotFoundHandler(async (_request, reply) => {
	try {
		return await reply.sendFile('index.html');
	} catch {
		return reply.code(500).type('text/plain').send('macOS Web frontend is not built.');
	}
});

const port = Number(process.env.PORT || 8080);

try {
	const address = await fastify.listen({
		port,
		host: '0.0.0.0',
	});

	console.log('[startup] macOS Web listening at', address);
	console.log('[startup] host =', hostname());
} catch (error) {
	console.error('[startup] FAILED TO LISTEN', error);
	process.exit(1);
}

const shutdown = async (signal) => {
	console.log('[shutdown] received', signal);
	try {
		await fastify.close();
	} finally {
		process.exit(0);
	}
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
