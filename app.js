// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyANFcISiv0jZL7U4sefd5i0eIUqG7r7MDU",
  authDomain: "flaremap-a1849.firebaseapp.com",
  projectId: "flaremap-a1849",
  storageBucket: "flaremap-a1849.firebasestorage.app",
  messagingSenderId: "931766029438",
  appId: "1:931766029438:web:69557ac21ea3882c109c2f"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const messaging = firebase.messaging();
const functions = firebase.functions();
// FlareMap - Dashboard Demo

const temperatureDisplay = document.getElementById("temperature");
const humidityDisplay = document.getElementById("humidity");
const smokeDisplay = document.getElementById("smoke");
const connectionDisplay = document.getElementById("connection");
const alertDisplay = document.getElementById("alert");

// Demo readings only — not real sensor data.
function updateDashboard() {
  const temperature = (25 + Math.random() * 5).toFixed(1);
  const humidity = Math.round(50 + Math.random() * 15);
  const smoke = Math.round(100 + Math.random() * 80);

  temperatureDisplay.textContent = temperature + " °C";
  humidityDisplay.textContent = humidity + " %";
  smokeDisplay.textContent = smoke;

  connectionDisplay.textContent = "ESP32: Demo mode";
  alertDisplay.textContent = "Status: Sample readings only";
}

// Update sample values every 3 seconds.
updateDashboard();
setInterval(updateDashboard, 3000);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
navigator.serviceWorker.register("./serviceworker.js");
  });
}

// =====================================
// FLAREMAP ADMIN AND PUSH NOTIFICATIONS
// =====================================

// Replace this with your Firebase Web Push public VAPID key.
// Get it from Firebase Console > Project settings >
// Cloud Messaging > Web Push certificates.
const FLAREMAP_VAPID_KEY = "BKxUMBei3vHExEPRaHhDrw0g0NJaO7r21gA5r0sG3fP-Y-qTgg9_t1_7ZMDKyg4Lwp0vHeNdK8deiPqvAEYk6Ds";

// This only controls whether the admin panel is displayed.
// The Cloud Function independently verifies admin authorization.
const FLAREMAP_ADMIN_EMAILS = [
  "cassandrasy76@gmail.com"
];

const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const enablePushButton = document.getElementById("enablePushButton");
const broadcastAlarmButton = document.getElementById("broadcastAlarmButton");

const adminLoginPanel = document.getElementById("adminLogin");
const adminControls = document.getElementById("adminControls");
const adminMessage = document.getElementById("adminMessage");

const flareFunctions = firebase.app().functions("asia-southeast1");

function showAdminMessage(message) {
  if (adminMessage) {
    adminMessage.textContent = message;
  }
}

function isFlareMapAdmin(user) {
  return Boolean(
    user &&
    user.email &&
    user.emailVerified &&
    FLAREMAP_ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

// Update administrator controls when authentication changes.
auth.onAuthStateChanged((user) => {
  const isAdmin = isFlareMapAdmin(user);

  if (adminLoginPanel) {
    adminLoginPanel.hidden = isAdmin;
  }

  if (adminControls) {
    adminControls.hidden = !isAdmin;
  }

  if (user && !isAdmin) {
    showAdminMessage(
      "This account does not have administrator access."
    );
  } else if (isAdmin) {
    showAdminMessage("Administrator signed in.");
  }
});

// Administrator sign-in.
adminLoginButton?.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  if (!email || !password) {
    showAdminMessage("Enter your email and password.");
    return;
  }

  adminLoginButton.disabled = true;

  try {
    const result = await auth.signInWithEmailAndPassword(
      email,
      password
    );

    if (!result.user.emailVerified) {
      showAdminMessage(
        "Please verify your email before using administrator features."
      );
      await auth.signOut();
      return;
    }

    if (!isFlareMapAdmin(result.user)) {
      showAdminMessage("Administrator access denied.");
      await auth.signOut();
      return;
    }

    showAdminMessage("Administrator signed in successfully.");
  } catch (error) {
    showAdminMessage("Sign-in failed: " + error.message);
  } finally {
    adminLoginButton.disabled = false;
  }
});

// Administrator sign-out.
adminLogoutButton?.addEventListener("click", async () => {
  try {
    await auth.signOut();
    showAdminMessage("Signed out.");
  } catch (error) {
    showAdminMessage("Sign-out failed: " + error.message);
  }
});

// Register this device for Firebase push notifications.
enablePushButton?.addEventListener("click", async () => {
  enablePushButton.disabled = true;

  try {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported.");
    }

    if (!("Notification" in window)) {
      throw new Error("Notifications are not supported.");
    }

    if (
      FLAREMAP_VAPID_KEY ===
      "BKxUMBei3vHExEPRaHhDrw0g0NJaO7r21gA5r0sG3fP-Y-qTgg9_t1_7ZMDKyg4Lwp0vHeNdK8deiPqvAEYk6Ds"
    ) {
      throw new Error("Add your Web Push public VAPID key first.");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }

    if (!auth.currentUser) {
      await auth.signInAnonymously();
    }

    const supported = await firebase.messaging.isSupported();

    if (!supported) {
      throw new Error("Firebase Messaging is not supported here.");
    }

    const registration = await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: FLAREMAP_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      throw new Error("Firebase did not provide a device token.");
    }

    const registerDevice =
      flareFunctions.httpsCallable("registerFlareMapDevice");

    await registerDevice({ token });

    showAdminMessage(
      "Notifications enabled and this device registered."
    );
  } catch (error) {
    showAdminMessage("Registration failed: " + error.message);
  } finally {
    enablePushButton.disabled = false;
  }
});

// Send an administrator-only broadcast.
broadcastAlarmButton?.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!isFlareMapAdmin(user)) {
    showAdminMessage("Administrator access required.");
    return;
  }

  const confirmed = window.confirm(
    "Send a FlareMap alert notification to registered devices?"
  );

  if (!confirmed) return;

  broadcastAlarmButton.disabled = true;

  try {
    const sendAlarm =
      flareFunctions.httpsCallable("sendFlareMapAlarm");

    const result = await sendAlarm();

    showAdminMessage(
      "Broadcast request completed. Sent: " +
      result.data.sent +
      ", failed: " +
      result.data.failed
    );
  } catch (error) {
    showAdminMessage("Broadcast failed: " + error.message);
  } finally {
    broadcastAlarmButton.disabled = false;
  }
});
