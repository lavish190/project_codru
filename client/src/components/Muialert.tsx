import { useEffect, ReactNode } from "react";
import { Alert as MuiAlert } from "@mui/material";

// 1. We define exactly what props this alert is allowed to receive
interface MuialertProps {
  message: ReactNode; // 🚨 UPDATED: Now accepts both plain strings and rich JSX (like your link!)
  severity: "success" | "error" | "info" | "warning";
  onClose: () => void;
  autoHideDuration?: number;
}

const Muialert = ({ 
  message, 
  severity, 
  onClose, 
  autoHideDuration = 4000 
}: MuialertProps) => {
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, autoHideDuration);

    return () => clearTimeout(timer); // Cleanup if the component unmounts early
  }, [onClose, autoHideDuration]);

  return (
    // 2. Replaced inline styles with responsive Tailwind classes!
    // w-full max-w-md ensures it stretches on mobile but caps at a nice size on desktop
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-9999 w-full max-w-md px-4 drop-shadow-2xl animate-fade-in-up">
      <MuiAlert
        onClose={onClose}
        severity={severity}
        variant="filled" // The "filled" variant looks highly premium out-of-the-box
        sx={{
          width: "100%",
          borderRadius: "12px", // Matches all our new text inputs!
          fontFamily: '"Arimo", sans-serif',
          fontWeight: 600,
          fontSize: "1rem",
          alignItems: "center",
          // We let MUI handle the standard Red/Green, but we can override Info/Warning with your brand colors!
          ...(severity === "info" && { backgroundColor: "#1765a4" }), // Brand Blue
          ...(severity === "warning" && { backgroundColor: "#ed7f23" }), // Brand Orange
        }}
      >
        {message}
      </MuiAlert>
    </div>
  );
};

export default Muialert;