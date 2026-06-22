import { useEffect, useState } from 'react';

/**
 * Default brand name shown when no company name has been set in Parametres.
 */
export const DEFAULT_COMPANY_NAME = 'SmartGestion';

const CACHED_PARAMS_KEY = 'pg_cached_params';

/** Custom event fired (same-tab) when company params are updated. */
export const COMPANY_PARAMS_UPDATED_EVENT = 'pg:company-params-updated';

function readCompanyName(): string {
  try {
    const raw = localStorage.getItem(CACHED_PARAMS_KEY);
    if (!raw) return DEFAULT_COMPANY_NAME;
    const data = JSON.parse(raw);
    const name = (data?.nomSociete || data?.nom_societe || data?.nom || '').toString().trim();
    return name || DEFAULT_COMPANY_NAME;
  } catch {
    return DEFAULT_COMPANY_NAME;
  }
}

/**
 * Reactively returns the company name set in Parametres (société),
 * falling back to {@link DEFAULT_COMPANY_NAME} ("SmartGestion") by default.
 *
 * Updates automatically when settings are saved (same tab via custom event,
 * or other tabs via the storage event).
 */
export function useCompanyName(): string {
  const [name, setName] = useState<string>(() => readCompanyName());

  useEffect(() => {
    const update = () => setName(readCompanyName());

    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHED_PARAMS_KEY || e.key === null) update();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(COMPANY_PARAMS_UPDATED_EVENT, update);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COMPANY_PARAMS_UPDATED_EVENT, update);
    };
  }, []);

  return name;
}
