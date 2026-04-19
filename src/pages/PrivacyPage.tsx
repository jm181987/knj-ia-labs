import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import knjLogo from "@/assets/knj-logo.png";

export default function PrivacyPage() {
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
          <h1>Política de Privacidad – KNJ PRO</h1>
          <p><em>Última actualización: Abril 2026</em></p>

          <h2>1. Datos Recopilados</h2>
          <ul>
            <li><strong>Registro:</strong> nombre, correo electrónico, contraseña e información de pago (procesada por Mercado Pago).</li>
            <li><strong>Uso:</strong> registros de acceso, prompts, imágenes y videos generados.</li>
            <li><strong>Cookies:</strong> utilizadas únicamente para autenticación y análisis de uso.</li>
          </ul>

          <h2>2. Finalidad</h2>
          <ul>
            <li>Operar, mantener y mejorar la plataforma.</li>
            <li>Procesar pagos y créditos.</li>
            <li>Detectar abuso y violaciones de las políticas.</li>
            <li>Generar contenido a través de modelos de IA de terceros.</li>
            <li>Integrar con APIs de proveedores de IA para procesar las solicitudes.</li>
          </ul>

          <h2>3. Compartición</h2>
          <p>Los datos pueden ser procesados por subprocesadores de confianza:</p>
          <ul>
            <li>Infraestructura cloud y hosting (proveedores de nube confiables).</li>
            <li>Proveedores de IA (Wavespeed, Kling, ByteDance, ElevenLabs, entre otros) — los prompts, imágenes, videos y audio son enviados exclusivamente para procesamiento, sin almacenamiento permanente por parte de los proveedores.</li>
            <li>Mercado Pago — procesamiento de transacciones financieras.</li>
            <li>WhatsApp — únicamente cuando el usuario inicia el contacto a través del botón flotante.</li>
            <li>La lista completa de subprocesadores puede actualizarse en cualquier momento; la versión vigente estará disponible en esta página.</li>
          </ul>

          <h2>4. Seguridad</h2>
          <ul>
            <li>Cifrado en reposo y en tránsito (TLS 1.2+).</li>
            <li>Acceso restringido mediante autenticación y políticas de seguridad a nivel de fila (RLS).</li>
            <li>Monitoreo continuo y respaldos automáticos.</li>
          </ul>

          <h2>5. Derechos del Titular</h2>
          <p>El usuario puede solicitar:</p>
          <ul>
            <li>Acceso, corrección, portabilidad y eliminación de sus datos.</li>
            <li>Revocación del consentimiento.</li>
          </ul>
          <p>
            Las solicitudes pueden enviarse a través del botón de WhatsApp disponible en la
            plataforma.
          </p>

          <h2>6. Retención</h2>
          <p>
            Los datos son conservados por el tiempo necesario para las operaciones y obligaciones
            legales. Tras la terminación de la cuenta, son anonimizados o eliminados.
          </p>

          <h2>7. Transferencia Internacional</h2>
          <p>
            KNJ PRO utiliza infraestructura y proveedores de IA ubicados fuera de Uruguay. Al usar la
            plataforma, sus datos personales, prompts, imágenes, videos y audio pueden ser
            transferidos a servidores localizados en las siguientes regiones:
          </p>
          <ul>
            <li>Estados Unidos (proveedores de IA, Mercado Pago internacional, infraestructura cloud);</li>
            <li>China (ByteDance/Seedance, Kuaishou/Kling — vía proveedores intermediarios);</li>
            <li>Singapur y otros países de Asia (Wavespeed y similares);</li>
            <li>Unión Europea (infraestructura cloud complementaria).</li>
          </ul>
          <p>
            La transferencia internacional se realiza con base en: (a) consentimiento específico del
            titular al aceptar los Términos de Uso; (b) cláusulas contractuales estándar con los
            proveedores; (c) necesidad de la transferencia para la ejecución del contrato de servicio.
          </p>
          <p>
            KNJ PRO adopta medidas técnicas y organizativas para garantizar que los datos transferidos
            internacionalmente reciban un nivel adecuado de protección.
          </p>

          <h2>8. Uso de Datos en Inteligencia Artificial</h2>
          <p>Al usar las herramientas de IA de la plataforma, sus datos pueden ser utilizados para:</p>
          <ul>
            <li>Generación de contenido conforme a su solicitud (imágenes, videos, audio, texto);</li>
            <li>Procesamiento de prompts, imágenes y audio por proveedores de IA;</li>
            <li>Mejora de la experiencia del usuario y optimización de los modelos disponibles.</li>
          </ul>
          <p>
            <strong>KNJ PRO no utiliza sus datos para entrenar modelos de IA propios.</strong> Los datos enviados a los
            proveedores están sujetos a la política de privacidad de cada proveedor.
          </p>

          <h2>9. Imagen, Voz y Datos Biométricos</h2>
          <p>
            KNJ PRO reconoce que las imágenes faciales, grabaciones de voz y videos que contengan
            personas identificables constituyen datos personales y pueden clasificarse como datos
            personales sensibles cuando se utilizan con fines de identificación biométrica.
          </p>
          <ul>
            <li>Las imágenes faciales subidas para la creación de avatares o generación de video se procesan exclusivamente con la finalidad solicitada por el usuario;</li>
            <li>Las grabaciones de voz subidas para clonación son tratadas como datos personales y procesadas por proveedores de IA según sus respectivas políticas;</li>
            <li>KNJ PRO no realiza identificación biométrica autónoma — el procesamiento biométrico, cuando ocurre, lo realizan proveedores externos de IA;</li>
            <li>El usuario consiente expresamente el procesamiento de estos datos al aceptar los Términos de Uso y subir contenido con imagen o voz.</li>
          </ul>

          <h2>10. Menores de Edad</h2>
          <p>
            La plataforma KNJ PRO no está dirigida a menores de 18 años. No recopilamos
            intencionalmente datos personales de menores. Si tomamos conocimiento de que un menor ha
            proporcionado datos, los eliminaremos a la brevedad.
          </p>

          <h2>11. Cambios a esta Política</h2>
          <p>
            KNJ PRO puede actualizar esta Política de Privacidad en cualquier momento. La versión
            vigente estará siempre disponible en esta página, con la fecha de última actualización.
          </p>

          <h2>12. Contacto</h2>
          <p>
            Para ejercer sus derechos, realizar consultas o reportar incidentes relacionados con sus
            datos personales, contáctenos a través del botón de WhatsApp disponible en la plataforma.
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
