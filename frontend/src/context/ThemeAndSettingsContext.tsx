import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../utils/api';

export type AppTheme = 'emerald' | 'navy' | 'amber' | 'dark';
export type FontSize = 'normal' | 'large' | 'xlarge';

export interface Sheikh {
  id: number;
  name: string;
  username?: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  recordedSessionsCount?: number;
}

export interface CustomHoliday {
  id: string;
  date: string; // 'YYYY-MM-DD'
  name: string; // e.g. 'إجازة الشيخ'
  reason?: string; // e.g. 'ظرف طارئ خاص بالشيخ'
}

export const WEEK_DAYS = [
  { id: 'saturday', name: 'السبت', short: 'سبت', index: 6 },
  { id: 'sunday', name: 'الأحد', short: 'أحد', index: 0 },
  { id: 'monday', name: 'الاثنين', short: 'اثنين', index: 1 },
  { id: 'tuesday', name: 'الثلاثاء', short: 'ثلاثاء', index: 2 },
  { id: 'wednesday', name: 'الأربعاء', short: 'أربعاء', index: 3 },
  { id: 'thursday', name: 'الخميس', short: 'خميس', index: 4 },
  { id: 'friday', name: 'الجمعة', short: 'جمعة', index: 5 },
] as const;

export interface HolidayInfo {
  isHoliday: boolean;
  isWeeklyHoliday: boolean;
  isCustomHoliday: boolean;
  holidayName?: string;
  holidayReason?: string;
  dayName: string;
  dayKey: string;
}

