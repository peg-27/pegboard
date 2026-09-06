const CACHE_NAME = 'peg-board-v5.0.0';
const FILES_TO_CACHE = [
  '/pegboard/',
  '/pegboard/manifest.json',
  '/pegboard/icon-192.png',
  '/pegboard/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          // 現行キャッシュと共有画像用の一時キャッシュ以外を削除
          if (key !== CACHE_NAME && key !== 'share-target-temp') {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 共有画像の受け取り（Share Target API）
  if (event.request.method === 'POST' && url.pathname === '/pegboard/') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const image = formData.get('image');
      if (image) {
        const cache = await caches.open('share-target-temp');
        await cache.put('shared-image', new Response(image));
      }
      return Response.redirect('/pegboard/?shared=true', 303);
    })());
    return;
  }

  // 更新チェック用のリクエストは横取りせず素通しさせる
  // → ?fresh= が付いたものは必ずネットから取る
  if (url.searchParams.has('fresh')) {
    return;
  }

  // ページ本体（HTML）はキャッシュ優先
  // → 起動が速い。新しい版があるかどうかはページ側の更新チェックが調べる。
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('/pegboard/');
      if (cached) return cached;
      try {
        const fresh = await fetch(new Request('/pegboard/', { cache: 'reload' }));
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/pegboard/', fresh.clone());
        return fresh;
      } catch (e) {
        return caches.match('/pegboard/');
      }
    })());
    return;
  }

  // その他のファイル（アイコン等）はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
