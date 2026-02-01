# API Contract

> Work in progress. This file describes the planned/implemented API for coordination between backend and frontend.

All endpoints are assumed to be prefixed with `http://localhost:4000`.

---

## Auth / Current User

### GET /me

Returns the current user’s full info (for now, backend can hard-code user id until auth is added).

Response example (simplified):

- user: `id`, `name`, `sex`, `dateOfBirth`
- profile: `location`, `superLikes`
- preferences: `preferredSex`, `ageMin`, `ageMax`, `maxDistanceKm`
- bio: `aboutMe`, `hobbies`, `goals`
- photos: list of `{ url }`

---

## Users

### GET /users/:id

Public basic info for a user.  
No sensitive fields (no email, no password hash).

### GET /users/:id/full

Full profile for a user (for profile page and recommendation cards):

- user
- profile
- preferences (if needed)
- bio
- photos

---

## Profile Editing

Used by “Edit profile” page.

### PUT /me/profile

Update profile location data.

**Body:**

```json
{
  "location": "Tallinn, Estonia",
  "latitude": 59.437,
  "longitude": 24.7536
}
```

PUT /me/bio
Update biographical info.

Body:

```json
{
  "aboutMe": "I love coding and cats.",
  "hobbies": ["coding", "cats", "coffee"],
  "goals": "Long-term relationship"
}
```

PUT /me/preferences
Update matching preferences.

Body:

```json
{
  "preferredSex": "MALE",
  "ageMin": 25,
  "ageMax": 35,
  "maxDistanceKm": 50
}
```

POST /me/photos (later)
Add a new photo (URL-based version first, file upload later).

Body:

```json
{
  "url": "https://example.com/my-photo.jpg"
}
```

Recommendations & Connections
GET /recommendations
Returns a list of suggested users based on:

current user’s Preferences (sex, age range, distance)

excluding users already LIKED/DISLIKED/MATCHED/SUPERLIKED in Connection.

Response: array of lightweight user cards:

id, name, age (computed on frontend), location, short aboutMe, main photoUrl.

POST /connections/:targetUserId/like
Current user likes another user.

Backend logic:

upsert Connection (fromUserId = me, toUserId = target, status = LIKED)

if the other user already liked/superliked me → set both to MATCHED.

POST /connections/:targetUserId/dislike
Set status = DISLIKED for this pair.

POST /connections/:targetUserId/superlike
Set status = SUPERLIKED and optionally increase Profile.superLikes of the target user.

GET /connections/matches
Return users where there is a mutual MATCHED connection.

Friends & Outstanding Requests
Uses the Friendship model.

GET /friends
List of accepted friends (Friendship.status = ACCEPTED).

GET /friends/requests
Outstanding friend requests for the current user:

addresseeId = currentUser

status = PENDING

POST /friends/:targetUserId/request
Create a friend request (status = PENDING).

POST /friends/:targetUserId/accept
Accept a friend request (set status = ACCEPTED).

POST /friends/:targetUserId/reject
Reject a friend request (set status = REJECTED).

Chat (planned)
GET /chats
List chats the current user participates in.

GET /chats/:chatId/messages
List messages in a chat.

POST /chats/:chatId/messages
Send a message.

Body:

```json
{
  "content": "Hello!"
}
```
