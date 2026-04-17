import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export default function PaymentPendingPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          <Clock className="h-16 w-16 text-yellow-500 mx-auto" />
          <CardTitle className="mt-4">Pago pendiente</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Tu pago está pendiente de confirmación (Abitab, RedPagos o transferencia). Te acreditaremos los créditos automáticamente cuando se confirme.
          </p>
          <Button asChild className="w-full">
            <Link to="/app">Volver a la app</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
