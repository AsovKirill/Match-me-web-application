import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "./Layout";
import "../styles/messages.css";
import {
  apiGetChats,
  apiGetChatMessages,
  apiSendChatMessage,
  apiGetMe,
  type ApiChatPreview,
  type ApiChatMessage,
} from "../api";
import { getSocket } from "../socket";

const PAGE_SIZE = 20;

type ChatId = number;

type ChatPreview = {
  id: ChatId;
  otherUserId: number | null;
  userName: string;
  avatarUrl?: string | null;
  lastMessage: string;
  lastTime: string | null;
  unreadCount: number;
};

type ChatMessage = {
  id: number;
  chatId: ChatId;
  fromMe: boolean;
  text: string;
  createdAt: string;
};

export default function Messages() {
  const navigate = useNavigate();
  const params = useParams<{ chatId?: string }>();

  const [myUserId, setMyUserId] = useState<number | null>(null);

  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [activeChatId, setActiveChatId] = useState<ChatId | null>(() => {
    const idFromUrl = params.chatId ? Number(params.chatId) : null;
    if (idFromUrl && !Number.isNaN(idFromUrl)) return idFromUrl;
    return null;
  });

  const [inputValue, setInputValue] = useState("");
  const [hasMoreHistory, setHasMoreHistory] = useState<Record<ChatId, boolean>>(
    {}
  );
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // online status by userId
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});

  // typing status by chatId
  const [typingChats, setTypingChats] = useState<Record<ChatId, boolean>>({});
  const typingTimeoutsRef = useRef<Record<ChatId, number>>({});
  const typingEmitTimeoutRef = useRef<number | null>(null);
