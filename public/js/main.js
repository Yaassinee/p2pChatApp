import { initializeChat } from './chat.js';
import { initializeWebRTC } from './webrtc.js';
import { initializeDatabase, registerUser, loginUser, getUserData } from './database.js';

let socket;
let webrtc;

// Initialize chat and WebRTC
function initializeApplication(userData) {
  socket = io();
  webrtc = initializeWebRTC(socket);
  initializeChat(socket, webrtc, userData);

  document.getElementById('login-container').style.display = 'none';
  document.getElementById('register-container').style.display = 'none';
  document.getElementById('chat-container').style.display = 'flex';
}

// Handle user authentication and initialization
async function handleUserAuthentication() {
  await initializeDatabase();

  const userData = await getUserData();

  if (userData) {
    initializeApplication(userData);
  } else {
    // Display login form
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const registerError = document.createElement('p');
    registerError.id = 'register-error';
    registerError.style.color = 'red';
    document.getElementById('register-container').appendChild(registerError);

    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('register-container').style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('register-container').style.display = 'none';
      document.getElementById('login-container').style.display = 'block';
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      if (await loginUser(username, password)) {
        const userData = await getUserData();
        initializeApplication(userData);
      } else {
        alert('Invalid username or password');
      }
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value;
      const password = document.getElementById('register-password').value;

      const success = await registerUser(username, password);
      if (success) {
        alert('User registered successfully. Please login.');
        document.getElementById('register-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'block';
        registerError.textContent = '';
      } else {
        registerError.textContent = 'User already exists. Please choose a different username.';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', handleUserAuthentication);
