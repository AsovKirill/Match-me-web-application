const API_URL = "http://localhost:4000";

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  // Expected: { token: string, ...maybe other fields }
  return res.json();
}

export async function apiSignup(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Signup failed");
  }

  return res.json();
}

export function saveToken(token: string) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

export async function apiGetMe() {
  const token = getToken();

  if (!token) {
    throw new Error("No token");
  }

  const res = await fetch(`${API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  return res.json();
}

export async function apiUpdateBasicInfo(options: {
  name?: string;
  dateOfBirth?: string; // format: "YYYY-MM-DD"
  gender?: "MALE" | "FEMALE" | "OTHER";
}) {
  const token = getToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}/me/basic-info`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error("Failed to update basic info");
  }

  return res.json();
}

export async function apiUploadPhoto(dataUrl: string) {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}/me/photos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dataUrl }),
  });

  if (!res.ok) {
    throw new Error("Failed to upload photo");
  }

  return res.json();
}

// update bio: aboutMe, hobbies, goals, languages
export async function apiUpdateBio(options: {
  aboutMe?: string;
  hobbies?: string[];
  goals?: string | null;
  languages?: string[];
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}/me/bio`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error("Failed to update bio");
  }

  return res.json();
}

// update profile: location, latitude, longitude
export async function apiUpdateProfile(options: {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}/me/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error("Failed to update profile");
  }

  return res.json();
}

// preferences: preferredGender, ageMin, ageMax, maxDistanceKm
export async function apiUpdatePreferences(options: {
  preferredGender?: "MALE" | "FEMALE" | "OTHER" | "ALL";
  ageMin?: number | null;
  ageMax?: number | null;
  maxDistanceKm?: number | null;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}/me/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error("Failed to update preferences");
  }

  return res.json();
}

//Auth helper
function getAuthHeaders() {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Recommendations 

// GET /recommendations -> { recommendations: number[] }
export async function apiGetRecommendationsIds(): Promise<number[]> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/recommendations`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    // Try to read JSON error from backend
    let message = "Failed to load recommendations";

    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // ignore JSON parse errors, keep default message
    }

    throw new Error(message);
  }

  const data = (await res.json()) as { recommendations: number[] };
  return data.recommendations ?? [];
}

// Users / Public profile pieces 

// GET /users/:id -> { id, name, profileImageUrl }
export type ApiUser = {
  id: number;
  name: string;
  profileImageUrl: string | null;
};

export async function apiGetUser(id: number): Promise<ApiUser> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/users/${id}`, {
    method: "GET",
    headers,
  });

  if (res.status === 404) {
    throw new Error("User not found");
  }

  if (!res.ok) {
    throw new Error("Failed to load user");
  }

  return res.json();
}

// GET /users/:id/bio -> { id, bio: { aboutMe, hobbies, goals, languages? } }
export type ApiUserBio = {
  id: number;
  bio: {
    aboutMe: string | null;
    hobbies: string[];
    goals: string | null;
    languages?: string[] | null;
  };
};

export async function apiGetUserBio(id: number): Promise<ApiUserBio> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/users/${id}/bio`, {
    method: "GET",
    headers,
  });

  if (res.status === 404) {
    throw new Error("User not found");
  }

  if (!res.ok) {
    throw new Error("Failed to load user bio");
  }

  return res.json();
}

// GET /users/:id/profile -> { id, profile: { location, latitude, longitude, superLikes } }
export type ApiUserProfile = {
  id: number;
  profile: {
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    superLikes: number;
  };
};

export async function apiGetUserProfile(id: number): Promise<ApiUserProfile> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/users/${id}/profile`, {
    method: "GET",
    headers,
  });

  if (res.status === 404) {
    throw new Error("User not found");
  }

  if (!res.ok) {
    throw new Error("Failed to load user profile");
  }

  return res.json();
}



// GET /connections { connections: number[] }
export async function apiGetConnectionsIds(): Promise<number[]> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to load connections");
  }

  const data: { connections: number[] } = await res.json();
  return data.connections ?? [];
}

// GET /connections/requests -> { requests: [{ id, fromUserId, status }] }
export type ApiConnectionRequest = {
  id: number;
  fromUserId: number;
  status: "LIKED" | "SUPERLIKED" | "PENDING" | "MATCHED" | "DISLIKED";
};

export async function apiGetConnectionRequests(): Promise<
  ApiConnectionRequest[]
> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections/requests`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to load connection requests");
  }

  const data: { requests: ApiConnectionRequest[] } = await res.json();
  return data.requests ?? [];
}

