
# UI de Gestión para Kling.ai

## Resumen
Crear una interfaz completa para generar videos e imágenes con la API de Kling.ai, con opciones avanzadas, historial de generaciones y galería.

## Arquitectura

### Backend (Edge Functions)
1. **Edge Function `kling-generate`** — Maneja todas las llamadas a la API de Kling.ai:
   - Genera JWT tokens usando Access Key y Secret Key (almacenados como secrets de Supabase)
   - Endpoints: text-to-video, image-to-video, text-to-image
   - Consulta de estado de tareas (polling)
   - Base URL: `https://api.klingai.com`

2. **Secrets**: Guardar `KLING_ACCESS_KEY` y `KLING_SECRET_KEY` como secrets seguros (nunca expuestos al frontend)

### Base de datos (Supabase)
- Tabla `generations` para historial: id, tipo (video/imagen), prompt, parámetros, estado, URLs de resultado, timestamps

### Frontend (React + Tailwind)

1. **Layout principal** — Sidebar con navegación + área de contenido principal

2. **Página "Generar"** — Formulario principal con:
   - Toggle entre Video e Imagen
   - Campo de prompt de texto
   - **Opciones de video**: modelo (kling-v2.6-pro, kling-video-o1), duración (5s/10s), aspect ratio (16:9, 9:16, 1:1), modo (estándar/profesional)
   - **Opciones de imagen**: modelo, cantidad de imágenes, aspect ratio, negative prompt
   - Opción de subir imagen de referencia (image-to-video)
   - Botón de generar con estado de carga

3. **Página "Historial"** — Lista de todas las generaciones con:
   - Filtros por tipo (video/imagen) y estado (pendiente/completado/fallido)
   - Vista de tarjetas con miniatura, prompt, fecha, estado
   - Polling automático para tareas en progreso
   - Barra de progreso para tareas activas

4. **Página "Galería"** — Vista grid de resultados completados:
   - Reproductor de video inline
   - Vista ampliada de imágenes
   - Descarga directa
   - Opción de re-generar con mismo prompt

5. **Componentes compartidos**:
   - Status badge (pendiente, procesando, completado, error)
   - Modal de preview (video player / imagen)
   - Toast notifications para estados de tareas

### Flujo de generación
1. Usuario llena el formulario y envía
2. Frontend llama al edge function
3. Edge function genera JWT, envía request a Kling API, guarda tarea en DB
4. Frontend hace polling cada 10s al edge function para verificar estado
5. Cuando completa, se actualiza la DB y se muestra el resultado
