import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Lock, Person, Visibility, VisibilityOff, Email, Mail } from "@mui/icons-material";
import { TextField, InputAdornment, IconButton, Dialog } from "@mui/material";

// Components & Assets
import SignInAnim from "./SignInAnim";
import Muialert from "./Muialert";
import GoogleIcon from "../assets/google.svg?url";
import { UserData } from "../App";

interface SigninProps {
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
}

function Signin({ setUserData }: SigninProps) {
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const navigate = useNavigate();

  const [value, setValue] = useState({
    username: "",
    password: "",
  });

  // 🚨 NEW: Password Visibility State
  const [showPassword, setShowPassword] = useState(false);

  // 🚨 NEW: OTP Login States
  const [otpLoginOpen, setOtpLoginOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [otpTimer, setOtpTimer] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value: val } = e.target;
    setValue((prev) => ({ ...prev, [name]: val }));
  };

  // OTP Timer Logic
  useEffect(() => {
    if (otpTimer && otpTimer > 0) {
      const interval = setInterval(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearInterval(interval);
    } else if (otpTimer === 0) {
      setOtpTimer(null);
    }
  }, [otpTimer]);

  // ==========================================
  // 🚨 NEW: READ URL FOR PREFILL DATA
  // ==========================================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillEmail = params.get("prefill");
    
    if (prefillEmail) {
      // 1. Prefill the standard username field just in case
      setValue(prev => ({ ...prev, username: prefillEmail }));
      
      // 2. Prefill the OTP email and auto-open the OTP dialog!
      setOtpEmail(prefillEmail);
      setOtpLoginOpen(true);
    }
  }, []);

  const PostData = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${import.meta.env.VITE_API}signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    
    const data = await res.json();
    if (res.ok) {
      setUserData((prev) => ({
        ...prev,
        Photo: data.photo || "",
        Name: data.name || "",
        Role: data.role || "",
        isAdmin: !!data.isAdmin,
      }));

      localStorage.setItem("jwtoken", data.token);
      localStorage.setItem("Username", data.username);
      navigate("/");
    } else {
      setAlertMessage(data.error || "Failed to Sign In");
      setShowAlert(true);
    }
  };

  const sendMail = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!value.username) {
      setAlertMessage("Please enter your username to reset your password");
      setShowAlert(true);
      return;
    }

    const res = await fetch(`${import.meta.env.VITE_API}reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: value.username }),
    });

    if (res.ok) {
      setAlertMessage("Password reset link sent to your email");
      setShowAlert(true);
    } else {
      const data = await res.json();
      setAlertMessage(data.error || "Failed to send mail");
      setShowAlert(true);
    }
  };

  // ==========================================
  // OTP LOGIN HANDLERS
  // ==========================================
  const handleSendLoginOtp = async () => {
    if (!otpEmail || !otpEmail.includes("@")) {
      setAlertMessage("Please enter a valid email address.");
      setShowAlert(true);
      return;
    }

    setIsOtpSending(true);
    setOtp("");
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API}generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });

      if (res.ok) {
        setOtpStep(2);
        setOtpTimer(60);
      } else {
        const data = await res.json();
        setAlertMessage(data.error || "Failed to send OTP.");
        setShowAlert(true);
      }
    } catch (error) {
      setAlertMessage("Network error. Could not send OTP.");
      setShowAlert(true);
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyLoginOtp = async (finalValue: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-otp-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp: finalValue }),
      });

      const data = await res.json();

      if (res.ok) {
        setUserData((prev) => ({
          ...prev,
          Photo: data.user?.photo || "",
          Name: data.user?.name || "",
          Role: data.user?.role || "",
          isAdmin: !!data.user?.isAdmin,
        }));

        localStorage.setItem("jwtoken", data.token);
        localStorage.setItem("Username", data.user?.username || "");
        
        setOtpLoginOpen(false);
        navigate("/");
      } else {
        setAlertMessage(data.error || "Invalid OTP.");
        setShowAlert(true);
      }
    } catch (err) {
      setAlertMessage("Network error. Failed to verify OTP.");
      setShowAlert(true);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        
        {/* Left Side: Animation */}
        <div className="md:w-1/2 bg-brand-blue p-12 flex flex-col justify-center items-center text-white">
          <div className="w-full max-w-xs mb-8">
            <SignInAnim />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4 text-center">Welcome Back!</h1>
          <p className="text-blue-100 text-center font-body opacity-80 italic">
            "The important thing is not to stop questioning."
          </p>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-8 md:p-12">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-display font-bold text-brand-blue">Sign In</h2>
            <p className="text-gray-500 mt-2 font-body">Good to see you again!</p>
          </div>

          <form onSubmit={PostData} className="flex flex-col gap-5">
            <TextField
              fullWidth
              variant="outlined"
              name="username"
              placeholder="Username"
              value={value.username}
              onChange={handleChange}
              required
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person className="text-brand-blue" />
                    </InputAdornment>
                  ),
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <div className="space-y-2">
              <TextField
                fullWidth
                variant="outlined"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={value.password}
                onChange={handleChange}
                required
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock className="text-brand-blue" />
                      </InputAdornment>
                    ),
                    // 🚨 NEW: EYE ICON FOR PASSWORD TOGGLE
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOff fontSize="small" className="text-gray-400" /> : <Visibility fontSize="small" className="text-gray-400" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <div className="flex justify-end px-1">
                <button 
                  type="button"
                  onClick={sendMail}
                  className="text-xs font-bold text-brand-orange hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="w-full bg-brand-blue text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 transform hover:-translate-y-0.5"
              >
                Sign In
              </button>
              
              {/* 🚨 NEW: LOGIN WITH OTP BUTTON */}
              <button
                type="button"
                onClick={() => { setOtpStep(1); setOtpLoginOpen(true); }}
                className="w-full bg-blue-50 text-brand-blue py-3.5 rounded-xl font-bold text-base hover:bg-blue-100 transition-all active:scale-[0.98]"
              >
                Sign In with Email OTP
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-gray-500 font-body">
            New here? <NavLink to="/signup" className="text-brand-orange font-bold hover:underline">Create Account</NavLink>
          </p>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
            <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-400">Or</span></div>
          </div>

          <button 
            type="button"
            onClick={() => window.location.href = `${import.meta.env.VITE_API}auth/google`}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold text-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.98]"
          >
            <img src={GoogleIcon} alt="Google" className="w-6 h-6" />
            Continue with Google
          </button>
          
        </div>
      </div>

      {/* 🚨 DIALOG: OTP LOGIN FLOW */}
      <Dialog 
        open={otpLoginOpen} 
        onClose={(event, reason) => { if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') setOtpLoginOpen(false); }}
        slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px', maxWidth: '400px', width: '100%' } } }}
      >
        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><Email className="text-brand-blue" fontSize="large" /></div>
          <h3 className="text-2xl font-display font-bold text-brand-blue mb-2">Login with OTP</h3>
          
          {otpStep === 1 ? (
            <div className="w-full flex flex-col items-center">
              <p className="text-gray-500 mb-6 text-sm">Enter your registered email address to receive a secure login code.</p>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Email Address"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (<InputAdornment position="start"><Mail className="text-brand-blue" /></InputAdornment>),
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' }, mb: 4 }}
              />
              <button
                type="button"
                onClick={handleSendLoginOtp}
                disabled={isOtpSending || !otpEmail}
                className="w-full bg-brand-orange text-white py-3.5 rounded-xl font-bold text-lg hover:bg-orange-600 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isOtpSending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Send Login Code"}
              </button>
              <button onClick={() => setOtpLoginOpen(false)} className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <p className="text-gray-500 mb-8 text-sm">We've sent a 4-digit code to <br/><span className="font-bold text-gray-700">{otpEmail}</span></p>
              
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    id={`login-otp-input-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[index] || ""}
                    autoFocus={index === 0}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                      if (pasteData) {
                        setOtp(pasteData);
                        if (pasteData.length === 4) handleVerifyLoginOtp(pasteData);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, ""); 
                      if (!val && e.target.value !== "") return; 
                      
                      const otpArray = otp.split("");
                      otpArray[index] = val;
                      const newOtp = otpArray.join("");
                      setOtp(newOtp);

                      if (val && index < 3) {
                        const nextInput = document.getElementById(`login-otp-input-${index + 1}`);
                        if (nextInput) nextInput.focus();
                      }

                      if (newOtp.length === 4) {
                        handleVerifyLoginOtp(newOtp);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[index] && index > 0) {
                        const prevInput = document.getElementById(`login-otp-input-${index - 1}`);
                        if (prevInput) prevInput.focus();
                      }
                    }}
                    className="w-14 h-14 text-center text-2xl font-black text-brand-blue bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:bg-blue-50 transition-all shadow-sm"
                  />
                ))}
              </div>

              <div className="mt-10 pt-6 border-t border-gray-100 w-full">
                {otpTimer && otpTimer > 0 ? (
                  <p className="text-gray-400 text-sm font-body">Resend code in <span className="text-brand-blue font-bold">{otpTimer}s</span></p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-gray-500">Didn't receive the code?</p>
                    <button type="button" onClick={handleSendLoginOtp} disabled={isOtpSending} className="text-brand-orange font-bold hover:underline flex items-center gap-2">
                      {isOtpSending && <div className="w-3 h-3 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>} Resend OTP
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setOtpStep(1)} className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 underline">Entered wrong email? Edit it</button>
            </div>
          )}
        </div>
      </Dialog>

      {showAlert && <Muialert message={alertMessage} severity="error" onClose={() => setShowAlert(false)} />}
    </div>
  );
}

export default Signin;