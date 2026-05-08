import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { storeRef, trackRefClick } from "@/lib/affiliate";

export function AffiliateRefCapture() {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if (ref) {
      storeRef(ref, 90);
      trackRefClick(ref);
    }
  }, [location.search]);
  return null;
}