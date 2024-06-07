import { saveChat, getChats, saveUserRoom, getUserRooms, createRoom } from './database.js';

export function initializeChat(socket, webrtc, userData) {
  let currentRoom = null;
  const { username } = userData;

  const createRoomButton = document.getElementById("create-room");
  const joinRoomButton = document.getElementById("join-room");
  const sendMessageButton = document.getElementById("send-message");
  const disconnectButton = document.getElementById("disconnect");
  const messageInput = document.getElementById("message");
  const messagesContainer = document.getElementById("messages");
  const roomsContainer = document.getElementById("rooms-container");
  const chatHeader = document.getElementById("chat-header");
  const chatRoomName = document.getElementById("chat-room-name");
  const roomNameInput = document.getElementById("room-name");
  const roomKeyInput = document.getElementById("room-key");
  const createdRoomInfo = document.getElementById("created-room-info");
  const createdRoomName = document.getElementById("created-room-name");
  const createdRoomKey = document.getElementById("created-room-key");
  const onlineUsersContainer = document.getElementById("online-users");

  document.getElementById("username-display").innerText = username;

  createRoomButton.addEventListener("click", async () => {
    const roomName = roomNameInput ? roomNameInput.value.trim() : null;

    if (roomName) {
      const room = await createRoom(roomName);
      if (room) {
        createdRoomName.innerText = room.roomName;
        createdRoomKey.innerText = room.roomKey;
        createdRoomInfo.style.display = 'block';
        await saveUserRoom(username, room.roomKey, room.roomName);
        addRoomToList(room.roomKey, room.roomName);
      } else {
        alert("Error creating room. Please try again.");
      }
    } else {
      alert("Room name cannot be empty.");
    }
  });

  joinRoomButton.addEventListener("click", async () => {
    const roomKey = roomKeyInput ? roomKeyInput.value.trim() : null;

    if (roomKey && !document.querySelector(`.room[data-room-key="${roomKey}"]`)) {
      socket.emit("get room name", roomKey, async (roomName) => {
        if (roomName) {
          currentRoom = roomKey;
          await saveUserRoom(username, roomKey, roomName);
          socket.emit("join room", { roomKey, username });
          addRoomToList(roomKey, roomName);
          switchRoom(roomKey, roomName);
          webrtc.setRoom(roomKey);
        } else {
          alert("Invalid room key.");
        }
      });
    } else if (!roomKey) {
      alert("Room key cannot be empty.");
    } else {
      alert("You are already in this room.");
    }
  });

  disconnectButton.addEventListener("click", () => {
    localStorage.removeItem('token');
    window.location.reload();
  });

  function addRoomToList(roomKey, roomName) {
    const roomElement = document.createElement("div");
    roomElement.className = "room";
    roomElement.dataset.roomKey = roomKey;

    const roomNameElement = document.createElement("span");
    roomNameElement.innerText = roomName;

    const roomKeyElement = document.createElement("span");
    roomKeyElement.className = "room-key";
    roomKeyElement.innerText = roomKey;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.innerText = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteRoom(roomKey, roomElement);
    });

    roomElement.appendChild(roomNameElement);
    roomElement.appendChild(roomKeyElement);
    roomElement.appendChild(deleteButton);
    roomElement.addEventListener("click", () => switchRoom(roomKey, roomName));
    roomsContainer.appendChild(roomElement);
  }

  async function deleteRoom(roomKey, roomElement) {
    socket.emit("delete room", roomKey);
    roomElement.remove();
    if (currentRoom === roomKey) {
      currentRoom = null;
      chatRoomName.innerText = '';
      messagesContainer.innerHTML = '';
      onlineUsersContainer.innerHTML = '';
    }
  }

  async function switchRoom(roomKey, roomName) {
    currentRoom = roomKey;
    chatRoomName.innerText = roomName;
    messagesContainer.innerHTML = '';
    onlineUsersContainer.innerHTML = '';
    await loadChatHistory(roomKey);
    socket.emit("get online users", roomKey);
  }

  async function loadChatHistory(roomKey) {
    const chats = await getChats(roomKey);
    chats.forEach((chat) => {
      const { message, username } = chat;
      const formattedMessage = `<p><strong>${username}:</strong> ${message}</p>`;
      messagesContainer.innerHTML += formattedMessage;
    });
  }

  sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message && currentRoom) {
      const msgObject = { message, username, room: currentRoom, timestamp: new Date().toISOString() };
      socket.emit('message', msgObject);
      saveChat(msgObject);
      messageInput.value = '';
      webrtc.waitForDataChannelOpen().then(() => {
        webrtc.sendMessage(message);
      }).catch(err => {
        console.error(err.message);
      });
    }
  });

  socket.on("message", (msgObject) => {
    const { message, username, room } = msgObject;
    const formattedMessage = `<p><strong>${username}:</strong> ${message}</p>`;
    if (currentRoom === room) {
      messagesContainer.innerHTML += formattedMessage;
    }
  });

  socket.on("user joined", (msg, room) => {
    const message = `<p>${msg}</p>`;
    if (currentRoom === room) {
      messagesContainer.innerHTML += message;
    }
  });

  socket.on("user left", (msg, room) => {
    const message = `<p>${msg}</p>`;
    if (currentRoom === room) {
      messagesContainer.innerHTML += message;
    }
  });

  socket.on("online users", (users) => {
    onlineUsersContainer.innerHTML = '';
    users.forEach(user => {
      const userElement = document.createElement("div");
      userElement.className = "online-user";
      userElement.innerText = user;
      onlineUsersContainer.appendChild(userElement);
    });
  });

  socket.on("join failed", () => {
    alert("Failed to join the room.");
  });

  async function loadUserRooms() {
    const userRooms = await getUserRooms(username);
    userRooms.forEach(({ roomKey, roomName }) => {
      addRoomToList(roomKey, roomName);
    });
  }

  loadUserRooms();
}
