
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");

const { initializeApp } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const crypto = require("crypto");

initializeApp();

const db = getFirestore();

// Must match the name in functions/.env
const ADMIN_EMAILS = defineString("FLAREMAP_ADMIN_EMAILS");

setGlobalOptions({
  region: "asia-southeast1",
  maxInstances: 5
});

// Check whether the caller is an authorized, verified administrator.
function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Please sign in."
    );
  }

  const email = request.auth.token.email?.toLowerCase();
  const emailVerified = request.auth.token.email_verified;

  const allowedEmails = ADMIN_EMAILS.value()
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  if (
    !email ||
    !emailVerified ||
    !allowedEmails.includes(email)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Verified administrator access required."
    );
  }
}

// Register a device's FCM token.
exports.registerFlareMapDevice = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before registering this device."
    );
  }

  const token = request.data?.token;

  if (
    typeof token !== "string" ||
    token.length < 20 ||
    token.length > 4096
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid device token."
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  await db
    .collection("flareMapDevices")
    .doc(tokenHash)
    .set({
      token,
      uid: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp()
    });

  return { success: true };
});

// Send an administrator-authorized broadcast.
exports.sendFlareMapAlarm = onCall(async (request) => {
  requireAdmin(request);

  const lockRef = db
    .collection("flareMapControl")
    .doc("broadcast");

  const now = Date.now();

  // Prevent repeated broadcasts within 30 seconds.
  await db.runTransaction(async (transaction) => {
    const lock = await transaction.get(lockRef);

    const lastSent = lock.exists
      ? lock.data().lastSentAt?.toMillis() || 0
      : 0;

    if (now - lastSent < 30000) {
      throw new HttpsError(
        "resource-exhausted",
        "Please wait 30 seconds before sending another alert."
      );
    }

    transaction.set(lockRef, {
      lastSentAt: FieldValue.serverTimestamp(),
      sentBy: request.auth.uid
    });
  });

  const snapshot = await db
    .collection("flareMapDevices")
    .get();

  const docs = snapshot.docs;

  let sent = 0;
  let failed = 0;

  // FCM multicast supports up to 500 tokens per batch.
  for (let i = 0; i < docs.length; i += 500) {
    const batch = docs.slice(i, i + 500);

    const validDocs = batch.filter(doc => {
      const token = doc.data().token;
      return typeof token === "string" && token.length > 0;
    });

    if (validDocs.length === 0) continue;

    const tokens = validDocs.map(doc => doc.data().token);

    const result = await getMessaging().sendEachForMulticast({
      tokens,

      // Data-only message: the service worker handles display.
      data: {
        type: "FLAREMAP_ALARM",
        durationMs: "10000",
        title: "FlareMap Alert",
        body: "An administrator has sent a FlareMap alert."
      },

      android: {
        priority: "high",
        ttl: 60000
      },

      webpush: {
        headers: {
          TTL: "60"
        }
      }
    });

    sent += result.successCount;
    failed += result.failureCount;

    // Remove tokens that Firebase confirms are no longer valid.
    const cleanup = db.batch();

    result.responses.forEach((response, index) => {
      const code = response.error?.code;

      if (
        !response.success &&
        (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        )
      ) {
        cleanup.delete(validDocs[index].ref);
      }
    });

    await cleanup.commit();
  }

  return {
    success: true,
    sent,
    failed
  };
});
