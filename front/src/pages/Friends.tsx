import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

import aboutIcon from "../assets/icons/about.png";
import hobbyIcon from "../assets/icons/hobby.png";
import cityIcon from "../assets/icons/city.png";
import IamHere from "../assets/icons/Oculus.png";
import Messges from "../assets/icons/message.png";
import Del from "../assets/icons/delete.png";
import { apiDisconnectConnection } from "../api";
import "../styles/friends.css";

import {
  apiGetConnectionRequests,
  apiGetConnectionsIds,
  apiAcceptRequest,
  apiRejectRequest,
  apiGetUser,
  apiGetUserBio,
  apiGetUserProfile,
  type ApiUser,
  type ApiUserBio,
  type ApiUserProfile,
  apiEnsureChatWith,
} from "../api";

type FriendProfile = {
  id: number;
  name: string;
  age?: number;
  gender?: string;
  city: string;
  about: string;
  hobbies: string[];
  lookingFor: string;
  languages: string[];
  avatarUrl?: string;
};

function mapApiToFriendProfile(
  user: ApiUser,
  bio: ApiUserBio,
  profile: ApiUserProfile
): FriendProfile {
  const about = bio.bio.aboutMe ?? "";
  const hobbies = bio.bio.hobbies ?? [];
  const goals = bio.bio.goals ?? "Friendship";
  const languages = bio.bio.languages ?? [];
  const city = profile.profile.location ?? "Unknown";

  return {
    id: user.id,
    name: user.name,
    city,
    about,
    hobbies,
    lookingFor: goals,
    languages,
    avatarUrl: user.profileImageUrl ?? undefined,
    // age / gender are not exposed on public API, so left undefined
  };
}

