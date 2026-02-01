package main

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const ctxUserIDKey ctxKey = "userID"

var jwtSecret []byte

func setJWTSecret(secret string) {
	jwtSecret = []byte(secret)
}

// CORS

func corsMiddleware(allowOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Auth middleware (как в TS-версии)

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "Authentication required")
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		type claims struct {
			UserID int64 `json:"userId"`
			jwt.RegisteredClaims
		}

		token, err := jwt.ParseWithClaims(tokenStr, &claims{}, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			writeError(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}

		cl, ok := token.Claims.(*claims)
		if !ok {
			writeError(w, http.StatusUnauthorized, "Invalid token payload")
			return
		}

		ctx := context.WithValue(r.Context(), ctxUserIDKey, cl.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func getUserIDFromContext(r *http.Request) (int64, bool) {
	val := r.Context().Value(ctxUserIDKey)
	if val == nil {
		return 0, false
	}
	id, ok := val.(int64)
	return id, ok
}
