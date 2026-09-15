// Explicit file extension is required: the project is ESM ("type": "module") and a
// bare '../server' resolves to the ./server DIRECTORY in Node, crashing the function
// with ERR_UNSUPPORTED_DIR_IMPORT on Vercel.
import app from '../server.js';

export default app;
