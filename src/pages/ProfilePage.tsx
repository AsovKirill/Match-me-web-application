import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

import coffeeIcon from "../assets/icons/coffee.png";
import highFiveIcon from "../assets/icons/high-five.png";
import messageIcon from "../assets/icons/message.png";
import islandIcon from "../assets/icons/island.png";
import heartIcon from "../assets/icons/heart.png";
import aboutIcon from "../assets/icons/about.png";
import hobbyIcon from "../assets/icons/hobby.png";
import cityIcon from "../assets/icons/city.png";
import langIcon from "../assets/icons/lang.png";
import {
  apiUpdateBio,
  apiUpdateProfile,
  apiUpdatePreferences,
  apiGetMyBio,
  apiGetMyProfile,
  apiGetMyPreferences,
  apiUploadPhoto,
  apiGetMe,
} from "../api";

import "../styles/profile.css";

type PurposeId =
  | "dates"
  | "relationships"
  | "friendship"
  | "communication"
  | "travel";

type Purpose = {
  id: PurposeId;
  title: string;
  description: string;
  icon: string;
};

const PURPOSES: Purpose[] = [
  {
    id: "dates",
    title: "Dates",
    description: "Go on dates and have a good time.",
    icon: coffeeIcon,
  },
  {
    id: "relationships",
    title: "Relationships",
    description: "Find my other half and build a happy relationship.",
    icon: heartIcon,
  },
  {
    id: "friendship",
    title: "Friendship",
    description: "Make friends and acquaintances and arrange meetups.",
    icon: highFiveIcon,
  },
  {
    id: "communication",
    title: "Communication",
    description: "Chat and share ideas without limitations.",
    icon: messageIcon,
  },
  {
    id: "travel",
    title: "Traveling together",
    description: "Create new experiences and discover new things together.",
    icon: islandIcon,
  },
];

type ModalType =
  | "about"
  | "purpose"
  | "hobbies"
  | "city"
  | "languages"
  | "preferences";

const ALL_HOBBIES = [
  "Gaming",
  "Reading",
  "Hiking",
  "Sport",
  "Traveling",
  "Music",
  "Cooking",
  "Photography",
  "Yoga",
  "Dancing",
  "Board games",
  "Running",
  "Movies",
];

const FINLAND_CITIES = [
  "Helsinki",
  "Espoo",
  "Tampere",
  "Vantaa",
  "Oulu",
  "Turku",
  "Jyväskylä",
  "Lahti",
  "Kuopio",
  "Pori",
];
const CITY_COORDS: Record<
  string,
  { lat: number; lon: number }
> = {
  Helsinki: { lat: 60.1699, lon: 24.9384 },
  Espoo: { lat: 60.2055, lon: 24.6559 },
  Tampere: { lat: 61.4978, lon: 23.7610 },
  Vantaa: { lat: 60.2934, lon: 25.0378 },
  Oulu: { lat: 65.0121, lon: 25.4651 },
  Turku: { lat: 60.4518, lon: 22.2666 },
  Jyväskylä: { lat: 62.2415, lon: 25.7209 },
  Lahti: { lat: 60.9827, lon: 25.6615 },
  Kuopio: { lat: 62.8926, lon: 27.6770 },
  Pori: { lat: 61.4850, lon: 21.7972 },
};

const LANG_OPTIONS = [
  "🇫🇮 Finnish",
  "🇸🇪 Swedish",
  "🇬🇧 English",
  "🇷🇺 Russian",
  "🇪🇪 Estonian",
  "🇩🇪 German",
  "🇫🇷 French",
];

