import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import knjLogo from "@/assets/knj-logo.png";

export default function CreditsPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-background/60 border-b border-border/60">
        <div className="max-w-4xl mx-auto h-16 px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={knjLogo} alt="KNJ PRO" className="h-10 w-10 object-contain" />
            <span className="font-bold text-lg tracking-tight">
              KNJ<span className="text-gradient"> PRO</span>
            </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <article className="prose prose-invert max-w-none prose-headings:tracking-tight prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-lg prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
          <h1>Política de Créditos – KNJ PRO</h1>
          <p><em>Última actualización: Abril 2026</em></p>

          <h2>1. Sistema de Créditos</h2>
          <p>
            Los créditos son la moneda interna de KNJ PRO, utilizada para generar imágenes, videos,
            avatares y demás contenidos disponibles en la plataforma. Cada modelo y tipo de
            generación tiene un costo específico en créditos, publicado y siempre visible en la
            sección de <Link to="/app/pricing">Precios</Link> dentro de la plataforma.
          </p>

          <h2>2. Adquisición de Créditos</h2>
          <ul>
            <li>Los créditos se adquieren mediante <strong>compra puntual</strong> de paquetes precargados o por <strong>monto personalizado</strong> definido por el usuario, con un mínimo establecido.</li>
            <li>Los precios están expresados en <strong>pesos uruguayos (UYU)</strong>.</li>
            <li>Los pagos son procesados a través de <strong>Mercado Pago</strong>, en entorno seguro (SSL/TLS), conforme a las políticas del operador.</li>
            <li>Los créditos se acreditan automáticamente en la cuenta del usuario una vez que Mercado Pago confirma el pago como aprobado.</li>
          </ul>

          <h2>3. Vigencia de los Créditos</h2>
          <ul>
            <li>Los créditos comprados <strong>no tienen fecha de expiración</strong> y permanecen disponibles en el saldo del usuario hasta ser consumidos.</li>
            <li>KNJ PRO no opera con renovaciones automáticas ni suscripciones recurrentes — todas las compras son puntuales.</li>
            <li>El saldo de créditos puede consultarse en cualquier momento desde el panel de la plataforma.</li>
          </ul>

          <h2>4. Consumo de Créditos</h2>
          <ul>
            <li>Los créditos se descuentan al iniciar cada generación, según el modelo y parámetros seleccionados.</li>
            <li><strong>El consumo ocurre por intento de generación</strong>, independientemente del resultado final, incluyendo casos de error del proveedor de IA, timeout o insatisfacción con el resultado.</li>
            <li>Los costos de cada modelo pueden variar según cambios en los precios de los proveedores de IA. KNJ PRO actualizará los costos publicados cuando esto ocurra.</li>
            <li>En caso de <strong>falla técnica comprobada</strong> del lado de la plataforma o del proveedor, los créditos serán reintegrados automáticamente al saldo del usuario.</li>
          </ul>

          <h2>5. Reglas Generales</h2>
          <ul>
            <li>Los créditos son <strong>personales e intransferibles</strong>. No pueden ser cedidos, vendidos ni canjeados a terceros.</li>
            <li>Los créditos <strong>no son convertibles a dinero</strong> ni reembolsables una vez consumidos.</li>
            <li>KNJ PRO se reserva el derecho de ajustar los valores en créditos de los modelos y servicios según los costos operativos de las APIs de IA integradas.</li>
            <li>Cualquier ajuste en costos será comunicado y reflejado en la sección de Precios dentro de la plataforma.</li>
          </ul>

          <h2>6. Reembolsos</h2>
          <p>
            Los reembolsos sólo aplican cuando lo exija la ley o ante una <strong>falla del servicio
            comprobada e imputable a KNJ PRO</strong>. No corresponden reembolsos por:
          </p>
          <ul>
            <li>Créditos ya consumidos en generaciones, incluso si el resultado no fue satisfactorio;</li>
            <li>Resultados generados que no cumplan con las expectativas del usuario;</li>
            <li>Bloqueos, rechazos o limitaciones impuestas por los modelos de IA o sus proveedores;</li>
            <li>Indisponibilidad temporal de modelos específicos cuando existan alternativas en la plataforma;</li>
            <li>Suspensión o cancelación de cuenta por violación de los Términos de Uso o Política de Contenido.</li>
          </ul>

          <h2>7. Créditos y Proveedores de IA</h2>
          <p>El usuario reconoce que:</p>
          <ul>
            <li>Los costos en créditos pueden variar según cambios en los precios de los proveedores de IA;</li>
            <li>Las fallas externas de los proveedores pueden ocasionar pérdida de créditos, los cuales serán reintegrados automáticamente cuando sea posible;</li>
            <li>KNJ PRO no es responsable por la pérdida de créditos derivada de la indisponibilidad de proveedores externos;</li>
            <li>Los modelos de IA pueden ser removidos o reemplazados, alterando los costos de generación.</li>
          </ul>

          <h2>8. Uso Fraudulento</h2>
          <p>
            En caso de detectarse uso fraudulento, abuso del sistema, contracargos indebidos en
            Mercado Pago o violación de los Términos de Uso, KNJ PRO podrá suspender la cuenta y
            retener los créditos restantes, sin derecho a reembolso.
          </p>

          <h2>9. Soporte y Contacto</h2>
          <p>
            Para reclamos relacionados con compras de créditos, fallas en generaciones o reintegros
            no procesados, contáctenos a través del botón de WhatsApp disponible en la plataforma.
            Le pedimos tener a mano el ID de la operación de Mercado Pago y, si corresponde, el ID
            de la generación afectada.
          </p>
        </article>
      </main>

      <footer className="border-t border-border/60 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} KNJ PRO — Todos los derechos reservados
        </div>
      </footer>
    </div>
  );
}
