import http from 'node:http';
import https from 'node:https';

type Input = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Input;
const body = input.body;
const url = new URL(input.url);
const transport = url.protocol === 'https:' ? https : http;
const request = transport.request(url, {
  agent: false,
  method: input.method,
  headers: {
    ...input.headers,
    ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
    connection: 'close',
  },
}, (response) => {
  const responseChunks: Buffer[] = [];
  response.on('data', (chunk) => responseChunks.push(Buffer.from(chunk)));
  response.once('end', () => {
    process.stdout.write(JSON.stringify({
      status: response.statusCode ?? 500,
      body: Buffer.concat(responseChunks).toString('utf8'),
    }));
  });
});
request.setTimeout(8_000, () => request.destroy(new Error('WooCommerce request timed out')));
request.once('error', (error) => {
  process.stderr.write(error.message);
  process.exitCode = 1;
});
if (body) request.write(body);
request.end();
