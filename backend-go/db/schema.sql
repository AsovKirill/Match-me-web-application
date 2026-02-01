-- USERS
CREATE TABLE IF NOT EXISTS "User" (
  "id"           BIGSERIAL PRIMARY KEY,
  "name"         TEXT        NOT NULL,
  "email"        TEXT        NOT NULL UNIQUE,
  "passwordHash" TEXT        NOT NULL,
  "dateOfBirth"  DATE        NOT NULL,
  "sex"          TEXT        NOT NULL,      -- MALE / FEMALE / OTHER
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PHOTOS
CREATE TABLE IF NOT EXISTS "Photo" (
  "id"     BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "url"    TEXT   NOT NULL
);

-- BIO
CREATE TABLE IF NOT EXISTS "Bio" (
  "id"        BIGSERIAL PRIMARY KEY,
  "userId"    BIGINT   NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "aboutMe"   TEXT,
  "hobbies"   TEXT[]   NOT NULL DEFAULT '{}',
  "goals"     TEXT,
  "languages" TEXT[]   NOT NULL DEFAULT '{}'
);

-- PROFILE
CREATE TABLE IF NOT EXISTS "Profile" (
  "id"         BIGSERIAL PRIMARY KEY,
  "userId"     BIGINT   NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "location"   TEXT,
  "latitude"   DOUBLE PRECISION,
  "longitude"  DOUBLE PRECISION,
  "superLikes" INT      NOT NULL DEFAULT 0
);

-- PREFERENCES
CREATE TABLE IF NOT EXISTS "Preferences" (
  "id"            BIGSERIAL PRIMARY KEY,
  "userId"        BIGINT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "preferredSex"  TEXT   NOT NULL DEFAULT 'ALL', -- MALE/FEMALE/OTHER/ALL
  "ageMin"        INT,
  "ageMax"        INT,
  "maxDistanceKm" INT
);

-- CONNECTIONS (likes, matches, etc.)
CREATE TABLE IF NOT EXISTS "Connection" (
  "id"         BIGSERIAL PRIMARY KEY,
  "fromUserId" BIGINT      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "toUserId"   BIGINT      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "status"     TEXT        NOT NULL,          -- LIKED / SUPERLIKED / DISLIKED / MATCHED / PENDING
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connection_from_to_unique"
  ON "Connection" ("fromUserId","toUserId");

-- CHATS
CREATE TABLE IF NOT EXISTS "Chat" (
  "id"        BIGSERIAL PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USERS IN CHATS
CREATE TABLE IF NOT EXISTS "ChatUser" (
  "id"     BIGSERIAL PRIMARY KEY,
  "chatId" BIGINT NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
  "userId" BIGINT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatUser_chat_user_unique"
  ON "ChatUser" ("chatId","userId");

-- MESSAGES
CREATE TABLE IF NOT EXISTS "Message" (
  "id"        BIGSERIAL PRIMARY KEY,
  "chatId"    BIGINT      NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
  "senderId"  BIGINT      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "content"   TEXT        NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- READ STATE PER CHAT/USER
CREATE TABLE IF NOT EXISTS "ChatRead" (
  "chatId"    BIGINT      NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
  "userId"    BIGINT      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "lastReadAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("chatId","userId")
);
