import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

type PagesHandler = (context: { request: Request }) => Promise<Response>;

type RouteLoader = () => Promise<{ onRequest: PagesHandler }>;

const API_ROUTES: Record<string, RouteLoader> = {
  '/api/moovie-catalog': () => import('../functions/api/moovie-catalog.js'),
  '/api/moovie-hub': () => import('../functions/api/moovie-hub.js'),
  '/api/cinestream': () => import('../functions/api/cinestream.ts'),
  '/api/watchmode-cache': () => import('../functions/api/watchmode-cache.ts'),
};

async function writeWorkerResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url || !req.method) {
      next();
      return;
    }

    const host = req.headers.host || 'localhost:5173';
    const url = new URL(req.url, `http://${host}`);
    const loader = API_ROUTES[url.pathname];

    if (!loader) {
      next();
      return;
    }

    try {
      const mod = await loader();
      const headers = new Headers();

      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item);
        } else {
          headers.set(key, value);
        }
      }

      const request = new Request(url.toString(), {
        method: req.method,
        headers,
      });

      const response = await mod.onRequest({ request });
      await writeWorkerResponse(res, response);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Local API handler failed',
        })
      );
    }
  };
}

export function cloudflareFunctionsDev(): Plugin {
  return {
    name: 'cloudflare-functions-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(createApiMiddleware());
    },
  };
}