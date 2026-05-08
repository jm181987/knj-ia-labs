import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, Wallet, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const tiers = [
  { name: "Starter", price: "$199 UYU", commission: "15%", note: "comisión única" },
  { name: "Pro", price: "$949 UYU", commission: "30%", note: "comisión única" },
  { name: "Premium", price: "$1.790 UYU", commission: "35%", note: "comisión única" },
  { name: "Suscripción", price: "$900 UYU/mes", commission: "30%", note: "recurrente mensual" },
];

export default function AffiliateLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold">KNJ <span className="text-primary">IA</span></span>
          </Link>
          <Button asChild variant="default"><Link to="/auth?redirect=/app/affiliate">Ser afiliado</Link></Button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" /> Programa de afiliados
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Gana hasta <span className="text-primary">35%</span> recomendando KNJ</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Comparte tu link único, ayudá a creadores a generar contenido con IA y cobra comisiones automáticas.</p>
        <div className="flex justify-center gap-3 pt-4">
          <Button size="lg" asChild><Link to="/auth?redirect=/app/affiliate">Empezar ahora</Link></Button>
          <Button size="lg" variant="outline" asChild><a href="#planes">Ver comisiones</a></Button>
        </div>
      </section>

      <section id="planes" className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Estructura de comisiones</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {tiers.map(t => (
            <Card key={t.name} className="bg-card/60 border-border/60">
              <CardContent className="p-6 space-y-2 text-center">
                <div className="text-sm text-muted-foreground">{t.name}</div>
                <div className="text-2xl font-bold">{t.price}</div>
                <div className="text-3xl font-bold text-primary">{t.commission}</div>
                <div className="text-xs text-muted-foreground">{t.note}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20 grid md:grid-cols-3 gap-6">
        {[
          { icon: Users, title: "Cookie de 90 días", text: "Si alguien hace clic en tu link y compra dentro de 90 días, la venta es tuya." },
          { icon: Wallet, title: "Pagos al saldo", text: "Solicita retiros cuando llegues al mínimo. Te pagamos por PayPal o Mercado Pago." },
          { icon: ShieldCheck, title: "Anti-fraude", text: "Validamos cada conversión. Sin auto-compras, sin trampas, todo limpio." },
        ].map((f, i) => (
          <Card key={i} className="bg-card/60 border-border/60">
            <CardContent className="p-6 space-y-3">
              <f.icon className="h-6 w-6 text-primary" />
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.text}</div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
