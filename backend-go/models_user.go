package main

import (
	"context"
	"time"
)

// Структуры примерно соответствуют моделям Prisma

type User struct {
	ID           int64
	Name         string
	Email        string
	PasswordHash string
	DateOfBirth  time.Time
	Sex          string
}

type Photo struct {
	ID     int64
	UserID int64
	URL    string
}

// ===== DB-функции =====

func GetUserByEmail(ctx context.Context, email string) (*User, error) {
	row := db.QueryRow(ctx, `
        SELECT "id", "name", "email", "passwordHash", "dateOfBirth", "sex"
        FROM "User"
        WHERE "email" = $1
    `, email)

	var u User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.DateOfBirth, &u.Sex)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func GetUserByID(ctx context.Context, id int64) (*User, error) {
	row := db.QueryRow(ctx, `
        SELECT "id", "name", "email", "passwordHash", "dateOfBirth", "sex"
        FROM "User"
        WHERE "id" = $1
    `, id)

	var u User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.DateOfBirth, &u.Sex)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func CreateUser(ctx context.Context, name, email, passwordHash string, dob time.Time, sex string) (*User, error) {
	row := db.QueryRow(ctx, `
        INSERT INTO "User" ("name", "email", "passwordHash", "dateOfBirth", "sex")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING "id", "name", "email", "passwordHash", "dateOfBirth", "sex"
    `, name, email, passwordHash, dob, sex)

	var u User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.DateOfBirth, &u.Sex)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func GetPhotosByUserID(ctx context.Context, userID int64) ([]Photo, error) {
	rows, err := db.Query(ctx, `
        SELECT "id", "userId", "url"
        FROM "Photo"
        WHERE "userId" = $1
        ORDER BY "id" ASC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []Photo
	for rows.Next() {
		var p Photo
		if err := rows.Scan(&p.ID, &p.UserID, &p.URL); err != nil {
			return nil, err
		}
		res = append(res, p)
	}
	return res, rows.Err()
}

func CreatePhoto(ctx context.Context, userID int64, url string) (*Photo, error) {
	row := db.QueryRow(ctx, `
        INSERT INTO "Photo" ("userId", "url")
        VALUES ($1, $2)
        RETURNING "id", "userId", "url"
    `, userID, url)

	var p Photo
	err := row.Scan(&p.ID, &p.UserID, &p.URL)
	if err != nil {
		return nil, err
	}
	return &p, nil
}
