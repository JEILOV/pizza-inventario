# Pizza Republic · Operación

Aplicación interna para cocina, salón y administración. Next.js 16, React 19, TypeScript y Firebase.

## Uso diario

- **Hoy / Comprar:** faltantes, avisos del equipo y alertas anticipadas de insumos externos. Comparte la lista filtrada por WhatsApp; el envío lo confirma la persona en WhatsApp. No se gestionan proveedores ni estados de pedidos.
- **Hoy / Preparar:** insumos internos, disponible, meta y cantidad faltante. Registrar preparado suma únicamente la cantidad recién elaborada y deja un ajuste con responsable. No descuenta automáticamente ingredientes de recetas.
- **Hoy / Reportar:** queda poco, se acabó o problema. El aviso no modifica el stock; permanece pendiente hasta que el equipo lo resuelva.
- **Turno:** listas compartidas de apertura y entrega, separadas por fecha, zona y turno. Administración puede agregar y quitar tareas. Las fechas operativas usan America/Lima.
- **Cierre:** conteo físico con filtros por categoría y ubicación, nota general y borrador en sessionStorage de esa pestaña, separado por usuario, fecha, zona y turno. Vacío no equivale a cero. Si hubo otro ajuste mientras se contaba, se pide recontar el insumo afectado antes de sobrescribirlo.
- **Personal:** cada primer acceso con Google registra un perfil sin rol. Un administrador asigna cocina, salón o admin; puede desactivar/reactivar sin borrar historial. Nadie se asigna sus propios privilegios. Los cambios aparecen automáticamente en el dispositivo del trabajador.

## Configuración de insumos

Los registros existentes siguen funcionando sin migración: aparecen como Sin categoría y usan sus mínimos cuando no hay metas configuradas.

Asigna categoría (masas, salsas, bebidas, delivery, etc.), ubicación, unidad de conteo y metas normal/de fin de semana. El mínimo marca el nivel crítico; la meta indica cuánto debe quedar disponible después de comprar o preparar. Ajusta metas y mínimos con el encargado antes de usarlos como referencia del servicio.

Las alertas amarillas usan el mayor entre el colchón de 40% sobre el mínimo actual y el mínimo próximo más el consumo diario estimado multiplicado por días de entrega y anticipación. Se consideran mínimos de viernes a domingo dentro de ese horizonte. Sin consumo estimado, siguen funcionando el colchón y los próximos mínimos. No es una predicción basada en ventas.

## Desarrollo

```sh
npm ci
npm run dev
```

Define en `.env.local` las variables públicas de configuración de Firebase: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID y NEXT_PUBLIC_FIREBASE_APP_ID. Usa el mismo proyecto en la configuración del cliente y en Firebase CLI. No subas `.env.local` ni archivos de `secrets/`.

```sh
npm run typecheck
npm test
npm run build
npm run test:rules
```

Las pruebas de reglas requieren Firebase CLI y Java compatible con su emulador. El script configura el idioma del proceso Java para evitar un fallo del emulador con locale es_PE, sin cambiar la configuración del equipo. Usan exclusivamente `demo-pizza-inventario`, un proyecto ficticio local. No usan credenciales administrativas ni escriben en producción.

## Publicación coordinada

El nuevo acceso necesita las reglas incluidas en este cambio. Publicar solo la web dejando las reglas anteriores impide el autorregistro y las nuevas funciones.

1. Verifica que `.firebaserc` y NEXT_PUBLIC_FIREBASE_PROJECT_ID correspondan al proyecto real. Comprueba que al menos un documento `usuarios/{uid}` existente tenga rol `admin` y esté activo (activo ausente se interpreta como true).
2. Con una cuenta autorizada, publica reglas e índices: `firebase deploy --only firestore:rules,firestore:indexes --project pizza-inventario`. Espera a que los índices estén listos.
3. Publica el frontend mediante el despliegue habitual del repositorio. Comprueba acceso con admin, alta nueva, asignación de área, desactivación, reporte, preparación y cierre.

La fuente de permisos ahora es el documento `usuarios/{uid}`, tanto para la interfaz como para las reglas. La Cloud Function antigua que sincroniza custom claims ya no es necesaria para esta versión; puede permanecer durante la transición. Los claims antiguos no conceden acceso si el perfil está desactivado. La herramienta de bootstrap existente puede seguir creando el primer perfil administrador desde un entorno de confianza.

## Instalar en el celular

Publica sobre HTTPS. La página incluye manifiesto, íconos y botón de instalación con instrucciones. En Android compatible se ofrece el diálogo de instalación; en iPhone se indica Safari, Compartir, Agregar a pantalla de inicio. No requiere una tienda de aplicaciones.

La aplicación necesita conexión para trabajar con Firebase. El service worker solo guarda una página pública de desconexión: no almacena sesiones, inventario ni páginas privadas. Los borradores de conteo son locales a una pestaña; no son copias de seguridad y desaparecen al cerrar esa sesión del navegador.

Guías de referencia: [PWA en Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps).
