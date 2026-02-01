import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiSignup, saveToken } from "../api";

function validateEmail(value: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!value.trim()) return "Email is required";
  if (!emailRegex.test(value.trim())) return "Please enter a valid email";
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Password is required";
  if (value.length < 6) return "Password must be at least 6 characters";
  return null;
}

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    setEmailError(emailValidation);
    setPasswordError(passwordValidation);

    if (emailValidation || passwordValidation) return;

    setIsSubmitting(true);

    try {
      const data = await apiSignup(email, password);
      saveToken(data.token);

      // after successful signup go to profile onboarding
      navigate("/profile-step-1");
    } catch (err) {
      console.error(err);
      setEmailError("Signup failed (maybe email already in use)");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormInvalid = Boolean(
    validateEmail(email) || validatePassword(password)
  );

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
      </section>

      <section className="auth-card-wrapper">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <div className="auth-card__field">
            <label className="auth-card__label" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              className={
                "auth-card__input" +
                (emailError ? " auth-card__input--error" : "")
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailError(validateEmail(email))}
            />
            {emailError && (
              <span className="auth-card__error-text">{emailError}</span>
            )}
          </div>

          <div className="auth-card__field">
            <label className="auth-card__label" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              className={
                "auth-card__input" +
                (passwordError ? " auth-card__input--error" : "")
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordError(validatePassword(password))}
            />
            {passwordError && (
              <span className="auth-card__error-text">{passwordError}</span>
            )}
          </div>

          <button
            className="button button--primary auth-card__button"
            type="submit"
            disabled={isSubmitting || isFormInvalid}
          >
            {isSubmitting ? "Signing up..." : "Sign Up"}
          </button>
        </form>
      </section>
    </Layout>
  );
}
