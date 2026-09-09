# KNJ IA Labs — migración PostgreSQL sin pérdida de datos

## Objetivo

Mover los datos operativos de KNJ IA Labs desde Supabase/Lovable Cloud a PostgreSQL administrado por KNJ, sin perder usuarios, accesos, pagos, suscripciones, créditos, generaciones, afiliados ni historial.

Destino (sin credenciales):

- Host: `169.58.110.123`
- Puerto: `5432`
- Base: `knj_studio_studio`
- Usuario: `knj_studio_studio_usr`

> La contraseña y `DATABASE_URL` completa son secretos de servidor. Nunca deben guardarse en Git, ni exponerse mediante variables `VITE_*` porque Vite las incluye en el bundle del navegador.

## Regla principal

**No cambiar producción a la nueva base hasta que exista una copia verificada y un camino de rollback.**

La autenticación actual continúa en Supabase durante la primera etapa. El UUID de cada usuario se conserva exactamente, de modo que `profiles.id`, `user_roles.user_id`, `user_credits.user_id`, `payments.user_id`, `subscriptions.user_id`, `generations.user_id` y las tablas de afiliados sigan apuntando al mismo usuario.

Esto evita obligar a los clientes a cambiar contraseña o volver a registrarse durante la migración de datos.

## Proyecto Supabase de origen

El repositorio actualmente apunta a:

- Project ref: `vamgjaitoiuitvlwqoic`
- URL pública: `https://vamgjaitoiuitvlwqoic.supabase.co`

Para copiar datos reales es obligatorio usar acceso privilegiado al PostgreSQL de ese proyecto (database connection string / contraseña del proyecto o conexión autorizada equivalente). La `anon/publishable key` del frontend no permite exportar de forma fiable todas las filas, `auth.users`, objetos protegidos por RLS ni datos administrativos.

## Inventario crítico observado en el código

### Datos de negocio

- `profiles`
- `user_roles`
- `user_credits`
- `credit_transactions`
- `credit_packages`
- `pricing`
- `payments`
- `subscriptions`
- `generations`
- `rate_limits`
- `testimonials`
- `email_templates`
- `email_sends`
- `app_settings`
- `affiliates`
- `affiliate_clicks`
- `affiliate_referrals`
- `affiliate_commissions`
- `affiliate_payouts`

### Operaciones SQL/RPC críticas

- `consume_credits`
- `add_credits_system`
- `debit_credits_for_user`
- `refund_credits_for_user`
- `check_and_increment_rate_limit`
- `has_role`
- funciones de afiliados, comisiones y payouts

### Funciones que pueden escribir datos

La migración debe contemplar, entre otras:

- `mp-webhook`
- `mp-create-preference`
- `mp-create-subscription`
- `mp-cancel-subscription`
- `mp-reconcile-payments`
- `paypal-webhook`
- `paypal-create-order`
- `paypal-capture-order`
- `paypal-create-subscription`
- `wavespeed-generate`
- funciones administrativas
- funciones de afiliados
- `notify-new-user`
- email/campañas

Los webhooks de pagos son especialmente importantes: deben seguir siendo idempotentes durante toda la migración para que un reintento de Mercado Pago o PayPal no duplique créditos o comisiones.

## Arquitectura de transición recomendada

### Fase 0 — congelar cambios de esquema, no la plataforma

No se detiene el tráfico. Sólo se evita introducir nuevas tablas/columnas mientras se realiza la migración.

1. Registrar el SHA exacto de `main` usado como referencia.
2. Tomar un backup completo del origen antes de cualquier cambio.
3. Verificar conectividad TLS y versión PostgreSQL del destino.
4. Verificar espacio libre y permisos del usuario destino.
5. Conservar intacta la configuración actual de Supabase para rollback.

### Fase 1 — mantener Supabase Auth

El login, signup, recuperación de contraseña y sesiones siguen atendidos por Supabase Auth.

No se cambia `supabase.auth.*` todavía. La nueva base almacena los mismos UUID de usuario como identificadores externos. En esta etapa no es necesario que la nueva base sea quien emita sesiones.

Ventaja: ningún cliente pierde acceso aunque la migración de datos de negocio necesite rollback.

### Fase 2 — copia inicial

Con credenciales privilegiadas del origen:

1. Exportar esquema y datos del origen con herramientas PostgreSQL/Supabase adecuadas.
2. Restaurar en una base de staging o directamente en el destino aún fuera de producción.
3. Conservar IDs UUID, timestamps y referencias externas (`mp_payment_id`, `mp_preapproval_id`, PayPal IDs, task IDs, etc.).
4. No regenerar IDs.
5. No recalcular saldos históricos a partir de aproximaciones.

Después de restaurar, ejecutar `scripts/migration/critical_integrity.sql` tanto en origen como en destino y comparar resultados.

### Fase 3 — captura de cambios mientras producción sigue operativa

Una copia única no basta porque pueden entrar pagos o generaciones mientras corre el backup.

Antes del cutover se necesita uno de estos mecanismos:

1. **Replicación lógica/CDC** desde PostgreSQL origen al destino, si el origen permite configurarla; o
2. **Dual-write controlado** en las operaciones críticas, manteniendo Supabase como fuente primaria y reflejando cada escritura al destino de forma idempotente.

Para KNJ se prefiere dual-write si no se dispone de replicación saliente del proyecto Supabase.

Orden de prioridad para dual-write:

1. `payments`
2. `subscriptions`
3. `user_credits`
4. `credit_transactions`
5. `generations`
6. `affiliate_commissions`
7. `affiliate_payouts`
8. `profiles` / `user_roles`
9. resto de tablas

