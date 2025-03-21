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

    if (!userId) {
      ws.close();
      return;
    }

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }

    // Get the user's WebSocket connections
    const userSockets = userConnections.get(userId);

    // console.log("userSockets", userSockets);

    // Set a flag for checking if the client is alive
    ws.isAlive = true;

    // Handle WebSocket errors to prevent crashes
    ws.on("error", (error) => {
      console.error(`❌ WebSocket error for user ${userId}:`, error);
    });

    // Handle incoming pong responses (client should send 'pong' back)
    ws.on("pong", () => {
      ws.isAlive = true; // Mark client as alive when pong received
    });

    // Add the WebSocket to the user's Set
    userSockets.add(ws);

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
        if (!ws.isAlive) {
          ws.terminate(); // Terminate the connection
          connections.delete(ws); // Remove the connection from the Set
        } else {
          ws.isAlive = false; // Mark as inactive until pong is received
          ws.ping(); // Send ping to client
        }
      });

      if (connections.size === 0) {
        userConnections.delete(userId);
      }
    });
  },
  1000 * 30, // 30 seconds,
);

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
        ws.send(message); // Send the message to the client
      }
    });
  }
}

module.exports = { initWebSocketServer, sendMessageToClients };
