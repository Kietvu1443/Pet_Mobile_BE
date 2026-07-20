const axios = require("axios");
const UserDevice = require("../models/UserDevice");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

async function sendPushNotifications(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  const chunks = [];
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    chunks.push(tokens.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    try {
      const messages = chunk.map((pushToken) => ({
        to: pushToken,
        title,
        body,
        data,
        sound: "default",
      }));

      const res = await axios.post(EXPO_PUSH_URL, messages, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      const ticketData = Array.isArray(res.data) ? res.data : res.data?.data || [];
      for (const ticket of ticketData) {
        if (ticket?.status === "error") {
          const errMsg = ticket?.message || "";
          if (
            errMsg.includes("DeviceNotRegistered") ||
            errMsg.includes("InvalidCredentials")
          ) {
            const idx = ticketData.indexOf(ticket);
            if (idx >= 0 && idx < chunk.length) {
              await UserDevice.unregister(chunk[idx]).catch(() => {});
            }
          } else {
            console.error("[expoPush] Ticket error:", errMsg);
          }
        }
      }
    } catch (error) {
      console.error("[expoPush] Batch send error:", error.message);
    }
  }
}

module.exports = { sendPushNotifications };
