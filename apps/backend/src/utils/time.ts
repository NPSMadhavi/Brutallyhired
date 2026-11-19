export const minutes = (n: number) => n * 60_000;
export const hours = (n: number) => n * 3_600_000;
export const days = (n: number) => n * 86_400_000;
export const addMs = (d: Date, ms: number) => new Date(d.getTime() + ms);
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