Toda escritura espejo debe usar claves naturales/idempotentes existentes y `ON CONFLICT` apropiado para no duplicar eventos.

### Fase 4 — validación antes de leer desde PostgreSQL nuevo

Condiciones mínimas para permitir el cutover:

- mismo número de perfiles;
- mismos UUID de usuarios referenciados;
- mismo total y distribución de `user_credits`;
- mismo número de `credit_transactions` y suma por usuario;
- mismos pagos por `id` y por identificador externo;
- mismos pagos aprobados y montos;
- mismas suscripciones y estados;
- mismas generaciones por estado;
- mismos balances de afiliados y comisiones;
- cero IDs duplicados inesperados;
- cero filas huérfanas en relaciones críticas;
- prueba de login con usuario existente;
- prueba de admin;
- compra de prueba end-to-end;
- generación de prueba y consumo de créditos;
- cancelación/reconciliación de suscripción de prueba;
- rollback ensayado.

### Fase 5 — cutover reversible

El cambio de lectura/escritura se debe controlar con configuración del servidor, no hardcodeando una URL en el frontend.

Secuencia:

1. Mantener Supabase Auth activo.
2. Activar lectura desde PostgreSQL nuevo para un entorno de preview/staging.
3. Ejecutar smoke tests.
4. Activar lectura desde PostgreSQL nuevo en producción.
5. Mantener dual-write durante la ventana de observación.
6. Si aparece una inconsistencia, volver lecturas al origen inmediatamente sin perder los datos ya reflejados.
7. Sólo después de validar estabilidad, dejar PostgreSQL nuevo como fuente primaria.

## Autorización y seguridad

Un navegador **no debe conectarse directamente a PostgreSQL**. El `DATABASE_URL` destino debe vivir sólo en un backend/Edge Function/API privada.

El backend de datos debe:

1. recibir el access token actual de Supabase;
2. validar al usuario con Supabase Auth/JWT;
3. obtener su UUID;
4. ejecutar consultas parametrizadas en PostgreSQL con ese UUID;
5. aplicar autorización equivalente a las políticas RLS actuales;
6. aplicar autorización administrativa explícita para operaciones sensibles.

No se debe reemplazar RLS por “confianza en el frontend”.

## Créditos

Los créditos son dinero/valor contable dentro de la plataforma. Las operaciones de débito/crédito deben seguir siendo atómicas.

En PostgreSQL nuevo deben implementarse con una transacción y bloqueo de fila, por ejemplo conceptualmente:

1. `SELECT balance ... FOR UPDATE`;
2. verificar saldo;
3. actualizar `user_credits`;
4. insertar `credit_transactions`;
5. confirmar ambos cambios en la misma transacción.

Nunca actualizar sólo el balance sin registrar la transacción asociada.

## Pagos y suscripciones

- Preservar IDs de Mercado Pago y PayPal.
- Crear índices/constraints únicos que mantengan la idempotencia del webhook.
- No acreditar dos veces si el proveedor reenvía el mismo evento.
- Mantener `mp_response`/payload histórico cuando exista.
- Comparar pagos aprobados no sólo por cantidad de filas sino también por monto total y créditos acreditados.

## Realtime

Actualmente `user_credits` usa Supabase Realtime. Mover la tabla a PostgreSQL genérico elimina automáticamente ese canal de Realtime.

Antes del cutover hay que reemplazarlo por uno de estos mecanismos:

- actualización del saldo como respuesta de cada operación + refresco al recuperar foco;
- polling corto autenticado;
- SSE/WebSocket desde el backend.

No cortar la suscripción actual hasta tener sustituto probado.

## Auth completo — etapa posterior

Mover datos de negocio y mover Supabase Auth son dos proyectos distintos.

Cuando se quiera eliminar Supabase por completo habrá que migrar también:

- `auth.users` y hashes de contraseña;
- identidades/proveedores;
- sesiones/tokens;
- configuración SMTP;
- redirect URLs;
- JWT signing configuration;
- Edge Functions;
- Storage, si hay objetos allí;
- Realtime, si sigue siendo necesario.

Hasta entonces Supabase Auth se mantiene operativo, por diseño, para proteger el acceso de los clientes.

## Rollback

Mientras la migración no esté declarada final:

- no borrar ni resetear el Supabase original;
- conservar backup previo al cutover;
- conservar la configuración anterior de frontend/backend;
- mantener IDs idénticos en ambos lados;
- mantener dual-write el tiempo suficiente para poder volver a leer del origen.

El rollback debe consistir en cambiar el proveedor de datos a Supabase, no en restaurar manualmente usuarios uno por uno.

## Credenciales

La contraseña del destino fue proporcionada fuera del repositorio y **no debe aparecer en ningún commit**.

Como medida de higiene, después de completar la migración se recomienda rotarla porque fue compartida en una conversación. El valor nuevo debe almacenarse sólo en el gestor de secretos del backend que finalmente atienda la aplicación.

## Bloqueo actual para ejecutar la copia real

El repositorio contiene la URL y la publishable/anon key del proyecto Supabase, pero esas credenciales no son suficientes para exportar todos los datos protegidos ni Auth.

Para ejecutar la copia real sin adivinar ni omitir clientes hace falta acceso privilegiado al proyecto Supabase `vamgjaitoiuitvlwqoic`, preferentemente conectando ese proyecto al conector Supabase de ChatGPT o proporcionando acceso de base de datos mediante un canal seguro de secretos.

Hasta tener ese acceso, **no se debe hacer el cutover**.