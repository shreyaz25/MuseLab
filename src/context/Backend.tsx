import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { AnalysisResult, BackendConfig } from "../api/types";

type Status = "checking" | "online" | "offline";

interface BackendCtx {
  status: Status;
  config: BackendConfig | null;
  recheck: () => void;
}
const Ctx = createContext<BackendCtx>({ status: "checking", config: null, recheck: () => {} });
export const useBackend = () => useContext(Ctx);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await api.health();
        const cfg = await api.config().catch(() => null);
        if (!cancelled) {
          setStatus("online");
          if (cfg) setConfig(cfg);
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tick]);

  return <Ctx.Provider value={{ status, config, recheck: () => setTick((t) => t + 1) }}>{children}</Ctx.Provider>;
}

// The analysis from the Studio, held in memory until the user saves it.
interface CurrentCtx {
  current: AnalysisResult | null;
  setCurrent: (a: AnalysisResult | null) => void;
}
const CurrentContext = createContext<CurrentCtx>({ current: null, setCurrent: () => {} });
export const useCurrentAnalysis = () => useContext(CurrentContext);
export function CurrentAnalysisProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  return <CurrentContext.Provider value={{ current, setCurrent }}>{children}</CurrentContext.Provider>;
}
