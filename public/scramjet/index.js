"use strict";

const params = new URLSearchParams(location.search);
const initialUrl = params.get("url") || "about:blank";
const ROOT = new URL("./", location.href);
const SW_URL = new URL("sw.js", ROOT).href;
const SW_SCOPE = ROOT.pathname;
const RELOAD_KEY = "__scramjet_scope_reload";

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^about:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return new URL(trimmed, location.origin).href;
  return "https://" + trimmed;
}

function showError(error) {
  document.body.replaceChildren();
  const box = document.createElement("pre");
  box.textContent = "Scramjet failed: " + (error instanceof Error ? error.stack || error.message : String(error));
  box.style.cssText = "position:fixed;inset:0;margin:0;padding:24px;box-sizing:border-box;background:#fff;color:#b00020;font:14px/1.5 monospace;white-space:pre-wrap;overflow:auto;";
  document.body.appendChild(box);
}

async function ensureDedicatedServiceWorker() {
  if (!navigator.serviceWorker) throw new Error("Your browser does not support service workers.");
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE, updateViaCache: "none" });
  await registration.update();
  await navigator.serviceWorker.ready;
  const controller = navigator.serviceWorker.controller?.scriptURL || "";
  if (controller === SW_URL) {
    sessionStorage.removeItem(RELOAD_KEY);
    return true;
  }
  if (sessionStorage.getItem(RELOAD_KEY) !== "1") {
    sessionStorage.setItem(RELOAD_KEY, "1");
    location.reload();
    return false;
  }
  throw new Error("Scramjet service worker is installed, but /scramjet/ is still controlled by another worker.");
}

function getWispUrl() {
  return (localStorage.getItem("wispUrl") || "").trim() || "wss://anura.pro/";
}

async function configureTransport() {
  const connection = new BareMux.BareMuxConnection(new URL("../baremux/worker.js", ROOT).href);
  const epoxyUrl = new URL("../epoxy/index.mjs", ROOT).href;
  const libcurlUrl = "https://unpkg.com/@mercuryworkshop/libcurl-transport@1.5.2/dist/index.mjs";
  const wispUrl = getWispUrl();
  try {
    await connection.setTransport(epoxyUrl, [{ wisp: wispUrl }]);
    console.log("[scramjet] Epoxy transport active:", wispUrl);
  } catch (error) {
    console.warn("[scramjet] Epoxy failed; trying libcurl:", error);
    await connection.setTransport(libcurlUrl, [{ websocket: wispUrl }]);
    console.log("[scramjet] libcurl transport active:", wispUrl);
  }
}

async function createController() {
  const { ScramjetController } = $scramjetLoadController();
  const controller = new ScramjetController({
    prefix: ROOT.pathname,
    files: {
      wasm: new URL("../scram/scramjet.wasm.wasm", ROOT).pathname,
      all: new URL("../scram/scramjet.all.js", ROOT).pathname,
      sync: new URL("../scram/scramjet.sync.js", ROOT).pathname,
    },
  });
  await controller.init();
  return controller;
}

async function start() {
  try {
    if (!(await ensureDedicatedServiceWorker())) return;
    const scramjet = await createController();
    await configureTransport();
    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    frame.frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;display:block;background:#fff;";
    document.body.appendChild(frame.frame);
    if (window.parent !== window) window.parent.postMessage({ type: "proxy-ready", url: initialUrl }, location.origin);
    if (initialUrl !== "about:blank") {
      const target = normalizeUrl(initialUrl);
      if (target) frame.go(target);
    }
  } catch (error) {
    console.error("[scramjet] startup failed", error);
    showError(error);
    if (window.parent !== window) window.parent.postMessage({ type: "proxy-error", error: error instanceof Error ? error.message : String(error) }, location.origin);
  }
}

start();