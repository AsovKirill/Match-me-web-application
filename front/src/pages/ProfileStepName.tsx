import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUpdateBasicInfo } from "../api";

export default function ProfileStepName() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

 

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      await apiUpdateBasicInfo({ name: name.trim() });
      navigate("/profile-step-2");
    } catch (err) {
      console.error(err);
      setError("Failed to save name");
    }
  };

  return (
    <Layout>
      <div className="onb-page">
        <div className="onb-center slide-up">
          <h1 className="onb-title">What is your name?</h1>
          <p className="onb-subtitle">
            It&apos;s better to write your real name
          </p>

          <form onSubmit={handleSubmit} className="onb-form">
            <input
              className={"onb-input" + (error ? " onb-input--error" : "")}
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
            />
            {error && <div className="onb-error">{error}</div>}

            <button type="submit" className="button button--primary onb-button">
              Next
            </button>
          </form>
        </div>

        <div className="onb-emoji-row">
          <span className="onb-emoji-side">👩‍💻</span>
          <div className="onb-emoji-main">😊</div>
          <span className="onb-emoji-side">👀</span>
        </div>
        
      </div>
    </Layout>
  );
}
