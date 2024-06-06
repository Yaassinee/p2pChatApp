const os = require("os");
const express = require("express");
const app = express();
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

app.set('view engine', 'ejs');

app.get("/", function (req, res) {
  res.render("index");
});

const server = http.createServer(app);
const io = socketIO(server);

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join room", ({ room, username }) => {
    socket.join(room);
    console.log(`${username} joined room ${room}`);
    io.in(room).emit("user joined", `${username} has joined the room`, room);
  });

  socket.on("leave room", ({ room, username }) => {
    socket.leave(room);
    console.log(`${username} left room ${room}`);
    io.in(room).emit("user left", `${username} has left the room`, room);
  });

  socket.on("message", ({ room, message, username }) => {
    io.in(room).emit("message", { message, username, room });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});







