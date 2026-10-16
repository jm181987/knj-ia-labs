# KNJ IA Labs

Plataforma de herramientas de inteligencia artificial de KNJ, orientada a centralizar experiencias de generación y uso de modelos de IA desde una interfaz web.

> **Estado:** desarrollo activo. Las funcionalidades y los proveedores disponibles pueden cambiar. Consulta el código y la configuración del despliegue para conocer las integraciones habilitadas.

## Funcionalidades

- Acceso a herramientas de IA desde una interfaz unificada.
- Gestión de usuarios y sesiones.
- Visualización de modelos o herramientas disponibles.
- Seguimiento de operaciones de generación, cuando el proveedor lo permite.
- Consulta de información de duración y costos, sujeta a los datos proporcionados por cada integración.

## Primeros pasos

1. Clona el repositorio:
   ```bash
   git clone https://github.com/jm181987/knj-ia-labs.git
   cd knj-ia-labs
   ```
2. Revisa el gestor de paquetes y los scripts definidos en `package.json` antes de instalar dependencias.
3. Configura las variables de entorno necesarias para los servicios que utilice la aplicación. Usa un archivo local excluido de Git y nunca publiques claves de API.
4. Ejecuta los scripts de desarrollo indicados en `package.json`.

## Configuración y despliegue

Las credenciales, los endpoints de proveedores de IA, la persistencia y la autenticación deben configurarse en el entorno de ejecución. Antes de publicar una versión, verifica que el proceso de compilación termine correctamente y que las rutas de autenticación y generación respondan.

## Verificaciones recomendadas

- **Inicio de sesión:** comprobar el primer acceso de un usuario nuevo y los siguientes inicios de sesión.
- **Catálogo de IA:** contrastar el número mostrado en pantalla con las herramientas realmente habilitadas.
- **Generación:** validar respuestas, errores y estados de espera de los proveedores.
- **Duración y costos:** comparar los datos presentados con los registros de la operación y la facturación del proveedor.
- **Errores:** evitar exponer claves, mensajes internos o información privada en el navegador.

## Seguridad

No subas archivos `.env`, tokens, contraseñas ni datos personales. Configura permisos por usuario y aplica controles de acceso en el servidor, no solamente en la interfaz.

## Mantenimiento

Para reportar problemas, abre un issue con pasos para reproducir el error, comportamiento esperado, comportamiento observado y registros **sin datos sensibles**.

---

Desarrollado por **KNJ** · [KNJ Marketing](https://www.marketingknj.site/)
