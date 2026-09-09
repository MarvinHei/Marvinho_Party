// In dev the Vite server (5173) and the game server (3001) are separate origins;
// in production the client is served by the game server, so same-origin works.
export const SERVER_URL: string = import.meta.env.DEV
  ? "http://localhost:3001"
  : window.location.origin;
