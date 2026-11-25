import { clsx } from "clsx";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { useEffect, useMemo, useRef, useState } from "react";

export function getCountryFlag(countryCode: string): string {
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export interface CountryInfo {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

// Pre-build country list sorted by name
const COUNTRIES: CountryInfo[] = (getCountries() as CountryCode[])
  .map((code) => {
    let name = String(code);
    try {
      name = displayNames.of(code) || String(code);
    } catch {
      name = String(code);
    }
    return {
      code,
      name,
      callingCode: `+${getCountryCallingCode(code)}`,
      flag: getCountryFlag(code),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Priority countries for quick access
const PRIORITY_CODES: CountryCode[] = ["IN", "SG", "US", "GB", "AE", "AU", "CA"];
const PRIORITY_COUNTRIES = PRIORITY_CODES.map((code) =>
  COUNTRIES.find((c) => c.code === code)!,
).filter(Boolean);

// Dynamic country-specific placeholders as requested
export const COUNTRY_PLACEHOLDERS: Record<string, string> = {
  SG: "8123 4567",
  IN: "98765 43210",
  US: "201 555 0123",
  CA: "201 555 0123",
  GB: "7911 123456",
  AU: "412 345 678",
  AE: "50 123 4567",
  DE: "151 23456789",
  FR: "6 12 34 56 78",
  JP: "90 1234 5678",
  CN: "138 0013 8000",
};

// Maximum national digit lengths by country
export const MAX_DIGITS_BY_COUNTRY: Record<string, number> = {
  SG: 8,
  IN: 10,
  US: 10,
  CA: 10,
  GB: 11,
  AU: 9,
  AE: 9,
  DE: 11,
  FR: 9,
  JP: 10,
  CN: 11,
};

/**
 * Filter out non-numeric characters without regular expressions.
 */
function extractDigits(raw: string): string {
  let res = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    // 0-9 char codes: 48-57
    if (code >= 48 && code <= 57) {
      res += raw[i];
    }
  }
  return res;
}

export interface PhoneInputProps {
  id?: string;
  value?: string;
  onChange?: (e164Value: string) => void;
  onBlur?: () => void;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  placeholder?: string;
}

export function PhoneInput({
  id,
  value = "",
  onChange,
  onBlur,
  defaultCountry = "IN",
  disabled = false,
  hasError = false,
  className,
  placeholder,
}: PhoneInputProps) {
  // Determine initial country and national number from value
  const initialCountry = useMemo<CountryInfo>(() => {
    if (value) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.country) {
        const found = COUNTRIES.find((c) => c.code === parsed.country);
        if (found) return found;
      }
    }
    return COUNTRIES.find((c) => c.code === defaultCountry) ?? COUNTRIES[0]!;
  }, [value, defaultCountry]);

  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(initialCountry);
  const [nationalNumber, setNationalNumber] = useState<string>(() => {
    if (value) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.nationalNumber) {
        const digits = extractDigits(parsed.nationalNumber);
        const max = MAX_DIGITS_BY_COUNTRY[parsed.country || defaultCountry] ?? 15;
        return new AsYouType(parsed.country || defaultCountry).input(digits.slice(0, max));
      }
    }
    return "";
  });

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    if (!value) {
      setNationalNumber("");
      return;
    }
    const parsed = parsePhoneNumberFromString(value);
    if (parsed) {
      if (parsed.country && parsed.country !== selectedCountry.code) {
        const found = COUNTRIES.find((c) => c.code === parsed.country);
        if (found) setSelectedCountry(found);
      }
      const digits = extractDigits(parsed.nationalNumber);
      const max = MAX_DIGITS_BY_COUNTRY[parsed.country || selectedCountry.code] ?? 15;
      setNationalNumber(new AsYouType(parsed.country || selectedCountry.code).input(digits.slice(0, max)));
    }
  }, [value, selectedCountry.code]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close dropdown on click outside or escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Filter countries by search query
  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.callingCode.includes(q) ||
        c.code.toLowerCase() === q,
    );
  }, [search]);

  // Compute dynamic placeholder
  const activePlaceholder =
    placeholder || COUNTRY_PLACEHOLDERS[selectedCountry.code] || "98765 43210";

  // Handle typing & pasting in national phone number input
  const handleNumberChange = (raw: string) => {
    const trimmed = raw.trim();

    // If pasted international format starting with + or 00
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
      const parsed = parsePhoneNumberFromString(trimmed);
      if (parsed?.country) {
        const found = COUNTRIES.find((c) => c.code === parsed.country);
        if (found) {
          setSelectedCountry(found);
          const digits = extractDigits(parsed.nationalNumber);
          const maxDigits = MAX_DIGITS_BY_COUNTRY[found.code] ?? 15;
          const truncated = digits.slice(0, maxDigits);
          const formatted = new AsYouType(found.code).input(truncated);
          setNationalNumber(formatted);
          onChange?.(truncated ? `${found.callingCode}${truncated}` : "");
          return;
        }
      }
    }

    // Extract digits only (rejecting letters and symbols)
    const digits = extractDigits(raw);

    // Prevent entering more digits than the country permits
    const maxDigits = MAX_DIGITS_BY_COUNTRY[selectedCountry.code] ?? 15;
    const limitedDigits = digits.slice(0, maxDigits);

    // Format as user types
    const formatted = new AsYouType(selectedCountry.code).input(limitedDigits);
    setNationalNumber(formatted);

    if (!limitedDigits) {
      onChange?.("");
      return;
    }

    const candidate = `${selectedCountry.callingCode}${limitedDigits}`;
    const parsed = parsePhoneNumberFromString(candidate, selectedCountry.code);
    if (parsed) {
      onChange?.(parsed.number);
    } else {
      onChange?.(candidate);
    }
  };

  const handleCountrySelect = (country: CountryInfo) => {
    setSelectedCountry(country);
    setIsOpen(false);

    // Re-format existing national number for the new country
    const digits = extractDigits(nationalNumber);
    if (digits) {
      const maxDigits = MAX_DIGITS_BY_COUNTRY[country.code] ?? 15;
      const truncated = digits.slice(0, maxDigits);
      const formatted = new AsYouType(country.code).input(truncated);
      setNationalNumber(formatted);
      const candidate = `${country.callingCode}${truncated}`;
      const parsed = parsePhoneNumberFromString(candidate, country.code);
      onChange?.(parsed ? parsed.number : candidate);
    } else {
      onChange?.("");
    }
  };

  return (
    <div ref={dropdownRef} className="relative flex w-full">
      {/* Country Selector Trigger matching [IN +91 ▼] */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={clsx(
          "flex items-center gap-1.5 px-3 py-2 min-h-[48px] rounded-l-xl border border-r-0 border-line-2 bg-[#F9FAFB] hover:bg-line-soft text-sm font-medium transition-colors shrink-0 select-none",
          hasError && "!border-danger",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <span className="font-bold text-ink text-[13px] tracking-wide">
          {selectedCountry.code}
        </span>
        <span className="font-semibold text-ink-2 font-mono text-[13px]">
          {selectedCountry.callingCode}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx("text-ink-muted transition-transform ml-0.5", isOpen && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* National Phone Number Input */}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={nationalNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        onBlur={onBlur}
        placeholder={activePlaceholder}
        aria-invalid={hasError}
        className={clsx(
          "w-full flex-1 rounded-r-xl border border-line-2 bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-muted/60 focus:border-brand focus:outline focus:outline-[3px] focus:outline-brand/15 min-h-[48px]",
          hasError && "!border-danger",
          className,
        )}
      />

      {/* Searchable Country Selector Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 w-[330px] max-w-[calc(100vw-32px)] max-h-72 rounded-2xl border border-line-2 bg-white shadow-lift z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-line-soft bg-canvas/50">
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-line bg-white text-ink placeholder:text-ink-muted/70 focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* List of Countries */}
          <div className="overflow-y-auto flex-1 divide-y divide-line-soft/40 py-1">
            {!search && (
              <div className="px-3 py-1.5 text-[11px] font-bold text-ink-muted uppercase tracking-wider bg-canvas/30">
                Suggested
              </div>
            )}
            {!search &&
              PRIORITY_COUNTRIES.map((c) => (
                <button
                  type="button"
                  key={`prio-${c.code}`}
                  onClick={() => handleCountrySelect(c)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors hover:bg-canvas",
                    selectedCountry.code === c.code && "bg-brand/5 font-semibold text-brand",
                  )}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-[11px] text-ink-muted">({c.code})</span>
                  </span>
                  <span className="font-mono text-ink-muted ml-2 shrink-0">{c.callingCode}</span>
                </button>
              ))}

            {!search && (
              <div className="px-3 py-1.5 text-[11px] font-bold text-ink-muted uppercase tracking-wider bg-canvas/30">
                All Countries
              </div>
            )}
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-muted">No countries found</div>
            ) : (
              filteredCountries.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => handleCountrySelect(c)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors hover:bg-canvas",
                    selectedCountry.code === c.code && "bg-brand/5 font-semibold text-brand",
                  )}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-[11px] text-ink-muted">({c.code})</span>
                  </span>
                  <span className="font-mono text-ink-muted ml-2 shrink-0">{c.callingCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
