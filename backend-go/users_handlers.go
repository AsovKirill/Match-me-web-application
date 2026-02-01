package main

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

func parseIDParam(r *http.Request, name string) (int64, bool) {
	raw := chi.URLParam(r, name)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

// проверка, может ли viewer видеть target (как canViewUserDetails в TS)
func canViewUserDetails(ctx context.Context, viewerID, targetID int64) (bool, error) {
	if viewerID == targetID {
		return true, nil
	}

	// есть ли хоть какая-то нененавистная связь
	var status string
	err := db.QueryRow(ctx, `
		SELECT "status"
		FROM "Connection"
		WHERE (
			("fromUserId" = $1 AND "toUserId" = $2) OR
			("fromUserId" = $2 AND "toUserId" = $1)
		)
		LIMIT 1
	`, viewerID, targetID).Scan(&status)
	if err == nil {
		// если существует и не DISLIKED — можно смотреть
		if status != "DISLIKED" {
			return true, nil
		}
	}

	// иначе — проверяем, могли бы они быть рекоммендацией (похожая логика на /recommendations)
	// упрощённый вариант: оба должны иметь профиль, био и префы.
	var count int
	err = db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "User" u
		LEFT JOIN "Profile" p ON p."userId" = u."id"
		LEFT JOIN "Preferences" pr ON pr."userId" = u."id"
		LEFT JOIN "Bio" b ON b."userId" = u."id"
		WHERE u."id" = $1
		  AND p."id" IS NOT NULL
		  AND pr."id" IS NOT NULL
		  AND b."id" IS NOT NULL
	`, targetID).Scan(&count)
	if err != nil {
		return false, err
	}
	if count == 0 {
		return false, nil
	}

	// если пользователь существует и у него заполнен профиль — разрешаем
	return true, nil
}

// GET /users/:id
func handleGetUser(w http.ResponseWriter, r *http.Request) {
	viewerID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	targetID, ok := parseIDParam(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// проверка видимости
	can, err := canViewUserDetails(ctx, viewerID, targetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to check permissions")
		return
	}
	if !can {
		// как в TS — маскируем как 404
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	var id int64
	var name string
	err = db.QueryRow(ctx, `
		SELECT "id","name"
		FROM "User"
		WHERE "id" = $1
	`, targetID).Scan(&id, &name)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	// первое фото как аватар
	var avatarURL *string
	_ = db.QueryRow(ctx, `
		SELECT "url"
		FROM "Photo"
		WHERE "userId" = $1
		ORDER BY "id" ASC
		LIMIT 1
	`, targetID).Scan(&avatarURL)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":              id,
		"name":            name,
		"profileImageUrl": avatarURL,
	})
}

// GET /users/:id/profile
func handleGetUserProfile(w http.ResponseWriter, r *http.Request) {
	viewerID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	targetID, ok := parseIDParam(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	can, err := canViewUserDetails(ctx, viewerID, targetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to check permissions")
		return
	}
	if !can {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	var location *string
	var lat, lon *float64
	var superLikes int

	err = db.QueryRow(ctx, `
		SELECT "location","latitude","longitude","superLikes"
		FROM "Profile"
		WHERE "userId" = $1
	`, targetID).Scan(&location, &lat, &lon, &superLikes)
	if err != nil {
		// как в TS — возвращаем пустой профиль
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"id": targetID,
			"profile": map[string]interface{}{
				"location":   nil,
				"latitude":   nil,
				"longitude":  nil,
				"superLikes": 0,
			},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": targetID,
		"profile": map[string]interface{}{
			"location":   location,
			"latitude":   lat,
			"longitude":  lon,
			"superLikes": superLikes,
		},
	})
}

// GET /users/:id/bio
func handleGetUserBio(w http.ResponseWriter, r *http.Request) {
	viewerID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	targetID, ok := parseIDParam(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "Invalid user id")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	can, err := canViewUserDetails(ctx, viewerID, targetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to check permissions")
		return
	}
	if !can {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	var aboutMe, goals *string
	var hobbies, languages []string

	err = db.QueryRow(ctx, `
		SELECT "aboutMe","hobbies","goals","languages"
		FROM "Bio"
		WHERE "userId" = $1
	`, targetID).Scan(&aboutMe, &hobbies, &goals, &languages)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"id": targetID,
			"bio": map[string]interface{}{
				"aboutMe":   nil,
				"hobbies":   []string{},
				"goals":     nil,
				"languages": []string{},
			},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": targetID,
		"bio": map[string]interface{}{
			"aboutMe":   aboutMe,
			"hobbies":   hobbies,
			"goals":     goals,
			"languages": languages,
		},
	})
}
