package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ===== TYPES =====

type registerRequest struct {
	Email       string  `json:"email"`
	Password    string  `json:"password"`
	Name        *string `json:"name"`
	DateOfBirth *string `json:"dateOfBirth"`
	Gender      *string `json:"gender"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authUserResponse struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type authResponse struct {
	Token string           `json:"token"`
	User  authUserResponse `json:"user"`
}

type PhotoDTO struct {
	ID  int64  `json:"id"`
	URL string `json:"url"`
}

// ===== HELPERS =====

func createJWT(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"userId": userID,
		"exp":    time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":    time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ===== /auth/register =====

func handleRegister(w http.ResponseWriter, r *http.Request) {
	var body registerRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "Email and password required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// check existing email
	var existingID int64
	err := db.QueryRow(ctx, `SELECT "id" FROM "User" WHERE "email" = $1`, body.Email).Scan(&existingID)
	if err == nil {
		writeError(w, http.StatusConflict, "Email is already in use")
		return
	}

	// hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	// safe defaults
	safeName := ""
	if body.Name != nil && strings.TrimSpace(*body.Name) != "" {
		safeName = strings.TrimSpace(*body.Name)
	} else {
		parts := strings.Split(body.Email, "@")
		if len(parts) > 0 && parts[0] != "" {
			safeName = parts[0]
		} else {
			safeName = "New user"
		}
	}

	var safeDate time.Time
	if body.DateOfBirth != nil && *body.DateOfBirth != "" {
		parsed, err := time.Parse(time.RFC3339, *body.DateOfBirth)
		if err != nil {
			safeDate = time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC)
		} else {
			safeDate = parsed
		}
	} else {
		safeDate = time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC)
	}

	allowedGenderValues := map[string]bool{
		"MALE":   true,
		"FEMALE": true,
		"OTHER":  true,
	}
	safeGender := "OTHER"
	if body.Gender != nil {
		g := strings.ToUpper(strings.TrimSpace(*body.Gender))
		if allowedGenderValues[g] {
			safeGender = g
		}
	}

	var newID int64
	var newName, newEmail string

	err = db.QueryRow(ctx, `
		INSERT INTO "User" ("name","email","passwordHash","dateOfBirth","sex")
		VALUES ($1,$2,$3,$4,$5)
		RETURNING "id","name","email"
	`, safeName, body.Email, string(hash), safeDate, safeGender).Scan(&newID, &newName, &newEmail)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create user: "+err.Error())
		return
	}

	token, err := createJWT(newID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create token")
		return
	}

	resp := authResponse{
		Token: token,
		User: authUserResponse{
			ID:    newID,
			Name:  newName,
			Email: newEmail,
		},
	}

	writeJSON(w, http.StatusCreated, resp)
}

// ===== /auth/login =====

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var body loginRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	body.Email = strings.TrimSpace(body.Email)
	if body.Email == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "Missing email or password")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var id int64
	var name, email, passwordHash string

	err := db.QueryRow(ctx, `
		SELECT "id","name","email","passwordHash"
		FROM "User"
		WHERE "email" = $1
	`, body.Email).Scan(&id, &name, &email, &passwordHash)
	if err != nil || passwordHash == "" {
		writeError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	token, err := createJWT(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create token")
		return
	}

	resp := authResponse{
		Token: token,
		User: authUserResponse{
			ID:    id,
			Name:  name,
			Email: email,
		},
	}

	writeJSON(w, http.StatusOK, resp)
}

// ===== /auth/logout =====

func handleLogout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out",
	})
}

// ===== /me =====

func handleGetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var id int64
	var name, email string

	err := db.QueryRow(ctx, `
		SELECT "id","name","email"
		FROM "User"
		WHERE "id" = $1
	`, userID).Scan(&id, &name, &email)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	rows, err := db.Query(ctx, `
		SELECT "id","url"
		FROM "Photo"
		WHERE "userId" = $1
		ORDER BY "id" ASC
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load photos")
		return
	}
	defer rows.Close()

	var photos []PhotoDTO
	for rows.Next() {
		var pid int64
		var url string
		if err := rows.Scan(&pid, &url); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to scan photo")
			return
		}
		photos = append(photos, PhotoDTO{ID: pid, URL: url})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":     id,
		"name":   name,
		"email":  email,
		"photos": photos,
	})
}

// ===== /me/basic-info =====

type updateBasicInfoRequest struct {
	Name        *string `json:"name"`        // опционально
	DateOfBirth *string `json:"dateOfBirth"` // "YYYY-MM-DD", опционально
	Gender      *string `json:"gender"`      // "MALE" / "FEMALE" / "OTHER", опционально
}

