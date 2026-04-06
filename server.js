const express = require("express");
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const { mountSocketHandlers } = require("./server/socketHandlers");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  
  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Mount logic handlers
  mountSocketHandlers(io);

  // Serve soundtrack files as static assets
  expressApp.use('/audio', express.static('soundtracks'));

  // Handle all HTTP traffic via Next.js
  expressApp.all(/(.*)/, (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
