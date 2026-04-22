import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackMetaEvent } from "@/lib/metaPixel";

export function MetaPixelTracker() {
  const location = useLocation();

  useEffect(() => {
    trackMetaEvent("PageView");
  }, [location.pathname, location.search]);

  return null;
}