const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

exports.ping = onRequest((request, response) => {
  logger.info("Functions emulator ping", {
    method: request.method,
    path: request.path,
  });

  response.json({
    emulator: process.env.FUNCTIONS_EMULATOR === "true",
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG || null,
    service: "functions",
    success: true,
    timestamp: new Date().toISOString(),
  });
});
