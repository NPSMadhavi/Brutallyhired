import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { EXPERIENCE_BANDS, NOTICE_PERIODS } from "../enums.js";

/**
 * Character-by-character English name validation without regular expressions.
 * Rules:
 * 1. Only English alphabetic characters (A-Z, a-z).
 * 2. No numbers (0-9).
 * 3. No special characters, hyphens (-), apostrophes ('), dots (.), underscores (_).
 * 4. No leading or trailing spaces.
 * 5. Allow single space between multiple words.
 * 6. Do not allow consecutive spaces.
 * 7. Enforces minLength and maxLength.
 */
export function validateEnglishName(
  val: unknown,
  fieldName: "First name" | "Last name",
  minLength: number,
  maxLength = 50,
): { valid: boolean; error?: string } {
  if (typeof val !== "string" || val.length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Check leading or trailing spaces
  if (val.charCodeAt(0) === 32 || val.charCodeAt(val.length - 1) === 32) {
    return { valid: false, error: `${fieldName} must not have leading or trailing spaces` };
  }

  if (val.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} character${minLength > 1 ? "s" : ""}`,
    };
  }

  if (val.length > maxLength) {
    return { valid: false, error: `${fieldName} cannot exceed ${maxLength} characters` };
  }

  let prevWasSpace = false;
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);

    // English uppercase: 65 ('A') to 90 ('Z')
    // English lowercase: 97 ('a') to 122 ('z')
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      prevWasSpace = false;
      continue;
    }

    // Single space between words: 32 (' ')
    if (code === 32) {
      if (prevWasSpace) {
        return { valid: false, error: `${fieldName} cannot contain consecutive spaces` };
      }
      prevWasSpace = true;
      continue;
    }

    // Specific rejection messages based on character
    if (code >= 48 && code <= 57) {
      return { valid: false, error: `${fieldName} cannot contain numbers` };
    }
    if (code === 45) {
      return { valid: false, error: `${fieldName} cannot contain hyphens` };
    }
    if (code === 39 || code === 8217 || code === 8216) {
      return { valid: false, error: `${fieldName} cannot contain apostrophes` };
    }
    if (code === 46 || code === 95) {
      return { valid: false, error: `${fieldName} cannot contain dots or underscores` };
    }

    return {
      valid: false,
      error: `${fieldName} can only contain English letters and single spaces between words`,
    };
  }

  return { valid: true };
}

/**
 * Character-by-character City validation without regular expressions.
 * Rules:
 * 1. Required, length 2 to 100 characters.
 * 2. Only English alphabetic characters and single spaces between words.
 * 3. No numbers or special characters.
 * 4. No leading or trailing spaces.
 * 5. No consecutive spaces.
 */
export function validateCity(val: unknown): { valid: boolean; error?: string } {
  if (typeof val !== "string" || val.length === 0) {
    return { valid: false, error: "Current city is required" };
  }

  if (val.charCodeAt(0) === 32 || val.charCodeAt(val.length - 1) === 32) {
    return { valid: false, error: "City must not have leading or trailing spaces" };
  }

  if (val.length < 2) {
    return { valid: false, error: "City must be at least 2 characters" };
  }

  if (val.length > 100) {
    return { valid: false, error: "City cannot exceed 100 characters" };
  }

  let prevWasSpace = false;
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);

    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      prevWasSpace = false;
      continue;
    }

    if (code === 32) {
      if (prevWasSpace) {
        return { valid: false, error: "City cannot contain consecutive spaces" };
      }
      prevWasSpace = true;
      continue;
    }

    if (code >= 48 && code <= 57) {
      return { valid: false, error: "City cannot contain numbers" };
    }

    return {
      valid: false,
      error: "City can only contain English letters and single spaces between words",
    };
  }

  return { valid: true };
}

/**
 * Country-specific mobile number validation using libphonenumber-js.
 * Enforces exact digit constraints and country-specific error messages.
 */
export function validatePhoneNumber(val: unknown): { valid: boolean; error?: string } {
  if (typeof val !== "string" || !val.trim()) {
    return { valid: false, error: "Mobile number is required" };
  }

  const trimmed = val.trim();
  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed) {
    return { valid: false, error: "Please enter a valid international mobile number" };
  }

  const country = parsed.country;
  const nationalDigits = parsed.nationalNumber;

  if (country === "SG") {
    if (nationalDigits.length !== 8) {
      return { valid: false, error: "Singapore mobile number must contain exactly 8 digits" };
    }
  } else if (country === "IN") {
    if (nationalDigits.length !== 10) {
      return { valid: false, error: "Indian mobile number must contain exactly 10 digits" };
    }
  } else if (country === "US" || country === "CA") {
    if (nationalDigits.length !== 10) {
      return { valid: false, error: "US/Canada mobile number must contain exactly 10 digits" };
    }
  } else if (country === "GB") {
    if (nationalDigits.length < 10 || nationalDigits.length > 11) {
      return { valid: false, error: "UK mobile number must contain 10 to 11 digits" };
    }
  }

  if (!parsed.isValid()) {
    const countryNames: Record<string, string> = {
      SG: "Singapore",
      IN: "Indian",
      US: "US",
      CA: "Canada",
      GB: "UK",
      AE: "UAE",
      AU: "Australian",
    };
    const prefix = country && countryNames[country] ? `${countryNames[country]} ` : "";
    return { valid: false, error: `Please enter a valid ${prefix}mobile number` };
  }

  return { valid: true };
}

export const profileSchema = z.object({
  firstName: z
    .string({ required_error: "First name is required" })
    .superRefine((val, ctx) => {
      const res = validateEnglishName(val, "First name", 2, 50);
      if (!res.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error,
        });
      }
    }),
  lastName: z
    .string({ required_error: "Last name is required" })
    .superRefine((val, ctx) => {
      const res = validateEnglishName(val, "Last name", 1, 50);
      if (!res.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error,
        });
      }
    }),
  phone: z
    .string({ required_error: "Mobile number is required" })
    .superRefine((val, ctx) => {
      const res = validatePhoneNumber(val);
      if (!res.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error,
        });
      }
    }),
  city: z
    .string({ required_error: "Current city is required" })
    .superRefine((val, ctx) => {
      const res = validateCity(val);
      if (!res.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error,
        });
      }
    }),
  experience: z.enum(EXPERIENCE_BANDS, {
    errorMap: () => ({ message: "Please select your total work experience" }),
  }),
  noticePeriod: z.enum(NOTICE_PERIODS, {
    errorMap: () => ({ message: "Please select your notice period" }),
  }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const resumeSummarySchema = z.object({
  currentRole: z.string().trim().max(200).optional(),
  totalExperience: z.string().trim().max(100).optional(),
  education: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  skills: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  certifications: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});
export type ResumeSummary = z.infer<typeof resumeSummarySchema>;

export const answerValueSchema = z.union([z.string().max(4000), z.number()]);

export const draftUpdateSchema = z.object({
  coverLetterText: z.string().trim().max(4000).nullable().optional(),
  answers: z.record(z.string(), answerValueSchema).optional(),
});
export type DraftUpdate = z.infer<typeof draftUpdateSchema>;

export const submitApplicationSchema = z.object({
  consentAccuracy: z.literal(true),
  consentPrivacy: z.literal(true),
  talentPool: z.boolean().default(false),
});
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
