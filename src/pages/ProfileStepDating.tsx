import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUpdateBasicInfo, apiUpdatePreferences } from "../api";

type SelfGenderOption = "woman" | "man" | "other";
type PrefGenderOption = "women" | "men" | "other";

export default function ProfileStepDating() {
  // basic settings
  const [gender, setGender] = useState<SelfGenderOption>("man");
  const [pref, setPref] = useState<PrefGenderOption>("men");
  const [genderError, setGenderError] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // maping from UI
    const genderMap: Record<SelfGenderOption, "MALE" | "FEMALE" | "OTHER"> = {
      woman: "FEMALE",
      man: "MALE",
      other: "OTHER",
    };

    const prefMap: Record<PrefGenderOption, "MALE" | "FEMALE" | "OTHER"> = {
      women: "FEMALE",
      men: "MALE",
      other: "OTHER",
    };

    try {
      // Save your gender
      await apiUpdateBasicInfo({
        gender: genderMap[gender],
      });

      // Save who you want to see
      await apiUpdatePreferences({
        preferredGender: prefMap[pref],
      });

      navigate("/profile-step-4");
    } catch (err) {
      console.error(err);
      setPrefError("Failed to save settings");
    }
  };

  const chipClass = (current: string, value: string): string =>
    "onb-chip" + (current === value ? " onb-chip--active" : "");

  return (
    <Layout>
      <div className="onb-page">
        <div className="onb-center slide-up">
          <h1 className="onb-title">Dating settings</h1>

          <form onSubmit={handleSubmit} className="onb-form onb-form--full">
            {/* your gender*/}
            <div className="onb-block">
              <h2 className="onb-block-title">Your gender</h2>
              <p className="onb-block-subtitle">You can change only once</p>

              <div className="onb-chip-row">
                <button
                  type="button"
                  className={chipClass(gender, "woman")}
                  onClick={() => {
                    setGender("woman");
                    setGenderError(null);
                  }}
                >
                  Woman
                </button>
                <button
                  type="button"
                  className={chipClass(gender, "man")}
                  onClick={() => {
                    setGender("man");
                    setGenderError(null);
                  }}
                >
                  Man
                </button>
                <button
                  type="button"
                  className={chipClass(gender, "other")}
                  onClick={() => {
                    setGender("other");
                    setGenderError(null);
                  }}
                >
                  Other
                </button>
              </div>

              {genderError && <div className="onb-error">{genderError}</div>}
            </div>

            <div className="onb-separator" />

            {/* who we want to see*/}
            <div className="onb-block">
              <h2 className="onb-block-title">Who would you like to see?</h2>
              <p className="onb-block-subtitle">
                You can change it at any time
              </p>

              <div className="onb-chip-row">
                <button
                  type="button"
                  className={chipClass(pref, "women")}
                  onClick={() => {
                    setPref("women");
                    setPrefError(null);
                  }}
                >
                  Women
                </button>
                <button
                  type="button"
                  className={chipClass(pref, "men")}
                  onClick={() => {
                    setPref("men");
                    setPrefError(null);
                  }}
                >
                  Men
                </button>
                <button
                  type="button"
                  className={chipClass(pref, "other")}
                  onClick={() => {
                    setPref("other");
                    setPrefError(null);
                  }}
                >
                  Other
                </button>
              </div>

              {prefError && <div className="onb-error">{prefError}</div>}
            </div>

            <button
              type="submit"
              className="button button--primary onb-button onb-button--wide"
            >
              Next
            </button>
          </form>
        </div>

        <div className="onb-emoji-row">
          <span className="onb-emoji-side">😊</span>
          <div className="onb-emoji-main">👀</div>
          <span className="onb-emoji-side">📸</span>
        </div>
        
      </div>
    </Layout>
  );
}


