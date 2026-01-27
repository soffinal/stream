import { Stream } from "../../stream.js";
import { filter } from "../filter/filter.js";

const servers = new Map<number, Bun.Server>();

export function expose<T>(options?: expose.Options): Stream.Transformer<Stream<T>, expose.Expose<Request>> {
  return (stream: Stream<T>): expose.Expose<Request> => {
    const requests = new Stream<expose.NetworkMessage<Request>>();
    const responses = new Stream<expose.NetworkMessage<Response>>();

    const server = Bun.serve<{ sessionId?: string; abort?: Function }, {}>({
      ...options,
      async fetch(request, server) {
        if (new URL(request.url).protocol.includes("ws"))
          return server.upgrade(request) ? undefined : new Response(null, { status: 401 });

        const id = Bun.randomUUIDv7();

        // Push request with ID
        requests.push({ id, value: request });

        // Wait for response with matching ID
        const response = await new Promise<Response>((resolve) => {
          const abort = responses.pipe(filter((msg) => msg.id === id)).listen((msg) => {
            resolve(msg.value);
            abort();
          });
        });

        return response;
      },
      websocket: {
        open(ws) {
          const sessionId = Bun.randomUUIDv7(); // Server-side session ID

          const abort = responses.pipe(filter((msg) => msg.id.startsWith(sessionId))).listen(async (msg) => {
            // Extract client ID from server ID
            const [_, clientId] = msg.id.split(":");
            ws.send(
              JSON.stringify({
                id: clientId, // Send back client's ID
                value: await msg.value.json(),
              }),
            );
          });

          ws.data = { sessionId, abort };
        },
        message(ws, message: string) {
          const { id: clientId, value } = JSON.parse(message) as expose.NetworkMessage<unknown>;

          // Combine server session ID + client message ID
          const serverId = `${ws.data.sessionId}:${clientId}`;

          requests.push({
            id: serverId,
            value: new Request("", { body: JSON.stringify(value) }),
          });
        },
        close(ws, code, reason) {
          ws.data?.abort?.();
        },
      },
    });

    servers.set(server.port!, server);

    // Extend stream with responses property
    return Object.assign(requests, { responses });
  };
}

export namespace expose {
  export type Options = {
    hostname?: string;
    port?: number;
  };
  export type NetworkMessage<T> = {
    id: string;
    value: T;
  };
  export type Expose<T> = Stream<NetworkMessage<T>> & {
    responses: Stream<NetworkMessage<Response>>;
  };
}
