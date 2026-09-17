// Robust import for Vercel serverless function from bundled CommonJS output
import serverModule from '../dist/server.cjs';

const app = (serverModule && (serverModule as any).default) || serverModule;

export default app;

