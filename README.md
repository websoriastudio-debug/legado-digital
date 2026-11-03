# Legado Digital

Web pública, campus de formación y oficina privada con referidos, revisión de pagos y panel del fundador.
Node 22.13 o superior, **sin dependencias**: `node:http`, `node:sqlite` y `node:crypto`.

## Arquitectura

| Capa | Dónde | Qué hace |
| --- | --- | --- |
| Web y oficina | `public/` | HTML, CSS y JavaScript sin compilar. Solo presenta; nunca decide permisos. |
| Servidor | `server/` | Rutas (`app.mjs`) y reglas de negocio separadas por tema: `accounts`, `catalog`, `sales`, `settings`. |
| Base de datos | `server/db.mjs` | SQLite con migraciones numeradas. Es la fuente de verdad de pagos y permisos. |
| Configuración | `shared/site.config.mjs` | Marca, WhatsApp, textos públicos y planes iniciales. Lo comercial se edita desde el panel del fundador. |

Una web estática (por ejemplo, GitHub Pages) **no basta**: cuentas, pagos, comprobantes y permisos necesitan este servidor.

## Ejecutar

```bash
npm run demo     # datos ficticios y pasarela de pruebas, en http://localhost:4240
npm start        # producción: sin datos de ejemplo
npm test         # pruebas de aceptación contra la API real
```

En Windows, si PowerShell bloquea `npm`, usa `npm.cmd run demo` o `node server.mjs --demo`.

La demostración guarda sus datos en `data/demo/` y producción en `data/prod/`: nunca se mezclan. Borra `data/demo` para empezar la demo de cero. En la demo, la pantalla de acceso muestra tres cuentas ficticias: Fundador, Vendedora START y Cuenta pendiente.

## Crear la cuenta del fundador (procedimiento seguro)

1. En el servidor, define `FOUNDER_EMAIL` y `FOUNDER_PASSWORD` (12 caracteres o más) como variables de entorno. Nunca en el código ni en el repositorio.
2. Arranca con `npm start`. Se crea la cuenta, o se restablece si ya existía ese correo: su contraseña y sus sesiones anteriores dejan de valer.
3. Cualquier otra cuenta con rol de administrador pierde ese rol. Nadie puede obtenerlo desde la web.
4. Entra, ve a **Seguridad** y activa el doble factor.

## Variables de entorno

Ver [.env.example](.env.example). Los secretos (pasarela, correo) viven solo en el servidor.

## Configurar antes de vender

Todo se hace desde el panel del fundador (`/admin`). Mientras falte algo indispensable, las ventas reales quedan bloqueadas y el **Resumen** dice qué falta.

- **Configuración:** titular, país, identificación fiscal, dirección, correo de soporte, WhatsApp, condiciones legales (con su versión), proveedor de correo y facturación.
- **Cobros y reglas:** modalidades (centralizado o directo al vendedor), cuentas receptoras de Yape, Plin, depósito y transferencia, tarjeta, tipo de cambio en soles, reglas de comisión versionadas y políticas de reventa, suspensión y devolución.
- **Planes y cursos:** nombre, precio, descripción y contenido de cada plan; cursos, módulos, lecciones y recursos privados.

## Flujo de compra y activación

1. Un vendedor activo comparte su enlace. El comprador ve quién lo atiende antes de pagar. Sin enlace, la venta es directa de Legado Digital.
2. El comprador se registra (nombre, apellido, país, correo, contraseña y foto opcional) y confirma su correo.
3. Crea el pedido y elige el medio. El pedido guarda una copia del beneficiario, las instrucciones, el importe y el tipo de cambio.
4. **Pago manual:** envía número de operación, fecha y comprobante. Lo revisa quien recibe el dinero: el vendedor si cobró él, o el fundador o un verificador delegado si cobró la plataforma. Aprobar exige confirmar que el ingreso llegó; rechazar exige un motivo, y el comprador puede enviar otro comprobante.
5. **Tarjeta:** solo activa la confirmación firmada de la pasarela (`POST /api/payments/webhook`, HMAC-SHA256 en la cabecera `x-ld-signature`). Volver a la web no activa nada. Si falta una confirmación, el fundador puede consultar al proveedor desde **Pedidos**.
6. Al aprobarse, en una sola transacción se conceden los derechos del plan, se activa la cuenta, se registra el movimiento económico y se avisa al comprador (sin incluir su contraseña). Repetir la aprobación no duplica nada.

## Dinero y comisiones

- Importes en unidades enteras con moneda: USD para el catálogo y PEN para cobros en soles, con la tasa usada guardada en el pedido.
- Lo cobrado directamente por un vendedor se registra como ingreso externo, no como saldo de la plataforma.
- Las comisiones solo existen con una regla habilitada. Cada venta guarda la versión aplicada y cambiar la regla no recalcula lo confirmado.
- Las liquidaciones están bloqueadas sin regla habilitada y nunca superan lo que custodia la plataforma.
- Devoluciones y contracargos generan ajustes enlazados al pedido. El acceso se retira solo si la política lo indica.
- Bonos y regalías tienen su estructura, pero están desactivados.

## Integrar la pasarela real

Pasa a `createApp` un adaptador `cardProvider` con `createCheckout({ order, user })`, que devuelve `{ url, ref }`, y `getStatus(order)`, que devuelve un evento o `null`. Adapta la verificación del webhook al formato del proveedor. Mientras tanto, `server/sandbox.mjs` simula el proveedor en la demo.

## Copias de seguridad

```bash
npm run backup                                   # crea backups/legado-FECHA con la base y los archivos privados
node scripts/restore.mjs backups/legado-FECHA data/prod   # detén el servidor antes
```

La restauración comprueba la integridad de la copia y conserva la carpeta anterior con otro nombre. Las pruebas automáticas incluyen una copia y su restauración.

## Esquema de datos

Tablas en [server/db.mjs](server/db.mjs): usuarios, sesiones, tokens de un uso, planes, cursos, módulos, lecciones, recursos, progreso, derechos de acceso, pedidos, eventos de pedido, comprobantes, eventos de pago, medios de cobro de vendedores, reglas de comisión, movimientos, liquidaciones, notificaciones, correos en cola, consentimientos, ajustes, consultas y registro administrativo.

## Qué es real, qué es demostración y qué está bloqueado

- **Implementado y probado:** cuentas, verificación de correo, sesiones con vencimiento, límite de intentos, doble factor del fundador, reautenticación en acciones sensibles, permisos en el servidor, referidos sin ciclos, pedidos, revisión manual, activación atómica, libro de movimientos, estadísticas, devoluciones, liquidaciones, red, campus, recursos privados, exportaciones, copias de seguridad. Ver [PRUEBAS.md](PRUEBAS.md).
- **Solo en sandbox:** el pago con tarjeta. Falta el proveedor real.
- **Bloqueado por datos pendientes:** ventas reales, envío de correos, comisiones, bonos y regalías. Ver [PENDIENTES.md](PENDIENTES.md).

Los textos legales son borradores hasta que un abogado los revise para tu jurisdicción.
