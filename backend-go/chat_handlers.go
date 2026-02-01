package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// ===== TYPES =====

type chatPreviewResponse struct {
	ID          int64      `json:"id"`
	OtherUser   *int64     `json:"otherUserId"`
	UserName    string     `json:"userName"`
	AvatarURL   *string    `json:"avatarUrl"`
	LastMsg     string     `json:"lastMessage"`
	LastTime    *time.Time `json:"lastTime"`
	UnreadCount int64      `json:"unreadCount"`
}

type chatMessageResponse struct {
	ID        int64     `json:"id"`
	ChatID    int64     `json:"chatId"`
	SenderID  int64     `json:"senderId"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

// ===== GET /chats =====

func handleGetChats(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := db.Query(ctx, `
		SELECT
			c."id" AS chatId,
			u2."id" AS otherUserId,
			u2."name" AS otherUserName,
			p."url" AS avatarUrl,
			m2."content" AS lastMessage,
			m2."timestamp" AS lastTime,
			COALESCE((
				SELECT COUNT(*)
				FROM "Message" m3
				LEFT JOIN "ChatRead" cr
					ON cr."chatId" = m3."chatId"
					AND cr."userId" = $1
				WHERE m3."chatId" = c."id"
				  AND m3."timestamp" > COALESCE(cr."lastReadAt", '1970-01-01'::timestamp)
				  AND m3."senderId" <> $1
			), 0) AS unreadCount
		FROM "Chat" c
		JOIN "ChatUser" cu1
			ON cu1."chatId" = c."id" AND cu1."userId" = $1
		JOIN "ChatUser" cu2
			ON cu2."chatId" = c."id" AND cu2."userId" <> $1
		JOIN "User" u2 ON u2."id" = cu2."userId"
		LEFT JOIN LATERAL (
			SELECT "content", "timestamp"
			FROM "Message"
			WHERE "chatId" = c."id"
			ORDER BY "timestamp" DESC
			LIMIT 1
		) m2 ON TRUE
		LEFT JOIN "Photo" p
			ON p."userId" = u2."id"
		ORDER BY m2."timestamp" DESC NULLS LAST, c."id" DESC
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load chats")
		return
	}
	defer rows.Close()

	var chats []chatPreviewResponse
	for rows.Next() {
		var c chatPreviewResponse
		var otherUserID int64
		var lastTime *time.Time
		var avatarURL *string
		var lastMsg *string

		if err := rows.Scan(
			&c.ID,
			&otherUserID,
			&c.UserName,
			&avatarURL,
			&lastMsg,
			&lastTime,
			&c.UnreadCount,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan chat")
			return
		}

		c.OtherUser = &otherUserID
		c.AvatarURL = avatarURL
		if lastMsg != nil {
			c.LastMsg = *lastMsg
		} else {
			c.LastMsg = ""
		}
		c.LastTime = lastTime

		chats = append(chats, c)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"chats": chats,
	})
}

// ===== GET /chats/{id}/messages =====

func handleGetChatMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	rawID := chi.URLParam(r, "id")
	chatID, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || chatID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid chat id")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// проверяем, что пользователь участник чата
	var exists bool
	err = db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "ChatUser"
			WHERE "chatId" = $1 AND "userId" = $2
		)
	`, chatID, userID).Scan(&exists)
	if err != nil || !exists {
		writeError(w, http.StatusNotFound, "Chat not found")
		return
	}

	// --- pagination ---
	query := r.URL.Query()
	limit := 20
	if lStr := query.Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	var before *time.Time
	if bStr := query.Get("before"); bStr != "" {
		if t, err := time.Parse(time.RFC3339, bStr); err == nil {
			before = &t
		}
	}

	var rows pgx.Rows

	if before != nil {
		// ветка с before
		rows, err = db.Query(ctx, `
			SELECT "id", "chatId", "senderId", "content", "timestamp"
			FROM "Message"
			WHERE "chatId" = $1 AND "timestamp" < $2
			ORDER BY "timestamp" DESC
			LIMIT $3
		`, chatID, *before, limit+1)
	} else {
		// ветка без before
		rows, err = db.Query(ctx, `
			SELECT "id", "chatId", "senderId", "content", "timestamp"
			FROM "Message"
			WHERE "chatId" = $1
			ORDER BY "timestamp" DESC
			LIMIT $2
		`, chatID, limit+1)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load messages: "+err.Error())
		return
	}
	defer rows.Close()

	var msgs []chatMessageResponse
	for rows.Next() {
		var m chatMessageResponse
		if err := rows.Scan(&m.ID, &m.ChatID, &m.SenderID, &m.Content, &m.Timestamp); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan message")
			return
		}
		msgs = append(msgs, m)
	}

	hasMore := false
	if len(msgs) > limit {
		hasMore = true
		msgs = msgs[:limit]
	}

	// помечаем как прочитанные
	_, _ = db.Exec(ctx, `
		INSERT INTO "ChatRead" ("chatId","userId","lastReadAt")
		VALUES ($1,$2,NOW())
		ON CONFLICT ("chatId","userId") DO UPDATE
		SET "lastReadAt" = EXCLUDED."lastReadAt"
	`, chatID, userID)

	writeJSON(w, http.StatusOK, map[string]any{
		"messages": msgs,
		"hasMore":  hasMore,
	})
}

// ===== POST /chats/{id}/messages =====

type sendMessageRequest struct {
	Content string `json:"content"`
}

func handleSendChatMessage(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	rawID := chi.URLParam(r, "id")
	chatID, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || chatID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid chat id")
		return
	}

	var body sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	body.Content = strings.TrimSpace(body.Content)
	if body.Content == "" {
		writeError(w, http.StatusBadRequest, "Message content is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// проверяем, что пользователь в чате
	var exists bool
	err = db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "ChatUser"
			WHERE "chatId" = $1 AND "userId" = $2
		)
	`, chatID, userID).Scan(&exists)
	if err != nil || !exists {
		writeError(w, http.StatusNotFound, "Chat not found")
		return
	}

	var msgID int64
	var ts time.Time
	err = db.QueryRow(ctx, `
		INSERT INTO "Message" ("chatId","senderId","content")
		VALUES ($1,$2,$3)
		RETURNING "id","timestamp"
	`, chatID, userID, body.Content).Scan(&msgID, &ts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to send message")
		return
	}

	// обновляем read state отправителя
	_, _ = db.Exec(ctx, `
		INSERT INTO "ChatRead" ("chatId","userId","lastReadAt")
		VALUES ($1,$2,$3)
		ON CONFLICT ("chatId","userId") DO UPDATE
		SET "lastReadAt" = EXCLUDED."lastReadAt"
	`, chatID, userID, ts)

	resp := chatMessageResponse{
		ID:        msgID,
		ChatID:    chatID,
		SenderID:  userID,
		Content:   body.Content,
		Timestamp: ts,
	}

	// ищем второго участника чата и шлём ему ws-событие
	var otherUserID int64
	err = db.QueryRow(ctx, `
		SELECT "userId"
		FROM "ChatUser"
		WHERE "chatId" = $1 AND "userId" <> $2
		LIMIT 1
	`, chatID, userID).Scan(&otherUserID)
	if err == nil && otherUserID > 0 {
		wsSendToUser(otherUserID, wsOutgoing{
			Type:       "new_message",
			ChatID:     chatID,
			FromUserID: userID,
			Message:    &resp,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

// ===== POST /chats/with/{userId} =====

func handleEnsureChatWith(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	raw := chi.URLParam(r, "userId")
	targetID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || targetID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	if targetID == userID {
		writeError(w, http.StatusBadRequest, "Cannot create chat with yourself")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// проверяем, что такой пользователь существует
	var tmp int64
	if err := db.QueryRow(ctx, `SELECT "id" FROM "User" WHERE "id" = $1`, targetID).Scan(&tmp); err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	// ищем существующий чат 1–1
	var chatID int64
	err = db.QueryRow(ctx, `
		SELECT c."id"
		FROM "Chat" c
		JOIN "ChatUser" cu1 ON cu1."chatId" = c."id" AND cu1."userId" = $1
		JOIN "ChatUser" cu2 ON cu2."chatId" = c."id" AND cu2."userId" = $2
		LIMIT 1
	`, userID, targetID).Scan(&chatID)
	if err == nil && chatID > 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"chatId": chatID,
		})
		return
	}

	// иначе создаём новый чат
	err = db.QueryRow(ctx, `
		INSERT INTO "Chat" DEFAULT VALUES
		RETURNING "id"
	`).Scan(&chatID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create chat")
		return
	}

	_, err = db.Exec(ctx, `
		INSERT INTO "ChatUser" ("chatId","userId")
		VALUES ($1,$2),($1,$3)
	`, chatID, userID, targetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to attach users to chat")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"chatId": chatID,
	})
}