interface SettingsContextType {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  holidayDays: string[];
  setHolidayDays: (days: string[]) => void;
  saveHolidays: (days: string[]) => Promise<void>;
  customHolidays: CustomHoliday[];
  addCustomHoliday: (holiday: { date: string; name: string; reason?: string }) => Promise<void>;
  deleteCustomHoliday: (id: string) => Promise<void>;
  isHoliday: (date: Date | string) => boolean;
  getHolidayInfo: (date: Date | string) => HolidayInfo;
  getDayInfo: (date: Date | string) => { isHoliday: boolean; dayName: string; dayKey: string };
  sheikhs: Sheikh[];
  activeSheikh: Sheikh | null;
  setActiveSheikh: (s: Sheikh | null) => void;
  refetchSheikhs: () => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function ThemeAndSettingsProvider({ children }: { children: ReactNode }) {
  // 1. Theme State
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem('kittab_theme') as AppTheme) || 'emerald';
  });

  // 2. Font Size State
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    return (localStorage.getItem('kittab_font_size') as FontSize) || 'normal';
  });

  // 3. Holiday Days State (Default: Thursday & Friday)
  const [holidayDays, setHolidayDaysState] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('kittab_holiday_days');
      if (cached) return JSON.parse(cached);
    } catch {}
    return ['thursday', 'friday'];
  });

  // 3.1 Custom Specific Holidays State (e.g. 2026-04-29 with note/reason)
  const [customHolidays, setCustomHolidaysState] = useState<CustomHoliday[]>(() => {
    try {
      const cached = localStorage.getItem('kittab_custom_holidays');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });

  // 4. Sheikhs & Active Sheikh State
  const [sheikhs, setSheikhs] = useState<Sheikh[]>([]);
  const [activeSheikh, setActiveSheikhState] = useState<Sheikh | null>(() => {
    try {
      const cached = localStorage.getItem('kittab_active_sheikh');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Apply Theme & Font Size to Document Root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kittab_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('kittab_font_size', fontSize);
  }, [fontSize]);

  // Fetch initial settings & sheikhs from backend
  const fetchSettingsAndSheikhs = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, sheikhsRes] = await Promise.allSettled([
        api.get('/settings'),
        api.get('/sheikhs'),
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
        const data = settingsRes.value.data;
        if (Array.isArray(data.holidayDays)) {
          setHolidayDaysState(data.holidayDays);
          localStorage.setItem('kittab_holiday_days', JSON.stringify(data.holidayDays));
        }
        if (Array.isArray(data.customHolidays)) {
          setCustomHolidaysState(data.customHolidays);
          localStorage.setItem('kittab_custom_holidays', JSON.stringify(data.customHolidays));
        }
        if (data.theme && ['emerald', 'navy', 'amber', 'dark'].includes(data.theme)) {
          setThemeState(data.theme);
        }
        if (data.fontSize && ['normal', 'large', 'xlarge'].includes(data.fontSize)) {
          setFontSizeState(data.fontSize);
        }
      }

      if (sheikhsRes.status === 'fulfilled' && Array.isArray(sheikhsRes.value.data)) {
        const list = sheikhsRes.value.data;
        setSheikhs(list);

        // If there is a logged-in sheikh, prioritize setting him as active
        try {
          const cachedUser = localStorage.getItem('kittab_user');
          if (cachedUser) {
            const parsed = JSON.parse(cachedUser);
            const found = list.find((s: Sheikh) => s.id === parsed.id);
            if (found && found.isActive) {
              setActiveSheikhState(found);
              localStorage.setItem('kittab_active_sheikh', JSON.stringify(found));
              return;
            }
          }
        } catch {}

        // Fallback: If no active sheikh is set, auto-select the first active sheikh
        setActiveSheikhState((current) => {
          if (current) {
            const found = list.find((s: Sheikh) => s.id === current.id);
            if (found && found.isActive) return found;
          }
          const firstActive = list.find((s: Sheikh) => s.isActive) || list[0] || null;
          if (firstActive) {
            localStorage.setItem('kittab_active_sheikh', JSON.stringify(firstActive));
          }
          return firstActive;
        });
      }
    } catch (err) {
      console.error('Failed to load initial settings / sheikhs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndSheikhs();
  }, []);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    api.post('/settings', { theme: t }).catch(() => {});
  };

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    api.post('/settings', { fontSize: s }).catch(() => {});
  };

  const setHolidayDays = (days: string[]) => {
    setHolidayDaysState(days);
    localStorage.setItem('kittab_holiday_days', JSON.stringify(days));
  };

  const saveHolidays = async (days: string[]) => {
    setHolidayDays(days);
    await api.post('/settings', { holidayDays: days });
  };

  const addCustomHoliday = async (item: { date: string; name: string; reason?: string }) => {
    const newHoliday: CustomHoliday = {
      id: `${item.date}-${Date.now()}`,
      date: item.date,
      name: item.name.trim(),
      reason: item.reason?.trim() || '',
    };
    const updated = [
      ...customHolidays.filter((h) => h.date !== item.date),
      newHoliday,
    ].sort((a, b) => a.date.localeCompare(b.date));

    setCustomHolidaysState(updated);
    localStorage.setItem('kittab_custom_holidays', JSON.stringify(updated));
    await api.post('/settings', { customHolidays: updated });
  };

  const deleteCustomHoliday = async (id: string) => {
    const updated = customHolidays.filter((h) => h.id !== id && h.date !== id);
    setCustomHolidaysState(updated);
    localStorage.setItem('kittab_custom_holidays', JSON.stringify(updated));
    await api.post('/settings', { customHolidays: updated });
  };

  const setActiveSheikh = (s: Sheikh | null) => {
    setActiveSheikhState(s);
    if (s) {
      localStorage.setItem('kittab_active_sheikh', JSON.stringify(s));
    } else {
      localStorage.removeItem('kittab_active_sheikh');
    }
  };

  const formatDateStr = (date: Date | string): string => {
    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getHolidayInfo = (date: Date | string): HolidayInfo => {
    const dateStr = formatDateStr(date);
    const d = new Date(date);
    const dayIdx = isNaN(d.getTime()) ? 0 : d.getDay();
    const dayObj = WEEK_DAYS.find((w) => w.index === dayIdx) || WEEK_DAYS[0];
    const isWeeklyHoliday = holidayDays.includes(dayObj.id);

    const matchedCustom = customHolidays.find((h) => h.date === dateStr);
    const isCustomHoliday = !!matchedCustom;
    const isHol = isWeeklyHoliday || isCustomHoliday;

    return {
      isHoliday: isHol,
      isWeeklyHoliday,
      isCustomHoliday,
      holidayName: matchedCustom?.name || (isWeeklyHoliday ? `عطلة أسبوعية (${dayObj.name})` : undefined),
      holidayReason: matchedCustom?.reason,
      dayName: dayObj.name,
      dayKey: dayObj.id,
    };
  };

  const isHoliday = (date: Date | string): boolean => {
    return getHolidayInfo(date).isHoliday;
  };

  const getDayInfo = (date: Date | string) => {
    const info = getHolidayInfo(date);
    return {
      isHoliday: info.isHoliday,
      dayName: info.dayName,
      dayKey: info.dayKey,
    };
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        setTheme,
        fontSize,
        setFontSize,
        holidayDays,
        setHolidayDays,
        saveHolidays,
        customHolidays,
        addCustomHoliday,
        deleteCustomHoliday,
        isHoliday,
        getHolidayInfo,
        getDayInfo,
        sheikhs,
        activeSheikh,
        setActiveSheikh,
        refetchSheikhs: fetchSettingsAndSheikhs,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useThemeAndSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useThemeAndSettings must be used within a ThemeAndSettingsProvider');
  }
  return context;
}
