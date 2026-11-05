const CACHE_NAME = 'fuel-app-v4';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

// Al hacer clic en la notificación flotante, abrir la app de inmediato
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-combustible') {
    event.waitUntil(sincronizarSegundoPlano());
  }
});

async function sincronizarSegundoPlano() {
  const db = await new Promise((res, rej) => {
    const req = indexedDB.open("FuelAppDB", 1);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  const tx = db.transaction("registros", "readonly");
  const records = await new Promise(res => {
    tx.objectStore("registros").getAll().onsuccess = (e) => res(e.target.result);
  });

  const pendientes = records.filter(r => !r.sincronizado);
  if (pendientes.length === 0) return;

  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySNFMDtC8frreTJAMQfTMKMkG6MqYtTCpk5qK4Y6VhnDc8WWXPfPL2k6cMw7hFqy4JZQ/exec";

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(pendientes)
    });

    const writeTx = db.transaction("registros", "readwrite");
    const store = writeTx.objectStore("registros");
    pendientes.forEach(item => {
      item.sincronizado = true;
      store.put(item);
    });
  } catch (err) {
    console.error("Error en sincronización en segundo plano:", err);
  }
}