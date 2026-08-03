import { io } from 'socket.io-client';

let socket = null;

export const getSocket = (token) => {
  const currentToken = token || sessionStorage.getItem('access_token');
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: { token: currentToken }
    });
  } else {
    socket.auth = { token: currentToken };
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
