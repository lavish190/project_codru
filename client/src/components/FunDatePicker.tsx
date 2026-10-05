import React from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { CalendarToday } from "@mui/icons-material";
import { styled } from "@mui/material/styles";

interface FunDatePickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  borderRadius?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  height?: string;
  borderColor?: string;
}

// 🚨 RIGID WRAPPER: Only used for Dashboard & Calendar
const CustomStyledDatePicker = styled(DatePicker)<{
  customheight: string;
  customradius: string;
  custombg: string;
  customcolor: string;
  customsize: string;
  customborder: string;
}>(({ customheight, customradius, custombg, customcolor, customsize, customborder }) => ({
  width: "100%",
  margin: 0,
  "& .MuiOutlinedInput-root": {
    height: `${customheight} !important`,
    minHeight: `${customheight} !important`,
    maxHeight: `${customheight} !important`,
    borderRadius: `${customradius} !important`,
    backgroundColor: `${custombg} !important`,
    paddingRight: "8px !important",
    boxSizing: "border-box !important",
  },
  "& .MuiOutlinedInput-input": {
    fontSize: `${customsize} !important`,
    color: `${customcolor} !important`,
    fontWeight: "500 !important",
    padding: "0px 12px !important",
    height: "100% !important",
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box !important",
    cursor: "pointer !important",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: `${customborder} !important`,
    borderRadius: `${customradius} !important`,
    borderWidth: "1px !important",
    top: 0,
    "& legend": {
      display: "none !important", // Disables floating label gap for custom forms
    },
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#1765a4 !important",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#1765a4 !important",
    borderWidth: "1.5px !important",
  },
  "& .MuiInputAdornment-root": {
    color: "#1765a4 !important",
    margin: 0,
  },
  "& .MuiSvgIcon-root": {
    fontSize: "18px !important",
  },
}));

export default function FunDatePicker(props: FunDatePickerProps) {
  const { 
    value, onChange, label, placeholder = "MM/DD/YYYY", className = "", 
    borderRadius, backgroundColor, textColor, fontSize, height, borderColor 
  } = props;

  // 🚨 STANDARD MODE: Used in Signup.tsx (Because no 'height' prop is passed)
  if (!height) {
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          label={label || undefined}
          value={value ? dayjs(value) : null}
          onChange={(newValue: any) => onChange(newValue ? newValue.toISOString() : null)}
          slots={{ openPickerIcon: CalendarToday }}
          slotProps={{
            textField: {
              fullWidth: true,
              className: className,
              inputProps: { readOnly: true }, 
              sx: {
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px", 
                  backgroundColor: "white",
                },
                "& .MuiSvgIcon-root": {
                  color: "#1765a4",
                }
              },
            } as any, // 🚨 Added `as any` here to fix TS(2353) in standard mode
          }}
        />
      </LocalizationProvider>
    );
  }

  // 🚨 RIGID MODE: Used in CounselorAdmissionsDesk & Calendar
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <CustomStyledDatePicker
        label={label || undefined}
        value={value ? dayjs(value) : null}
        onChange={(newValue: any) => onChange(newValue ? newValue.toISOString() : null)}
        slots={{ openPickerIcon: CalendarToday }}
        slotProps={{
          textField: {
            fullWidth: true,
            size: "small", 
            className: className,
            placeholder: placeholder,
            inputProps: { readOnly: true },
          } as any, // TS(2353) fix for rigid mode
        }}
        customheight={height}
        customradius={borderRadius || "10px"}
        custombg={backgroundColor || "white"}
        customcolor={textColor || "#1e293b"}
        customsize={fontSize || "13px"}
        customborder={borderColor || "#e2e8f0"}
      />
    </LocalizationProvider>
  );
}