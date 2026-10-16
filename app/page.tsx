"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { SchoolBrand } from "@saraswati/tenant-kit";
import { getDashboardUrl, getAllRoles } from '@/lib/role-mapping';

// Disable prerendering for login page
export const dynamic = 'force-dynamic';

// ============================================
// ICONS
// ============================================

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5.5c0 4.3 3 8.3 7 9.5 4-1.2 7-5.2 7-9.5V6l-7-3Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

// ============================================
// ROLE TO DASHBOARD URL MAPPING
// ============================================

const ROLE_DASHBOARD_MAP: Record<string, string> = {
  "School Admin": process.env.NEXT_PUBLIC_SCHOOL_ADMIN_DASHBOARD_URL || "https://staging.sgs.swais.in/admin/students",
  "Headmaster":    process.env.NEXT_PUBLIC_HEADMASTER_DASHBOARD_URL || "https://staging.sgs.swais.in/headmaster",
  "Faculty":       process.env.NEXT_PUBLIC_FACULTY_DASHBOARD_URL || "https://staging.sgs.swais.in/faculty/dashboard",
  "Student":       process.env.NEXT_PUBLIC_STUDENT_DASHBOARD_URL || "https://staging.sgs.swais.in/student",
  "Parent":        process.env.NEXT_PUBLIC_PARENT_DASHBOARD_URL || "https://staging.sgs.swais.in/parent/dashboard",
};

// ============================================
// EMAIL & PHONE VALIDATION FUNCTIONS
// ============================================

async function validateUserEmail(email: string, role: string): Promise<{ isValid: boolean; message: string }> {
  try {
    const response = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email: email.trim(), 
        role: role 
      }),
    });

    const data = await response.json();

    if (response.ok && data.valid) {
      return { isValid: true, message: '' };
    } else {
      return { 
        isValid: false, 
        message: data.message || `No ${role} found with this email. Please contact your administrator.` 
      };
    }
  } catch (error) {
    console.error('Email validation error:', error);
    return { 
      isValid: false, 
      message: 'Unable to validate email. Please try again.' 
    };
  }
}

async function validateUserPhone(phone: string, role: string): Promise<{ isValid: boolean; message: string }> {
  try {
    const response = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone.trim(),
        role: role
      }),
    });

    const data = await response.json();

    if (response.ok && data.valid) {
      return { isValid: true, message: data.message || '' };
    }

    return {
      isValid: false,
      message: data.message || `No ${role} found with this phone number. Please contact your administrator.`
    };
  } catch (error) {
    console.error('Phone validation error:', error);
    return {
      isValid: false,
      message: 'Unable to validate phone number. Please try again.'
    };
  }
}

// ============================================
// MAIN LOGIN PAGE
// ============================================

