import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { 
  Email, Lock, Phone, Person, Badge as BadgeIcon, Visibility, VisibilityOff
} from "@mui/icons-material";
import {
  TextField, Button, InputAdornment, Checkbox, Dialog, Select, MenuItem, IconButton
} from "@mui/material";

// Components & Assets
import SignUpAnim from "./SignUpAnim";
import FunDatePicker from "./FunDatePicker";
import Muialert from "./Muialert";
import GoogleIcon from "../assets/google.svg";

function Signup() {
  const [value, setValue] = useState({
    name: "",
    email: "",
    password: "",
    cpassword: "",
    phone: "",
    username: "",
    dob: "",
    role: "Student",
    declaration: false,
    otp: "",
    isEmailVerified: false,
  });

  const [isOtpSending, setIsOtpSending] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [countryCode, setCountryCode] = useState("+91");
  
  // 🚨 NEW: Password Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value: val } = e.target;
    setValue((prev) => ({
      ...prev,
      [name]: val,
      // If they edit the email after verifying, reset verification status
      ...(name === "email" && { isEmailVerified: false }), 
    }));
  };

  const handleEmailVerification = async () => {
    setIsOtpSending(true);
    setValue(prev => ({ ...prev, otp: "" }));
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API}generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value.email.toLowerCase().trim() }),
      });

      if (res.ok) {
        setOpen(true);
        setTimer(60);
      } else {
        const data = await res.json();
        setAlertMessage(data.error || "Failed to send OTP. Try again.");
        setShowAlert(true);
      }
    } catch (error) {
      setAlertMessage("Network error. Could not send OTP.");
      setShowAlert(true);
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleOtpComplete = async (finalValue: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value.email.toLowerCase().trim(), otp: finalValue }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // 🚨 BULLETPROOF: Block sign-up if the email already belongs to an existing user
        if (data.existingUser) {
           setOpen(false);
           setValue(prev => ({ ...prev, otp: "", isEmailVerified: false }));
           setAlertMessage("An account with this email already exists. Please sign in instead.");
           setShowAlert(true);
           return;
        }

        setValue((prev) => ({ ...prev, isEmailVerified: true }));
        setOpen(false);
      } else {
        const data = await res.json();
        setAlertMessage(data.error || "OTP Verification Failed");
        setShowAlert(true);
      }
    } catch (err) {
      setAlertMessage("Network error. Failed to verify OTP.");
      setShowAlert(true);
    }
  };

  // 🚀 UPDATED: Auto-Login & Smart Redirect Logic
  const PostData = async (e: React.FormEvent) => {
    e.preventDefault();

    if (usernameStatus !== "available") {
      setAlertMessage("Please choose a valid and available username.");
      setShowAlert(true);
      return;
    }

    if (!value.isEmailVerified) {
      setAlertMessage("Please verify your email first.");
      setShowAlert(true);
      return;
    }

    // 🚨 BULLETPROOF: Frontend password match check to save an API call
    if (value.password !== value.cpassword) {
      setAlertMessage("Passwords do not match.");
      setShowAlert(true);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API}register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });

      const data = await res.json();

      if (res.ok) {
        // 1. AUTO-LOGIN
        localStorage.setItem("jwtoken", data.token);
        localStorage.setItem("Username", data.username);
        localStorage.setItem("Name", data.name);
        localStorage.setItem("Photo", data.photo || "");

        // 2. SMART REDIRECT
        const returnTo = sessionStorage.getItem("redirectPath") || "/";
        sessionStorage.removeItem("redirectPath"); 

        // 3. Navigate with the 'new' flag for the popup
        navigate(`${returnTo}?new=true`);
      } else {
        setAlertMessage(data.error || "Something went wrong.");
        setShowAlert(true);
      }
    } catch (err) {
      setAlertMessage("Server error. Please try again.");
      setShowAlert(true);
    }
  };

  useEffect(() => {
    if (timer && timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setTimer(null);
    }
  }, [timer]);

  useEffect(() => {
    const checkUsername = async () => {
      const currentUsername = value.username.trim();
      if (currentUsername.length === 0) {
        setUsernameStatus("idle");
        return;
      }
      if (currentUsername.length < 4) {
        setUsernameStatus("invalid");
        return;
      }

      setUsernameStatus("checking");

      try {
        const res = await fetch(`${import.meta.env.VITE_API}check-username`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUsername }),
        });
        const data = await res.json();
        if (res.ok && data.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
        }
      } catch (error) {
        setUsernameStatus("idle");
      }
    };

    const delayDebounceFn = setTimeout(() => {
      checkUsername();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [value.username]);

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        
        {/* Left Side: Animation & Branding */}
        <div className="md:w-1/2 bg-brand-blue p-12 flex flex-col justify-center items-center text-white">
          <div className="w-full max-w-sm mb-8"><SignUpAnim /></div>
          <h1 className="text-3xl font-display font-bold mb-4 text-center">Join the Curious Team</h1>
          <p className="text-blue-100 text-center font-body opacity-80">Start your journey of education with empathy and discovery.</p>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-brand-blue">Create Account</h2>
            <p className="text-gray-500 mt-2 font-body">Fill in the details below to get started</p>
          </div>

          <form onSubmit={PostData} className="flex flex-col gap-5">
            <TextField
              fullWidth
              variant="outlined"
              name="name"
              label="Full Name" 
              value={value.name}
              onChange={handleChange}
              required
              slotProps={{ input: { startAdornment: (<InputAdornment position="start"><BadgeIcon className="text-brand-blue" /></InputAdornment>) } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <TextField
              fullWidth
              variant="outlined"
              name="username"
              label="Username"
              value={value.username}
              onChange={handleChange}
              required
              error={usernameStatus === "taken" || usernameStatus === "invalid"}
              helperText={
                usernameStatus === "checking" ? "Checking availability..." :
                usernameStatus === "invalid" ? "Username must be at least 4 characters." :
                usernameStatus === "taken" ? "Username is already taken." :
                usernameStatus === "available" ? "Username is available!" : ""
              }
              slotProps={{
                input: {
                  startAdornment: (<InputAdornment position="start"><Person className="text-brand-blue" /></InputAdornment>),
                  endAdornment: (
                    <InputAdornment position="end">
                      {usernameStatus === "checking" && <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>}
                      {usernameStatus === "available" && <span className="text-green-500 font-bold">✔</span>}
                    </InputAdornment>
                  )
                }
              }}
              sx={{ 
                '& .MuiOutlinedInput-root': { borderRadius: '12px' },
                '& .MuiFormHelperText-root': { color: usernameStatus === 'available' ? '#22c55e' : undefined, fontWeight: usernameStatus === 'available' ? 'bold' : 'normal' }
              }}
            />

            <TextField
              fullWidth
              variant="outlined"
              name="email"
              type="email"
              label="Email Address"
              value={value.email}
              onChange={handleChange}
              required
              slotProps={{
                input: {
                  startAdornment: (<InputAdornment position="start"><Email className="text-brand-blue" /></InputAdornment>),
                  endAdornment: (
                    <InputAdornment position="end">
                      {!value.isEmailVerified && value.email.length > 3 && value.email.includes("@") && (
                        <button 
                          type="button"
                          onClick={handleEmailVerification}
                          className="flex items-center gap-2 text-xs font-bold text-brand-orange hover:underline disabled:opacity-50 disabled:no-underline"
                          disabled={!!timer || isOtpSending}
                        >
                          {isOtpSending ? (
                            <><div className="w-3 h-3 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div> Sending...</>
                          ) : (timer ? `Resend in ${timer}s` : "Verify")}
                        </button>
                      )}
                      {value.isEmailVerified && <span className="text-green-500 font-bold">✔ Verified</span>}
                    </InputAdornment>
                  )
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                fullWidth variant="outlined" name="password" 
                type={showPassword ? "text" : "password"} 
                label="Password" value={value.password} onChange={handleChange} required
                slotProps={{ 
                  input: { 
                    startAdornment: (<InputAdornment position="start"><Lock className="text-brand-blue" /></InputAdornment>),
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
              <TextField
                fullWidth variant="outlined" name="cpassword" 
                type={showConfirmPassword ? "text" : "password"} 
                label="Confirm Password" value={value.cpassword} onChange={handleChange} required
                error={value.cpassword.length > 0 && value.password !== value.cpassword}
                slotProps={{ 
                  input: { 
                    startAdornment: (<InputAdornment position="start"><Lock className="text-brand-blue" /></InputAdornment>),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                          {showConfirmPassword ? <VisibilityOff fontSize="small" className="text-gray-400" /> : <Visibility fontSize="small" className="text-gray-400" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  } 
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </div>

            <div className="flex gap-3">
              <Select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as string)}
                sx={{ minWidth: '130px', borderRadius: '12px', backgroundColor: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1765a4' } }}
              >
                <MenuItem value="+91">+91 (IN)</MenuItem>
                <MenuItem value="+1">+1 (US)</MenuItem>
                <MenuItem value="+44">+44 (UK)</MenuItem>
              </Select>
              <TextField
                fullWidth variant="outlined" name="phone" label="Phone Number" value={value.phone} onChange={handleChange} required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', backgroundColor: 'white' } }}
              />
            </div>

      
            <div className="w-full [&>div]:w-full">
              <FunDatePicker 
                label="Date of Birth"
                value={value.dob} 
                onChange={(newDate) => setValue({ ...value, dob: newDate || "" })} 
              />
            </div>
           
            <button
              type="submit"
              className="w-full bg-brand-orange text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/30 transform hover:-translate-y-0.5"
            >
              Create Account
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
            <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest"><span className="px-4 bg-white text-gray-400">Or continue with</span></div>
          </div>

          <button 
            onClick={() => {
              const returnTo = sessionStorage.getItem("redirectPath") || "/";
              window.location.href = `${import.meta.env.VITE_API}auth/google?returnTo=${returnTo}`;
            }}
            className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
          >
            <img src={GoogleIcon} alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>

          <p className="mt-8 text-center text-gray-400 text-sm font-medium">
            Already have an account? <NavLink to="/signin" className="text-brand-blue font-bold hover:underline ml-1">Sign In</NavLink>
          </p>
        </div>
      </div>

      <Dialog 
        open={open} 
        onClose={(event, reason) => { if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') setOpen(false); }}
        slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px' } } }}
      >
        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><Email className="text-brand-blue" fontSize="large" /></div>
          <h3 className="text-2xl font-display font-bold text-brand-blue mb-2">Verify Your Email</h3>
          <p className="text-gray-500 mb-8 text-sm max-w-62.5">We've sent a 4-digit code to <br/><span className="font-bold text-gray-700">{value.email}</span></p>
          
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={value.otp[index] || ""}
                autoFocus={index === 0}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                  if (pasteData) {
                    setValue(prev => ({ ...prev, otp: pasteData }));
                    if (pasteData.length === 4) handleOtpComplete(pasteData);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ""); 
                  if (!val && e.target.value !== "") return; 
                  
                  const otpArray = value.otp.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setValue(prev => ({ ...prev, otp: newOtp }));

                  if (val && index < 3) {
                    const nextInput = document.getElementById(`otp-input-${index + 1}`);
                    if (nextInput) nextInput.focus();
                  }

                  if (newOtp.length === 4) {
                    handleOtpComplete(newOtp);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !value.otp[index] && index > 0) {
                    const prevInput = document.getElementById(`otp-input-${index - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="w-14 h-14 text-center text-2xl font-black text-brand-blue bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:bg-blue-50 transition-all shadow-sm"
              />
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 w-full">
            {timer && timer > 0 ? (
              <p className="text-gray-400 text-sm font-body">Resend code in <span className="text-brand-blue font-bold">{timer}s</span></p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-500">Didn't receive the code?</p>
                <button type="button" onClick={handleEmailVerification} disabled={isOtpSending} className="text-brand-orange font-bold hover:underline flex items-center gap-2">
                  {isOtpSending && <div className="w-3 h-3 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>} Resend OTP
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline">Entered wrong email? Edit it</button>
        </div>
      </Dialog>
      
      {showAlert && <Muialert message={alertMessage} severity="error" onClose={() => setShowAlert(false)} />}
    </div>
  );
}

export default Signup;