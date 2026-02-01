package main

import (
	"context"
	"math"
	"net/http"
	"sort"
	"time"
)

// простая функция для возраста
func calcAge(dob time.Time, now time.Time) int {
	years := now.Year() - dob.Year()
	if now.YearDay() < dob.YearDay() {
		years--
	}
	return years
}

// расстояние в км по координатам (haversine)
func distanceKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	rlat1 := lat1 * math.Pi / 180
	rlon1 := lon1 * math.Pi / 180
	rlat2 := lat2 * math.Pi / 180
	rlon2 := lon2 * math.Pi / 180

	dlat := rlat2 - rlat1
	dlon := rlon2 - rlon1

	a := math.Sin(dlat/2)*math.Sin(dlat/2) +
		math.Cos(rlat1)*math.Cos(rlat2)*math.Sin(dlon/2)*math.Sin(dlon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

func handleGetRecommendations(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// тянем текущего юзера с профилем/префами/био
	var (
		name                      string
		dateOfBirth               time.Time
		sex                       string
		myLat, myLon              *float64
		myPrefSex                 *string
		ageMin, ageMax, maxDistKm *int
	)
	err := db.QueryRow(ctx, `
		SELECT u."name", u."dateOfBirth", u."sex",
		       p."latitude", p."longitude",
		       pr."preferredSex", pr."ageMin", pr."ageMax", pr."maxDistanceKm"
		FROM "User" u
		LEFT JOIN "Profile" p ON p."userId" = u."id"
		LEFT JOIN "Preferences" pr ON pr."userId" = u."id"
		LEFT JOIN "Bio" b ON b."userId" = u."id"
		WHERE u."id" = $1
	`, userID).Scan(&name, &dateOfBirth, &sex, &myLat, &myLon, &myPrefSex, &ageMin, &ageMax, &maxDistKm)
	if err != nil || myPrefSex == nil {
		writeError(w, http.StatusBadRequest, "Profile is not complete for recommendations")
		return
	}

	now := time.Now()
	myAge := calcAge(dateOfBirth, now)

	// собираем id пользователей, с которыми уже есть коннекшены/матчи
	blocked := map[int64]bool{}
	rows, err := db.Query(ctx, `
		SELECT "toUserId"
		FROM "Connection"
		WHERE "fromUserId" = $1
		  AND "status" IN ('LIKED','SUPERLIKED','DISLIKED','MATCHED')
	`, userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err == nil {
				blocked[id] = true
			}
		}
	}

	rows2, err := db.Query(ctx, `
		SELECT "fromUserId","toUserId"
		FROM "Connection"
		WHERE "status" = 'MATCHED'
		  AND ("fromUserId" = $1 OR "toUserId" = $1)
	`, userID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var fromID, toID int64
			if err := rows2.Scan(&fromID, &toID); err == nil {
				if fromID == userID {
					blocked[toID] = true
				} else {
					blocked[fromID] = true
				}
			}
		}
	}

	// кандидаты
	candRows, err := db.Query(ctx, `
		SELECT u."id", u."dateOfBirth", u."sex",
		       p."latitude", p."longitude"
		FROM "User" u
		INNER JOIN "Profile" p ON p."userId" = u."id"
		INNER JOIN "Preferences" pr ON pr."userId" = u."id"
		INNER JOIN "Bio" b ON b."userId" = u."id"
		WHERE u."id" <> $1
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load candidates")
		return
	}
	defer candRows.Close()

	type scored struct {
		id    int64
		score float64
	}
	var results []scored

	for candRows.Next() {
		var cid int64
		var dob2 time.Time
		var sex2 string
		var lat2, lon2 *float64

		if err := candRows.Scan(&cid, &dob2, &sex2, &lat2, &lon2); err != nil {
			continue
		}
		if blocked[cid] {
			continue
		}

		age2 := calcAge(dob2, now)

		// простые фильтры по возрасту и полу
		if ageMin != nil && age2 < *ageMin {
			continue
		}
		if ageMax != nil && age2 > *ageMax {
			continue
		}
		if myPrefSex != nil && *myPrefSex != "ALL" && sex2 != *myPrefSex {
			continue
		}

		// расстояние
		if myLat != nil && myLon != nil && lat2 != nil && lon2 != nil && maxDistKm != nil {
			d := distanceKm(*myLat, *myLon, *lat2, *lon2)
			if d > float64(*maxDistKm) {
				continue
			}
		}

		// скромный скоринг: чем ближе возраст, тем выше
		ageGap := math.Abs(float64(myAge - age2))
		score := 100.0 - ageGap

		results = append(results, scored{id: cid, score: score})
	}

	// сортируем по score
	sort.Slice(results, func(i, j int) bool {
		if results[i].score == results[j].score {
			return results[i].id < results[j].id
		}
		return results[i].score > results[j].score
	})

	// берём топ-10
	limit := 10
	if len(results) < limit {
		limit = len(results)
	}
	ids := make([]int64, 0, limit)
	for i := 0; i < limit; i++ {
		ids = append(ids, results[i].id)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"recommendations": ids,
	})
}
