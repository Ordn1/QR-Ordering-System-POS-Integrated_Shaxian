import { useEffect, useRef } from 'react';

const RETRY_MS = 2000;

export function useWebSocket(path, onMessage) {
  const handler = useRef(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!path) {
      return undefined;
    }

    let socket = null;
    let retry = null;
    let closed = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}${path}`);

      socket.onmessage = (event) => handler.current(JSON.parse(event.data));
      socket.onclose = () => {
        if (!closed) {
          retry = setTimeout(connect, RETRY_MS);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [path]);
}
