import Select, { type StylesConfig } from "react-select";

export interface AppSelectOption {
  value: string;
  label: string;
}

export interface AppSelectProps {
  options: AppSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  /** Optional: use smaller height (e.g. for pagination) */
  size?: "sm" | "default";
}

const controlHeight = 40;
const controlHeightSm = 32;

export function AppSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  isDisabled = false,
  className = "",
  size = "default",
}: AppSelectProps) {
  const height = size === "sm" ? controlHeightSm : controlHeight;

  const styles: StylesConfig<AppSelectOption, false> = {
    control: (base, state) => ({
      ...base,
      minHeight: height,
      height: height,
      borderRadius: "6px",
      borderWidth: "1px",
      borderColor: state.isFocused ? "hsl(var(--ring))" : "hsl(var(--input))",
      borderStyle: "solid",
      backgroundColor: "hsl(var(--background))",
      "&:hover": {
        borderColor: state.isFocused ? "hsl(var(--ring))" : "hsl(var(--input))",
      },
      boxShadow: state.isFocused ? "0 0 0 2px hsl(var(--ring) / 0.2)" : "none",
    }),
    valueContainer: (base) => ({
      ...base,
      paddingLeft: "12px",
      paddingRight: "8px",
      height: height - 2,
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: "hsl(var(--foreground))",
    }),
    placeholder: (base) => ({
      ...base,
      color: "hsl(var(--muted-foreground))",
    }),
    singleValue: (base) => ({
      ...base,
      color: "hsl(var(--foreground))",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      backgroundColor: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "6px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      fontSize: "14px",
      backgroundColor: state.isFocused ? "hsl(var(--accent))" : "transparent",
      color: state.isFocused ? "hsl(var(--accent-foreground))" : "hsl(var(--foreground))",
      cursor: "pointer",
      paddingTop: "6px",
      paddingBottom: "6px",
      paddingLeft: "12px",
      paddingRight: "12px",
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base) => ({
      ...base,
      paddingLeft: "8px",
      paddingRight: "8px",
      color: "hsl(var(--muted-foreground))",
    }),
  };

  const selectedOption = options.find((opt) => opt.value === value) ?? null;

  return (
    <div className={className}>
      <Select<AppSelectOption, false>
        options={options}
        value={selectedOption}
        onChange={(option) => onChange(option?.value ?? "")}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isSearchable
        isClearable={false}
        menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
        menuPosition="fixed"
        styles={styles}
        classNamePrefix="app-select"
      />
    </div>
  );
}