export default function ProfilePage() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [about, setAbout] = useState("");
  const [purpose, setPurpose] = useState<PurposeId | null>(null);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Preferences
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [distance, setDistance] = useState(""); // km

  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  const [tempAbout, setTempAbout] = useState("");
  const [tempPurpose, setTempPurpose] = useState<PurposeId | null>(null);
  const [tempHobbies, setTempHobbies] = useState<string[]>([]);
  const [tempCity, setTempCity] = useState("");
  const [tempLanguages, setTempLanguages] = useState<string[]>([]);

  const [tempGender, setTempGender] = useState<
    "male" | "female" | "other" | ""
  >("");
  const [tempMinAge, setTempMinAge] = useState("");
  const [tempMaxAge, setTempMaxAge] = useState("");
  const [tempDistance, setTempDistance] = useState(""); // km

  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const [modalError, setModalError] = useState<string | null>(null);

  // Load purpose from localStorage (avatar comes from backend)
  useEffect(() => {
    try {
      const storedPurpose = localStorage.getItem("profilePurpose");
      if (storedPurpose && PURPOSES.some((p) => p.id === storedPurpose)) {
        setPurpose(storedPurpose as PurposeId);
        setTempPurpose(storedPurpose as PurposeId);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load avatar from backend (/me)
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const me = await apiGetMe();
        const avatar = me.photos?.[0]?.url ?? null;
        setAvatarUrl(avatar);
      } catch (err) {
        console.error("Failed to load avatar", err);
      }
    };

    void loadAvatar();
  }, []);

  // Load profile data from backend on mount
  useEffect(() => {
    const loadFromBackend = async () => {
      try {
        setIsLoading(true);

        const [bioRes, profileRes, prefsRes] = await Promise.all([
          apiGetMyBio(),
          apiGetMyProfile(),
          apiGetMyPreferences(),
        ]);

        // BIO
        if (bioRes?.bio) {
          setAbout(bioRes.bio.aboutMe ?? "");
          setHobbies(bioRes.bio.hobbies ?? []);
          setLanguages(bioRes.bio.languages ?? []);

          const goals: string | null = bioRes.bio.goals ?? null;
          if (goals) {
            const goalsToPurpose: Record<string, PurposeId> = {
              Dates: "dates",
              Relationships: "relationships",
              Friendship: "friendship",
              Communication: "communication",
              "Traveling together": "travel",
            };
            const pId = goalsToPurpose[goals];
            if (pId) {
              setPurpose(pId);
              setTempPurpose(pId);
              try {
                localStorage.setItem("profilePurpose", pId);
              } catch {
                // ignore
              }
            }
          }
        }

        // PROFILE
        if (profileRes?.profile) {
          setCity(profileRes.profile.location ?? "");
        }

        // PREFERENCES
        if (prefsRes) {
          const preferred =
            prefsRes.preferredGender ?? prefsRes.preferredSex ?? null;

          let g: "male" | "female" | "other" | "" = "";
          if (preferred === "MALE") g = "male";
          else if (preferred === "FEMALE") g = "female";
          else if (preferred === "OTHER") g = "other";

          setGender(g);
          setMinAge(
            prefsRes.ageMin !== null && prefsRes.ageMin !== undefined
              ? String(prefsRes.ageMin)
              : ""
          );
          setMaxAge(
            prefsRes.ageMax !== null && prefsRes.ageMax !== undefined
              ? String(prefsRes.ageMax)
              : ""
          );
          setDistance(
            prefsRes.maxDistanceKm !== null &&
              prefsRes.maxDistanceKm !== undefined
              ? String(prefsRes.maxDistanceKm)
              : ""
          );
        }
      } catch (err) {
        console.error("Failed to load profile data", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadFromBackend();
  }, []);

  const selectedPurpose = purpose
    ? PURPOSES.find((p) => p.id === purpose) ?? null
    : null;

  const openModal = (type: ModalType) => {
    setActiveModal(type);
    setTempAbout(about);
    setTempPurpose(purpose);
    setTempHobbies(hobbies);
    setTempCity(city);
    setTempLanguages(languages);
    setTempGender(gender);
    setTempMinAge(minAge);
    setTempMaxAge(maxAge);
    setTempDistance(distance);
    setModalError(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalError(null);
  };

  const saveModal = () => {
    if (activeModal === "about") {
      setAbout(tempAbout.trim());
    } else if (activeModal === "purpose") {
      setPurpose(tempPurpose);
      if (tempPurpose) {
        try {
          localStorage.setItem("profilePurpose", tempPurpose);
        } catch {
          // ignore
        }
      }
    } else if (activeModal === "hobbies") {
      setHobbies(tempHobbies);
    } else if (activeModal === "city") {
      setCity(tempCity);
    } else if (activeModal === "languages") {
      setLanguages(tempLanguages);
    } else if (activeModal === "preferences") {
      const min = Number(tempMinAge);
      const max = Number(tempMaxAge);
      const dist = Number(tempDistance);

      // VALIDATION AGE
      if (tempMinAge && min < 18) {
        setModalError("Minimum age cannot be below 18");
        return;
      }

      if (tempMaxAge && max < 18) {
        setModalError("Maximum age cannot be below 18");
        return;
      }

      if (tempMinAge && tempMaxAge && max < min) {
        setModalError("Max age cannot be less than min age");
        return;
      }

      // VALIDATION DISTANCE
      if (tempDistance && (isNaN(dist) || dist <= 0)) {
        setModalError("Distance must be a positive number");
        return;
      }

      // If valid → clear errors and save
      setModalError(null);
      setGender(tempGender);
      setMinAge(tempMinAge);
      setMaxAge(tempMaxAge);
      setDistance(tempDistance);
    }

    closeModal();
  };

  const toggleFromArray = (
    value: string,
    list: string[],
    setList: (v: string[]) => void
  ) => {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
    } else {
      setList([...list, value]);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);

      try {
        await apiUploadPhoto(dataUrl);
        setAvatarUrl(dataUrl);
      } catch (err) {
        console.error("Failed to upload avatar", err);
        alert("Failed to upload avatar. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  };

  const renderGenderText = () => {
    if (!gender) return "Gender not selected";
    if (gender === "male") return "Men";
    if (gender === "female") return "Women";
    return "Other";
  };

 const handleSave = async () => {
  try {
    // goals to string (DB)
    let goals: string | null = null;
    if (purpose) {
      const purposeMap: Record<PurposeId, string> = {
        dates: "Dates",
        relationships: "Relationships",
        friendship: "Friendship",
        communication: "Communication",
        travel: "Traveling together",
      };
      goals = purposeMap[purpose];
    }

    // UI gender -> backend preferredGender enum
    let preferredGender: "MALE" | "FEMALE" | "OTHER" | "ALL" | undefined;
    if (gender === "male") preferredGender = "MALE";
    else if (gender === "female") preferredGender = "FEMALE";
    else if (gender === "other") preferredGender = "OTHER";

    const ageMinNum = minAge ? Number(minAge) : null;
    const ageMaxNum = maxAge ? Number(maxAge) : null;
    const distanceNum = distance ? Number(distance) : null;
    const cityCoords = city ? CITY_COORDS[city] : undefined;

      // Age validation 
      if (ageMinNum !== null && ageMinNum < 18) {
        alert("Minimum age cannot be less than 18.");
        return;
      }

    if (ageMaxNum !== null && ageMaxNum < 18) {
      alert("Maximum age cannot be less than 18.");
      return;
    }

      if (ageMinNum !== null && ageMaxNum !== null && ageMinNum > ageMaxNum) {
        alert("Minimum age cannot be greater than maximum age.");
        return;
      }
      // end age validation 

    await Promise.all([
      apiUpdateBio({
        aboutMe: about,
        hobbies,
        goals,
        languages,
      }),
      apiUpdateProfile({
        location: city || null,
        latitude: cityCoords?.lat ?? null,
        longitude: cityCoords?.lon ?? null,
      }),
      apiUpdatePreferences({
        preferredGender,
        ageMin: ageMinNum,
        ageMax: ageMaxNum,
        maxDistanceKm: distanceNum, 
      }),
    ]);

    alert("Profile saved!");
  } catch (err) {
    console.error(err);
    alert("Failed to save profile");
  }
};

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("profilePurpose");
    } catch {
      // ignore
    }
    navigate("/");
  };

  return (
    <Layout>
      <div className="profile-page">
        <header className="profile-header">
          <div className="profile-avatar-wrapper" onClick={handleAvatarClick}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
            ) : (
              <div className="profile-avatar profile-avatar--empty">👤</div>
            )}
            <div className="profile-avatar-edit">Change</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="profile-avatar-input"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="profile-header-text">
            <h1 className="profile-title">My Profile</h1>
            <button
              type="button"
              className="profile-logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </header>

        {/* ABOUT ME */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">About me</h2>
            <button
              type="button"
              className="profile-edit-link"
              onClick={() => openModal("about")}
            >
              Edit
            </button>
          </div>

          <button
            type="button"
            className="profile-about-area"
            onClick={() => openModal("about")}
          >
            <div className="profile-field-icon">
              <img src={aboutIcon} alt="" />
            </div>

            <div className="profile-field-body">
              {about ? (
                <>
                  <div className="profile-field-title">About me</div>
                  <div className="profile-field-subtitle">{about}</div>
                </>
              ) : (
                <>
                  <div className="profile-field-title">Tell about yourself</div>
                  <div className="profile-field-subtitle">
                    A completed profile increases your chances of a match!
                  </div>
                </>
              )}
            </div>
          </button>
        </section>

        {/* PURPOSE */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">I am here for</h2>
            <button
              type="button"
              className="profile-edit-link"
              onClick={() => openModal("purpose")}
            >
              Edit
            </button>
          </div>

          <button
            type="button"
            className="profile-purpose-area"
            onClick={() => openModal("purpose")}
          >
            <div className="profile-field-icon">
              {selectedPurpose ? (
                <img src={selectedPurpose.icon} alt={selectedPurpose.title} />
              ) : (
                <span>💬</span>
              )}
            </div>

            <div className="profile-field-body">
              {selectedPurpose ? (
                <>
                  <div className="profile-field-title">
                    {selectedPurpose.title}
                  </div>
                  <div className="profile-field-subtitle">
                    {selectedPurpose.description}
                  </div>
                </>
              ) : null}
            </div>
          </button>
        </section>

        {/* HOBBIES */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">Hobbies</h2>
            <button
              type="button"
              className="profile-edit-link"
              onClick={() => openModal("hobbies")}
            >
              Edit
            </button>
          </div>

          <button
            type="button"
            className="profile-hobbies-area"
            onClick={() => openModal("hobbies")}
          >
            <div className="profile-field-icon">
              <img src={hobbyIcon} alt="" />
            </div>

            <div className="profile-field-body">
              {hobbies.length === 0 ? (
                <div className="profile-hobby-placeholder">
                  <div className="profile-hobby-placeholder-text">
                    <div className="profile-hobby-placeholder-title">
                      Add your interests
                    </div>
                    <div className="profile-hobby-placeholder-subtitle">
                      Tell us what you’re into and what you like
                    </div>
                  </div>
                </div>
              ) : (
                <div className="profile-hobby-chips">
                  {hobbies.map((h) => (
                    <span key={h} className="profile-hobby-chip">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        </section>

        {/* BASIC INFO */}
        <section className="profile-section">
          <h2 className="profile-section-title">Basic information</h2>

          <div className="profile-basic-list">
            {/* CITY */}
            <button
              type="button"
              className="profile-basic-row"
              onClick={() => openModal("city")}
            >
              <div className="profile-field-icon">
                <img src={cityIcon} alt="" />
              </div>

              <div className="profile-basic-main">
                <div className="profile-basic-label">City</div>
                <div className="profile-basic-value">
                  {city || "Not selected"}
                </div>
              </div>

              <div className="profile-basic-arrow">›</div>
            </button>

            {/* LANGUAGES */}
            <button
              type="button"
              className="profile-basic-row"
              onClick={() => openModal("languages")}
            >
              <div className="profile-field-icon">
                <img src={langIcon} alt="" />
              </div>

              <div className="profile-basic-main">
                <div className="profile-basic-label">Languages</div>
                <div className="profile-basic-value">
                  {languages.length === 0
                    ? "Not selected"
                    : languages.join(", ")}
                </div>
              </div>

              <div className="profile-basic-arrow">›</div>
            </button>
          </div>
        </section>

        {/* PREFERENCES */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2 className="profile-section-title">Preferences</h2>
            <button
              type="button"
              className="profile-edit-link"
              onClick={() => openModal("preferences")}
            >
              Edit
            </button>
          </div>

          <button
            type="button"
            className="profile-basic-row"
            onClick={() => openModal("preferences")}
          >
            <div className="profile-field-icon">
              <img src={heartIcon} alt="" />
            </div>

            <div className="profile-basic-main">
              <div className="profile-basic-label">Gender & age & distance </div>
              <div className="profile-basic-value">
                {renderGenderText()}
                {(minAge || maxAge) && (
                  <>
                    {" · "}
                    {minAge || "?"}–{maxAge || "?"} years
                  </>
                )}
                {distance && (
                  <>
                    {" · "}
                    up to {distance} km away
                  </>
                )}
              </div>
            </div>

            <div className="profile-basic-arrow">›</div>
          </button>
        </section>

        <div className="profile-finish-row">
          <button
            type="button"
            className="button button--primary profile-finish-button"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>

        {/* MODALS */}
        {activeModal && (
          <div className="profile-modal-backdrop" onClick={closeModal}>
            <div
              className="profile-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="profile-modal-title">
                {activeModal === "about" && "About me"}
                {activeModal === "purpose" && "I am here for"}
                {activeModal === "hobbies" && "Hobbies"}
                {activeModal === "city" && "City"}
                {activeModal === "languages" && "Languages"}
                {activeModal === "preferences" && "Preferences"}
              </h3>

              <div className="profile-modal-body">
                {activeModal === "about" && (
                  <textarea
                    className="profile-modal-textarea"
                    placeholder="Write something about yourself..."
                    value={tempAbout}
                    onChange={(e) => setTempAbout(e.target.value)}
                  />
                )}

                {activeModal === "purpose" && (
                  <div className="profile-modal-grid">
                    {PURPOSES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={
                          "profile-chip-toggle" +
                          (tempPurpose === p.id
                            ? " profile-chip-toggle--active"
                            : "")
                        }
                        onClick={() => setTempPurpose(p.id)}
                      >
                        <img
                          src={p.icon}
                          alt={p.title}
                          className="profile-chip-toggle-icon"
                        />
                        <div className="profile-chip-toggle-title">
                          {p.title}
                        </div>
                        <div className="profile-chip-toggle-subtitle">
                          {p.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activeModal === "hobbies" && (
                  <div className="profile-modal-chips">
                    {ALL_HOBBIES.map((hobby) => (
                      <button
                        key={hobby}
                        type="button"
                        className={
                          "profile-pill" +
                          (tempHobbies.includes(hobby)
                            ? " profile-pill--active"
                            : "")
                        }
                        onClick={() =>
                          toggleFromArray(hobby, tempHobbies, setTempHobbies)
                        }
                      >
                        {hobby}
                      </button>
                    ))}
                  </div>
                )}

                {activeModal === "city" && (
                  <div className="profile-modal-chips">
                    {FINLAND_CITIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={
                          "profile-pill" +
                          (tempCity === c ? " profile-pill--active" : "")
                        }
                        onClick={() => setTempCity(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {activeModal === "languages" && (
                  <div className="profile-modal-chips">
                    {LANG_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        className={
                          "profile-pill" +
                          (tempLanguages.includes(lang)
                            ? " profile-pill--active"
                            : "")
                        }
                        onClick={() =>
                          toggleFromArray(lang, tempLanguages, setTempLanguages)
                        }
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}

                {activeModal === "preferences" && (
                  <div className="profile-preferences">
                    <div className="profile-preferences-section">
                      <div className="profile-basic-label">
                        Preferred gender
                      </div>
                      <div className="profile-modal-chips">
                        <button
                          type="button"
                          className={
                            "profile-pill" +
                            (tempGender === "male"
                              ? " profile-pill--active"
                              : "")
                          }
                          onClick={() => setTempGender("male")}
                        >
                          Man
                        </button>
                        <button
                          type="button"
                          className={
                            "profile-pill" +
                            (tempGender === "female"
                              ? " profile-pill--active"
                              : "")
                          }
                          onClick={() => setTempGender("female")}
                        >
                          Woman
                        </button>
                        <button
                          type="button"
                          className={
                            "profile-pill" +
                            (tempGender === "other"
                              ? " profile-pill--active"
                              : "")
                          }
                          onClick={() => setTempGender("other")}
                        >
                          Other
                        </button>
                      </div>
                    </div>

                    <div className="profile-preferences-section">
                      <div className="profile-basic-label">
                        Preferred age range
                      </div>
                      <div className="profile-preferences-age">
                        <input
                          type="number"
                          min={18}
                          max={99}
                          placeholder="Min"
                          value={tempMinAge}
                          onChange={(e) => setTempMinAge(e.target.value)}
                          className="profile-preferences-age-input"
                        />
                        <span className="profile-preferences-age-separator">
                          –
                        </span>
                        <input
                          type="number"
                          min={18}
                          max={99}
                          placeholder="Max"
                          value={tempMaxAge}
                          onChange={(e) => setTempMaxAge(e.target.value)}
                          className="profile-preferences-age-input"
                        />
                      </div>
                    </div>

                    <div className="profile-preferences-section">
                      <div className="profile-basic-label">
                        Maximum distance
                      </div>
                      <div className="profile-preferences-age">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          placeholder="100"
                          value={tempDistance}
                          onChange={(e) => setTempDistance(e.target.value)}
                          className="profile-preferences-age-input"
                        />
                        <span className="profile-preferences-age-separator">
                          km
                        </span>
                      </div>
                    </div>

                    {modalError && (
                      <div className="profile-modal-error">{modalError}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="profile-modal-actions">
                <button
                  type="button"
                  className="button button--outline profile-modal-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button--primary profile-modal-btn"
                  onClick={saveModal}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

