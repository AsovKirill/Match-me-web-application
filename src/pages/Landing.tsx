import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <Layout>
      <section className="hero hero--animated">
        <h1 className="hero__title">
          Find the one
          <br />
          who is perfect
          <br />
          for you <span className="hero__heart">❤️</span>
        </h1>

        <div className="landing-buttons">
          <button
            className="button button--outline"
            onClick={() => navigate("/login")}
          >
            Log in
          </button>
          <button
            className="button button--primary"
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </button>
        </div>
      </section>
    </Layout>
  );
}
