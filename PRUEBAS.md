# Pruebas ejecutadas

Ejecución del 3 de noviembre de 2026 con `npm test`, contra la API real por HTTP: **23 de 23 correctas**.

## Escenarios de aceptación del encargo

| Escenario | Resultado |
| --- | --- |
| El fundador activa a cuatro compradores y cada uno completa una venta directa a un cliente nuevo | Correcta |
| Una cuenta pendiente no abre cursos ni vende, aunque use la URL o la API | Correcta |
| START no accede a contenido superior ni ofrece planes no autorizados | Correcta |
| Un vendedor revisa su cobro directo, pero no un cobro de la plataforma ni su propia compra | Correcta |
| Ningún vendedor lee perfiles, comprobantes ni datos económicos de otra rama | Correcta |
| El rechazo conserva el motivo y permite corregir el comprobante | Correcta |
| Dos aprobaciones simultáneas o un webhook repetido generan una sola activación y un solo movimiento | Correcta |
| Un pago con importe, moneda o pedido incorrectos no activa | Correcta |
| Las estadísticas salen de movimientos reales y responden a devoluciones y ajustes | Correcta |
| Cerrar sesión, recuperar contraseña y editar el perfil funcionan | Correcta |
| El sistema bloquea pagos sin configurar y muestra qué falta | Correcta |
| La información de prueba no aparece como actividad real fuera de la demostración | Correcta |

## Seguridad y reglas complementarias

| Prueba | Resultado |
| --- | --- |
| Un evento desordenado (devolución antes del pago) no activa y la conciliación consulta al proveedor | Correcta |
| El fundador es el único administrador; el registro y el navegador no conceden permisos | Correcta |
| Doble factor del fundador y reautenticación en acciones sensibles | Correcta |
| El patrocinador se cambia solo con motivo, sin ciclos y con trato explícito de pedidos abiertos | Correcta |
| La red admite generaciones sucesivas y el vendedor solo gestiona las directas | Correcta |
| Las liquidaciones están bloqueadas sin reglas y nunca superan lo custodiado | Correcta |
| Una suspensión bloquea panel y ventas nuevas, conserva el contacto y se puede reactivar | Correcta |
| Los planes se editan sin alterar pedidos anteriores | Correcta |
| Los archivos se validan por su contenido y no se sirven fuera de public | Correcta |
| La copia de seguridad se puede restaurar y conserva los datos | Correcta |
| Los importes son enteros, los precios 50, 100 y 200, y WhatsApp usa el número oficial | Correcta |

## Comprobado en el navegador (demostración)

- Venta por enlace: el comprador ve «Esta venta la atiende: Elena R.», se registra, confirma el correo, elige Yape, ve beneficiario, importe en soles y tipo de cambio, y envía el comprobante.
- La vendedora revisa el pago. Sin marcar la casilla de comprobación no puede aprobar. Al aprobar, la compradora pasa a activa y aparece en sus clientes.
- La cuenta pendiente no entra en «Mi formación» ni por la dirección directa (la API responde 403).
- Actualización a PRO con tarjeta en la pasarela de pruebas: el retorno no activa; la confirmación del proveedor sí, y el nivel sube a 2.
- Panel del fundador: las doce secciones cargan; el tipo de cambio se guarda.
- Escritorio y móvil (360, 390, 768 y 1024 px) sin scroll horizontal; el menú lateral se abre y se cierra con Escape en móvil.

## No probado

- Cobro real con tarjeta: no hay proveedor contratado.
- Envío real de correos: no hay proveedor de correo.
- Copia y restauración en el servidor de producción: solo en la prueba automática.
