const admin = require("firebase-admin");

let app;

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  app = admin.app();
}

module.exports = admin;