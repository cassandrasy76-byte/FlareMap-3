// =====================================
// FLAREMAP FIREBASE CONFIGURATION
// =====================================

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

const functions =
  firebase.app().functions("asia-southeast1");

let messaging = null;


// =====================================
// ADMINISTRATOR SETTINGS
// =====================================

const ADMIN_EMAILS = [
  "cassandrasy76@gmail.com"
];

const VAPID_KEY =
  "BKxUMBei3vHExEPRaHhDrw0g0NJaO7r21gA5r0sG3fP-Y-qTgg9_t1_7ZMDKyg4Lwp0vHeNdK8deiPqvAEYk6Ds";


// =====================================
// HTML ELEMENTS
// =====================================

const el = id => document.getElementById(id);

const emailInput = el("adminEmail");
const passwordInput = el("adminPassword");

const loginButton = el("adminLoginButton");
const resendButton = el("resendVerificationButton");
const logoutButton = el("adminLogoutButton");

const pushButton = el("enablePushButton");
const alarmButton = el("broadcastAlarmButton");

const loginPanel = el("adminLogin");
const adminControls = el("adminControls");
const adminMessage = el("adminMessage");

function showMessage(message) {
  if (adminMessage) {
    adminMessage.textContent = message;
  }
}


// =====================================
// ADMINISTRATOR AUTHORIZATION
// =====================================

function isFlareMapAdmin(user) {
  return Boolean(
    user &&
    user.email &&
    user.emailVerified &&
    ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

function updateAdminInterface(user) {
  const allowed = isFlareMapAdmin(user);

  loginPanel.hidden = allowed;
  adminControls.hidden = !allowed;

  if (
    user &&
    user.email &&
    !user.emailVerified &&
    ADMIN_EMAILS.includes(user.email.toLowerCase())
  ) {
    showMessage(
      "Your email is not verified. Use Resend Verification Email."
    );
  } else if (allowed) {
    showMessage("Administrator signed in.");
  } else if (user) {
    showMessage("This account does not have administrator access.");
  }
}

auth.onAuthStateChanged(updateAdminInterface);


// =====================================
// DEMO SENSOR VALUES
// =====================================

function updateDashboard() {
  el("temperature").textContent =
    (25 + Math.random() * 5).toFixed(1) + " °C";

  el("humidity").textContent =
    Math.round(50 + Math.random() * 15) + " %";

  el("mq5").textContent =
    Math.round(100 + Math.random() * 80);

  el("mq7").textContent =
    Math.round(100 + Math.random() * 80);

  el("connection").textContent = "Demo mode";

  el("roomStatus").textContent =
    "Demo readings only";

  el("alert").textContent = "SAMPLE DATA";

  el("lastUpdated").textContent =
    "Updated: " + new Date().toLocaleTimeString();
}

updateDashboard();

setInterval(updateDashboard, 5000);


// =====================================
// ADMINISTRATOR LOGIN
// =====================================

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Enter your email and password.");
    return;
  }

  loginButton.disabled = true;

  try {
    const result =
      await auth.signInWithEmailAndPassword(email, password);

    await result.user.reload();

    const user = auth.currentUser;

    if (!user.emailVerified) {
      showMessage(
        "Email not verified. Click Resend Verification Email."
      );
      return;
    }

    if (!isFlareMapAdmin(user)) {
      await auth.signOut();
      showMessage("Administrator access denied.");
      return;
    }

    updateAdminInterface(user);

    showMessage("Administrator login successful.");

  } catch (error) {
    console.error(error);

    showMessage(
      "Login failed: " + error.message
    );

  } finally {
    loginButton.disabled = false;
  }
});


// =====================================
// RESEND VERIFICATION EMAIL
// =====================================

resendButton.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    showMessage(
      "Sign in first before requesting a verification email."
    );
    return;
  }

  try {
    await user.sendEmailVerification();

    showMessage(
      "Verification email sent. Check your inbox and spam folder."
    );

  } catch (error) {
    showMessage(
      "Could not send verification email: " + error.message
    );
  }
});


// =====================================
// ADMINISTRATOR LOGOUT
// =====================================

logoutButton.addEventListener("click", async () => {
  try {
    await auth.signOut();
    showMessage("Signed out.");

  } catch (error) {
    showMessage(error.message);
  }
});


// =====================================
// ENABLE PUSH NOTIFICATIONS
// =====================================

pushButton.addEventListener("click", async () => {
  pushButton.disabled = true;

  try {
    if (!isFlareMapAdmin(auth.currentUser)) {
      throw new Error("Verified administrator access required.");
    }

    if (
      !("serviceWorker" in navigator) ||
      !("Notification" in window)
    ) {
      throw new Error("Notifications are not supported.");
    }

    if (!(await firebase.messaging.isSupported())) {
      throw new Error(
        "Firebase Messaging is not supported in this browser."
      );
    }

    if (!messaging) {
      messaging = firebase.messaging();
    }

    const permission =
      await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }

    const registration =
      await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      throw new Error("Firebase did not return a device token.");
    }

    const registerDevice =
      functions.httpsCallable("registerFlareMapDevice");

    await registerDevice({ token });

    showMessage(
      "This device is registered for FlareMap notifications."
    );

  } catch (error) {
    console.error(error);

    showMessage(
      "Notification setup failed: " + error.message
    );

  } finally {
    pushButton.disabled = false;
  }
});


// =====================================
// ADMIN-ONLY ALARM BUTTON
// =====================================

alarmButton.addEventListener("click", async () => {

  if (!isFlareMapAdmin(auth.currentUser)) {
    showMessage(
      "Only a verified administrator can send an alarm."
    );
    return;
  }

  const confirmed = confirm(
    "Send a FlareMap notification to registered devices?"
  );

  if (!confirmed) return;

  alarmButton.disabled = true;

  try {
    const sendAlarm =
      functions.httpsCallable("sendFlareMapAlarm");

    const result = await sendAlarm();

    showMessage(
      "Alarm request completed. Sent: " +
      result.data.sent +
      ", failed: " +
      result.data.failed
    );

  } catch (error) {
    console.error(error);

    showMessage(
      "Alarm failed: " + error.message
    );

  } finally {
    alarmButton.disabled = false;
  }
});


// =====================================
// SERVICE WORKER
// =====================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./serviceworker.js")
      .catch(error => console.error(
        "Service worker registration failed:", error
      ));
  });
}
