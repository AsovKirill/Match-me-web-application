import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

import coffeeIcon from "../assets/icons/coffee.png";
import highFiveIcon from "../assets/icons/high-five.png";
import messageIcon from "../assets/icons/message.png";
import islandIcon from "../assets/icons/island.png";
import heartIcon from "../assets/icons/heart.png";

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

export default function ProfileStepPurpose() {
  const [selected, setSelected] = useState<PurposeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!selected) {
      setError("Select at least one purpose");
      return;
    }

    
    try {
      localStorage.setItem("profilePurpose", selected);
    } catch {
      
    }

    navigate("/profile");
  };

  return (
    <Layout>
      <div className="onb-page">
        <div className="onb-center slide-up">
          <h1 className="onb-title">Tell us why you&apos;re here</h1>

          <form
            onSubmit={handleSubmit}
            className="onb-form onb-form--full"
          >
            <div className="onb-purpose-row">
              {PURPOSES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    "onb-purpose-card" +
                    (selected === item.id
                      ? " onb-purpose-card--active"
                      : "")
                  }
                  onClick={() => {
                    setSelected(item.id);
                    setError(null);
                  }}
                >
                  <div className="onb-purpose-icon">
                    <img
                      src={item.icon}
                      alt={item.title}
                      className="purpose-icon"
                    />
                  </div>
                  <div className="onb-purpose-title">
                    {item.title}
                  </div>
                  <div className="onb-purpose-desc">
                    {item.description}
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="onb-error onb-error--center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="button button--primary onb-button onb-button--wide"
            >
              Finish
            </button>
          </form>

          <div className="onb-emoji-row">
            <span className="onb-emoji-side">📸</span>
            <div className="onb-emoji-main">🎯</div>
            <span className="onb-emoji-side">😊</span>
          </div>
            
        </div>
      </div>
    </Layout>
  );
}
