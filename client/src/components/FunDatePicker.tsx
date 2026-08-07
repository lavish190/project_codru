import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { CalendarToday } from "@mui/icons-material";

interface FunDatePickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  label?: string; // 🚨 NEW: Make label dynamic (optional)
}

// 🚨 NEW: Destructure label with a fallback default
export default function FunDatePicker({ value, onChange, label = "Select Date" }: FunDatePickerProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        value={value ? dayjs(value) : null}
        onChange={(newValue) => {
          onChange(newValue ? newValue.toISOString() : null);
        }}
        slots={{
          openPickerIcon: CalendarToday,
        }}
        slotProps={{
          textField: {
            fullWidth: true,
            label: label, // 🚨 NEW: Use the dynamic label here!
            sx: {
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                backgroundColor: "white",
              },
            },
          },
          inputAdornment: {
            position: "start",
            className: "text-brand-blue", 
          },
          openPickerIcon: {
            className: "text-brand-blue", 
          }
        }}
      />
    </LocalizationProvider>
  );
}