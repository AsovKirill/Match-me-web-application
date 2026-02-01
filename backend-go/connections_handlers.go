package main

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// GET /connections -> { connections: number[] }
func handleGetConnections(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := db.Query(ctx, `
		SELECT "fromUserId","toUserId"
		FROM "Connection"
		WHERE "status" = 'MATCHED'
		  AND ("fromUserId" = $1 OR "toUserId" = $1)
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load connections")
		return
	}
	defer rows.Close()

	idsMap := map[int64]bool{}
	for rows.Next() {
		var fromID, toID int64
		if err := rows.Scan(&fromID, &toID); err != nil {
			continue
		}
		if fromID == userID {
			idsMap[toID] = true
		} else {
			idsMap[fromID] = true
		}
	}

	var ids []int64
	for id := range idsMap {
		ids = append(ids, id)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"connections": ids,
	})
}

// GET /connections/requests
func handleGetConnectionRequests(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := db.Query(ctx, `
		SELECT "id","fromUserId","toUserId","status"
		FROM "Connection"
		WHERE "toUserId" = $1
		  AND "status" IN ('LIKED','SUPERLIKED')
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load requests")
		return
	}
	defer rows.Close()

	type req struct {
		ID       int64  `json:"id"`
		FromUser int64  `json:"fromUserId"`
		ToUser   int64  `json:"toUserId"`
		Status   string `json:"status"`
	}
	var out []req

	for rows.Next() {
		var rItem req
		if err := rows.Scan(&rItem.ID, &rItem.FromUser, &rItem.ToUser, &rItem.Status); err != nil {
			continue
		}
		out = append(out, rItem)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"requests": out,
	})
}

func handleLikeUser(w http.ResponseWriter, r *http.Request) {
	handleConnectionAction(w, r, "LIKED", true)
}

func handleDislikeUser(w http.ResponseWriter, r *http.Request) {
	handleConnectionAction(w, r, "DISLIKED", false)
}

func handleAcceptConnection(w http.ResponseWriter, r *http.Request) {
	// тот, кто принимает, меняет входящий запрос на MATCHED
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	raw := chi.URLParam(r, "id")
	targetID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || targetID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	if targetID == userID {
		writeError(w, http.StatusBadRequest, "Cannot accept yourself")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// есть ли коннекшен target -> me
	var connID int64
	err = db.QueryRow(ctx, `
		SELECT "id"
		FROM "Connection"
		WHERE "fromUserId" = $1
		  AND "toUserId" = $2
		  AND "status" IN ('LIKED','SUPERLIKED','PENDING')
	`, targetID, userID).Scan(&connID)
	if err != nil {
		writeError(w, http.StatusNotFound, "No pending request from this user")
		return
	}

	_, err = db.Exec(ctx, `
		UPDATE "Connection"
		SET "status" = 'MATCHED'
		WHERE "id" = $1
	`, connID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update connection")
		return
	}

	// создаём (или находим существующий) чат для этой пары
	_, _ = ensureChatForUsers(ctx, userID, targetID)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":         connID,
		"fromUserId": targetID,
		"toUserId":   userID,
		"status":     "MATCHED",
	})
}

func handleRejectConnection(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	raw := chi.URLParam(r, "id")
	targetID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || targetID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	if targetID == userID {
		writeError(w, http.StatusBadRequest, "Cannot reject yourself")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var connID int64
	err = db.QueryRow(ctx, `
		SELECT "id"
		FROM "Connection"
		WHERE "fromUserId" = $1
		  AND "toUserId" = $2
		  AND "status" IN ('LIKED','SUPERLIKED','PENDING')
	`, targetID, userID).Scan(&connID)
	if err != nil {
		writeError(w, http.StatusNotFound, "No pending request from this user")
		return
	}

	_, err = db.Exec(ctx, `
		UPDATE "Connection"
		SET "status" = 'DISLIKED'
		WHERE "id" = $1
	`, connID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update connection")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":         connID,
		"fromUserId": targetID,
		"toUserId":   userID,
		"status":     "DISLIKED",
	})
}

