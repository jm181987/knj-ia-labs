import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trackMetaEvent } from "@/lib/metaPixel";
import { useAuth } from "@/hooks/useAuth";

export default function PaymentSuccessPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const paymentId = params.get("payment_id");
  const [status, setStatus] = useState<"loading" | "approved" | "pending">("loading");
  const [credits, setCredits] = useState<number | null>(null);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (!paymentId) {
      setStatus("pending");
      return;
    }
    let attempts = 0;
    const poll = async () => {
      const { data } = await (supabase as any)
        .from("payments")
        .select("status, credits, amount_uyu, amount, currency, package_id, type")
        .eq("id", paymentId)
        .maybeSingle();
      if (data?.status === "approved") {
        setStatus("approved");
        setCredits(data.credits);
        if (!tracked) {
          setTracked(true);
          const value = Number(data.amount_uyu ?? data.amount ?? 0);
          const currency = (data.currency as string) || "UYU";
          const isSub = data.type === "subscription";
          trackMetaEvent(
            isSub ? "Subscribe" : "Purchase",
            {
              value,
              currency,
              content_ids: data.package_id ? [String(data.package_id)] : [String(paymentId)],
              content_type: isSub ? "subscription" : "product",
              num_items: 1,
            },
            { email: user?.email },
          );
        }
        return;
      }
      attempts++;
      if (attempts < 8) setTimeout(poll, 2000);
      else setStatus("pending");
    };
    poll();
  }, [paymentId, tracked, user?.email]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          {status === "loading" ? (
            <>
              <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
              <CardTitle className="mt-4">{t("payment.confirming")}</CardTitle>
            </>
          ) : status === "approved" ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <CardTitle className="mt-4">{t("payment.approved")}</CardTitle>
            </>
          ) : (
            <>
              <Loader2 className="h-16 w-16 text-yellow-500 mx-auto" />
              <CardTitle className="mt-4">{t("payment.processing")}</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "approved" && credits !== null ? (
            <>
              <p className="text-muted-foreground">
                {t("payment.creditedPrefix")}{" "}
                <strong className="text-foreground inline-flex items-center gap-1">
                  <Coins className="h-4 w-4 text-primary" /> {credits} {t("common.credits")}
                </strong>{" "}
                {t("payment.creditedSuffix")}
              </p>
              <Button asChild className="w-full">
                <Link to="/app">{t("payment.startGenerating")}</Link>
              </Button>
            </>
          ) : status === "pending" ? (
            <>
              <p className="text-muted-foreground">{t("payment.processingDesc")}</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/app">{t("payment.backToApp")}</Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
