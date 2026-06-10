# Resumen ONPE frontend

Panel local para visualizar votos por candidato, diferencia de votos y administrar animaciones de dos candidatos.

## Ejecutar

```bash
npm start
```

Luego abre:

```text
http://localhost:5173
```

El servidor expone un proxy local:

- `/api/totales`
- `/api/participantes`

Si ONPE no responde o bloquea la consulta, la interfaz usa los datos de respaldo incluidos en `src/app.js`.

## Configuracion

- El panel de administracion se abre con el boton `Admin`.
- Usuario: `admin`
- Clave: `admin`
- Las animaciones, colores, escala e imagen de cada candidato se guardan en `data/settings.json`.
- Los clientes leen la configuracion compartida desde `/api/settings`.
- Las imagenes cargadas desde el panel se guardan en `public/uploads` y se sirven como recursos publicos, por ejemplo `/public/uploads/archivo.png`.
- Si ONPE requiere una cookie de Cloudflare, ejecuta el servidor con `ONPE_COOKIE`:

```bash
ONPE_COOKIE="cf_clearance=..." npm start
```

En PowerShell:

```powershell
$env:ONPE_COOKIE="cf_clearance=..."
npm start
```

Tambien puedes cambiar las credenciales del administrador:

```powershell
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD="admin"
npm start
```
