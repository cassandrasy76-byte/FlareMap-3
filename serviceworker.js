importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
); 

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyANFcISiv0jZL7U4sefd5i0eIUqG7r7MDU",
  authDomain: "flaremap-a1849.firebaseapp.com",
  projectId: "flaremap-a1849",
  storageBucket: "flaremap-a1849.firebasestorage.app",
  messagingSenderId: "931766029438",
  appId: "1:931766029438:web:69557ac21ea3882c109c2f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {

  const title =
    payload.data?.title || "FlareMap Alert";

  const options = {
    body:
      payload.data?.body ||
      "An administrator sent a FlareMap notification.",
    data: {
      url: "./"
    }
  };

  return self.registration.showNotification(
    title,
    options
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("./")
  );
});