export default function Friends() {
  const [requests, setRequests] = useState<FriendProfile[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selected, setSelected] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load friend requests + matched friends from backend
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [requestsRaw, connectionsIds] = await Promise.all([
          apiGetConnectionRequests(), // [{ id, fromUserId, status }]
          apiGetConnectionsIds(), // [userId, userId...]
        ]);

        const requestUserIds = [
          ...new Set(requestsRaw.map((r) => r.fromUserId)),
        ];
        const friendUserIds = [...new Set(connectionsIds)];

        const loadProfiles = async (ids: number[]): Promise<FriendProfile[]> =>
          Promise.all(
            ids.map(async (id) => {
              const [user, bio, profile] = await Promise.all([
                apiGetUser(id),
                apiGetUserBio(id),
                apiGetUserProfile(id),
              ]);

              return mapApiToFriendProfile(user, bio, profile);
            })
          );

        const [requestProfiles, friendProfiles] = await Promise.all([
          loadProfiles(requestUserIds),
          loadProfiles(friendUserIds),
        ]);

        setRequests(requestProfiles);
        setFriends(friendProfiles);
      } catch (err) {
        console.error("Failed to load friends data", err);
        setError("Failed to load friends. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleAccept = async (user: FriendProfile) => {
    try {
      await apiAcceptRequest(user.id);

      setRequests((prev) => prev.filter((r) => r.id !== user.id));
      setFriends((prev) => {
        if (prev.some((f) => f.id === user.id)) return prev;
        return [...prev, user];
      });
    } catch (err) {
      console.error("Failed to accept friend request:", err);
      alert("Failed to accept request. Please try again.");
    }
  };

  const handleDecline = async (user: FriendProfile) => {
    try {
      await apiRejectRequest(user.id);
      setRequests((prev) => prev.filter((r) => r.id !== user.id));
    } catch (err) {
      console.error("Failed to decline friend request:", err);
      alert("Failed to decline request. Please try again.");
    }
  };

  const handleRemoveFriend = async (user: FriendProfile) => {
    try {
      await apiDisconnectConnection(user.id);

      setFriends((prev) => prev.filter((f) => f.id !== user.id));
      setSelected((prev) => (prev && prev.id === user.id ? null : prev));
    } catch (err) {
      console.error("Failed to remove friend:", err);
      alert("Failed to remove friend. Please try again.");
    }
  };

  const openProfile = (user: FriendProfile) => {
    setSelected(user);
  };

  const closeModal = () => {
    setSelected(null);
  };

  const goToMessages = async (user: FriendProfile) => {
    try {
      const chatId = await apiEnsureChatWith(user.id);
      closeModal();
      navigate(`/messages/${chatId}`);
    } catch (err) {
      console.error("Failed to open chat:", err);
      alert("Failed to open chat. Please try again.");
    }
  };

  return (
    <Layout>
      <div className="friends-page">
        {loading && <div className="friends-empty">Loading your friends…</div>}
        {!loading && error && <div className="friends-empty">{error}</div>}

        {/* FRIEND REQUESTS */}
        {!loading && requests.length > 0 && (
          <section className="friends-section">
            <h2 className="friends-section-title">Friend requests</h2>

            {requests.map((user) => (
              <div
                key={user.id}
                className="friends-request-card"
                onClick={() => openProfile(user)}
              >
                <div className="friends-user-main">
                  <div className="friends-avatar">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} />
                    ) : (
                      <span></span>
                    )}
                  </div>
                  <div className="friends-user-text">
                    <div className="friends-user-name">{user.name}</div>
                    <div className="friends-user-sub">
                      {user.age ? `${user.age} · ${user.city}` : user.city}
                    </div>
                  </div>
                </div>

                <div
                  className="friends-request-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="button button--primary friends-request-btn"
                    onClick={() => void handleAccept(user)}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="button button--outline friends-request-btn friends-request-btn--secondary"
                    onClick={() => void handleDecline(user)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* MY FRIENDS */}
        {!loading && (
          <section className="friends-section">
            <h2 className="friends-section-title">My friends</h2>

            {friends.length === 0 && (
              <div className="friends-empty">
                You don&apos;t have friends yet. Start swiping to find someone
                💫
              </div>
            )}

            {friends.map((user) => (
              <div
                key={user.id}
                className="friends-row"
                onClick={() => openProfile(user)}
              >
                <div className="friends-user-main">
                  <div className="friends-avatar">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} />
                    ) : (
                      <span></span>
                    )}
                  </div>

                  <div className="friends-user-text">
                    <div className="friends-user-name">{user.name}</div>
                    <div className="friends-user-sub">{user.city}</div>
                  </div>
                </div>

                
                <div
                  className="friends-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="friends-chat-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      void goToMessages(user);
                    }}
                  >
                    <img src={Messges} alt="" className="btn-chat-img" />
                  </button>

                  <button
                    type="button"
                    className="friends-remove-icon"
                    onClick={() => void handleRemoveFriend(user)}
                  >
                    <img
                      src={Del}
                      alt=""
                      className="btn-chat-img btn-del-img"
                    />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* MODAL */}
        {selected && (
          <div className="friends-modal-backdrop" onClick={closeModal}>
            <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
              <header className="friends-modal-header">
                <div className="friends-modal-avatar">
                  {selected.avatarUrl ? (
                    <img src={selected.avatarUrl} alt={selected.name} />
                  ) : (
                    <span></span>
                  )}
                </div>
                <div className="friends-modal-title">
                  <div className="friends-modal-name">{selected.name}</div>
                  <div className="friends-modal-meta">
                    {selected.age && <>{selected.age} · </>}
                    {selected.gender && <>{selected.gender} · </>}
                    {selected.city}
                  </div>
                </div>
              </header>

              <div className="friends-modal-body">
                {/* About */}
                <section className="friends-modal-section">
                  <div className="friends-modal-section-header">
                    <div className="friends-icon-circle">
                      <img src={aboutIcon} alt="" />
                    </div>
                    <span>About</span>
                  </div>
                  <p className="friends-modal-text">{selected.about}</p>
                </section>

                {/* Hobbies */}
                <section className="friends-modal-section">
                  <div className="friends-modal-section-header">
                    <div className="friends-icon-circle">
                      <img src={hobbyIcon} alt="" />
                    </div>
                    <span>Hobbies</span>
                  </div>
                  <div className="friends-chip-row">
                    {selected.hobbies.map((hobby) => (
                      <span key={hobby} className="friends-chip">
                        {hobby}
                      </span>
                    ))}
                  </div>
                </section>

                {/* I am here for + basic info */}
                <section className="friends-modal-section friends-modal-split">
                  <div className="friends-modal-column">
                    <div className="friends-modal-section-header">
                      <div className="friends-icon-circle">
                        <img src={IamHere} alt="" />
                      </div>
                      <span>I am here for</span>
                    </div>
                    <div className="friends-looking">
                      <div className="friends-looking-title">
                        {selected.lookingFor}
                      </div>
                      <div className="friends-looking-sub">
                        Let&apos;s see if you&apos;re a match.
                      </div>
                    </div>
                  </div>

                  <div className="friends-modal-column">
                    <div className="friends-modal-section-header">
                      <div className="friends-icon-circle">
                        <img src={cityIcon} alt="" />
                      </div>
                      <span>Basic information</span>
                    </div>
                    <div className="friends-basic-field">
                      <span className="friends-basic-label">City</span>
                      <span className="friends-basic-value">
                        {selected.city}
                      </span>
                    </div>
                    <div className="friends-basic-field">
                      <div className="friends-basic-label">
                        <span>Languages</span>
                      </div>
                      <div className="friends-chip-row friends-chip-row--tight">
                        {selected.languages.map((lang) => (
                          <span
                            key={lang}
                            className="friends-chip friends-chip--tiny"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="friends-modal-actions">
                <button
                  type="button"
                  className="button button--outline friends-modal-btn"
                  onClick={closeModal}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="button button--primary friends-modal-btn"
                  onClick={() => selected && void goToMessages(selected)}
                >
                  Send message
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
