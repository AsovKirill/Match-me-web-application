// src/socket.ts

type Handler = (data: any) => void;

type EventName = "chat:new-message" | "presence:update" | "chat:typing";

let ws: WebSocket | null = null;
let isConnecting = false;

// подписчики по событиям
const handlers: Record<EventName, Set<Handler>> = {
  "chat:new-message": new Set(),
  "presence:update": new Set(),
  "chat:typing": new Set(),
};

function dispatch(event: EventName, payload: any) {
  handlers[event].forEach((fn) => fn(payload));
}

function ensureWS() {
  // уже есть открытое/подключающееся соединение
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  if (isConnecting) return;
  isConnecting = true;

  // ВАЖНО: тот же ключ, который ты используешь в auth (login/register)
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("No auth token for WS");
    isConnecting = false;
    return;
  }

  const url = `ws://localhost:4000/ws?token=${encodeURIComponent(token)}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WS connected");
    isConnecting = false;
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);

      switch (msg.type) {
        case "new_message": {
          // формат от Go:
          // {
          //   type: "new_message",
          //   chatId,
          //   fromUserId,
          //   message: { id, chatId, senderId, content, timestamp }
          // }
          const m = msg.message;
          dispatch("chat:new-message", {
            id: m.id,
            chatId: msg.chatId,
            senderId: m.senderId,
            content: m.content,
            timestamp: m.timestamp,
          });
          break;
        }

        case "presence": {
          // { type: "presence", userId, online }
          dispatch("presence:update", {
            userId: msg.userId,
            online: !!msg.online,
          });
          break;
        }

        case "typing": {
          // { type: "typing", chatId, fromUserId, typing }
          dispatch("chat:typing", {
            chatId: msg.chatId,
            userId: msg.fromUserId,
            isTyping: !!msg.typing,
          });
          break;
        }

        default:
          console.warn("Unknown WS message", msg);
      }
    } catch (e) {
      console.error("WS parse error", e);
    }
  };

  ws.onclose = () => {
    console.log("WS closed");
    ws = null;
    isConnecting = false;
    // простое авто-переподключение
    setTimeout(ensureWS, 2000);
  };

  ws.onerror = (err) => {
    console.error("WS error", err);
  };
}

// публичное API, которое ты используешь в компонентах
export function getSocket() {
  ensureWS();

  return {
    on(event: EventName, handler: Handler) {
      handlers[event].add(handler);
    },

    off(event: EventName, handler: Handler) {
      handlers[event].delete(handler);
    },

    emit(event: string, payload: any) {
      ensureWS();
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // сейчас по WS мы реально используем только typing
      if (event === "chat:typing") {
        const { chatId, isTyping } = payload;
        ws.send(
          JSON.stringify({
            type: "typing",
            chatId,
            typing: !!isTyping,
          })
        );
      } else if (event === "chat:join") {
        // если потом захочешь — можно что-то посылать и тут
      } else if (event === "chat:leave") {
        // и тут тоже
      }
    },
  };
}
