// cmd/seed/main.go
package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// this will run before main()
func init() {
    // load .env from the project root (backend-go/.env)
    _ = godotenv.Load() // defaults to ".env" in current working dir
}


var cityCoords = map[string]struct {
	Lat float64
	Lon float64
}{
	"Helsinki":  {Lat: 60.1699, Lon: 24.9384},
	"Espoo":     {Lat: 60.2055, Lon: 24.6559},
	"Tampere":   {Lat: 61.4978, Lon: 23.7610},
	"Vantaa":    {Lat: 60.2934, Lon: 25.0378},
	"Oulu":      {Lat: 65.0121, Lon: 25.4651},
	"Turku":     {Lat: 60.4518, Lon: 22.2666},
	"Jyväskylä": {Lat: 62.2415, Lon: 25.7209},
	"Lahti":     {Lat: 60.9827, Lon: 25.6615},
	"Kuopio":    {Lat: 62.8926, Lon: 27.6770},
	"Pori":      {Lat: 61.4850, Lon: 21.7972},
}

var avatarPool = []string{
	"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar1",
	"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar2",
	"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar3",
	"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar4",
	"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar5",
}

var hobbyPool = []string{
	"music", "photography", "gaming", "cooking", "hiking", "running",
	"traveling", "yoga", "sport", "dancing", "reading", "board games", "movies",
}

var languagePool = []string{
	"English", "Estonian", "Russian", "Swedish", "French", "German", "Finnish",
}

var goalPool = []string{
	"Friendship", "Friendship", "Dates", "Relationships", "Relationships",
	"Relationships", "Communication", "Traveling together",
}

func randomChoice(list []string) string {
	return list[rand.Intn(len(list))]
}

func randomSubset(list []string, min, max int) []string {
	n := min + rand.Intn(max-min+1)
	if n > len(list) {
		n = len(list)
	}
	perm := rand.Perm(len(list))
	out := make([]string, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, list[perm[i]])
	}
	return out
}

func buildAboutMe(name string, hobbies []string, location, goal string) string {
	templates := []string{
		"%s lives in %s and enjoys %s. Here to find %s.",
		"%s is based in %s and spends free time on %s. Looking for %s.",
		"%s likes %s in %s. Here mostly for %s.",
	}
	tmpl := templates[rand.Intn(len(templates))]
	return fmt.Sprintf(tmpl, name, location, strings.Join(hobbies, ", "), strings.ToLower(goal))
}

