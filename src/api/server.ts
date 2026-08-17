import * as http from 'node:http';
import { Readable } from 'node:stream';
import { router } from './router';

export function createAdapterServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      // 1. Build Full URL
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost';
      const fullUrl = new URL(req.url || '/', `${protocol}://${host}`);

      // 2. Map Headers
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else if (value !== undefined) {
          headers.set(key, value);
        }
      }
      // console.log('[SERVER] Host header received:', req.headers.host);

      // 3. Map Body
      const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET');
      const body = hasBody ? Readable.toWeb(req) : null;

      // 4. Construct Web Request
      const webReq = new Request(fullUrl.toString(), {
        method: req.method,
        headers,
        body: body as ReadableStream | null,
        // @ts-ignore - duplex is needed in some node versions for streaming bodies
        duplex: hasBody ? 'half' : undefined
      });

      // 5. Route
      const webRes = await router(webReq);

      // 6. Send Response
      res.statusCode = webRes.status;
      res.statusMessage = webRes.statusText;
      
      webRes.headers.forEach((value, key) => {
        res.appendHeader(key, value);
      });

      if (webRes.body) {
        const buffer = await webRes.arrayBuffer();
        res.end(Buffer.from(buffer));
      } else {
        res.end();
      }
    } catch (err) {
      console.error('Server error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }));
      }
    }
  });

  return server;
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  createAdapterServer(port).listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