// общий helper для like / dislike / superlike
func handleConnectionAction(w http.ResponseWriter, r *http.Request, status string, checkMatch bool) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	raw := chi.URLParam(r, "id")
	targetID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || targetID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	if targetID == userID {
		writeError(w, http.StatusBadRequest, "Cannot connect to yourself")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// таргет существует?
	var tmp int64
	if err := db.QueryRow(ctx, `SELECT "id" FROM "User" WHERE "id" = $1`, targetID).Scan(&tmp); err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	// если checkMatch = true (like), смотрим, лайкал ли он нас ранее
	if checkMatch {
		var reverseStatus string
		err := db.QueryRow(ctx, `
			SELECT "status"
			FROM "Connection"
			WHERE "fromUserId" = $1 AND "toUserId" = $2
		`, targetID, userID).Scan(&reverseStatus)
		if err == nil && (reverseStatus == "LIKED" || reverseStatus == "SUPERLIKED" || reverseStatus == "PENDING") {
			// это матч
			_, err = db.Exec(ctx, `
				UPDATE "Connection"
				SET "status" = 'MATCHED'
				WHERE "fromUserId" = $1 AND "toUserId" = $2
			`, targetID, userID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "Failed to update connection")
				return
			}

			// создаём чат для пары (если ещё нет)
			_, _ = ensureChatForUsers(ctx, userID, targetID)

			writeJSON(w, http.StatusOK, map[string]interface{}{
				"matched":    true,
				"fromUserId": targetID,
				"toUserId":   userID,
				"status":     "MATCHED",
			})
			return
		}
	}

	// upsert from me -> target
	var id int64
	err = db.QueryRow(ctx, `
		INSERT INTO "Connection" ("fromUserId","toUserId","status")
		VALUES ($1,$2,$3)
		ON CONFLICT ("fromUserId","toUserId") DO UPDATE SET
			"status" = EXCLUDED."status"
		RETURNING "id"
	`, userID, targetID, status).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to upsert connection")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":         id,
		"fromUserId": userID,
		"toUserId":   targetID,
		"status":     status,
		"matched":    false,
	})
}

// POST /connections/:id/disconnect
func handleDisconnectConnection(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	raw := chi.URLParam(r, "id")
	targetID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || targetID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	if targetID == userID {
		writeError(w, http.StatusBadRequest, "Cannot disconnect from yourself")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// таргет есть?
	var tmp int64
	if err := db.QueryRow(ctx, `SELECT "id" FROM "User" WHERE "id" = $1`, targetID).Scan(&tmp); err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	res, err := db.Exec(ctx, `
		UPDATE "Connection"
		SET "status" = 'DISLIKED'
		WHERE ("fromUserId" = $1 AND "toUserId" = $2)
		   OR ("fromUserId" = $2 AND "toUserId" = $1)
	`, userID, targetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update connections")
		return
	}
	affected := res.RowsAffected()
	if affected == 0 {
		writeError(w, http.StatusNotFound, "Connection not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"disconnectedUserId": targetID,
	})
}

// ===== helper: создаёт чат для пары пользователей, если его ещё нет =====

func ensureChatForUsers(ctx context.Context, user1, user2 int64) (int64, error) {
	if user1 == user2 {
		return 0, nil
	}

	var chatID int64

	// пробуем найти существующий 1-1 чат
	err := db.QueryRow(ctx, `
		SELECT c."id"
		FROM "Chat" c
		JOIN "ChatUser" cu1 ON cu1."chatId" = c."id" AND cu1."userId" = $1
		JOIN "ChatUser" cu2 ON cu2."chatId" = c."id" AND cu2."userId" = $2
		LIMIT 1
	`, user1, user2).Scan(&chatID)
	if err == nil && chatID > 0 {
		return chatID, nil
	}

	// создаём новый чат
	err = db.QueryRow(ctx, `
		INSERT INTO "Chat" DEFAULT VALUES
		RETURNING "id"
	`).Scan(&chatID)
	if err != nil {
		return 0, err
	}

	_, err = db.Exec(ctx, `
		INSERT INTO "Chat" ("chatId","userId")
		VALUES ($1,$2),($1,$3)
		ON CONFLICT DO NOTHING
	`, chatID, user1, user2)
	if err != nil {
		return 0, err
	}

	return chatID, nil
}
