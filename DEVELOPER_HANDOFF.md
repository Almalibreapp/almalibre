# Almalibre Franquicias — Developer Handoff

Complete technical overview for a developer taking ownership of the app. Every URL, endpoint, secret name, table and integration is listed here so you know exactly **where things point**.

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix) |
| State / data | @tanstack/react-query |
| Router | react-router-dom |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions Deno) |
| Mobile shell | Capacitor (Android/iOS wrappers) + PWA |
| Push | Web Push (VAPID) via service worker `public/sw.js` |
| Hosting | Lovable (preview + published) |

---

## 2. Environments & URLs

**App**
- Preview: `https://id-preview--4afffd78-9c74-45be-a863-e5bffd6b80ac.lovable.app`
- Published: `https://almalibre.lovable.app`
- Custom domain: `https://app.almalibreacaihouse.com`

**Own Supabase project** (auth, database, storage, edge functions of THIS app)
- Ref: `lwruwpwdrkmtgcapnbzc`
- URL: `https://lwruwpwdrkmtgcapnbzc.supabase.co`
- Env vars in `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key, safe in client)
  - `VITE_SUPABASE_PROJECT_ID`

**External telemetry Supabase project** (NOT ours — belongs to the machine integrator)
- Ref: `nrfhtviwgrkbyiujxlrd`
- Base: `https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1`
- Anon key hardcoded in `src/config/api.ts` and `src/services/controlApi.ts` (public anon key, safe).
- Every request must send BOTH headers: `apikey` and `Authorization: Bearer <same anon key>`.

**Manufacturer hardware API (Huaxin Vending)** — called only from server-side edge functions, never from the browser
- Base: `https://hxapi.huaxinvending.com`
- Credentials (hardcoded in `supabase/functions/_shared/fabricante-api.ts` and `supabase/functions/cupones/index.ts`):
  - `MCH_ID = 485410120201108`
  - `MCH_SECRET = Victor20260110Ab`
  - `SIGN = 742ec60a88d8224587cec0fc5755454ed`
- Auth flow: `POST /api/mch/mchLogin` → returns `authorization` + `jsessionId`, cached 30 min. Every subsequent call sends `Authorization: <token>` and `Cookie: JSESSIONID=<id>`.
- Endpoints used: `/api/mch/getOrders`, `/api/mch/getMachineStatus`, `/api/mch/getToppings`, `/api/mch/updateStock`, plus coupon endpoints wrapped by `cupones` edge function.

**WooCommerce store (Almalibre e-commerce)**
- Base: `https://almalibreacaihouse.com/wp-json/wc/v3`
- Category filter for the in-app store: `181` (slug `app`).
- Credentials in Supabase secrets: `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`.
- Called from edge functions `woocommerce-products` and `woocommerce-checkout`.

**WordPress bridge API (nonstopmachine.com — used for sync jobs)**
- `https://nonstopmachine.com/wp-json/helados/v1` (profitability data)
- `https://nonstopmachine.com/wp-json/fabricante-ext/v1` (temperature sync)
- `https://nonstopmachine.com/wp-json` (sales sync)
- Auth: `Authorization: Bearer <WORDPRESS_API_TOKEN>` (stored as Supabase secret).

**Resend (transactional email)**
- API key: secret `RESEND_API_KEY`. Sender: `onboarding@resend.dev`. Admin recipient: secret `ADMIN_NOTIFICATION_EMAIL`.

---

## 3. Frontend entry points

- `src/main.tsx` — bootstraps React, registers service worker.
- `src/App.tsx` — providers (QueryClient, Tooltip, Toaster), router, global prefetch, `<FloatingAlmaButton>` and `<InstallBanner>`.
- `src/pages/Index.tsx` — auth gate: shows `AuthForm` → `RoleSelector` (admins) → `Dashboard` (franchisee) or `Academy` (mandatory training not yet completed).

### Routes (`src/App.tsx`)

