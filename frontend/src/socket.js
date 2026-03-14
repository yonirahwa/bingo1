/**
 * socket.js — singleton Socket.IO client
 */
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const socket = io(BACKEND_URL, { 
  autoConnect: false,
  transports: ['websocket'] // Force websocket for ngrok stability
});

export default socket;
