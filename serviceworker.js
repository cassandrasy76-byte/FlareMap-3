importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

// Use the SAME Firebase configuration as app.js
firebase.initializeApp({
  apiKey: "AIzaSyANFcISiv0jZL7U4sefd5i0eIUqG7r7MDU",
  authDomain: "flaremap-a1849.firebaseapp.com",
  projectId: "flaremap-a1849",
  storageBucket: "flaremap-a1849.firebasestorage.app",
  messagingSenderId: "931766029438",
  appId: "1:931766029438:web:69557ac21ea3882c109c2f"
});

const messaging = firebase.messaging();
const CACHE_NAME = "flaremap-v2";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
messaging.onBackgroundMessage((payload) => {
  console.log("FlareMap background message received:", payload);

  const title = payload.data?.title || "FlareMap Alert";
  const options = {
    body: payload.data?.body || "A FlareMap alert has been received.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: {
      url: "./"
    }
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("./")
  );
});