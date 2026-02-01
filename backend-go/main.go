package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := LoadConfig()
	setJWTSecret(cfg.JWTSecret)
	InitDB(cfg.DBURL)
	defer CloseDB()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware(cfg.AllowOrigin))

	// public
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	r.Get("/debug/db", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		var now time.Time
		err := db.QueryRow(ctx, `SELECT NOW()`).Scan(&now)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "DB error: "+err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"db_now": now,
		})
	})
	r.Get("/ws", handleWS)
	// === AUTH ===
	r.Post("/auth/register", handleRegister)
	r.Post("/auth/login", handleLogin)
	r.Post("/auth/logout", handleLogout)

	// === PROTECTED ===
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		// me
		r.Get("/me", handleGetMe)
		r.Put("/me/basic-info", handleUpdateBasicInfo)
		r.Get("/me/bio", handleGetMyBio)
		r.Put("/me/bio", handleUpdateMyBio)
		r.Get("/me/profile", handleGetMyProfile)
		r.Put("/me/profile", handleUpdateMyProfile)
		r.Get("/me/preferences", handleGetMyPreferences)
		r.Put("/me/preferences", handleUpdateMyPreferences)
		r.Post("/me/photos", handleUploadPhoto)

		// users
		r.Get("/users/{id}", handleGetUser)
		r.Get("/users/{id}/bio", handleGetUserBio)
		r.Get("/users/{id}/profile", handleGetUserProfile)

		// recommendations
		r.Get("/recommendations", handleGetRecommendations)

		// connections
		r.Get("/connections", handleGetConnections)
		r.Get("/connections/requests", handleGetConnectionRequests)
		r.Post("/connections/{id}/like", handleLikeUser)
		r.Post("/connections/{id}/dislike", handleDislikeUser)
		r.Post("/connections/{id}/accept", handleAcceptConnection)
		r.Post("/connections/{id}/reject", handleRejectConnection)
		r.Post("/connections/{id}/disconnect", handleDisconnectConnection)
		r.Get("/chats", handleGetChats)
		r.Get("/chats/{id}/messages", handleGetChatMessages)
		r.Post("/chats/{id}/messages", handleSendChatMessage)
		r.Post("/chats/with/{userId}", handleEnsureChatWith)
		// chats
		r.Get("/chats", handleGetChats)
		r.Get("/chats/{id}/messages", handleGetChatMessages)
		r.Post("/chats/{id}/messages", handleSendChatMessage)
		r.Post("/chats/with/{userId}", handleEnsureChatWith)
		r.Get("/presence", handlePresence)
	})

	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Go backend running on http://localhost:%s", cfg.Port)
	log.Fatal(srv.ListenAndServe())
}
