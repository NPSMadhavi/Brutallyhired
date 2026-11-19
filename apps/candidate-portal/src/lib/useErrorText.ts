import { useTranslation } from "react-i18next";
import { ApiError } from "./api";

/** Map an API error code to translated text, with a generic fallback. */
export function useErrorText() {
  const { t, i18n } = useTranslation();
  return (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "generic";
    const key = `errors.${code}`;
    return i18n.exists(key) ? t(key) : t("errors.generic");
  };
}
