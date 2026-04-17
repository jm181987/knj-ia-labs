import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PaymentFailurePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <CardTitle className="mt-4">{t("payment.rejectedTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{t("payment.rejectedDesc")}</p>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/app">{t("common.back")}</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/app/pricing">{t("common.retry")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
