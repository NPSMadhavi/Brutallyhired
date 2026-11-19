import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "@/components/ui/icons";

type Toast = { id: number; text: string };
const Ctx = createContext<(text: string) => void>(() => undefined);

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(380px,calc(100vw-40px))] flex-col gap-2" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift">
            <span className="flex-1 pt-0.5">{x.text}</span>
            <button type="button" aria-label={t("common.dismiss")} className="rounded-lg p-1 hover:bg-white/10" onClick={() => setItems((xs) => xs.filter((i) => i.id !== x.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
