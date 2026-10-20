# Espacio Querido · Portal inmobiliario

React 18 + TypeScript + SCSS (CSS Modules) + Supabase. Vite como bundler.

## Qué incluye

**Sitio público** (réplica del diseño + nuevas secciones)
- Inicio: hero con buscador rápido, Servicios, Propiedades destacadas (nuevo), ¿Por qué trabajar con nosotros?, Financiamientos, Equipo, formulario de contacto, FAQ, footer y banner de cookies.
- `/propiedades` — buscador con filtros por ubicación (con autocompletado), operación, tipo, precio, recámaras, baños, estacionamientos, m² y amenidades. Filtros en la URL (se pueden compartir), orden y paginación. Drawer de filtros en móvil.
- `/propiedades/:slug` — detalle: galería, encabezado con **ID**, ubicación, tipo y precio; **foto del asesor asignado** con WhatsApp, llamada y "Propiedades (N)"; barra de plantas/m²/recámaras; descripción, amenidades y mapa; **compartir** (WhatsApp, Instagram, Facebook, PDF, enlace); formulario **"Envía un mensaje al asesor"** con reCAPTCHA; propiedades similares. Sin asesor asignado se muestra el contacto de la inmobiliaria.
- `/propiedades/:slug/ficha` — ficha técnica imprimible (botón PDF → "Guardar como PDF").
- `/propiedades?agent=<id>` — todas las propiedades de un asesor.
- `/aviso-de-privacidad` con control de consentimiento de cookies.

**Panel de administración** (`/admin`)
- Login, recuperar contraseña por correo, restablecer contraseña y cambio de contraseña desde "Mi cuenta".
- **Dashboard**: visitas, visitantes únicos, páginas vistas, tiempo promedio de permanencia, rebote, leads y conversión, clics (WhatsApp, llamadas, correo, CTAs), vistas de propiedades, visitantes en línea, tráfico diario, fuentes, dispositivos, páginas y propiedades top, búsquedas frecuentes.
- **Leads**: lista con búsqueda y filtros, estado (Nuevo → Contactado → Calificado → Cerrado/Perdido), notas internas, origen/UTM, botones de WhatsApp/llamar/correo, exportar CSV.
- **Propiedades**: pestañas Activo / Borrador / Finalizado, cambio rápido de estado, destacar, duplicar, eliminar. Botón **Subir propiedad** → captura manual o **importar de EasyBroker**.
- **Editor**: datos generales, precio, características, ubicación con vista previa de mapa, amenidades (y personalizadas), fotos con arrastrar-soltar, reordenar y portada.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # llena tus llaves de Supabase
npm run dev
```

### 1. Base de datos
En Supabase → **SQL Editor**, ejecuta `supabase/schema.sql` completo (es idempotente). Opcional: `supabase/seed.sql` con propiedades de prueba.

### 2. Primer administrador
Authentication → Users → **Add user** (marca *Auto Confirm*). Luego:
```sql
update public.profiles set role = 'admin' where email = 'tu-correo@dominio.com';
```
A partir de ahí, los demás asesores se dan de alta desde **Panel → Asesores**.

### Roles y permisos

| | Administrador | Asesor |
|---|:-:|:-:|
| Dashboard / analítica | ✅ | — |
| Leads | ✅ (todos, filtrables por asesor) | — |
| Alta / baja / desactivar asesores | ✅ | — |
| Ver propiedades | Todas | Solo las asignadas a él |
| Subir propiedad manual | ✅ | ✅ (queda asignada a él) |
| Editar propiedad y fotos | ✅ | ✅ (solo las suyas) |
| Cambiar estado Activo / Borrador / Finalizado | ✅ | ✅ (solo las suyas) |
| Asignar / reasignar asesor | ✅ | — |
| Destacar en inicio, eliminar | ✅ | — |
| Importar de EasyBroker | ✅ | — |
| Editar su foto, teléfono y WhatsApp públicos | ✅ | ✅ (Mi cuenta) |

Los permisos no dependen solo de la interfaz: están reforzados con RLS y un trigger en la base de datos (un asesor no puede reasignarse propiedades ni ver las de otros aunque llame a la API directamente).

Al **dar de alta** un asesor puedes enviarle una invitación por correo (él define su contraseña) o fijarle una contraseña. **Desactivar** le quita el acceso sin perder su historial; **eliminar** deja sus propiedades y leads como "Sin asignar".

### 3. Recuperación de contraseña
Authentication → URL Configuration:
- **Site URL**: `https://tudominio.com`
- **Redirect URLs**: `https://tudominio.com/admin/restablecer-contrasena` y `http://localhost:5173/admin/restablecer-contrasena`

