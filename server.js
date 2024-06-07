require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server, {
  cors: {
    origin: ["http://localhost:5173", "http://192.168.58.15:5173"],
    methods: ["GET", "POST"],
  },
});

// Set the views directory and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static files from the 'public' directory
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Render the index.ejs template for the root path
app.get('/', (req, res) => {
  res.render('index');
});

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET;

// Authentication middleware
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// Get user data endpoint
app.get('/user', authenticateUser, (req, res) => {
  res.json({ username: req.user.username });
});

// WebSocket logic
const users = {};
const socketToRoom = {};
const roomToUsers = {};

io.on("connection", (socket) => {
  console.log("New Connections :", socket.id);

  socket.on("get room name", (roomKey, callback) => {
    const room = roomToUsers[roomKey];
    if (room) {
      callback(room.roomName);
    } else {
      callback(null);
    }
  });

  socket.on("join room", ({ roomKey, username }) => {
    const room = roomToUsers[roomKey];
    if (room) {
      room.users.push(username);
      users[socket.id] = { username, roomKey };
      socket.join(roomKey);
      io.to(roomKey).emit("user joined", `${username} has joined the room`, roomKey);
      io.to(roomKey).emit("online users", room.users);
    } else {
      socket.emit("join failed");
    }
  });

  socket.on("offer", (payload) => {
    try {
      io.to(payload.target).emit("offer", payload);
    } catch (error) {
      console.error("Error in offer event:", error);
    }
  });

  socket.on("answer", (payload) => {
    try {
      io.to(payload.target).emit("answer", payload);
    } catch (error) {
      console.error("Error in answer event:", error);
    }
  });

  socket.on("ice-candidate", (payload) => {
    try {
      io.to(payload.target).emit("ice-candidate", payload);
    } catch (error) {
      console.error("Error in ice-candidate event:", error);
    }
  });

  socket.on("delete room", (roomKey) => {
    if (roomToUsers[roomKey]) {
      roomToUsers[roomKey].users.forEach((username) => {
        io.to(roomKey).emit("user left", `${username} has left the room`, roomKey);
      });
      delete roomToUsers[roomKey];
    }
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      const { username, roomKey } = user;
      const room = roomToUsers[roomKey];

      if (room) {
        room.users = room.users.filter(user => user !== username);
        io.to(roomKey).emit("user left", `${username} has left the room`, roomKey);
        io.to(roomKey).emit("online users", room.users);
      }
    }
    delete users[socket.id];
  });
});

// Start the server
const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

