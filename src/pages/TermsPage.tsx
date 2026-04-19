import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import knjLogo from "@/assets/knj-logo.png";

export default function TermsPage() {
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
          <h1>Términos y Condiciones de Uso – KNJ PRO</h1>
          <p><em>Última actualización: Abril 2026</em></p>

          <h2>1. Sobre KNJ PRO</h2>
          <p>
            KNJ PRO es una plataforma de inteligencia artificial que ofrece herramientas
            para la generación de imágenes, videos, avatares y contenido editorial,
            operada a través de infraestructura en la nube e integraciones con APIs de
            modelos de IA de terceros.
          </p>

          <h2>2. Aceptación de los Términos</h2>
          <p>
            KNJ PRO es una plataforma intermediaria que provee acceso a modelos de
            inteligencia artificial de terceros para la generación de imágenes, videos,
            audio y texto. La plataforma no produce, controla ni garantiza los
            resultados generados por las IAs.
          </p>
          <p>El uso de la plataforma implica el consentimiento automático de estos términos.</p>

          <h2>3. Uso de Inteligencia Artificial y Contenido Generado</h2>
          <p>KNJ PRO provee acceso a herramientas de IA suministradas por terceros. El usuario reconoce y acepta que:</p>
          <ul>
            <li>Los modelos disponibles pueden tener limitaciones técnicas, legales y de contenido, y pueden bloquear, rechazar o alterar resultados sin previo aviso;</li>
            <li>La generación de contenido a través de la plataforma no implica autorización legal para su uso, publicación o comercialización;</li>
            <li><strong>El usuario es el único responsable de garantizar que posee todos los derechos, licencias y autorizaciones necesarios para cualquier contenido utilizado como entrada (prompt, imagen, video, audio o referencia);</strong></li>
            <li>KNJ PRO no garantiza que el contenido generado esté libre de derechos de autor, marcas, derechos de imagen, derechos de voz o cualquier otro derecho de terceros;</li>
            <li>El uso del contenido generado debe cumplir con la legislación aplicable, incluyendo derechos de autor, derechos de imagen, protección de datos y competencia.</li>
          </ul>

          <h3>3.1 Uso Aceptable — Modelos de Generación de Video</h3>
          <p>Al utilizar modelos de generación de video con soporte de referencia facial, el usuario adicionalmente acepta que:</p>
          <ul>
            <li>Está expresamente prohibido generar deepfakes, simulaciones o representaciones de figuras públicas, celebridades, políticos o cualquier persona sin consentimiento explícito y documentado;</li>
            <li>Está prohibido crear contenido que infrinja derechos de autor, marcas o propiedad intelectual de terceros (incluyendo personajes de estudios como Disney, Marvel, Warner Bros, etc.);</li>
            <li>El usuario declara ser titular de los derechos sobre todas las imágenes de referencia enviadas y asume total responsabilidad por su uso;</li>
            <li>KNJ PRO implementa filtros de seguridad pero no garantiza el bloqueo total de contenido inapropiado — la responsabilidad final siempre es del usuario;</li>
            <li>Las violaciones pueden resultar en suspensión inmediata de la cuenta sin reembolso de créditos.</li>
          </ul>

          <h2>4. Contenido Prohibido</h2>
          <p>El usuario NO podrá utilizar la plataforma para:</p>
          <ul>
            <li>Generar contenido con personajes, marcas, franquicias u obras protegidas sin autorización expresa;</li>
            <li>Reproducir o simular celebridades, influencers o cualquier persona real sin consentimiento documentado;</li>
            <li>Crear deepfakes engañosos o contenido que induzca a confusión sobre su autenticidad;</li>
            <li>Usar voz o imagen de terceros sin autorización legal;</li>
            <li>Crear contenido fraudulento, engañoso, difamatorio o ilegal;</li>
            <li>Generar contenido que infrinja derechos de autor, marcas o propiedad intelectual;</li>
            <li>Intentar evadir, eludir o manipular filtros de seguridad o restricciones;</li>
            <li>Crear material de abuso infantil, pornografía no consentida o contenido que incite a la violencia o discriminación.</li>
          </ul>
          <p>La violación de estas reglas puede resultar en suspensión inmediata de la cuenta, pérdida de créditos y reporte a las autoridades.</p>

          <h2>5. Responsabilidad del Usuario e Indemnización</h2>
          <p>El usuario declara y garantiza que:</p>
          <ul>
            <li>Posee todos los derechos, licencias y autorizaciones necesarias sobre el contenido enviado a la plataforma;</li>
            <li><strong>Asume total responsabilidad por el uso, publicación, distribución y comercialización del contenido generado;</strong></li>
            <li><strong>Libera a KNJ PRO de cualquier responsabilidad por el uso indebido, ilegal o no autorizado del contenido generado;</strong></li>
            <li>Indemnizará íntegramente a KNJ PRO, incluidos honorarios de abogados y costas judiciales, por cualquier reclamo, demanda o procedimiento iniciado por terceros derivado del uso de la plataforma o del contenido generado.</li>
          </ul>

          <h2>6. Servicios y APIs de Terceros</h2>
          <p>La plataforma utiliza APIs y servicios de proveedores externos. El usuario reconoce que:</p>
          <ul>
            <li>Las funcionalidades pueden ser modificadas, actualizadas o discontinuadas en cualquier momento sin previo aviso;</li>
            <li>Los precios en créditos pueden variar según cambios de costos operativos y de proveedores;</li>
            <li>Los modelos de IA pueden ser removidos, reemplazados o alterados por sus proveedores;</li>
            <li>Los resultados dependen enteramente de los proveedores de IA, sin que KNJ PRO controle calidad, exactitud o disponibilidad;</li>
            <li><strong>KNJ PRO actúa como intermediario tecnológico, sin responsabilidad por el contenido producido.</strong></li>
          </ul>

          <h2>7. Limitación de Responsabilidad</h2>
          <p>KNJ PRO NO será responsable por:</p>
          <ul>
            <li>Contenido generado por las IAs, incluyendo inexactitudes, errores o contenido ofensivo;</li>
            <li>Decisiones tomadas por el usuario en base al contenido generado;</li>
            <li>Bloqueos o rechazos impuestos por APIs y proveedores de IA;</li>
            <li>Indisponibilidad temporal o permanente de modelos de IA;</li>
            <li>Pérdida de créditos por fallas externas en proveedores o infraestructura;</li>
            <li>Daños directos, indirectos, incidentales, consecuentes o punitivos derivados del uso de la plataforma;</li>
            <li>Violaciones de derechos de terceros cometidas por el usuario mediante el contenido generado.</li>
          </ul>

          <h2>8. Bloqueo y Suspensión</h2>
          <p>KNJ PRO se reserva el derecho de, sin previo aviso y a su sola discreción:</p>
          <ul>
            <li>Bloquear o remover contenido que viole estos términos o la legislación aplicable;</li>
            <li>Suspender temporal o permanentemente cuentas infractoras;</li>
            <li>Remover acceso a funcionalidades específicas;</li>
            <li>Cancelar servicios y suscripciones en caso de violación grave;</li>
            <li>Retener créditos restantes en caso de uso fraudulento.</li>
          </ul>
          <p>El bloqueo o suspensión no dará derecho a reembolso de créditos o montos pagados.</p>

          <h2>9. Notificación de Violación (Takedown)</h2>
          <p>
            Si considera que algún contenido generado o disponible en la plataforma viola sus derechos
            de propiedad intelectual, imagen, voz u otros, envíe una notificación a través de nuestro
            canal de WhatsApp con: identificación del contenido, prueba de titularidad del derecho,
            referencia para localizar el contenido, sus datos de contacto completos y declaración de
            veracidad. KNJ PRO revisará la notificación y podrá remover el contenido en hasta 72 horas
            hábiles. Notificaciones falsas o de mala fe pueden generar responsabilidad para el denunciante.
          </p>

          <h2>10. Planes, Créditos y Pagos</h2>
          <ul>
            <li>El acceso a las funcionalidades es mediante un sistema de créditos, adquiridos por compra puntual o suscripción.</li>
            <li>Los créditos son personales, intransferibles y no reembolsables luego de su uso.</li>
            <li>Los reembolsos sólo aplican cuando lo exija la ley o ante falla comprobada del servicio.</li>
            <li>Los pagos son procesados a través de Mercado Pago, en entorno seguro (SSL/TLS), conforme a las reglas del operador.</li>
            <li>Los precios están expresados en pesos uruguayos (UYU).</li>
          </ul>

          <h2>11. Propiedad y Derechos sobre el Contenido</h2>
          <p>
            El usuario conserva la titularidad de las imágenes, videos y avatares creados, siempre que no
            infrinja derechos de terceros.
          </p>
          <p>
            KNJ PRO podrá utilizar imágenes públicas generadas en la plataforma con fines de
            demostración, portafolio y mejora de modelos, salvo objeción expresa del usuario.
          </p>
          <p>
            Ningún dato enviado será utilizado para reentrenar modelos propios sin consentimiento explícito.
          </p>
          <p>
            Los archivos generados (imágenes, videos, audio) se almacenan temporalmente en nuestros
            servidores. Es responsabilidad del usuario descargar los archivos que desee conservar.
          </p>

          <h2>12. Terminación y Suspensión</h2>
          <p>
            KNJ PRO se reserva el derecho de suspender o cancelar cuentas por violación de los Términos,
            inactividad prolongada o abuso del sistema.
          </p>

          <h2>13. Foro y Legislación</h2>
          <p>
            Estos Términos se rigen por las leyes de la República Oriental del Uruguay, eligiéndose el
            foro de la ciudad de Montevideo para cualquier controversia.
          </p>

          <h2>14. Infraestructura y Proveedores Tecnológicos</h2>
          <p>
            KNJ PRO opera como plataforma de orquestación de tecnologías de IA provistas por proveedores
            externos. El usuario reconoce que los resultados pueden variar entre proveedores, que la
            disponibilidad de motores alternativos no representa promesa de equivalencia técnica, y que
            la indisponibilidad o falla de cualquier motor de terceros no constituye defecto del servicio
            ni da derecho a reembolso, descuento o compensación.
          </p>

          <h2>15. Política de Retención de Archivos Generados</h2>
          <p>
            El contenido generado se almacena temporalmente en servidores de proveedores de
            infraestructura. Los plazos de retención varían según el proveedor (en general
            aproximadamente 14 días). Luego de este plazo los archivos pueden ser eliminados sin
            posibilidad de recuperación. Es responsabilidad exclusiva del usuario descargar y respaldar
            el contenido que considere importante.
          </p>

          <h2>16. Riesgo Legal Dinámico y Evolución Regulatoria</h2>
          <p>
            El usuario reconoce que el uso de IA generativa es un área en constante evolución legal y
            regulatoria. KNJ PRO no es responsable por cambios legislativos o regulatorios que puedan
            impactar el uso, distribución o comercialización del contenido generado.
          </p>

          <h2>17. Semejanza No Intencional</h2>
          <p>
            El contenido generado por IA puede asemejarse de forma no intencional a personas, marcas,
            obras o propiedades intelectuales existentes. Tal semejanza no constituye reproducción
            deliberada, pero no exime al usuario de verificar el resultado antes de cualquier uso,
            publicación o comercialización. KNJ PRO no es responsable por semejanzas no intencionales.
          </p>

          <h2>18. Sin Garantía de Originalidad</h2>
          <p>
            KNJ PRO no garantiza que el contenido generado sea único, original o exclusivo. Contenidos
            similares o idénticos pueden ser generados para otros usuarios. El usuario no podrá reclamar
            exclusividad sobre el contenido generado.
          </p>

          <h2>19. Consumo de Créditos</h2>
          <p>
            Los créditos se consumen por intento de generación, independientemente del resultado final,
            incluyendo casos de error, falla técnica, timeout o insatisfacción con el resultado. KNJ PRO
            podrá, a su sola discreción, otorgar créditos adicionales en casos de fallas técnicas
            verificadas.
          </p>

          <h2>20. Expectativas del Usuario</h2>
          <p>
            La plataforma no garantiza que los resultados generados cumplan con las expectativas del
            usuario, ya que dependen del prompt utilizado, modelo seleccionado, limitaciones técnicas y
            variables internas de los proveedores. Resultados insatisfactorios no constituyen defecto del
            servicio ni dan derecho a reembolso.
          </p>

          <h2>21. Edad Mínima</h2>
          <p>
            La plataforma KNJ PRO está destinada exclusivamente a usuarios mayores de 18 años. Al crear
            una cuenta y usar los servicios, el usuario declara tener 18 años o más y plena capacidad
            legal. KNJ PRO se reserva el derecho de solicitar prueba de edad y suspender o cancelar
            cuentas que no cumplan este requisito.
          </p>

          <h2>22. Declaración de Derechos sobre Imágenes de Personas Reales</h2>
          <p>Al subir imágenes con el rostro o figura de una persona real, el usuario declara, bajo su entera responsabilidad, que:</p>
          <ul>
            <li>Cuenta con autorización expresa y documentada de la persona representada para el uso de su imagen en la plataforma;</li>
            <li>La imagen no representa a una persona real identificable; o</li>
            <li>La persona representada es el propio usuario.</li>
          </ul>

          <h2>23. Privacidad</h2>
          <p>
            KNJ PRO recopila y procesa datos personales (correo electrónico, datos de uso) únicamente
            para la operación de la plataforma. No vendemos ni cedemos datos a terceros con fines
            comerciales. Los pagos son procesados por Mercado Pago bajo sus propias políticas de privacidad.
          </p>

          <h2>24. Contacto</h2>
          <p>
            Para consultas sobre estos términos, denuncias de contenido o ejercicio de derechos, contacte
            con nosotros a través del botón de WhatsApp disponible en la plataforma.
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
