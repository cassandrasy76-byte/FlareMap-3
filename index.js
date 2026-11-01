
const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  defineString
} = require("firebase-functions/params");

const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const ADMIN_EMAILS =
  defineString("FLAREMAP_ADMIN_EMAILS");


// =====================================
// VERIFY ADMINISTRATOR
// =====================================

function requireAdmin(request) {

  const user = request.auth?.token;

  if (
    !user ||
    !user.email ||
    user.email_verified !== true
  ) {
    throw new HttpsError(
      "unauthenticated",
      "A verified administrator sign-in is required."
    );
  }

  const allowedEmails = ADMIN_EMAILS.value()
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedEmails.includes(user.email.toLowerCase())) {
    throw new HttpsError(
      "permission-denied",
      "Administrator access required."
    );
  }
}


// =====================================
// REGISTER A DEVICE
// =====================================

exports.registerFlareMapDevice = onCall(
  { region: "asia-southeast1" },

  async request => {

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please sign in first."
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
        "Invalid notification token."
      );
    }

    const id = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await admin.firestore()
      .collection("flaremapDevices")
      .doc(id)
      .set({
        token,
        registeredAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true };
  }
);


// =====================================
// SEND ADMINISTRATOR ALARM
// =====================================

exports.sendFlareMapAlarm = onCall(
  { region: "asia-southeast1" },

  async request => {

    requireAdmin(request);

    const snapshot = await admin.firestore()
      .collection("flaremapDevices")
      .get();

    const tokens = [
      ...new Set(
        snapshot.docs
          .map(doc => doc.data().token)
          .filter(token => typeof token === "string")
      )
    ];

    if (tokens.length === 0) {
      return {
        sent: 0,
        failed: 0,
        message: "No registered devices."
      };
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < tokens.length; i += 500) {

      const batch = tokens.slice(i, i + 500);

      const result = await admin.messaging()
        .sendEachForMulticast({
          tokens: batch,

          data: {
            title: "FlareMap Alert",
            body: "An administrator has sent a FlareMap notification.",
            type: "admin_alert"
          },

          webpush: {
            headers: {
              Urgency: "high"
            }
          }
        });

      sent += result.successCount;
      failed += result.failureCount;
    }

    return {
      sent,
      failed
    };
  }
);
