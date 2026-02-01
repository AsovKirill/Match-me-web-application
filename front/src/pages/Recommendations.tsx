import {
  useEffect,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import Layout from "./Layout";

import coffeeIcon from "../assets/icons/coffee.png";
import highFiveIcon from "../assets/icons/high-five.png";
import messageIcon from "../assets/icons/message.png";
import islandIcon from "../assets/icons/island.png";
import heartIcon from "../assets/icons/heart.png";
import aboutIcon from "../assets/icons/about.png";
import hobbyIcon from "../assets/icons/hobby.png";
import IamHere from "../assets/icons/Oculus.png";
import basicIcon from "../assets/icons/id-card.png";

import "../styles/recommendations.css";

import {
  apiGetRecommendationsIds,
  apiGetUser,
  apiGetUserBio,
  apiGetUserProfile,
  apiLikeUser,
  apiDislikeUser,
  type ApiUser,
  type ApiUserBio,
  type ApiUserProfile,
} from "../api";

type MatchProfile = {
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

type SwipeDirection = "left" | "right" | null;


const PURPOSE_ICONS: Record<string, string> = {
  Dates: coffeeIcon,
  Relationships: heartIcon,
  Friendship: highFiveIcon,
  Communication: messageIcon,
  Travel: islandIcon,
  "Traveling together": islandIcon,
};

function mapApiUserToMatchProfile(
  user: ApiUser,
  bio: ApiUserBio,
  profile: ApiUserProfile
): MatchProfile {
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
  };
}

const SWIPE_THRESHOLD = 80; 

export default function Recommendations() {
  const [profiles, setProfiles] = useState<MatchProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [swipe, setSwipe] = useState<SwipeDirection>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [touchOffsetX, setTouchOffsetX] = useState(0);

  const current = profiles[index] ?? null;

 
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        
        const ids = await apiGetRecommendationsIds();

        if (!ids.length) {
          setProfiles([]);
          setIndex(0);
          return;
        }

        
        const composed: MatchProfile[] = await Promise.all(
          ids.map(async (id) => {
            const [user, bio, profile] = await Promise.all([
              apiGetUser(id),
              apiGetUserBio(id),
              apiGetUserProfile(id),
            ]);

            return mapApiUserToMatchProfile(user, bio, profile);
          })
        );

        setProfiles(composed);
        setIndex(0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load recommendations";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSwipe = async (direction: Exclude<SwipeDirection, null>) => {
    if (!current || isAnimating) return;

    setSwipe(direction);
    setIsAnimating(true);

    try {
      if (direction === "right") {
        await apiLikeUser(current.id);
      } else {
        await apiDislikeUser(current.id);
      }
    } catch (err) {
      console.error("Failed to send swipe to backend:", err);
    }

    window.setTimeout(() => {
      setSwipe(null);
      setIsAnimating(false);

      
      setProfiles((prevProfiles) => {
        if (!prevProfiles.length) return prevProfiles;

        const nextProfiles = prevProfiles.filter((_, i) => i !== index);

        setIndex((prevIndex) => {
          if (!nextProfiles.length) return 0;
          if (prevIndex >= nextProfiles.length) return 0;
          return prevIndex;
        });

        return nextProfiles;
      });
    }, 330);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!current) return;
    if (e.key === "ArrowLeft") void handleSwipe("left");
    if (e.key === "ArrowRight") void handleSwipe("right");
  };

  
  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (!current || isAnimating) return;
    const t = e.touches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
    setTouchOffsetX(0);
  };

  const handleTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (!touchStart || !current || isAnimating) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;

    
    if (Math.abs(dy) > Math.abs(dx)) return;

    e.preventDefault(); 
    setTouchOffsetX(dx);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !current || isAnimating) {
      setTouchStart(null);
      setTouchOffsetX(0);
      return;
    }

    if (touchOffsetX > SWIPE_THRESHOLD) {
      void handleSwipe("right");
    } else if (touchOffsetX < -SWIPE_THRESHOLD) {
      void handleSwipe("left");
    }

    setTouchStart(null);
    setTouchOffsetX(0);
  };


  const currentPurposeIcon =
    (current && PURPOSE_ICONS[current.lookingFor]) || heartIcon;

  return (
    <Layout>
      <div className="recs-page" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="recs-stage">
          
          <button
            type="button"
            className="recs-action recs-action--no"
            onClick={() => void handleSwipe("left")}
            disabled={!current || isAnimating}
          >
            <span className="recs-action-emoji">💔</span>
          </button>

          
          <div className="recs-card-shell">
            {loading ? (
              <div className="recs-empty">Loading recommendations…</div>
            ) : error ? (
              <div className="recs-empty">{error}</div>
            ) : current ? (
              <article
                className={
                  "recs-card" +
                  (swipe === "left"
                    ? " recs-card--swipe-left"
                    : swipe === "right"
                    ? " recs-card--swipe-right"
                    : "")
                }
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={
                  !swipe && touchOffsetX !== 0
                    ? {
                        transform: `translateX(${touchOffsetX}px) rotate(${
                          touchOffsetX / 25
                        }deg)`,
                      }
                    : undefined
                }
              >
               
                <div className="recs-card-shadow recs-card-shadow--back" />
                <div className="recs-card-shadow recs-card-shadow--mid" />

                <div className="recs-card-inner">
                  <div className="recs-avatar-wrapper">
                    <div className="recs-avatar-circle">
                      {current.avatarUrl ? (
                        <img
                          src={current.avatarUrl}
                          alt={current.name}
                          className="recs-avatar-img"
                        />
                      ) : (
                        <span className="recs-avatar-placeholder">👤</span>
                      )}
                    </div>
                  </div>

                  <header className="recs-header">
                    <h1 className="recs-name">{current.name}</h1>
                    <div className="recs-meta">
                      <span>{current.city}</span>
                    </div>
                  </header>

                  {/* About */}
                  <section className="recs-section">
                    <div className="recs-section-header">
                      <div className="profile-field-icon">
                        <img src={aboutIcon} alt="" />
                      </div>
                      <span className="recs-section-title">About me</span>
                    </div>
                    <div className="recs-about-pill">{current.about}</div>
                  </section>

                  {/* Hobbies */}
                  <section className="recs-section">
                    <div className="recs-section-header">
                      <div className="profile-field-icon">
                        <img src={hobbyIcon} alt="" />
                      </div>
                      <span className="recs-section-title">Hobbies</span>
                    </div>
                    <div className="recs-chip-row">
                      {current.hobbies.map((hobby) => (
                        <span key={hobby} className="recs-chip">
                          {hobby}
                        </span>
                      ))}
                    </div>
                  </section>

                  {/* Bottom two columns */}
                  <section className="recs-bottom-grid">
                    <div className="recs-bottom-block">
                      <div className="recs-section-header">
                        <div className="profile-field-icon">
                          <img src={IamHere} alt="" />
                        </div>
                        <span className="recs-section-title">
                          I am here for
                        </span>
                      </div>
                      <div className="recs-looking-for">
                        <div className="recs-looking-icon">
                          <img
                            src={currentPurposeIcon}
                            alt={current.lookingFor}
                          />
                        </div>
                        <div className="recs-looking-text">
                          <div className="recs-looking-title">
                            {current.lookingFor}
                          </div>
                          <div className="recs-looking-sub">
                            Let&apos;s see if you&apos;re a match.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="recs-bottom-block">
                      <div className="recs-section-header">
                        <div className="profile-field-icon">
                          <img src={basicIcon} alt="" />
                        </div>
                        <span className="recs-section-title">
                          Basic information
                        </span>
                      </div>

                      <div className="recs-basic-field">
                        <span className="recs-basic-label">City</span>
                        <span className="recs-basic-value">{current.city}</span>
                      </div>

                      <div className="recs-basic-field">
                        <span className="recs-basic-label">Languages</span>
                        <div className="recs-chip-row recs-chip-row--tight">
                          {current.languages.map((lang) => (
                            <span
                              key={lang}
                              className="recs-chip recs-chip--tiny"
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </article>
            ) : (
              <div className="recs-empty">
                No more recommendations for now 💤
              </div>
            )}

            
            <div className="recs-dots">
              {profiles.map((profile, i) => (
                <span
                  key={profile.id}
                  className={`recs-dot${
                    i === index ? " recs-dot--active" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          
          <button
            type="button"
            className="recs-action recs-action--yes"
            onClick={() => void handleSwipe("right")}
            disabled={!current || isAnimating}
          >
            <span className="recs-action-emoji">❤️</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}
