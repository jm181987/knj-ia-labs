import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import knjLogo from "@/assets/knj-logo.png";

export default function UploadPolicyPage() {
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
        <article className="prose prose-invert max-w-none prose-headings:tracking-tight prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-10 prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
          <h1>Política de Subida y Contenido – KNJ PRO</h1>
          <p><em>Última actualización: Abril 2026</em></p>

          <h2>1. Contenido Prohibido</h2>
          <ul>
            <li>Desnudez real o simulada de menores de edad.</li>
            <li>Contenido sexualmente explícito, violento, racista, homofóbico o difamatorio.</li>
            <li>Generación de deepfakes con personas reales sin autorización.</li>
            <li>Violación de derechos de autor, marcas, patentes o secretos comerciales.</li>
            <li>Subida de imágenes maliciosas, scripts o archivos que contengan malware.</li>
          </ul>

          <h2>2. Derechos de Autor y Uso de IA</h2>
          <ul>
            <li>El usuario es responsable de garantizar que los prompts e imágenes subidas no contengan material protegido.</li>
            <li>KNJ PRO podrá remover cualquier contenido sospechoso sin previo aviso.</li>
            <li>El contenido generado por IA puede contener elementos sintéticos; el usuario debe revelar el uso de IA en contextos comerciales cuando la ley lo requiera.</li>
            <li><strong>Fotos, videos o audios de celebridades, influencers o figuras públicas sin autorización legal.</strong></li>
            <li><strong>Contenido protegido por derechos de autor, marca o cualquier derecho de propiedad intelectual sin autorización.</strong></li>
            <li><strong>Rostros o voces de terceros sin consentimiento explícito del titular.</strong></li>
          </ul>

          <h2>3. Transparencia sobre Contenido Público</h2>
          <p>
            <strong>IMPORTANTE:</strong> Todo el contenido generado (imágenes, videos y audio) puede
            ser almacenado en buckets públicos y accesible por cualquier persona con la URL. No
            genere contenido sensible o privado que no desee que sea potencialmente accedido por
            terceros.
          </p>

          <h2>4. Declaración de Derechos</h2>
          <p>Al enviar cualquier contenido a la plataforma, el usuario declara y garantiza que:</p>
          <ul>
            <li><strong>Posee todos los derechos, licencias y autorizaciones necesarios sobre el contenido enviado;</strong></li>
            <li>El envío no viola derechos de terceros, incluidos derechos de autor, derechos de imagen, derechos de voz y derechos de propiedad intelectual;</li>
            <li>Asume total responsabilidad por cualquier reclamo de terceros relacionado con el contenido enviado.</li>
          </ul>
          <p>
            El envío de contenido a la plataforma implica automáticamente la aceptación de esta
            declaración. El contenido enviado en violación de estos términos podrá ser removido y la
            cuenta del usuario suspendida.
          </p>

          <h2>5. Reportes</h2>
          <p>
            Si detecta contenido en la plataforma que viola esta política, contáctenos a través del
            botón de WhatsApp para reportarlo. Revisaremos el caso y tomaremos las medidas
            correspondientes.
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
