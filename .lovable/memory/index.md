# Memory: index.md

# Project Memory

## Core
KNJ PRO — app de generación video/imagen (Wavespeed). Acento púrpura (#7C3AED). Lovable Cloud (Supabase).
Admins tienen permisos totales (RLS via has_role + edge functions con service role): editar/eliminar cualquier usuario, pagos, créditos, paquetes, pricing, testimonios, suscripciones y settings. No pedirles confirmación de "permisos".
Admins NO usan sistema de créditos: no mostrarles alertas de saldo bajo ni bloqueos por créditos.
Notificación WhatsApp a admin en cada nuevo registro vía edge function notify-new-user.

## Memories
- [Kling API](mem://features/kling-api) — JWT auth con Access/Secret keys (legacy, ahora Wavespeed)
- [Design tokens](mem://design/tokens) — Púrpura primario, modo claro/oscuro