func handleUpdateBasicInfo(w http.ResponseWriter, r *http.Request) {
	// исправлено: используем getUserIDFromContext вместо несуществующего getUserFromContext
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req updateBasicInfoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	// Собираем части SET динамически
	setParts := []string{}
	args := []any{}
	argIdx := 1

	// name
	if req.Name != nil {
		setParts = append(setParts, `"name" = $`+itoa(argIdx))
		args = append(args, *req.Name)
		argIdx++
	}

	// dateOfBirth
	if req.DateOfBirth != nil {
		t, err := time.Parse("2006-01-02", *req.DateOfBirth)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid dateOfBirth, expected YYYY-MM-DD")
			return
		}
		setParts = append(setParts, `"dateOfBirth" = $`+itoa(argIdx))
		args = append(args, t)
		argIdx++
	}

	// gender (Sex enum в БД)
	if req.Gender != nil {
		switch *req.Gender {
		case "MALE", "FEMALE", "OTHER":
			setParts = append(setParts, `"sex" = $`+itoa(argIdx))
			args = append(args, *req.Gender)
			argIdx++
		default:
			writeError(w, http.StatusBadRequest, "invalid gender, expected MALE/FEMALE/OTHER")
			return
		}
	}

	if len(setParts) == 0 {
		writeError(w, http.StatusBadRequest, "nothing to update")
		return
	}

	// всегда обновляем updatedAt
	setParts = append(setParts, `"updatedAt" = NOW()`)

	query := `
		UPDATE "User"
		SET ` + joinStrings(setParts, ", ") + `
		WHERE "id" = $` + itoa(argIdx) + `
	`
	args = append(args, userID)

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	cmdTag, err := db.Exec(ctx, query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update basic info: "+err.Error())
		return
	}
	if cmdTag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

// маленькие хелперы

func itoa(i int) string {
	return strconv.Itoa(i)
}

func joinStrings(parts []string, sep string) string {
	switch len(parts) {
	case 0:
		return ""
	case 1:
		return parts[0]
	}
	n := len(sep) * (len(parts) - 1)
	for i := 0; i < len(parts); i++ {
		n += len(parts[i])
	}
	b := make([]byte, n)
	bp := copy(b, parts[0])
	for _, s := range parts[1:] {
		bp += copy(b[bp:], sep)
		bp += copy(b[bp:], s)
	}
	return string(b)
}

// ===== /me/bio =====

type updateBioRequest struct {
	AboutMe   *string  `json:"aboutMe"`
	Hobbies   []string `json:"hobbies"`
	Goals     *string  `json:"goals"`
	Languages []string `json:"languages"`
}

func handleGetMyBio(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var aboutMe, goals *string
	var hobbies, languages []string

	err := db.QueryRow(ctx, `
		SELECT "aboutMe","hobbies","goals","languages"
		FROM "Bio"
		WHERE "userId" = $1
	`, userID).Scan(&aboutMe, &hobbies, &goals, &languages)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"id": userID,
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
		"id": userID,
		"bio": map[string]interface{}{
			"aboutMe":   aboutMe,
			"hobbies":   hobbies,
			"goals":     goals,
			"languages": languages,
		},
	})
}

func handleUpdateMyBio(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body updateBioRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if body.Hobbies == nil {
		body.Hobbies = []string{}
	}
	if body.Languages == nil {
		body.Languages = []string{}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Exec(ctx, `
		INSERT INTO "Bio" ("userId","aboutMe","hobbies","goals","languages")
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT ("userId") DO UPDATE SET
			"aboutMe"=EXCLUDED."aboutMe",
			"hobbies"=EXCLUDED."hobbies",
			"goals"=EXCLUDED."goals",
			"languages"=EXCLUDED."languages"
	`, userID, body.AboutMe, body.Hobbies, body.Goals, body.Languages)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to upsert bio")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": userID,
		"bio": map[string]interface{}{
			"aboutMe":   body.AboutMe,
			"hobbies":   body.Hobbies,
			"goals":     body.Goals,
			"languages": body.Languages,
		},
	})
}

// ===== /me/profile =====

