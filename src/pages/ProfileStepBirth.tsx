import { FormEvent, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUpdateBasicInfo } from "../api";

function parseBirth(value: string): Date | null {
  const parts = value.split("/");
  if (parts.length !== 3) return null;

  const [ddStr, mmStr, yyyyStr] = parts;
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  const yyyy = Number(yyyyStr);

  if (!dd || !mm || !yyyy) return null;

  const date = new Date(yyyy, mm - 1, dd);

  // checke that date is exist
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }

  return date;
}

function validateBirth(value: string): string | null {
  if (!value) return "Date of birth is required";

  const date = parseBirth(value);
  if (!date) return "Invalid date";

  const now = new Date();
  if (date > now) return "Date cannot be in the future";

  const min = new Date(1900, 0, 1);
  if (date < min) return "Please enter a realistic date";

  return null;
}

export default function ProfileStepBirth() {
  const [birth, setBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const formatWithSlashes = (raw: string) => {
    // only numbers
    let value = raw.replace(/[^\d]/g, "");
    if (value.length > 8) value = value.slice(0, 8);

    if (value.length <= 2) return value;
    if (value.length <= 4) {
      return `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    return `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWithSlashes(e.target.value);
    setBirth(formatted);
    if (error) setError(null);
  };



  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validateBirth(birth);
    setError(validation);
    if (validation) return;

    const date = parseBirth(birth);
    if (!date) {
      setError("Invalid date");
      return;
    }

    // convert to YYYY-MM-DD string
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const isoDate = `${yyyy}-${mm}-${dd}`;

    try {
      await apiUpdateBasicInfo({ dateOfBirth: isoDate });
      navigate("/profile-step-3");
    } catch (err) {
      console.error(err);
      setError("Failed to save date of birth");
    }
  };

  return (
    <Layout>
      <div className="onb-page">
        <div className="onb-center slide-up">
          <h1 className="onb-title">Date of birth</h1>
          <p className="onb-subtitle">
            Only the age will appear in the profile.
          </p>

          <form onSubmit={handleSubmit} className="onb-form">
            <input
              className={"onb-input" + (error ? " onb-input--error" : "")}
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={birth}
              onChange={handleChange}
            />
            {error && <div className="onb-error">{error}</div>}

            <button type="submit" className="button button--primary onb-button">
              Next
            </button>
          </form>
        </div>

        <div className="onb-emoji-row">
          <span className="onb-emoji-side">👩‍💻</span>
          <div className="onb-emoji-main">🙂</div>
          <span className="onb-emoji-side">👀</span>
        </div>
        
      </div>
    </Layout>
  );
}
