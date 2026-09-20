# Despliegue de la web

## Hosting actual: Hostinger

El dominio `ezcentriko.com` sirve ahora la web desde el hosting de Hostinger.
Publicar el contenido de `web/dist/` en `public_html/`: `index.html` y `assets/`
deben quedar al mismo nivel. Subir el proyecto completo deja las imágenes en
`public/assets/`, pero la página las solicita en `/assets/` y obtiene errores 404.

Desde la raíz del repositorio:

```powershell
npm --prefix web run build
python web/deploy/upload-hostinger.py --root /public_html
```

La carpeta pública de esta cuenta FTP es `/public_html`.
El script solicita la contraseña sin guardarla, usa FTP con TLS y verifica
el certificado del proveedor. Reemplaza los archivos sin guardar copias de
respaldo, verifica las transferencias y publica el HTML al final.
No elimina otros archivos del hosting. Si el CDN conserva una respuesta
antigua, purgar la caché del dominio desde Hostinger.

## Despliegue inicial en VPS

La landing se sirve como archivos estáticos con Nginx. No necesita ejecutar Vite
en producción ni desplegar `client`, `server` o PostgreSQL.

- VPS: `2.25.210.143`
- Código: `/opt/ezcentriko`
- Versiones: `/var/www/ezcentriko/releases/`
- Versión publicada: `/var/www/ezcentriko/current` (enlace simbólico)
- Configuración: `/etc/nginx/sites-available/ezcentriko`

## Actualizar

Conectarse por SSH y ejecutar:

```sh
cd /opt/ezcentriko
git pull --ff-only
cd web
npm ci
npm run build
release="/var/www/ezcentriko/releases/$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
install -d -m 755 "$release"
cp -a dist/. "$release/"
chmod -R a+rX "$release"
ln -s "$release" /var/www/ezcentriko/current.next
mv -Tf /var/www/ezcentriko/current.next /var/www/ezcentriko/current
curl --fail --head http://127.0.0.1/
```

Las versiones anteriores se conservan. Para volver a una de ellas, crear
`current.next` apuntando a su ruta y sustituir `current` con el mismo `mv -Tf`.

## Nginx y dominio

La configuración inicial está en `ezcentriko.nginx`. Tras cualquier cambio:

```sh
nginx -t && systemctl reload nginx
```

Para servir el dominio por HTTPS, los registros DNS de `ezcentriko.com` y
`www.ezcentriko.com` deben apuntar a `2.25.210.143`; cualquier registro AAAA
también debe corresponder a esta VPS. Después se puede emitir un certificado
TLS e instalarlo en Nginx. La publicación inicial por IP utiliza HTTP.

No almacenar credenciales SSH en el repositorio.
