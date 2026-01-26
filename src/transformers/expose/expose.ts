import { Stream } from "../../stream.js";

const servers = new Map<number, Bun.Server>();

export function expose<T>(options?: expose.Options): Stream.Transformer<Stream<T>, Stream<T>> {
  const { host = "localhost", port = 3000 } = options ?? {};
  const server = servers.get(port) ?? servers.set(port, createBunServer(options)).get(port)!;

  return (stream: Stream<T>): Stream<T> => {
    const output = new Stream<T>();

    return output;
  };
}

function createBunServer(options?: expose.Options) {
  const server = Bun.serve({
    ...options,
    fetch(request, server) {
      return server.upgrade(request) ? undefined : new Response(null, { status: 401 });
    },
    websocket: {
      message(ws, message) {},
    },
  });

  return server;
}

export namespace expose {
  export type Options = {
    host?: string;
    port?: number;
  };
}
