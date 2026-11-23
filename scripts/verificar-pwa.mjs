import assert from "node:assert/strict";
const origen = process.env.PREVIEW_URL ?? "http://127.0.0.1:3100";
const pagina = await fetch(origen);
assert.equal(pagina.status, 200);
const html = await pagina.text();
assert.match(html, /manifest\.webmanifest/);
assert.match(html, /apple-touch-icon/);
assert.match(html, /Pizza Republic/);
const respuesta = await fetch(`${origen}/manifest.webmanifest`);
assert.equal(respuesta.status, 200);
const manifest = await respuesta.json();
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "/");
for (const icono of manifest.icons) {
  const r = await fetch(`${origen}${icono.src}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /image\/png/);
  const png = Buffer.from(await r.arrayBuffer());
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  const [w, h] = icono.sizes.split("x").map(Number);
  assert.equal(png.readUInt32BE(16), w);
  assert.equal(png.readUInt32BE(20), h);
}
const sw = await fetch(`${origen}/sw.js`);
assert.equal(sw.status, 200);
assert.match(sw.headers.get("cache-control"), /no-store/);
assert.equal((await fetch(`${origen}/offline.html`)).status, 200);
console.log("PWA: página, metadatos, manifiesto, dimensiones de íconos, service worker y página offline correctos.");