### 4. Edge Functions
```bash
supabase functions deploy admin-users          # alta/baja de asesores
supabase functions deploy easybroker-import    # importación (solo admin)
supabase secrets set EASYBROKER_API_KEY=tu_api_key
```
La API key nunca llega al navegador. Al importar puedes asignar todas a un asesor o dejar **automático**: cada propiedad se asigna al asesor cuyo correo coincida con el del agente en EasyBroker.

Para la invitación por correo agrega también `https://tudominio.com/admin/restablecer-contrasena` en **Redirect URLs** (paso 3).

### 4.1 reCAPTCHA (opcional, recomendado)
1. Crea una clave **reCAPTCHA v2 – casilla "No soy un robot"** en Google para tu dominio.
2. `VITE_RECAPTCHA_SITE_KEY=...` en tu `.env`.
3. ```bash
   supabase secrets set RECAPTCHA_SECRET=tu_secret
   supabase functions deploy submit-lead --no-verify-jwt
   ```
4. Ya con eso funcionando, bloquea los envíos que no pasen por el captcha:
   ```sql
   drop policy "leads_public_insert" on public.leads;
   ```
Sin la clave, los formularios funcionan igual con un honeypot anti-spam.

### 5. Imágenes
Copia tus archivos a `public/images/` con estos nombres (o cambia las rutas en `src/utils/content.ts`):

```
public/images/
  logo.svg              logo-white.svg        logo-icon-white.svg   favicon.png
  hero.jpg
  services/venta.jpg    compra.jpg            renta.jpg             inversion.jpg
  banks/banamex.svg  banorte.svg  banregio.svg  hsbc.svg  santander.svg  afirme.svg
        scotiabank.svg  mifel.svg  bbva.svg  infonavit.svg  cofinavit.svg  sofomes.svg
  team/andres-quinones.jpg  alexa-espinoza.jpg  …  (nombre en minúsculas, sin acentos, con guiones)
```
Si falta una foto del equipo o un logo de banco, se muestran iniciales / el nombre.

### 6. Deploy
Es una SPA: configura el fallback a `index.html` (Vercel/Netlify lo hacen automático; en Netlify agrega `/* /index.html 200` en `public/_redirects`).

## Estructura

```
src/
  app/           AppRouter.tsx, paths.ts
  components/    layout · home · properties · forms · auth · admin · ui
  context/       AuthContext, ToastContext
  hooks/         useAnalytics (tracking), useDebounce, useScrollToHash…
  lib/           supabase.ts
  pages/         public · auth · admin
  services/      properties, leads, analytics, auth, easybroker
  styles/        _variables, _mixins, global.scss
  types/         index.ts
  utils/         constants, content (textos del sitio), format, storage
supabase/
  schema.sql     tablas, roles, RLS, storage, RPCs de tracking, dashboard y asesores
  seed.sql
  functions/
    _shared/utils.ts
    admin-users/        alta, contraseña y baja de asesores
    easybroker-import/  listar e importar (solo admin)
    submit-lead/        verificación reCAPTCHA
```

## Cómo funciona la analítica
- Cada visita crea una sesión (30 min de inactividad = nueva sesión) con fuente, UTM, dispositivo y navegador.
- Se registra `page_view` por ruta, un latido cada 15 s con la pestaña visible (tiempo de permanencia) y clics automáticos en `tel:`, `mailto:` y WhatsApp.
- Para medir cualquier botón: `<button data-track="cta_click" data-track-label="Nombre">`.
- Si el visitante rechaza cookies, no se registra nada. El panel `/admin` nunca se mide.
- Las escrituras pasan por funciones `security definer`; el público no puede leer analítica ni leads.
