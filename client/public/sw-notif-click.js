/* sw-notif-click.js — imported into the generated service worker
   (see vite.config.js workbox.importScripts). Handles taps on the daily
   diary reminder: focuses the open app tab or launches the app. */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    (async () => {
      try {
        const allClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of allClients) {
          try {
            await client.navigate(targetUrl);
          } catch (_) {
            // navigate() may fail for cross-origin clients — focus anyway
          }
          if ('focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      } catch (_) {
        try {
          if (clients.openWindow) return clients.openWindow(targetUrl);
        } catch (_) {}
      }
    })()
  );
});
