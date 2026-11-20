# Acceso por áreas

Los administradores gestionan las áreas, usuarios y reportes de su propia empresa
en **Áreas y usuarios**. Cada usuario pertenece a cero o un área; cada área
puede acceder a varios reportes. Los administradores conservan acceso a todos
los reportes de su empresa. Un visitante sin área no accede a reportes.

Antes de iniciar esta versión del servidor, desde `server/` ejecutar:

```sh
npm run migrate
```

Usar una conexión con permisos de modificación del esquema. Si se migra como
postgres, conceder al rol de la aplicación SELECT, INSERT, UPDATE y DELETE en
`areas` y `area_reports`, y USAGE/SELECT en `areas_id_seq` antes de publicar.

La migración es transaccional e idempotente. Conserva los permisos individuales
anteriores en áreas iniciales separadas (`Acceso inicial <id de usuario>`), sin
ampliarlos a otros usuarios. Se pueden renombrar esas áreas o reasignar usuarios
a nuevas áreas departamentales. La tabla antigua se conserva para recuperación,
pero deja de conceder acceso; sus endpoints devuelven 410.

La pertenencia, el rol y la empresa se consultan en la base en cada petición.
La lista de reportes y la emisión de tokens Power BI aplican el mismo filtro.
Los tokens Power BI ya emitidos siguen válidos hasta que expiren.

Para probar con PostgreSQL, `node test/run-isolated.js` crea y elimina una base
temporal independiente mediante DATABASE_URL (requiere CREATEDB). No modifica
tablas de producción. También se admite `TEST_DATABASE_URL=... npm test` con
una base desechable cuyo nombre comience con `ezcentriko_areas_test_`.

Producción actual: `76.13.172.242`, repositorio `/var/www/ezcentriko`, proceso PM2
`ezcentriko`, frontend servido desde `server/public`, dominio `ezcentrikope.com`.
Conservar copia del código, frontend y base antes de desplegar. Restaurar el
código/frontend previo permite volver a los permisos anteriores sin eliminar
las tablas de áreas. No ejecutar schema.sql en producción: contiene datos demo.
