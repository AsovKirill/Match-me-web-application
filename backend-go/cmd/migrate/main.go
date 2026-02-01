// cmd/migrate/main.go
package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("failed to create pgx pool: %v", err)
	}
	defer pool.Close()

	// читаем SQL схему
	schemaBytes, err := os.ReadFile("db/schema.sql")
	if err != nil {
		log.Fatalf("failed to read db/schema.sql: %v", err)
	}
	schema := string(schemaBytes)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	log.Println("Applying schema...")
	_, err = pool.Exec(ctx, schema)
	if err != nil {
		log.Fatalf("failed to apply schema: %v", err)
	}

	log.Println("Schema applied successfully")
}
