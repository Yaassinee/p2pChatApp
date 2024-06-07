let db;

export async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chatDB', 2); // Increment the version number if needed

    request.onerror = () => {
      console.error('Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'username' });
        usersStore.createIndex('username', 'username', { unique: true });
      }
      if (!db.objectStoreNames.contains('chats')) {
        const chatsStore = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
        chatsStore.createIndex('room', 'room', { unique: false });
      }
      if (!db.objectStoreNames.contains('userRooms')) {
        const userRoomsStore = db.createObjectStore('userRooms', { keyPath: 'id', autoIncrement: true });
        userRoomsStore.createIndex('username', 'username', { unique: false });
        userRoomsStore.createIndex('roomKey', 'roomKey', { unique: false });
      }
      if (!db.objectStoreNames.contains('rooms')) {
        const roomsStore = db.createObjectStore('rooms', { keyPath: 'roomKey' });
        roomsStore.createIndex('roomName', 'roomName', { unique: true });
      }
    };
  });
}

export async function registerUser(username, password) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['users'], 'readwrite');
    const usersStore = transaction.objectStore('users');

    // Check if the username already exists
    const getRequest = usersStore.get(username);

    getRequest.onsuccess = () => {
      if (getRequest.result) {
        resolve(false); // Username already exists
      } else {
        const request = usersStore.add({ username, password });

        request.onerror = () => {
          console.error('Error registering user:', request.error);
          resolve(false);
        };

        request.onsuccess = () => {
          resolve(true);
        };
      }
    };

    getRequest.onerror = () => {
      console.error('Error checking username:', getRequest.error);
      resolve(false);
    };
  });
}

export async function loginUser(username, password) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['users'], 'readonly');
    const usersStore = transaction.objectStore('users');

    const request = usersStore.get(username);

    request.onerror = () => {
      console.error('Error logging in:', request.error);
      resolve(false);
    };

    request.onsuccess = () => {
      const user = request.result;
      if (user && user.password === password) {
        const token = btoa(JSON.stringify({ username: user.username }));
        localStorage.setItem('token', token);
        resolve(true);
      } else {
        resolve(false);
      }
    };
  });
}

export async function getUserData() {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');

    if (!token) {
      resolve(null);
      return;
    }

    try {
      const decoded = JSON.parse(atob(token));
      resolve(decoded);
    } catch (err) {
      console.error('Error decoding token:', err);
      resolve(null);
    }
  });
}

export async function saveChat(chat) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readwrite');
    const chatsStore = transaction.objectStore('chats');

    const request = chatsStore.add(chat);

    request.onerror = () => {
      console.error('Error saving chat:', request.error);
      resolve(false);
    };

    request.onsuccess = () => {
      resolve(true);
    };
  });
}

export async function getChats(room) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readonly');
    const chatsStore = transaction.objectStore('chats');
    const index = chatsStore.index('room');

    const request = index.getAll(room);

    request.onerror = () => {
      console.error('Error getting chats:', request.error);
      resolve([]);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export async function saveUserRoom(username, roomKey, roomName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['userRooms'], 'readwrite');
    const userRoomsStore = transaction.objectStore('userRooms');

    const request = userRoomsStore.add({ username, roomKey, roomName });

    request.onerror = () => {
      console.error('Error saving user room:', request.error);
      resolve(false);
    };

    request.onsuccess = () => {
      resolve(true);
    };
  });
}

export async function getUserRooms(username) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['userRooms'], 'readonly');
    const userRoomsStore = transaction.objectStore('userRooms');
    const index = userRoomsStore.index('username');

    const request = index.getAll(username);

    request.onerror = () => {
      console.error('Error getting user rooms:', request.error);
      resolve([]);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export async function createRoom(roomName) {
  const roomKey = generateRoomKey();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['rooms'], 'readwrite');
    const roomsStore = transaction.objectStore('rooms');

    const request = roomsStore.add({ roomName, roomKey });

    request.onerror = () => {
      console.error('Error creating room:', request.error);
      resolve(null);
    };

    request.onsuccess = () => {
      resolve({ roomName, roomKey });
    };
  });
}

function generateRoomKey() {
  return Math.random().toString(36).substring(2, 10); // Generates a random key
}