**Franquiciado**
```
/                          Auth / Dashboard / Academy gate
/add-machine               Register a machine by IMEI
/machine/:id               Machine detail (temperature, status, stock, control)
/machine/:id/settings      Machine settings
/settings                  Profile settings
/store                     WooCommerce store (category 181)
/checkout                  Checkout via woocommerce-checkout edge function
/orders                    Historical orders (Supabase `pedidos`)
/incidents                 List of user incidents
/incidents/new             Create incident with up to 5 photos
/tutorials                 Video tutorials
/promotions, /promotions/new
/subscription              Plans Basic / Pro / Premium (disabled)
/payment-methods
/support                   Alma AI assistant (error diagnosis E-01..E-20)
/notifications             Notification preferences
/ai, /ai/stock-prediction, /ai/profitability, /ai/daily-summary
/cupones                   Discount coupons (external hardware API)
/network                   Fleet metrics for the franchisee
/export                    Excel export (sales + temperature, ≤ 60 days)
/academy                   Mandatory training with videos + certification
```

**Admin (guarded by `AdminRoute` + `AdminLayout`)**
```
/admin/machines, /admin/machine/:id
/admin/franchisees
/admin/stock
/admin/sales, /admin/analytics
/admin/cupones
/admin/export
/admin/push
/admin/incidents
/admin/notifications
```

---

## 4. Supabase (own project) — schema

29 tables in `public`. Categories:

| Group | Tables |
|---|---|
| Auth / roles | `profiles`, `user_roles` (enum `app_role = admin/user`), `dispositivos_usuario` |
| Machines & telemetry | `maquinas`, `lecturas_temperatura`, `stock_config`, `stock_history`, `stock_sync_log`, `ventas_historico`, `ventas_sync_log` |
| E-commerce | `productos`, `pedidos`, `pedido_items`, `direcciones_guardadas`, `metodos_pago` |
| Coupons | `codigos_promocionales`, `canjes_codigo`, `cupones_cache` |
| Support | `incidencias`, `incidencia_mensajes`, `mensajes_soporte` |
| Notifications | `notificaciones`, `preferencias_notificaciones`, `push_subscriptions` |
| Billing | `suscripciones`, `pagos_suscripcion` |
| Academy | `academy_modulos`, `academy_progreso`, `academy_consentimiento` |
| Tutorials | `video_tutoriales` |

**Roles pattern (must be respected):** roles are stored in `user_roles`, checked via SECURITY DEFINER function `public.has_role(uuid, app_role)`. NEVER store a role on `profiles`. Client-side admin checks go through `useUserRole` hook + RLS.

### Key database functions

- `has_role(_user_id, _role)` — used in every RLS policy that gates admin.
- `handle_new_user()` — trigger on `auth.users` insert, creates `profiles` row.
- `generate_order_number()` / `generate_ticket_number()` — `pg_advisory_xact_lock` prevents race conditions, format `ALM-YYYY-####` / `INC-YYYY-####`.
- `notify_new_sale()` — trigger on `ventas_historico`; posts to edge function `notify-new-sale` via `pg_net.http_post`.
- `update_updated_at_column()` — generic updated_at trigger.

### Storage buckets

- `incident-photos` — **private**. Access via signed URLs. Policies: owner + admin only (see migration `20260721*`).

