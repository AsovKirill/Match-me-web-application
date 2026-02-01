// ws.go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// ===== WebSocket модели =====

type wsClient struct {
	userID int64
	conn   *websocket.Conn
}

type wsHub struct {
	mu     sync.RWMutex
	byUser map[int64]map[*wsClient]struct{}
}

var hub = &wsHub{
	byUser: make(map[int64]map[*wsClient]struct{}),
}

type wsOutgoing struct {
	Type       string               `json:"type"`
	ChatID     int64                `json:"chatId,omitempty"`
	FromUserID int64                `json:"fromUserId,omitempty"`
	UserID     int64                `json:"userId,omitempty"`
	Online     bool                 `json:"online,omitempty"`
	Message    *chatMessageResponse `json:"message,omitempty"`
	Typing     bool                 `json:"typing,omitempty"`
}

// ===== hub helpers =====

func (h *wsHub) addClient(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	conns := h.byUser[c.userID]
	if conns == nil {
		conns = make(map[*wsClient]struct{})
		h.byUser[c.userID] = conns
	}
	conns[c] = struct{}{}
}

func (h *wsHub) removeClient(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	conns := h.byUser[c.userID]
	if conns == nil {
		return
	}
	delete(conns, c)
	if len(conns) == 0 {
		delete(h.byUser, c.userID)
	}
}

func wsSendToUser(userID int64, payload wsOutgoing) {
	hub.mu.RLock()
	conns := hub.byUser[userID]
	if len(conns) == 0 {
		hub.mu.RUnlock()
		return
	}

	clients := make([]*wsClient, 0, len(conns))
	for c := range conns {
		clients = append(clients, c)
	}
	hub.mu.RUnlock()

	data, err := json.Marshal(payload)
	if err != nil {
		log.Println("wsSendToUser marshal error:", err)
		return
	}

	for _, c := range clients {
		if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Println("wsSendToUser write error:", err)
		}
	}
}

// broadcast presence всем подключённым
func wsBroadcastPresence(userID int64, online bool) {
	hub.mu.RLock()
	clients := make([]*wsClient, 0)
	for _, conns := range hub.byUser {
		for c := range conns {
			clients = append(clients, c)
		}
	}
	hub.mu.RUnlock()

	out := wsOutgoing{
		Type:   "presence",
		UserID: userID,
		Online: online,
	}
	data, err := json.Marshal(out)
	if err != nil {
		log.Println("wsBroadcastPresence marshal error:", err)
		return
	}

	for _, c := range clients {
		if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Println("wsBroadcastPresence write error:", err)
		}
	}
}

// ===== JWT разбор для ws =====

func parseUserIDFromToken(tokenStr string) (int64, error) {
	if tokenStr == "" {
		return 0, jwt.ErrTokenMalformed
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return 0, err
	}

	rawID, ok := claims["userId"]
	if !ok {
		return 0, jwt.ErrTokenMalformed
	}

	// в наших токенах userId — это float64
	switch v := rawID.(type) {
	case float64:
		return int64(v), nil
	case int64:
		return v, nil
	default:
		return 0, jwt.ErrTokenMalformed
	}
}

// ===== WebSocket handler =====

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// dev-режим: пускаем всех (CORS уже настроен на HTTP)
		return true
	},
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	userID, err := parseUserIDFromToken(tokenStr)
	if err != nil || userID <= 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	client := &wsClient{
		userID: userID,
		conn:   conn,
	}
	hub.addClient(client)
	wsBroadcastPresence(userID, true)

	// читаем входящие сообщения (typing)
	go func() {
		defer func() {
			hub.removeClient(client)
			_ = conn.Close()
			wsBroadcastPresence(userID, false)
		}()

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				// клиент отвалился
				return
			}

			var incoming struct {
				Type   string `json:"type"`
				ChatID int64  `json:"chatId"`
				Typing bool   `json:"typing"`
			}
			if err := json.Unmarshal(data, &incoming); err != nil {
				continue
			}

			switch incoming.Type {
			case "typing":
				if incoming.ChatID <= 0 {
					continue
				}

				// находим второго участника чата
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				var otherID int64
				err := db.QueryRow(ctx, `
					SELECT "userId"
					FROM "ChatUser"
					WHERE "chatId" = $1 AND "userId" <> $2
					LIMIT 1
				`, incoming.ChatID, userID).Scan(&otherID)
				cancel()
				if err != nil || otherID <= 0 {
					continue
				}

				wsSendToUser(otherID, wsOutgoing{
					Type:       "typing",
					ChatID:     incoming.ChatID,
					FromUserID: userID,
					Typing:     incoming.Typing,
				})
			default:
				// других типов пока нет
			}
		}
	}()
}
