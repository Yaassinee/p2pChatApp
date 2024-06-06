document.addEventListener("DOMContentLoaded", (event) => {
  // Defining some global utility variables
  var isChannelReady = false;
  var isInitiator = false;
  var isStarted = false;
  var pc;
  var turnReady;
  var datachannel;
  var clientName = "user" + Math.floor(Math.random() * 1000 + 1);
  var remoteclient;
  var rooms = {};

  // IndexedDB setup
  let db;
  const request = indexedDB.open("chatDB", 1);

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("chats", { keyPath: "room" });
    objectStore.createIndex("room", "room", { unique: true });
  };

  request.onsuccess = (event) => {
    db = event.target.result;
  };

  request.onerror = (event) => {
    console.error("Database error: ", event.target.error);
  };

  const socket = io();
  let currentRoom = null;
  let username = clientName;

  const joinRoomButton = document.getElementById("join-room");
  const sendMessageButton = document.getElementById("send-message");
  const sendFileButton = document.getElementById("send-file");
  const messageInput = document.getElementById("message");
  const fileInput = document.getElementById("file-input");
  const messagesContainer = document.getElementById("messages");
  const roomsContainer = document.getElementById("rooms-container");
  const chatHeader = document.getElementById("chat-header");

  document.getElementById("yourname").innerHTML = "You: " + username;

  joinRoomButton.addEventListener("click", () => {
    const room = document.getElementById("room").value.trim();

    if (username && room && !rooms[room]) {
      currentRoom = room;
      socket.emit("join room", { room, username });
      rooms[room] = [];
      addRoomToList(room);
      switchRoom(room);
    }
  });

  function addRoomToList(room) {
    const roomElement = document.createElement("div");
    roomElement.className = "room";
    roomElement.innerText = room;
    roomElement.addEventListener("click", () => switchRoom(room));
    roomsContainer.appendChild(roomElement);
  }

  async function switchRoom(room) {
    currentRoom = room;
    chatHeader.innerText = `Room: ${room}`;
    await loadChatHistory(room);
  }

  sendMessageButton.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message && currentRoom) {
      const msgObject = { message, username, room: currentRoom, timestamp: new Date().toISOString() };
      socket.emit("message", msgObject);
      saveMessageToDB(msgObject);
      messageInput.value = "";
    }
  });

  sendFileButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file && currentRoom) {
      waitForDataChannelOpen().then(() => {
        sendFile(file);
      });
    }
  });

  function waitForDataChannelOpen() {
    return new Promise((resolve) => {
      if (datachannel && datachannel.readyState === 'open') {
        resolve();
      } else {
        datachannel.onopen = () => {
          resolve();
        };
      }
    });
  }

  function sendFile(file) {
    const chunkSize = 16 * 1024; // 16 KB chunks
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (event) => {
      const arrayBuffer = event.target.result;

      function sendChunk() {
        if (offset < arrayBuffer.byteLength) {
          const chunk = arrayBuffer.slice(offset, offset + chunkSize);
          if (datachannel && datachannel.readyState === 'open') {
            datachannel.send(chunk);
            offset += chunkSize;
            setTimeout(sendChunk, 0); // Schedule the next chunk
          } else {
            console.error("Data channel is not open. Cannot send chunk.");
          }
        } else {
          const msgObject = { message: `File: ${file.name}`, username, room: currentRoom, timestamp: new Date().toISOString() };
          saveMessageToDB(msgObject);
        }
      }

      sendChunk();
    };

    reader.readAsArrayBuffer(file);
  }

  socket.on("message", (msgObject) => {
    const { message, username, room } = msgObject;
    const formattedMessage = `<p><strong>${username}:</strong> ${message}</p>`;
    rooms[room].push(formattedMessage);
    if (currentRoom === room) {
      messagesContainer.innerHTML += formattedMessage;
    }
  });

  socket.on("user joined", (msg, room) => {
    const message = `<p>${msg}</p>`;
    rooms[room].push(message);
    if (currentRoom === room) {
      messagesContainer.innerHTML += message;
    }
  });

  socket.on("user left", (msg, room) => {
    const message = `<p>${msg}</p>`;
    rooms[room].push(message);
    if (currentRoom === room) {
      messagesContainer.innerHTML += message;
    }
  });

  // Save message to IndexedDB
  function saveMessageToDB(msgObject) {
    const transaction = db.transaction(["chats"], "readwrite");
    const store = transaction.objectStore("chats");
    const request = store.get(msgObject.room);

    request.onsuccess = (event) => {
      const chatHistory = event.target.result;
      if (chatHistory) {
        chatHistory.messages.push(msgObject);
        store.put(chatHistory);
      } else {
        store.put({ room: msgObject.room, messages: [msgObject] });
      }
    };
  }

  // Load chat history from IndexedDB
  async function loadChatHistory(room) {
    const transaction = db.transaction(["chats"], "readonly");
    const store = transaction.objectStore("chats");
    const request = store.get(room);

    request.onsuccess = (event) => {
      const chatHistory = event.target.result;
      if (chatHistory && chatHistory.messages) {
        messagesContainer.innerHTML = '';
        chatHistory.messages.forEach((msg) => {
          const { message, username } = msg;
          const formattedMessage = `<p><strong>${username}:</strong> ${message}</p>`;
          messagesContainer.innerHTML += formattedMessage;
        });
      }
    };
  }

  // Existing WebRTC setup and event handlers
  socket.on("created", function (room) {
    console.log("Created room " + room);
    isInitiator = true;
  });

  socket.on("full", function (room) {
    console.log("Room " + room + " is full");
  });

  socket.on("join", function (room, client) {
    console.log(
      "Another peer made a request to join room " +
        room +
        " with name :" +
        client
    );
    console.log("This peer is the initiator of room " + room + "!");
    sendMessageButton.disabled = false;
    isChannelReady = true;
    remoteclient = client;
    document.getElementById("remotename").innerHTML = client;
    socket.emit("creatorname", room, clientName);
  });

  socket.on("mynameis", (client) => {
    console.log("The creator's name is " + client);
    remoteclient = client;
    document.getElementById("remotename").innerHTML = client;
  });

  socket.on("joined", function (room) {
    console.log("joined: " + room);
    isChannelReady = true;
    sendMessageButton.disabled = false;
  });

  socket.on("log", function (array) {
    console.log.apply(console, array);
  });

  socket.on("message", function (message, room) {
    console.log("Client received message:", message, room);
    if (message === "gotuser") {
      maybeStart();
    } else if (message.type === "offer") {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === "answer" && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === "candidate" && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate,
      });
      pc.addIceCandidate(candidate);
    } else if (message === "bye" && isStarted) {
      handleRemoteHangup();
    }
  });

  function sendMessage(message, room) {
    console.log("Client sending message: ", message, room);
    socket.emit("message", { message, room, username });
  }

  function maybeStart() {
    console.log(">>>>>>> maybeStart() ", isStarted, isChannelReady);
    if (!isStarted && isChannelReady) {
      console.log(">>>>>> creating peer connection");
      createPeerConnection();
      isStarted = true;
      console.log("isInitiator", isInitiator);
      if (isInitiator) {
        doCall();
      }
    }
  }

  window.onbeforeunload = function () {
    sendMessage("bye", currentRoom);
  };

  function createPeerConnection() {
    try {
      pc = new RTCPeerConnection(pcConfig);
      pc.onicecandidate = handleIceCandidate;
      console.log("Created RTCPeerConnnection");

      datachannel = pc.createDataChannel("filetransfer");
      datachannel.onopen = (event) => {
        console.log("Data channel is open");
      };

      datachannel.onmessage = (event) => {
        console.log("Received message: " + event.data);
        displayMessage(event.data);
      };
      datachannel.onerror = (error) => {
        console.log("Data Channel Error:", error);
      };

      datachannel.onclose = () => {
        console.log("Data Channel closed");
      };

      pc.ondatachannel = function (event) {
        datachannel = event.channel;
        datachannel.onopen = function (event) {
          console.log("Data channel is open");
        };
        datachannel.onmessage = async (event) => {
          try {
            var themessage = event.data;
            console.log(themessage, event);
            displayMessage(themessage);
          } catch (err) {
            console.log(err);
          }
        };
      };
    } catch (e) {
      console.log("Failed to create PeerConnection, exception: " + e.message);
      alert("Cannot create RTCPeerConnection object.");
      return;
    }
  }

  function handleIceCandidate(event) {
    console.log("icecandidate event: ", event);
    if (event.candidate) {
      sendMessage(
        {
          type: "candidate",
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        },
        currentRoom
      );
    } else {
      console.log("End of candidates.");
    }
  }

  function handleCreateOfferError(event) {
    console.log("createOffer() error: ", event);
  }

  function doCall() {
    console.log("Sending offer to peer");
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
  }

  function doAnswer() {
    console.log("Sending answer to peer.");
    pc.createAnswer().then(
      setLocalAndSendMessage,
      onCreateSessionDescriptionError
    );
  }

  function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log("setLocalAndSendMessage sending message", sessionDescription);
    sendMessage(sessionDescription, currentRoom);
  }

  function onCreateSessionDescriptionError(error) {
    trace("Failed to create session description: " + error.toString());
  }

  function hangup() {
    console.log("Hanging up.");
    stop();
    sendMessage("bye", currentRoom);
  }

  function handleRemoteHangup() {
    console.log("Session terminated.");
    stop();
    isInitiator = false;
  }

  function stop() {
    isStarted = false;
    pc.close();
    pc = null;
  }

  function displayMessage(message) {
    const messagesContainer = document.getElementById("messages");
    messagesContainer.innerHTML += message + "<br>";
  }
});