func main() {
	rand.Seed(time.Now().UnixNano())

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

	// simple ping
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("failed to ping db: %v", err)
	}

	log.Println("Seeding database...")

	// wipe existing data in correct order
	_, err = pool.Exec(ctx, `
		DELETE FROM "ChatRead";
		DELETE FROM "Message";
		DELETE FROM "ChatUser";
		DELETE FROM "Chat";
		DELETE FROM "Connection";
		DELETE FROM "Photo";
		DELETE FROM "Bio";
		DELETE FROM "Preferences";
		DELETE FROM "Profile";
		DELETE FROM "User";
	`)
	if err != nil {
		log.Fatalf("failed to clear tables: %v", err)
	}

	// common password for all demo users
	password := "1234567"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}

	// helper for creating a user with profile/bio/preferences/photo
	createUser := func(name, email, sex string, dob time.Time, location string,
		lat, lon *float64, preferredSex string, ageMin, ageMax, maxDistKm int,
		about string, hobbies, languages []string, goal string, avatarURL string) error {

		var userID int64
		err := pool.QueryRow(ctx, `
			INSERT INTO "User" ("name","email","passwordHash","dateOfBirth","sex")
			VALUES ($1,$2,$3,$4,$5)
			RETURNING "id"
		`, name, email, string(hash), dob, sex).Scan(&userID)
		if err != nil {
			return fmt.Errorf("insert user: %w", err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO "Profile" ("userId","location","latitude","longitude","superLikes")
			VALUES ($1,$2,$3,$4,$5)
		`, userID, location, lat, lon, rand.Intn(6))
		if err != nil {
			return fmt.Errorf("insert profile: %w", err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO "Preferences" ("userId","preferredSex","ageMin","ageMax","maxDistanceKm")
			VALUES ($1,$2,$3,$4,$5)
		`, userID, preferredSex, ageMin, ageMax, maxDistKm)
		if err != nil {
			return fmt.Errorf("insert preferences: %w", err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO "Bio" ("userId","aboutMe","hobbies","goals","languages")
			VALUES ($1,$2,$3,$4,$5)
		`, userID, about, hobbies, goal, languages)
		if err != nil {
			return fmt.Errorf("insert bio: %w", err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO "Photo" ("userId","url")
			VALUES ($1,$2)
		`, userID, avatarURL)
		if err != nil {
			return fmt.Errorf("insert photo: %w", err)
		}

		return nil
	}

	// 3 fixed users (Anna, Mark, Alex) – similar to your Prisma seed
	makeCity := func(city string) (string, *float64, *float64) {
		c := cityCoords[city]
		return city, &c.Lat, &c.Lon
	}

	// Anna
	{
		loc, lat, lon := makeCity("Helsinki")
		hobbies := []string{"hiking", "yoga"}
		goal := "Relationships"
		about := "I love coding, hiking and coffee."
		if about == "" {
			about = buildAboutMe("Anna", hobbies, loc, goal)
		}
		if err := createUser(
			"Anna",
			"anna@example.com",
			"FEMALE",
			time.Date(2000, 5, 10, 0, 0, 0, 0, time.UTC),
			loc, lat, lon,
			"MALE",
			25, 67, 50,
			about, hobbies,
			[]string{"English", "Finnish"},
			goal,
			"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar5",
		); err != nil {
			log.Fatalf("failed to create Anna: %v", err)
		}
	}

	// Mark
	{
		loc, lat, lon := makeCity("Helsinki")
		hobbies := []string{"music", "running", "cooking"}
		goal := "Friendship"
		about := "Into music, running, and cooking."
		if err := createUser(
			"Mark",
			"mark@example.com",
			"MALE",
			time.Date(2000, 11, 2, 0, 0, 0, 0, time.UTC),
			loc, lat, lon,
			"FEMALE",
			18, 67, 30,
			about, hobbies,
			[]string{"English"},
			goal,
			"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar5",
		); err != nil {
			log.Fatalf("failed to create Mark: %v", err)
		}
	}

	// Alex
	{
		loc, lat, lon := makeCity("Helsinki")
		hobbies := []string{"reading", "traveling", "board games"}
		goal := "Traveling together"
		about := "Love learning new things and meeting people."
		if err := createUser(
			"Alex",
			"alex@example.com",
			"OTHER",
			time.Date(2000, 3, 15, 0, 0, 0, 0, time.UTC),
			loc, lat, lon,
			"ALL",
			20, 40, 100,
			about, hobbies,
			[]string{"English", "Russian"},
			goal,
			"https://api.dicebear.com/9.x/thumbs/svg?seed=avatar5",
		); err != nil {
			log.Fatalf("failed to create Alex: %v", err)
		}
	}

	// 120 random users
	for i := 0; i < 120; i++ {
		sexes := []string{"MALE", "FEMALE", "OTHER"}
		sex := sexes[rand.Intn(len(sexes))]

		preferredList := []string{"MALE", "FEMALE", "OTHER", "ALL"}
		preferredSex := preferredList[rand.Intn(len(preferredList))]

		age := 18 + rand.Intn(45-18+1)
		year := time.Now().Year() - age
		month := time.Month(1 + rand.Intn(12))
		day := 1 + rand.Intn(28)
		dob := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)

		cities := []string{
			"Helsinki", "Helsinki", "Helsinki", "Helsinki",
			"Espoo",
			"Tampere", "Tampere",
			"Vantaa",
			"Oulu",
			"Turku", "Turku",
			"Jyväskylä",
			"Lahti",
			"Kuopio",
			"Pori",
		}
		city := cities[rand.Intn(len(cities))]
		coord := cityCoords[city]
		lat, lon := coord.Lat, coord.Lon
		latPtr, lonPtr := &lat, &lon

		name := fmt.Sprintf("User%d", i+1)
		hobbies := randomSubset(hobbyPool, 1, 4)
		langs := randomSubset(languagePool, 1, 3)
		goal := randomChoice(goalPool)
		about := buildAboutMe(name, hobbies, city, goal)
		avatar := randomChoice(avatarPool)

		email := fmt.Sprintf("%s%d@example.com",
			strings.ToLower(strings.ReplaceAll(name, " ", "")), i+1)

		if err := createUser(
			name,
			email,
			sex,
			dob,
			city,
			latPtr, lonPtr,
			preferredSex,
			18, 45, 50,
			about, hobbies, langs, goal, avatar,
		); err != nil {
			log.Fatalf("failed to create random user %d: %v", i+1, err)
		}
	}

	log.Println("Seeding done. Demo password for all users:", password)
}
