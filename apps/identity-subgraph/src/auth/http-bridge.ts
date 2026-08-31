import type { IncomingMessage } from 'node:http';

type ParsedRequest = IncomingMessage & {
  body?: unknown;
  originalUrl?: string;
};

async function requestBody(request: ParsedRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (request.body !== undefined) return JSON.stringify(request.body);
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export async function toBetterAuthRequest(
  request: ParsedRequest,
  baseURL: string,
): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return new Request(
    new URL(request.originalUrl ?? request.url ?? '/', baseURL),
    { method: request.method, headers, body: await requestBody(request) },
  );
}