### Secrets (Supabase project → Edge Function Secrets)

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS,
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEYS, SUPABASE_JWKS, SUPABASE_DB_URL
WORDPRESS_API_TOKEN
WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
RESEND_API_KEY, ADMIN_NOTIFICATION_EMAIL
ADMIN_BOOTSTRAP_TOKEN
LOVABLE_API_KEY   (for Lovable AI Gateway - chat/image/embeddings)
```

---

## 5. Edge Functions (`supabase/functions/*`)

All are auto-deployed. Every function has an entry in `supabase/config.toml` with `verify_jwt = false`, and each does its own JWT validation in code when auth is required.

| Function | Purpose | Auth in code | External calls |
|---|---|---|---|
| `create-admin` | Create/promote admin users. Requires an existing admin caller OR bootstrap token `x-bootstrap-token` = `ADMIN_BOOTSTRAP_TOKEN`. | manual | — |
| `sync-ventas` | Cron every 2 min. Pulls sales from `nonstopmachine.com`, inserts into `ventas_historico` (which fires push notifications). | none (cron) | WordPress API |
| `sync-temperatura` | Manual/cron. Pulls temperature per machine into `lecturas_temperatura`. | none | WordPress API |
| `notify-new-sale` | Called by DB trigger `notify_new_sale`. Resolves ALL owners of the IMEI and pushes/emails them. | none (internal) | `send-push`, Resend |
| `send-push` | Broadcast/filtered Web Push via VAPID to `push_subscriptions`. | none (internal + admin UI) | Web Push |
| `cupones` | Full CRUD proxy for hardware coupon system. Authenticates against Huaxin then re-exposes CRUD. | anon | Huaxin API |
| `ai-stock-prediction` | AI stock forecast per machine. | JWT required | WordPress API + Lovable AI |
| `ai-profitability-analysis` | AI profitability report. | JWT required | WordPress API + Lovable AI |
| `ai-daily-summary` | Daily AI summary for a machine. | JWT required | WordPress API + Lovable AI |
| `woocommerce-products` | Lists products from category 181. | JWT required | WooCommerce API |
| `woocommerce-checkout` | Creates a WooCommerce order, returns `payment_url`. | JWT required | WooCommerce API |

**Client-side invocation pattern**
```ts
import { supabase } from '@/integrations/supabase/client';
const { data, error } = await supabase.functions.invoke('woocommerce-products', { body: {} });
```
Never call functions by hard path; always `supabase.functions.invoke()` (auto-injects JWT) or construct with `import.meta.env.VITE_SUPABASE_PROJECT_ID`.

---

## 6. External telemetry API (`nrfhtviwgrkbyiujxlrd`)

This is a **separate** Supabase project owned by the machine integrator. It exposes the vending machine data via edge functions. Called directly from the browser using `src/services/api.ts` and `src/services/controlApi.ts`.

Base: `https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1`

| Endpoint | Method | Params | Wrapper (frontend) |
|---|---|---|---|
| `/estado` | GET | `?imei=` | `fetchEstadoMaquina`, `fetchMiMaquina` |
| `/ventas` | GET | `?imei=&fecha=YYYY-MM-DD` | `fetchOrdenes`, `fetchVentasDetalle`, `fetchVentasResumen` |
| `/stock` | GET/POST | GET `?imei=`; POST `?imei=` with body → **IMEI is mandatory in URL** | `fetchToppings`, stock update in `useStockSync` |
| `/temperatura` | GET | `?imei=&start=YYYY-MM-DD&end=YYYY-MM-DD` (dates must be simplified, no timestamps) | `fetchTemperatura` |
| `/productos` | GET/POST | GET `?imei=`; POST `?imei=` with `{ position, precio?, nombre?, imagen? }` — **IMEI must be in URL query** | `fetchProductos`, `updateProductoPrecio`, `updateProductoNombre`, `updateProductoImagen` |
| `/control` | POST | `{ imei, action }` — remote refrigeration / sales / origin / defrost | `src/services/controlApi.ts` |
| `/cupones` | GET/POST/PUT/DELETE | Full CRUD; requires IMEI-first selection | `controlApi.ts` |

**Important quirks (do not break):**
- Both `apikey` AND `Authorization: Bearer` headers required — see `API_CONFIG.headers`.
- Endpoint is flaky; wrappers implement dedupe + 15s circuit breaker (see `performVentasFetch`).
- Endpoint sometimes returns HTML (nginx 5xx) — wrappers degrade to empty results.
- `POST /stock` and `POST /productos` REQUIRE `?imei=` in URL query, not just body.

---

## 7. Time-zone logic (critical business rule)

File: `src/lib/timezone-utils.ts`, complementary file: `src/lib/sales.ts`.

- All sales come with `fecha_hora_china` (server sends China UTC+8 for a few machines, Spain time for the rest).
- IMEIs whose timestamps are China time — hardcoded set `CHINA_TIME_IMEIS`:
  - `865622072039477`
  - `865622073018769`
  - `865622072055218`
- For those, convert by `Date.UTC(y, m-1, d, h-8, ...)` → format in `Europe/Madrid` (handles DST automatically).
- Additionally, `fetchSpanishDayOrders` (`src/lib/sales.ts`) fetches BOTH the target day and the next day for evening-sale coverage when the machine's raw date is China.
- Memory rule: for sales, `subtract 27 minutes from fecha_hora_china` for correct Spain time. Fields `venta.fecha`/`venta.hora` are banned in favour of `fecha_hora_china`.

Spanish-time helper for storing "today": `new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })`.

---

## 8. Auth flow

- Managed Supabase auth. Client in `src/integrations/supabase/client.ts` (auto-generated, do NOT edit). Uses `localStorage`, autoRefreshToken.
- Sign-up trigger `handle_new_user` populates `profiles`.
- Roles: `useUserRole(user.id)` → uses `has_role`. Admin gate = `AdminRoute` component.
- `RoleSelector` shown to admins on login so they can enter as admin or franchisee.
- Session persistent by design (memory rule: no auto-logout, splash screen while checking).

---

## 9. Notifications

**Push (Web Push / PWA)**
- VAPID keys in secrets. Service worker: `public/sw.js`. Manifest: `public/manifest.json`.
- Subscribe flow: `src/services/pushNotifications.ts` → saves subscription in `push_subscriptions` table.
- Broadcast: admin at `/admin/push` calls `send-push`.
- Trigger for sales: DB trigger on `ventas_historico` → `notify-new-sale` → resolves owners by `mac_address` → calls `send-push` filtered by user_id + Resend email.
- iOS: PWA must be installed on Home Screen first (Safari share sheet). `InstallBanner.tsx` explains it.

**Local (Capacitor)**
- `src/services/localNotifications.ts`, hook `useLocalNotifications`. Alerts for new sale, temp > -15 °C, out-of-stock. Uses `@capacitor/local-notifications` (NEVER `@capacitor/push-notifications`, that lib is banned).

**Email**
- Resend via edge functions, admin toggle at `/admin/notifications`.

---

## 10. Payments & store

- Store restricted to WooCommerce category `181`.
- Cart: `FloatingCart` + `useStoreProducts` hook.
- Free shipping over 50 €.
- Checkout POSTs to `woocommerce-checkout` → returns `payment_url` → we redirect the user.
- Saved addresses in `direcciones_guardadas`.

---

## 11. Cross-cutting rules already baked in

- Currency: **Euros only**.
- Language: Spanish only. Brand voice: "Almalibre Franquicias", "Açaí" over "Helados".
- Design tokens: violet primary `#a855f7`, dark bg `#0f172a`. All colors are semantic tokens in `src/index.css` — do NOT hardcode `text-white`/`bg-black` in components.
- Loading UX: skeletons only, no spinners.
- "One machine, one owner": `maquinas.mac_address` may appear once per franchisee; admin views deduplicate with franchisee priority.
- Bottom nav has exactly 4 items: Inicio, Pedidos, Cupones, Mi Perfil.
- `FloatingAlmaButton` (WhatsApp `+19016750678`) — visible ONLY for logged-in franchisees, hidden for admins & anonymous.
- Academy is a hard gate: franchisees cannot reach Dashboard until certified (`useAcademyStatus`).
- Excel export in `/export` reads `lecturas_temperatura` directly (not the flaky external endpoint), highlights pasteurization (≥66 °C).

---

## 12. Local development

```bash
npm i
npm run dev        # Vite on :8080
```

The Supabase client is instantiated from `.env` values shipped in the repo (anon key only). No secret is needed to run the frontend. Edge functions run on Supabase — nothing to boot locally.

`supabase/config.toml` is auto-generated by Lovable — do not change project-level settings.

---

## 13. Where to look first when something breaks

| Symptom | Where to check |
|---|---|
| Machine data missing / wrong | External Supabase (`nrfhtviwgrkbyiujxlrd`) status; `performVentasFetch` circuit breaker in `src/services/api.ts` |
| Sales at wrong hour | `CHINA_TIME_IMEIS` in `src/lib/timezone-utils.ts` and `src/lib/sales.ts` |
| No push notifications | `push_subscriptions` rows, VAPID secrets, `notify-new-sale` logs, `sync-ventas` cron |
| Store empty | `woocommerce-products` logs, category id 181, WooCommerce credentials |
| Admin can't manage a resource | RLS policy + `has_role` function |
| Stock update fails | Ensure `?imei=` in URL and body, see `updateProducto*` in `controlApi.ts` |
| Coupons broken | `cupones` edge function auth cache; hardware API HTML responses |
| Academy blocking user | `academy_progreso` + `academy_consentimiento` rows |

---

## 14. Do-not-touch list

- `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` — auto-generated.
- `.env` — auto-generated (`VITE_SUPABASE_*`).
- `supabase/config.toml` — project-level settings auto-managed.
- Schemas `auth`, `storage`, `realtime`, `supabase_functions`, `vault` — never write to these.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.

---

Written for whoever inherits this project. If any endpoint or credential changes, update this file at the same time.
