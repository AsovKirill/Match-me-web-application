package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	JWTSecret   string
	DBURL       string
	AllowOrigin string
}

func LoadConfig() Config {
	// загружаем .env (если есть)
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret-change-me"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set in environment")
	}

	origin := os.Getenv("FRONTEND_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}

	cfg := Config{
		Port:        port,
		JWTSecret:   jwtSecret,
		DBURL:       dbURL,
		AllowOrigin: origin,
	}

	log.Printf("Config: PORT=%s, ALLOW_ORIGIN=%s", cfg.Port, cfg.AllowOrigin)
	return cfg
}
