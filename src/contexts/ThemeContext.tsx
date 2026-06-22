import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

interface ThemeContextType {
  primaryColor: string;
  primaryColorOklch: string;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function hexToOklch(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const linearR = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const linearG = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const linearB = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert linear sRGB -> OKLab -> OKLCH so the actual hue/chroma of the
  // chosen colour is preserved (previously the hue was hardcoded to teal).
  const l_ = Math.cbrt(0.4122214708 * linearR + 0.5363325363 * linearG + 0.0514459929 * linearB);
  const m_ = Math.cbrt(0.2119034982 * linearR + 0.6806995451 * linearG + 0.1073969566 * linearB);
  const s_ = Math.cbrt(0.0883024619 * linearR + 0.2817188376 * linearG + 0.6299787005 * linearB);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#C63C4E');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTheme = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('parametres')
          .select('couleur_principale')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data?.couleur_principale) {
          setPrimaryColor(data.couleur_principale);
        }
      } catch (err) {
        console.warn('Error fetching theme:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();
  }, [user]);

  useEffect(() => {
    if (!primaryColor) return;

    const root = document.documentElement;
    const oklchColor = hexToOklch(primaryColor);

    root.style.setProperty('--primary', oklchColor);
    root.style.setProperty('--ring', oklchColor);
    root.style.setProperty('--sidebar-primary', oklchColor);
    root.style.setProperty('--sidebar-ring', oklchColor);
    root.style.setProperty('--chart-1', oklchColor);

    const r = parseInt(primaryColor.slice(1, 3), 16) / 255;
    const g = parseInt(primaryColor.slice(3, 5), 16) / 255;
    const b = parseInt(primaryColor.slice(5, 7), 16) / 255;

    root.style.setProperty('--primary-rgb', `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`);
  }, [primaryColor]);

  return (
    <ThemeContext.Provider 
      value={{ 
        primaryColor, 
        primaryColorOklch: hexToOklch(primaryColor),
        loading 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