type updateProfileRequest struct {
	Location  *string  `json:"location"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

func handleGetMyProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var location *string
	var lat, lon *float64
	var superLikes int

	err := db.QueryRow(ctx, `
		SELECT "location","latitude","longitude","superLikes"
		FROM "Profile"
		WHERE "userId" = $1
	`, userID).Scan(&location, &lat, &lon, &superLikes)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"id": userID,
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
		"id": userID,
		"profile": map[string]interface{}{
			"location":   location,
			"latitude":   lat,
			"longitude":  lon,
			"superLikes": superLikes,
		},
	})
}

func handleUpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Exec(ctx, `
		INSERT INTO "Profile" ("userId","location","latitude","longitude","superLikes")
		VALUES ($1,$2,$3,$4,0)
		ON CONFLICT ("userId") DO UPDATE SET
			"location"=EXCLUDED."location",
			"latitude"=EXCLUDED."latitude",
			"longitude"=EXCLUDED."longitude"
	`, userID, body.Location, body.Latitude, body.Longitude)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to upsert profile")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": userID,
		"profile": map[string]interface{}{
			"location":   body.Location,
			"latitude":   body.Latitude,
			"longitude":  body.Longitude,
			"superLikes": 0,
		},
	})
}

// ===== /me/preferences =====

type updatePreferencesRequest struct {
	PreferredGender string `json:"preferredGender"`
	AgeMin          *int   `json:"ageMin"`
	AgeMax          *int   `json:"ageMax"`
	MaxDistanceKm   *int   `json:"maxDistanceKm"`
}

func handleGetMyPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var preferredSex *string
	var ageMin, ageMax, maxDistanceKm *int

	err := db.QueryRow(ctx, `
		SELECT "preferredSex","ageMin","ageMax","maxDistanceKm"
		FROM "Preferences"
		WHERE "userId" = $1
	`, userID).Scan(&preferredSex, &ageMin, &ageMax, &maxDistanceKm)
	if err != nil || preferredSex == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"id": userID,
			"preferences": map[string]interface{}{
				"preferredGender": "ALL",
				"ageMin":          nil,
				"ageMax":          nil,
				"maxDistanceKm":   nil,
			},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": userID,
		"preferences": map[string]interface{}{
			"preferredGender": *preferredSex,
			"ageMin":          ageMin,
			"ageMax":          ageMax,
			"maxDistanceKm":   maxDistanceKm,
		},
	})
}

func handleUpdateMyPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body updatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	pref := strings.ToUpper(strings.TrimSpace(body.PreferredGender))
	if pref == "" {
		pref = "ALL"
	}

	allowed := map[string]bool{
		"MALE":   true,
		"FEMALE": true,
		"OTHER":  true,
		"ALL":    true,
	}
	if !allowed[pref] {
		writeError(w, http.StatusBadRequest, "Invalid preferredGender value")
		return
	}

	var ageMinNum, ageMaxNum *int
	if body.AgeMin != nil {
		if *body.AgeMin < 18 {
			writeError(w, http.StatusBadRequest, "ageMin must be at least 18")
			return
		}
		ageMinNum = body.AgeMin
	}
	if body.AgeMax != nil {
		if *body.AgeMax < 18 {
			writeError(w, http.StatusBadRequest, "ageMax must be at least 18")
			return
		}
		ageMaxNum = body.AgeMax
	}
	if ageMinNum != nil && ageMaxNum != nil && *ageMinNum > *ageMaxNum {
		writeError(w, http.StatusBadRequest, "ageMin cannot be greater than ageMax")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Exec(ctx, `
		INSERT INTO "Preferences" ("userId","preferredSex","ageMin","ageMax","maxDistanceKm")
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT ("userId") DO UPDATE SET
			"preferredSex"=EXCLUDED."preferredSex",
			"ageMin"=EXCLUDED."ageMin",
			"ageMax"=EXCLUDED."ageMax",
			"maxDistanceKm"=EXCLUDED."maxDistanceKm"
	`, userID, pref, ageMinNum, ageMaxNum, body.MaxDistanceKm)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to upsert preferences")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": userID,
		"preferences": map[string]interface{}{
			"preferredGender": pref,
			"ageMin":          ageMinNum,
			"ageMax":          ageMaxNum,
			"maxDistanceKm":   body.MaxDistanceKm,
		},
	})
}

// ===== /me/photos =====

type uploadPhotoRequest struct {
	DataURL string `json:"dataUrl"`
}

func handleUploadPhoto(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body uploadPhotoRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if strings.TrimSpace(body.DataURL) == "" {
		writeError(w, http.StatusBadRequest, "dataUrl is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var photoID int64
	err := db.QueryRow(ctx, `
		INSERT INTO "Photo" ("userId","url")
		VALUES ($1,$2)
		RETURNING "id"
	`, userID, body.DataURL).Scan(&photoID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create photo")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": userID,
		"photo": map[string]interface{}{
			"id":  photoID,
			"url": body.DataURL,
		},
	})
}