// POST /connections/:id/like
export async function apiLikeUser(userId: number) {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections/${userId}/like`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to like user");
  }

  return res.json();
}

// POST /connections/:id/dislike
export async function apiDislikeUser(userId: number) {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections/${userId}/dislike`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to dislike user");
  }

  return res.json();
}

// POST /connections/:id/accept
export async function apiAcceptRequest(fromUserId: number) {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections/${fromUserId}/accept`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to accept request");
  }

  return res.json();
}

// POST /connections/:id/reject
export async function apiRejectRequest(fromUserId: number) {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections/${fromUserId}/reject`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to reject request");
  }

  return res.json();
}

export async function apiGetMyBio() {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_URL}/me/bio`, { headers });
  if (!res.ok) throw new Error("Failed to load my bio");
  return res.json();
}

export async function apiGetMyProfile() {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_URL}/me/profile`, { headers });
  if (!res.ok) throw new Error("Failed to load my profile");
  return res.json();
}


export type ApiMyPreferences = {
  preferredSex?: "MALE" | "FEMALE" | "OTHER" | "ALL";
  preferredGender?: "MALE" | "FEMALE" | "OTHER" | "ALL";
  ageMin?: number | null;
  ageMax?: number | null;
  maxDistanceKm?: number | null;
};

export async function apiGetMyPreferences(): Promise<ApiMyPreferences> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_URL}/me/preferences`, { headers });

  if (!res.ok) {
    throw new Error("Failed to load my preferences");
  }

  const data = await res.json();

  // Backend might return either:
  
  const raw = data.preferences ?? data;

  return {
    preferredSex: raw.preferredSex ?? undefined,
    preferredGender: raw.preferredGender ?? undefined,
    ageMin:
      raw.ageMin === null || raw.ageMin === undefined
        ? null
        : Number(raw.ageMin),
    ageMax:
      raw.ageMax === null || raw.ageMax === undefined
        ? null
        : Number(raw.ageMax),
    maxDistanceKm:
      raw.maxDistanceKm === null || raw.maxDistanceKm === undefined
        ? null
        : Number(raw.maxDistanceKm),
  };
}


export type ApiChatPreview = {
  id: number;
  otherUserId: number | null;
  userName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastTime: string | null; // ISO
  unreadCount: number;
};

export async function apiGetChats(): Promise<ApiChatPreview[]> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/chats`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to load chats");
  }

  const data = (await res.json()) as { chats: ApiChatPreview[] };
  return data.chats ?? [];
}


export type ApiChatMessage = {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  timestamp: string; // ISO
};

export type ApiChatMessagesResponse = {
  messages: ApiChatMessage[];
  hasMore: boolean;
};

export async function apiGetChatMessages(options: {
  chatId: number;
  limit?: number;
  before?: string; // ISO timestamp
}): Promise<ApiChatMessagesResponse> {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();

  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options.before) {
    params.set("before", options.before);
  }

  const query = params.toString();
  const url =
    query.length > 0
      ? `${API_URL}/chats/${options.chatId}/messages?${query}`
      : `${API_URL}/chats/${options.chatId}/messages`;

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to load chat messages");
  }

  return res.json();
}

export async function apiSendChatMessage(options: {
  chatId: number;
  content: string;
}): Promise<ApiChatMessage> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/chats/${options.chatId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: options.content }),
  });

  if (!res.ok) {
    throw new Error("Failed to send message");
  }

  return res.json();
}

// Chats 

export async function apiEnsureChatWith(userId: number): Promise<number> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/chats/with/${userId}`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to open chat");
  }

  const data = (await res.json()) as { chatId: number };
  return data.chatId;
}
export async function apiDisconnectConnection(userId: number): Promise<void> {
  const headers = getAuthHeaders();

  const res = await fetch(`${API_URL}/connections/${userId}/disconnect`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to disconnect");
  }
}
