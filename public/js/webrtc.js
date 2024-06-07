let dataChannel;
let pc;
let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let currentRoom;
const pcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function waitForDataChannelOpen() {
  return new Promise((resolve, reject) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      resolve();
    } else if (dataChannel) {
      dataChannel.onopen = () => {
        console.log("Data channel opened");
        resolve();
      };
      dataChannel.onerror = (error) => {
        console.error("Data channel error: ", error);
        reject(new Error("Data channel error: " + error));
      };
    } else {
      console.error("Data channel is not initialized.");
      reject(new Error("Data channel is not initialized."));
    }
  });
}

export function initializeWebRTC(socket) {
  socket.on("created", (room) => {
    console.log("Created room " + room);
    isInitiator = true;
  });

  socket.on("full", (room) => {
    console.log("Room " + room + " is full");
  });

  socket.on("join", (room, client) => {
    console.log("Another peer made a request to join room " + room + " with name: " + client);
    isChannelReady = true;
    maybeStart();
  });

  socket.on("joined", (room) => {
    console.log("joined: " + room);
    isChannelReady = true;
    maybeStart();
  });

  socket.on("log", (array) => {
    console.log.apply(console, array);
  });

  socket.on("message", (message, room) => {
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
      const candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate,
      });
      pc.addIceCandidate(candidate);
    } else if (message === "bye" && isStarted) {
      handleRemoteHangup();
    }
  });

  function sendMessage(message, room) {
    socket.emit("message", { message, room });
  }

  function maybeStart() {
    if (!isStarted && isChannelReady) {
      createPeerConnection();
      isStarted = true;
      if (isInitiator) {
        doCall();
      }
    }
  }

  window.onbeforeunload = () => {
    sendMessage("bye", currentRoom);
  };

  function createPeerConnection() {
    try {
      pc = new RTCPeerConnection(pcConfig);
      pc.onicecandidate = handleIceCandidate;

      if (isInitiator) {
        dataChannel = pc.createDataChannel("chat");
        setupDataChannel();
      } else {
        pc.ondatachannel = (event) => {
          dataChannel = event.channel;
          setupDataChannel();
        };
      }
    } catch (e) {
      console.error("Failed to create PeerConnection, exception: " + e.message);
      alert("Cannot create RTCPeerConnection object. WebRTC is not supported by this browser.");
      return;
    }
  }

  function setupDataChannel() {
    if (!dataChannel) {
      console.error("Data channel is not created.");
      return;
    }
    dataChannel.onopen = handleDataChannelOpen;
    dataChannel.onmessage = handleDataChannelMessage;
    dataChannel.onclose = handleDataChannelClose;
    dataChannel.onerror = handleDataChannelError;
    console.log("Data channel setup complete");
  }

  function handleIceCandidate(event) {
    if (event.candidate) {
      sendMessage({
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      }, currentRoom);
    }
  }

  function handleCreateOfferError(event) {
    console.log("createOffer() error: ", event);
  }

  function doCall() {
    pc.createOffer().then(setLocalAndSendMessage, handleCreateOfferError);
  }

  function doAnswer() {
    pc.createAnswer().then(setLocalAndSendMessage, onCreateSessionDescriptionError);
  }

  function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription, currentRoom);
  }
  
  function onCreateSessionDescriptionError(error) {
    console.error("Failed to create session description: ", error);
  }

  function handleDataChannelOpen() {
    console.log("Data channel is open");
  }

  function handleDataChannelMessage(event) {
    console.log("Received message:", event.data);
    displayMessage(event.data);
  }

  function handleDataChannelClose() {
    console.log("Data channel is closed");
  }

  function handleDataChannelError(error) {
    console.error("Data channel error:", error);
  }

  function handleRemoteHangup() {
    stop();
    isInitiator = false;
  }

  function stop() {
    isStarted = false;
    if (pc) {
      pc.close();
      pc = null;
    }
  }

  function displayMessage(message) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
  }

  return {
    setRoom: (room) => {
      currentRoom = room;
    },
    waitForDataChannelOpen: waitForDataChannelOpen,
    sendMessage: (message) => {
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
      } else {
        console.error("Data channel is not open. Cannot send message.");
      }
    }
  };
}