export default function Home() {
  const roles = ["School Admin", "Headmaster", "Faculty", "Student", "Parent"];
  
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [selectedRole, setSelectedRole] = useState("Select your role");
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);

  // NEW: OTP State Management
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Handle outside click for dropdown
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ============================================
  // HANDLE FINAL LOGIN REDIRECT / SESSION
  // ============================================
  const executeFinalLogin = async () => {
    sessionStorage.setItem('userRole', selectedRole);
    
    const dashboardUrl = getDashboardUrl(selectedRole);
    
    if (!dashboardUrl) {
      setMessage("Invalid role selected. Please try again.");
      setIsLoading(false);
      return;
    }

    sessionStorage.setItem('dashboardRedirectUrl', dashboardUrl);

    if (loginMethod === "email") {
      // EMAIL LOGIN: Trigger Google SSO
      sessionStorage.setItem('userEmail', email.trim());
      sessionStorage.removeItem('userPhone');
      
      if (process.env.NODE_ENV === 'development') {
        window.location.href = dashboardUrl;
        return;
      }

      await signIn('google', {
        callbackUrl: '/dashboard',
        redirect: true,
      });

    } else {
      // PHONE LOGIN: User verified via OTP.
      sessionStorage.setItem('userPhone', phone.trim());
      sessionStorage.removeItem('userEmail');
      
      try {
        // Fetch an SSO token to securely pass the login state to the external staging server
        const tokenRes = await fetch('/api/sso-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), role: selectedRole })
        });
        
        if (tokenRes.ok) {
          const data = await tokenRes.json();
          // Safely append access_token if it exists, otherwise fall back to base URL
          if (data.access_token) {
            window.location.href = `${dashboardUrl}?token=${data.access_token}`;
          } else {
            window.location.href = dashboardUrl;
          }
        } else {
          // Fallback if the token generation fails
          console.warn("SSO token generation failed. Redirecting without token.");
          window.location.href = dashboardUrl;
        }
      } catch (error) {
        console.error("Error generating SSO token:", error);
        window.location.href = dashboardUrl;
      }
    }
  };
  
  // ============================================
  // STEP 1: HANDLE INITIAL LOGIN VERIFICATION
  // ============================================
  const handleLogin = async () => {
    setMessage("");

    if (!selectedRole || selectedRole === "Select your role") {
      setMessage("Please select your role.");
      return;
    }

    if (loginMethod === "email" && !email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    if (loginMethod === "phone" && !phone.trim()) {
      setMessage("Please enter your phone number.");
      return;
    }

    setIsLoading(true);

    try {
      const validation = loginMethod === "email"
        ? await validateUserEmail(email.trim(), selectedRole)
        : await validateUserPhone(phone.trim(), selectedRole);
      
      if (!validation.isValid) {
        setMessage(validation.message);
        setIsLoading(false);
        return;
      }

      // If user selected Phone Login, transition to the OTP step instead of logging in
      if (loginMethod === "phone") {
        setIsOtpStep(true);
        setMessage("OTP sent via SMS. Valid for 10 minutes.");
        setIsLoading(false);
        return;
      }

      // If user selected Email Login, proceed directly to final login
      await executeFinalLogin();
      
    } catch (error) {
      console.error('Login error:', error);
      setMessage("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  // ============================================
  // STEP 2: HANDLE OTP VERIFICATION
  // ============================================
  const handleVerifyOtp = async () => {
    setMessage("");
    setIsLoading(true);

    try {
      const result = await signIn('phone-otp', {
        phone: phone.trim(),
        otp: otpCode,
        role: selectedRole,
        redirect: false,
      });

      if (!result?.ok || result.error) {
        setMessage('Invalid or expired OTP. Please request a new one.');
        setIsLoading(false);
        return;
      }

      // Auth.js has created the session cookie; continue to the role dashboard.
      await executeFinalLogin();
    } catch (error) {
      setMessage("Failed to verify OTP. Please try again.");
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    if (selectedRole === "Select your role") return false;
    return loginMethod === "email" ? email.trim() !== "" : phone.trim() !== "";
  };

  const getButtonText = () => {
    if (isLoading) return "Please wait...";
    return "Continue";
  };

  return (
    <main className="login-page">
      <div className="scene">
        {/* Brand / campus side */}
        <section className="hero" aria-label="SGS Portal">
          <div className="hero-inner">
            <SchoolBrand />
            <p className="hero-tag">
              Your all-in-one AI-powered school portal for students, teachers,
              parents, and administration.
            </p>
            <div className="hero-badges">
              <span className="hero-badge"><ShieldIcon />Secure Portal</span>
              <i className="badge-sep" aria-hidden="true" />
              <span className="hero-badge"><BoltIcon />AI-Powered</span>
            </div>
          </div>
          <p className="hero-motto" aria-hidden="true">
            Learn <b>&middot;</b> Grow <b>&middot;</b> Build a Better Tomorrow
          </p>
        </section>

        {/* Form card side */}
        <div className="form-side">
        <form 
          className="card" 
          aria-labelledby="welcome-heading" 
          onSubmit={(e) => { 
            e.preventDefault(); 
            isOtpStep ? handleVerifyOtp() : handleLogin(); 
          }}
        >
          <span className="wave" aria-hidden="true">👋</span>
          <h2 className="welcome-heading" id="welcome-heading">Welcome Back!</h2>
          <p className="welcome-sub">Sign in to access your account</p>

          {/* DYNAMIC FORM RENDERING BASED ON isOtpStep */}
          {!isOtpStep ? (
            <>
              {/* STEP 1: Standard Login Form */}
              <div className="tabs" role="tablist" aria-label="Sign in method">
                <button
                  className={`tab ${loginMethod === "email" ? "active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={loginMethod === "email"}
                  disabled={isLoading}
                  onClick={() => {
                    setLoginMethod("email");
                    setMessage("");
                  }}
                >
                  <MailIcon />
                  <span>Email</span>
                </button>
                <button
                  className={`tab ${loginMethod === "phone" ? "active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={loginMethod === "phone"}
                  disabled={isLoading}
                  onClick={() => {
                    setLoginMethod("phone");
                    setMessage("");
                  }}
                >
                  <PhoneIcon />
                  <span>Phone Number</span>
                </button>
              </div>

              {loginMethod === "email" ? (
                <label className="field-group">
                  <span>
                    Email Address <strong className="required-marker">*</strong>
                  </span>
                  <span className="input-wrap">
                    <MailIcon />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </span>
                </label>
              ) : (
                <label className="field-group">
                  <span>
                    Phone Number <strong className="required-marker">*</strong>
                  </span>
                  <span className="input-wrap">
                    <PhoneIcon />
                    <input
                      type="tel"
                      placeholder="Enter your phone number"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => {
                        const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(digitsOnly);
                      }}
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      disabled={isLoading}
                      required
                    />
                  </span>
                </label>
              )}

              <div className="field-group role-dropdown" ref={roleDropdownRef}>
                <span>
                  Select Role <strong className="required-marker">*</strong>
                </span>
                <button
                  className={`select-box ${isRoleOpen ? "open" : ""}`}
                  type="button"
                  aria-expanded={isRoleOpen}
                  disabled={isLoading}
                  onClick={() => setIsRoleOpen((current) => !current)}
                >
                  <span className="select-label">
                    <UsersIcon />
                    <span id="selectedRole" className={selectedRole === "Select your role" ? "is-placeholder" : ""}>
                      {selectedRole === "Select your role" ? "Choose your role" : selectedRole}
                    </span>
                  </span>
                  <ChevronIcon />
                </button>
                {isRoleOpen ? (
                  <div className="role-menu" role="listbox" aria-label="Role options">
                    {roles.map((role) => (
                      <button
                        className={`role-menu-option ${selectedRole === role ? "selected" : ""}`}
                        key={role}
                        type="button"
                        role="option"
                        aria-selected={selectedRole === role}
                        onClick={() => {
                          setSelectedRole(role);
                          setIsRoleOpen(false);
                        }}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {message && (
                <div className="form-message" role="alert">
                  {message}
                </div>
              )}

              <button
                className="sign-in"
                type="submit"
                disabled={isLoading || !isFormValid()}
              >
                {isLoading ? <span className="loader" aria-hidden="true" /> : <LoginIcon />}
                <span>{getButtonText()}</span>
                {isLoading ? null : <ArrowRightIcon />}
              </button>

              <div className="or-row">
                <span>OR</span>
              </div>

              <p className="administrator">
                <ShieldIcon />
                Don&apos;t have an account? <strong>Contact SWAIS administrator</strong>
              </p>
            </>
          ) : (
            <>
              {/* STEP 2: OTP Entry Form */}
              <label className="field-group" style={{ marginTop: '1rem' }}>
                <span>
                  Enter 6-Digit OTP <strong className="required-marker">*</strong>
                </span>
                <span className="input-wrap">
                  <ShieldIcon />
                  <input
                    type="text"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    disabled={isLoading}
                    style={{ letterSpacing: '8px', fontSize: '1.25rem', fontWeight: 'bold' }}
                    required
                  />
                </span>
              </label>

              {message && (
                <div className="form-message" role="alert" style={{ color: message.includes('sent') ? '#10b981' : undefined }}>
                  {message}
                </div>
              )}

              <button
                className="sign-in"
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                style={{ marginTop: '1rem' }}
              >
                {isLoading ? <span className="loader" aria-hidden="true" /> : <LoginIcon />}
                <span>{isLoading ? "Verifying..." : "Verify & Login"}</span>
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => { 
                    setIsOtpStep(false); 
                    setOtpCode(""); 
                    setMessage(""); 
                  }}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
                  disabled={isLoading}
                >
                  Change phone number or role
                </button>
              </div>
            </>
          )}
        </form>
        </div>
      </div>

      <footer className="page-footer">
        <span>&copy; 2026 SGS Portal. All rights reserved.</span>
        <i aria-hidden="true">|</i>
        <span className="footer-link">Privacy Policy</span>
        <i aria-hidden="true">|</i>
        <span className="footer-link">Terms of Use</span>
      </footer>
    </main>
  );
}
