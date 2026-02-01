// presence_handlers.go
package main

import (
	"net/http"
	"strconv"
	"strings"
)

func handlePresence(w http.ResponseWriter, r *http.Request) {
	// просто убеждаемся, что пользователь авторизован
	_, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	raw := r.URL.Query().Get("userIds")
	if raw == "" {
		writeError(w, http.StatusBadRequest, "userIds is required")
		return
	}

	parts := strings.Split(raw, ",")
	var ids []int64
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id, err := strconv.ParseInt(p, 10, 64)
		if err == nil && id > 0 {
			ids = append(ids, id)
		}
	}

	type presence struct {
		UserID int64 `json:"userId"`
		Online bool  `json:"online"`
	}

	res := make([]presence, 0, len(ids))

	// безопасно читаем hub.byUser под RLock
	hub.mu.RLock()
	for _, id := range ids {
		conns := hub.byUser[id]
		online := len(conns) > 0
		res = append(res, presence{
			UserID: id,
			Online: online,
		})
	}
	hub.mu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"presence": res,
	})
}