const lastTypingStateRef = useRef<boolean>(false);

  // мобилка / десктоп
  const [isMobile, setIsMobile] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const activeChatIdRef = useRef<ChatId | null>(activeChatId);

  // следим за актуальным activeChatId для сокет-хендлеров
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // отслеживаем ширину экрана
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // ===== Загрузка текущего пользователя + списка чатов =====
  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        setLoadingChats(true);
        setError(null);

        // текущий пользователь
        const me = await apiGetMe();
        if (!cancelled) {
          setMyUserId(me.id);
        }

        // список чатов
        const apiChats = await apiGetChats();

        if (!cancelled) {
          const mappedChats: ChatPreview[] = apiChats.map(
            (c: ApiChatPreview) => ({
              id: c.id,
              otherUserId: c.otherUserId,
              userName: c.userName,
              avatarUrl: c.avatarUrl,
              lastMessage: c.lastMessage,
              lastTime: c.lastTime,
              unreadCount: c.unreadCount ?? 0,
            })
          );

          setChats(mappedChats);

          if (!activeChatId && mappedChats.length > 0) {
            setActiveChatId(mappedChats[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load chats", err);
        if (!cancelled) {
          setError("Failed to load chats. Please try again later.");
        }
      } finally {
        if (!cancelled) {
          setLoadingChats(false);
        }
      }
    };

    void loadInitial();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Загрузка сообщений для активного чата =====
  useEffect(() => {
    if (!activeChatId || !myUserId) return;

    let cancelled = false;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        setError(null);

        const { messages: apiMessages, hasMore } = await apiGetChatMessages({
          chatId: activeChatId,
          limit: PAGE_SIZE,
        });

        if (cancelled) return;

        const mapped: ChatMessage[] = apiMessages.map((m: ApiChatMessage) => ({
          id: m.id,
          chatId: m.chatId,
          fromMe: m.senderId === myUserId,
          text: m.content,
          createdAt: m.timestamp,
        }));

        setMessages((prev) => {
          const withoutThisChat = prev.filter(
            (msg) => msg.chatId !== activeChatId
          );
          return [...withoutThisChat, ...mapped];
        });

        setHasMoreHistory((prev) => ({
          ...prev,
          [activeChatId]: hasMore,
        }));

        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        });
      } catch (err) {
        console.error("Failed to load chat messages", err);
        if (!cancelled) {
          setError("Failed to load messages. Please try again later.");
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeChatId, myUserId]);

  // ===== Socket.IO: входящие сообщения, presence, typing =====
  useEffect(() => {
    if (!myUserId) return;

    const socket = getSocket();

    type NewMessagePayload = {
      id: number;
      chatId: number;
      senderId: number;
      content: string;
      timestamp: string;
    };

    const handleNewMessage = (payload: NewMessagePayload) => {
      const { id, chatId, senderId, content, timestamp } = payload;
      const fromMe = senderId === myUserId;

      setMessages((prev) => {
        if (prev.some((m) => m.id === id)) return prev;

        const newMsg: ChatMessage = {
          id,
          chatId,
          fromMe,
          text: content,
          createdAt: timestamp,
        };

        return [...prev, newMsg];
      });

      setChats((prev) => {
        let found = false;
        const isActive = activeChatIdRef.current === chatId;

        const updated = prev.map((c) => {
          if (c.id !== chatId) return c;
          found = true;

          const base: ChatPreview = {
            ...c,
            lastMessage: content,
            lastTime: timestamp,
          };

          // если чат не активен и сообщение не от меня → увеличиваем unread
          if (!isActive && !fromMe) {
            base.unreadCount = (base.unreadCount ?? 0) + 1;
          }

          return base;
        });

        if (!found) {
          return prev;
        }

        // сортировка по времени последнего сообщения
        return [...updated].sort((a, b) => {
          const tA = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const tB = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return tB - tA;
        });
      });

      // автоскролл, если это активный чат
      if (activeChatIdRef.current === chatId) {
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        });
      }
    };

    const handlePresenceUpdate = (payload: {
      userId: number;
      online: boolean;
    }) => {
      setOnlineUsers((prev) => ({
        ...prev,
        [payload.userId]: payload.online,
      }));
    };

    type TypingPayload = {
      chatId: number;
      userId: number;
      isTyping: boolean;
    };

    const handleTyping = ({ chatId, userId, isTyping }: TypingPayload) => {
      // игнорим свои же события
      if (userId === myUserId) return;

      if (isTyping) {
        setTypingChats((prev) => ({ ...prev, [chatId]: true }));

        const oldTimeout = typingTimeoutsRef.current[chatId];
        if (oldTimeout) {
          window.clearTimeout(oldTimeout);
        }

        typingTimeoutsRef.current[chatId] = window.setTimeout(() => {
          setTypingChats((prev) => ({ ...prev, [chatId]: false }));
        }, 3000);
      } else {
        setTypingChats((prev) => ({ ...prev, [chatId]: false }));
        const oldTimeout = typingTimeoutsRef.current[chatId];
        if (oldTimeout) {
          window.clearTimeout(oldTimeout);
        }
      }
    };

    socket.on("chat:new-message", handleNewMessage);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("chat:typing", handleTyping);

    return () => {
      socket.off("chat:new-message", handleNewMessage);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("chat:typing", handleTyping);
    };
  }, [myUserId]);

  // ===== Socket.IO: join/leave комнат чатов =====
  useEffect(() => {
    const socket = getSocket();
    const prevChatId = activeChatIdRef.current;

    if (prevChatId) {
      socket.emit("chat:leave", prevChatId);
    }

    if (activeChatId) {
      socket.emit("chat:join", activeChatId);
    }

    activeChatIdRef.current = activeChatId;

    return () => {
      if (activeChatId) {
        socket.emit("chat:leave", activeChatId);
      }
    };
  }, [activeChatId]);

  // ===== Реакция на смену активного чата =====
  useEffect(() => {
    // если вышли "назад" на мобилке — чистим URL
    if (!activeChatId) {
      navigate("/messages", { replace: true });
      return;
    }

    // обнуляем unread у выбранного чата
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, unreadCount: 0 } : c))
    );

    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });

    navigate(`/messages/${activeChatId}`, { replace: true });
  }, [activeChatId, navigate]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const messagesForActive = useMemo(
    () =>
      activeChatId
        ? messages
            .filter((m) => m.chatId === activeChatId)
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            )
        : [],
    [messages, activeChatId]
  );

  const handleSelectChat = (chatId: ChatId) => {
    setActiveChatId(chatId);
  };

  const handleBackToList = () => {
    setActiveChatId(null);
  };

 const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setInputValue(value);

  if (!activeChatId) return;

  const isTyping = value.length > 0;
  lastTypingStateRef.current = isTyping;

  // если таймер уже висит — просто обновили lastTypingStateRef и ждём
  if (typingEmitTimeoutRef.current !== null) {
    return;
  }

  // ставим таймер: через 300мс отправим текущее состояние isTyping
  typingEmitTimeoutRef.current = window.setTimeout(() => {
    typingEmitTimeoutRef.current = null;

    const socket = getSocket();
    const currentChatId = activeChatIdRef.current; // всегда актуальный чат
    if (!currentChatId) return;

    console.log("EMIT chat:typing (debounced)", {
      chatId: currentChatId,
      isTyping: lastTypingStateRef.current,
    });

    socket.emit("chat:typing", {
      chatId: currentChatId,
      isTyping: lastTypingStateRef.current,
    });
  }, 300); // можно 300–400 мс, как тебе нравится
};

  const handleSend = async () => {
    if (!activeChatId || !inputValue.trim() || !myUserId) return;

    const text = inputValue.trim();
    setInputValue("");

    const socket = getSocket();
    socket.emit("chat:typing", {
      chatId: activeChatId,
      isTyping: false,
    });

    try {
      const apiMsg = await apiSendChatMessage({
        chatId: activeChatId,
        content: text,
      });

      const newMsg: ChatMessage = {
        id: apiMsg.id,
        chatId: apiMsg.chatId,
        fromMe: apiMsg.senderId === myUserId,
        text: apiMsg.content,
        createdAt: apiMsg.timestamp,
      };

      // локально добавляем
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // обновляем превью
      setChats((prev) => {
        const updated = prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                lastMessage: newMsg.text,
                lastTime: newMsg.createdAt,
              }
            : c
        );

        return [...updated].sort((a, b) => {
          const tA = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const tB = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return tB - tA;
        });
      });

      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    } catch (err) {
      console.error("Failed to send message", err);
      setInputValue(text);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleEnterKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleLoadOlder = async () => {
    if (!activeChatId || !myUserId) return;
    if (!hasMoreHistory[activeChatId]) return;
    if (messagesForActive.length === 0) return;

    const oldest = messagesForActive[0];

    try {
      const { messages: apiMessages, hasMore } = await apiGetChatMessages({
        chatId: activeChatId,
        limit: PAGE_SIZE,
        before: oldest.createdAt,
      });

      const mapped: ChatMessage[] = apiMessages.map((m: ApiChatMessage) => ({
        id: m.id,
        chatId: m.chatId,
        fromMe: m.senderId === myUserId,
        text: m.content,
        createdAt: m.timestamp,
      }));

      setMessages((prev) => [...mapped, ...prev]);

      setHasMoreHistory((prev) => ({
        ...prev,
        [activeChatId]: hasMore,
      }));
    } catch (err) {
      console.error("Failed to load older messages", err);
      alert("Failed to load older messages. Please try again.");
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOtherUserOnline =
    activeChat?.otherUserId != null
      ? onlineUsers[activeChat.otherUserId] === true
      : false;

  const isOtherTyping =
    activeChatId != null ? typingChats[activeChatId] === true : false;

  const containerClassName =
    "chat-page" + (isMobile && activeChat ? " mobile-chat" : "");

  return (
    <Layout>
      <div className={containerClassName}>
        {/* Левая колонка — список чатов */}
        <aside className="chat-sidebar">
          <h2 className="chat-sidebar__title">Messages</h2>

          {loadingChats && chats.length === 0 && (
            <div className="chat-empty">Loading chats…</div>
          )}

          {error && !loadingChats && chats.length === 0 && (
            <div className="chat-empty">{error}</div>
          )}

          <div className="chat-list">
            {chats.map((chat) => {
              const hasUnread =
                chat.unreadCount > 0 && chat.id !== activeChatId;

              return (
                <button
                  key={chat.id}
                  type="button"
                  className={
                    "chat-list-item" +
                    (chat.id === activeChatId ? " chat-list-item--active" : "") +
                    (hasUnread ? " chat-list-item--unread" : "")
                  }
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="chat-list-item__avatar">
                    {chat.avatarUrl ? (
                      <img
                        className="chat-main__avatar__img"
                        src={chat.avatarUrl}
                        alt={chat.userName}
                      />
                    ) : (
                      <span></span>
                    )}
                    {chat.unreadCount > 0 && (
                      <span className="chat-list-item__badge">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="chat-list-item__body">
                    <div className="chat-list-item__top">
                      <span className="chat-list-item__name">
                        {chat.userName}
                      </span>
                      <span className="chat-list-item__time">
                        {formatTime(chat.lastTime)}
                      </span>
                    </div>
                    <div className="chat-list-item__bottom">
                      <span className="chat-list-item__preview">
                        {chat.lastMessage}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {!loadingChats && chats.length === 0 && !error && (
              <div className="chat-empty">
                You don&apos;t have chats yet. Add some friends first ✨
              </div>
            )}
          </div>
        </aside>

        {/* Правая колонка — чат */}
        <section className="chat-main">
          {activeChat ? (
            <>
              <header className="chat-main__header">
                {isMobile && (
                  <button
                    className="chat-main__back"
                    onClick={handleBackToList}
                  >
                    ‹
                  </button>
                )}

                <div className="chat-main__user">
                  <div className="chat-main__avatar">
                    {activeChat.avatarUrl ? (
                      <img
                        className="chat-main__avatar__img"
                        src={activeChat.avatarUrl}
                        alt={activeChat.userName}
                      />
                    ) : (
                      <span></span>
                    )}
                  </div>
                  <div>
                  <div className="chat-main__name">{activeChat.userName}</div>

<div
  className={
    "chat-main__status " +
    (isOtherUserOnline
      ? "chat-main__status--online"
      : "chat-main__status--offline")
  }
>
  {isOtherUserOnline ? "Online" : "Offline"}
</div>

{isOtherTyping && (
  <div className="chat-main__typing">
    typing
    <span className="typing-dots">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  </div>
)}
                  </div>
                </div>
              </header>

              <div className="chat-main__body">
                {hasMoreHistory[activeChat.id] && (
                  <button
                    type="button"
                    className="chat-load-more"
                    onClick={handleLoadOlder}
                    disabled={loadingMessages}
                  >
                    {loadingMessages ? "Loading..." : "Load previous messages"}
                  </button>
                )}

                <div className="chat-messages" ref={listRef}>
                  {messagesForActive.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        "chat-message" +
                        (msg.fromMe
                          ? " chat-message--outgoing"
                          : " chat-message--incoming")
                      }
                    >
                      <div className="chat-message__bubble">{msg.text}</div>
                      <div className="chat-message__meta">
                        {formatDate(msg.createdAt)}
                      </div>
                    </div>
                  ))}
                  {isOtherTyping && (
    <div className="chat-message chat-message--incoming chat-message--typing">
      <div className="chat-message__bubble">
        <span className="typing-dots">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
      </div>
    </div>
  )}

                  {messagesForActive.length === 0 && !loadingMessages && (
                    <div className="chat-empty">
                      Say hi and start a conversation{" "}
                    </div>
                  )}

                  {loadingMessages && messagesForActive.length === 0 && (
                    <div className="chat-empty">Loading messages…</div>
                  )}
                </div>
              </div>

              <footer className="chat-main__footer">
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Write a message..."
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleEnterKey}
                  />
                  <button
                    type="button"
                    className="button button--primary chat-send-btn"
                    onClick={() => void handleSend()}
                  >
                    Send
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="chat-main--empty">
              {loadingChats
                ? "Loading chats…"
                : "Select a chat to start messaging "}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}


