import React, { useState, useEffect } from "react";

const COLORS = {
  base: "#12151C",
  surface: "#1A1F2B",
  surfaceRaised: "#212737",
  border: "#2A3142",
  borderLight: "#384058",
  text: "#E8E6E1",
  textMuted: "#8B92A5",
  textFaint: "#5B6275",
  amber: "#F0A857",
  amberDim: "#F0A85733",
  teal: "#5FB8A8",
  tealDim: "#5FB8A833",
  red: "#E2574C",
  redDim: "#E2574C2A",
  violet: "#8B85D6",
};

const FONT_DISPLAY = "'Archivo', 'Arial Narrow', sans-serif";
const FONT_BODY = "'Inter', -apple-system, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize mock users if none exist
  useEffect(() => {
    const existingUsers = localStorage.getItem("departures_users");
    if (!existingUsers) {
      const defaultUsers = [
        {
          name: "John Miller",
          email: "john@example.com",
          password: "password123",
        },
      ];
      localStorage.setItem("departures_users", JSON.stringify(defaultUsers));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password || (!isLogin && !name)) {
      setError("Please enter all credentials to continue.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const users = JSON.parse(localStorage.getItem("departures_users") || "[]");

    setIsLoading(true);

    // Simulate standard security token resolution delay
    setTimeout(() => {
      if (isLogin) {
        // Login Flow
        const foundUser = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );
        if (foundUser) {
          setIsLoading(false);
          onLogin(foundUser);
        } else {
          setIsLoading(false);
          setError("Invalid email address or password.");
        }
      } else {
        // Signup Flow
        const userExists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
        if (userExists) {
          setIsLoading(false);
          setError("An account with this email address already exists.");
        } else {
          const newUser = { name, email, password };
          users.push(newUser);
          localStorage.setItem("departures_users", JSON.stringify(users));
          setIsLoading(false);
          onLogin(newUser);
        }
      }
    }, 1200);
  };

  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        background: COLORS.base,
        color: COLORS.text,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        
        @keyframes spinner {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-card {
          animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Decorative Blur Orbs */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.amber}15 0%, transparent 70%)`,
          top: "-5%",
          right: "-5%",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.violet}0E 0%, transparent 70%)`,
          bottom: "-15%",
          left: "-15%",
          pointerEvents: "none",
        }}
      />

      <div
        className="auth-card"
        style={{
          maxWidth: 400,
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header Block */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: COLORS.amber,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={COLORS.base}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 24,
                letterSpacing: "-0.02em",
              }}
            >
              DEPARTURES
            </span>
          </div>
          <p
            style={{
              fontSize: 14,
              color: COLORS.textMuted,
              margin: 0,
            }}
          >
            Personalized Scheduling Manager
          </p>
        </div>

        {/* Credentials Form Card */}
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 32,
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
          }}
        >
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 24px",
              color: COLORS.text,
            }}
          >
            {isLogin ? "Sign In" : "Create Account"}
          </h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  background: COLORS.redDim,
                  border: `1px solid ${COLORS.red}44`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: COLORS.red,
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  lineHeight: 1.4,
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginTop: 2, flexShrink: 0 }}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {!isLogin && (
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    color: COLORS.textMuted,
                    marginBottom: 6,
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Amelia Earhart"
                    disabled={isLoading}
                    style={{
                      width: "100%",
                      background: COLORS.surfaceRaised,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.text,
                      borderRadius: 8,
                      padding: "12px 14px 12px 38px",
                      fontSize: 14.5,
                      fontFamily: FONT_BODY,
                      outline: "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = COLORS.amber;
                      e.target.style.boxShadow = `0 0 8px ${COLORS.amber}22`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = COLORS.border;
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amelia@departures.io"
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    background: COLORS.surfaceRaised,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    borderRadius: 8,
                    padding: "12px 14px 12px 38px",
                    fontSize: 14.5,
                    fontFamily: FONT_BODY,
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = COLORS.amber;
                    e.target.style.boxShadow = `0 0 8px ${COLORS.amber}22`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = COLORS.border;
                    e.target.style.boxShadow = "none";
                  }}
                />
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    background: COLORS.surfaceRaised,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    borderRadius: 8,
                    padding: "12px 14px 12px 38px",
                    fontSize: 14.5,
                    fontFamily: FONT_BODY,
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = COLORS.amber;
                    e.target.style.boxShadow = `0 0 8px ${COLORS.amber}22`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = COLORS.border;
                    e.target.style.boxShadow = "none";
                  }}
                />
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                background: COLORS.amber,
                color: COLORS.base,
                border: "none",
                borderRadius: 8,
                padding: "13px 14px",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: isLoading ? "default" : "pointer",
                transition: "opacity 0.2s, transform 0.1s, box-shadow 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: `0 4px 12px ${COLORS.amber}22`,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.opacity = 0.9;
                  e.target.style.boxShadow = `0 4px 16px ${COLORS.amber}44`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.opacity = 1;
                  e.target.style.boxShadow = `0 4px 12px ${COLORS.amber}22`;
                }
              }}
              onMouseDown={(e) => {
                if (!isLoading) e.target.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                if (!isLoading) e.target.style.transform = "scale(1)";
              }}
            >
              {isLoading ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: `2px solid ${COLORS.base}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spinner 0.6s linear infinite",
                    }}
                  />
                  <span>Loading...</span>
                </>
              ) : (
                <span>{isLogin ? "Sign In" : "Register"}</span>
              )}
            </button>

            {/* Toggle Toggler */}
            <div
              style={{
                textAlign: "center",
                marginTop: 24,
                fontSize: 13.5,
                color: COLORS.textMuted,
              }}
            >
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsLogin(!isLogin);
                }}
                disabled={isLoading}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.teal,
                  fontWeight: 500,
                  padding: "0 2px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "inherit",
                }}
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </div>
          </form>
        </div>

        {/* Demo Credentials Hint */}
        {isLogin && (
          <div
            style={{
              marginTop: 16,
              background: `${COLORS.surface}88`,
              border: `1px solid ${COLORS.border}55`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: COLORS.textFaint,
              fontFamily: FONT_MONO,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            Demo passenger access: john@example.com / password123
          </div>
        )}
      </div>
    </div>
  );
}
