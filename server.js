import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const distPath=fileURLToPath(new URL('./dist/',import.meta.url));
logging.set_level(logging.NONE);
Object.assign(wisp.options,{allow_udp_streams:false,dns_servers:['1.1.1.1','1.0.0.1']});

const fastify=Fastify({
	serverFactory:(handler)=>createServer()
		.on('request',(req,res)=>{
			res.setHeader('Cross-Origin-Opener-Policy','same-origin');
			res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
			handler(req,res);
		})
		.on('upgrade',(req,socket,head)=>{
			const path=new URL(req.url??'/', 'http://localhost').pathname;
			if(path==='/wisp/') wisp.routeRequest(req,socket,head);
			else socket.end();
		})
});

await fastify.register(fastifyStatic,{root:distPath,decorateReply:true});
await fastify.register(fastifyStatic,{root:scramjetPath,prefix:'/scram/',decorateReply:false});
await fastify.register(fastifyStatic,{root:epoxyPath,prefix:'/epoxy/',decorateReply:false});
await fastify.register(fastifyStatic,{root:baremuxPath,prefix:'/baremux/',decorateReply:false});
fastify.setNotFoundHandler(async(_,reply)=>reply.sendFile('index.html'));
await fastify.listen({port:Number(process.env.PORT||8080),host:'0.0.0.0'});