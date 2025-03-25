const WebSocket = require("ws");

/**
 * Object to store user's WebSocket connections
 */
const userConnections = new Map();

let wss; // Declare WebSocket Server instance globally

/**
 * Function to initialize WebSocket server
 */
function initWebSocketServer(server) {
  wss = new WebSocket.Server({ server });

  // Handle WebSocket server-level errors
  wss.on("error", (error) => {
    console.error("🔥 WebSocket Server Error:", error);
  });

  // Handle WebSocket connections
  wss.on("connection", (ws, req) => {
    // Extract userId and deviceId from the query parameters
    const urlParams = new URLSearchParams(req.url.split("?")[1]);
    const userId = urlParams.get("userId");
    const deviceId = urlParams.get("deviceId");

    if (!userId || !deviceId) {
      ws.close();
      return;
    }

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Map());
    }

    const deviceMap = userConnections.get(userId);

    // Close existing device connection if exists
    const existingWs = deviceMap.get(deviceId);
    if (existingWs && typeof existingWs.terminate === "function") {
      console.log(`⚠️ Terminating duplicate for ${userId} | ${deviceId}`);
      existingWs.terminate();
    }

    // Set a flag for checking if the client is alive
    ws.isAlive = true;

    // Store the new connection
    deviceMap.set(deviceId, ws);

    // Handle incoming pong responses (client should send 'pong' back)
    ws.on("pong", () => {
      ws.isAlive = true; // Mark client as alive when pong received
    });

    // Close the WebSocket connection
    ws.on("close", () => {
      deviceMap.delete(deviceId);
      if (deviceMap.size === 0) {
        userConnections.delete(userId);
      }
    });

    // Handle WebSocket errors to prevent crashes
    ws.on("error", (err) => {
      console.error(`💥 WebSocket error for ${userId}-${deviceId}:`, err);
    });
  });

  return wss;
}

/**
 * Function to check for inactive clients and remove them
 */
setInterval(() => {
  userConnections.forEach((deviceMap, userId) => {
    deviceMap.forEach((ws, deviceId) => {
      if (!ws || typeof ws.terminate !== "function") {
        deviceMap.delete(deviceId);
        return;
      }
      if (!ws.isAlive) {
        ws.terminate();
        deviceMap.delete(deviceId);
      } else {
        ws.isAlive = false;
        ws.ping();
      }
    });

    if (deviceMap.size === 0) {
      userConnections.delete(userId);
    }
  });
}, 30000); // Check every 30 seconds

/**
 * Function to send a message to all connections for a specific userId
 * @param {String} userId - User ID
 * @param {String} type - Message type
 * @param {Object} payload - Message payload
 */
function sendMessageToClients(userId, type, payload = {}) {
  const user = userId.toString();
  const message = JSON.stringify({ type, ...payload });

  const deviceMap = userConnections.get(user);
  if (!deviceMap) return;

  deviceMap.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

module.exports = { initWebSocketServer, sendMessageToClients };
