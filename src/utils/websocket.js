const WebSocket = require("ws");

/**
 * Object to store user's WebSocket connections
 */
const userConnections = new Map();

/**
 * Function to initialize WebSocket server
 */
function initWebSocketServer(server) {
  wss = new WebSocket.Server({ server });

  // Handle WebSocket connections
  wss.on("connection", (ws, req) => {
    // Extract userId and deviceId from the query parameters
    const urlParams = new URLSearchParams(req.url.split("?")[1]);
    const userId = urlParams.get("userId");

    if (!userId) {
      ws.close();
      return;
    }

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }

    // Get the user's WebSocket connections
    const userSockets = userConnections.get(userId);

    if (!userSockets.has(ws)) {
      userSockets.add(ws);
    }

    ws.on("close", () => {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        userConnections.delete(userId);
      }
    });
  });

  return wss;
}

/**
 * Function to check for inactive clients and remove them
 */
setInterval(
  () => {
    userConnections.forEach((connections, userId) => {
      connections.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) {
          connections.delete(ws);
        }
      });

      if (connections.size === 0) {
        userConnections.delete(userId);
      }
    });
  },
  1000 * 60 * 5,
); // 5 minutes

/**
 * Function to send a message to all connections for a specific userId
 */
function sendMessageToClients(userId, type, payload = {}) {
  const user = userId.toString();
  const userSockets = userConnections.get(user);

  if (userSockets) {
    // Create a message object
    const message = JSON.stringify({ type, ...payload });
    userSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

module.exports = { initWebSocketServer, sendMessageToClients };
