# Fisiosilver

Aplicacion web para apoyo al seguimiento de salud en personas mayores, orientada a un TFM con enfoque practico y defendible.

## Stack actual

- React + Vite + TypeScript
- Supabase
- Vercel

## MVP actual

La app mantiene las pantallas originales:

- Login y registro
- Inicio / Dashboard
- Diario de salud
- Fragilidad / VIG
- Informes clinicos
- Nutricion
- Asistente de voz

La idea del MVP es sencilla:

- el paciente inicia sesion;
- registra constantes;
- completa el cuestionario VIG;
- consulta informacion guardada;
- usa funciones de IA solo cuando estan configuradas.

## Cambios implementados para alineacion TFM

Se han aplicado cambios pequenos pero claros para que el proyecto encaje mejor con lo visto en clase:

1. Servicio de base de datos aclarado.
   El servicio real ahora vive en `services/dbService.ts`. Se mantiene `services/firestore.ts` solo por compatibilidad con imports antiguos.

2. Roles basicos.
   Se anade `role` con dos valores:
   - `patient`
   - `admin`

3. Activacion e inactivacion de usuarios.
   Se anade `active` en la tabla `users`. Si un usuario esta inactivo, no puede seguir usando la app tras autenticarse.

4. Pantalla de administracion.
   El administrador puede:
   - listar usuarios;
   - ver nombre, email, rol, activo/inactivo y fecha de creacion;
   - cambiar rol;
   - activar o desactivar usuarios;
   - consultar acciones registradas.

5. Registro de acciones.
   Se usa la tabla `user_action_log` para guardar acciones principales como login, logout, registros diarios, VIG, correcciones, borrados y cambios administrativos.

6. Auditoria sencilla.
   Se anaden tablas de auditoria para usuario, diario, VIG, informes clinicos y nutricion. La app guarda cambios relevantes sin complicar demasiado la logica.

7. Datos del paciente corregibles.
   Perfil, diario, VIG, informes clinicos y nutricion pueden corregirse o eliminarse segun el caso. Las correcciones relevantes quedan auditadas y los borrados quedan registrados como accion.

8. Modelo relacional mas defendible.
   La evaluacion VIG mantiene `vigs_assessments` para el resultado global y ahora tambien guarda respuestas en `assessment_answers`.

9. IA como funcionalidad avanzada.
   La app ya no se bloquea por falta de clave de IA. Login, dashboard, diario y VIG siguen funcionando. Solo las funciones de IA muestran aviso de configuracion.

10. Backend/API conceptual.
   Se mantiene `/api/groq` y se prepara `/api/gemini` para acercar el proyecto a una arquitectura con backend intermediario en Vercel.

## Modelo de datos resumido

Tablas principales:

- `users`
- `daily_logs`
- `vigs_assessments`
- `assessment_answers`
- `clinical_reports`
- `nutrition_logs`
- `user_action_log`
- `user_audit`
- `daily_logs_audit`
- `vigs_assessment_audit`
- `clinical_reports_audit`
- `nutrition_logs_audit`

Relaciones clave:

- un usuario tiene muchos registros diarios;
- un usuario tiene muchas evaluaciones VIG;
- una evaluacion VIG tiene muchas respuestas;
- un usuario puede tener muchos informes clinicos y nutricionales;
- un usuario genera muchos logs de accion y auditoria.

## SQL para Supabase

Ejecuta este archivo en Supabase:

- [supabase_migration_tfm.sql](/Users/m.jamilkhirbek/Documents/New%20project/Fisiosilver-main/supabase_migration_tfm.sql)

Archivo de apoyo para explicar el esquema:

- [database_schema.sql](/Users/m.jamilkhirbek/Documents/New%20project/Fisiosilver-main/database_schema.sql)

Si se usan subidas de archivos en Supabase Storage, ejecuta tambien:

- [supabase_storage_policies.sql](/Users/m.jamilkhirbek/Documents/New%20project/Fisiosilver-main/supabase_storage_policies.sql)

## Como crear un administrador

1. Crea primero un usuario normal desde la app.
2. En Supabase, abre el editor SQL.
3. Ejecuta:

```sql
update public.users
set role = 'admin', active = true
where email = 'tu-email@ejemplo.com';
```

4. Cierra sesion y vuelve a entrar con ese usuario.

## Variables de entorno

Minimas para desarrollo:

```env
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

Notas:

- No es obligatorio tener IA configurada para probar login, diario y VIG.
- Si no configuras claves, las pantallas de IA mostraran un aviso pero la app seguira funcionando.

## Ejecutar en local

Requisitos:

- Node.js

Pasos:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir en navegador:

- [http://localhost:3000](http://localhost:3000)

## Comandos de comprobacion

```bash
npm run lint
npm run build
```

## Despliegue en Vercel

El proyecto esta pensado para seguir desplegando en Vercel:

1. subir el repositorio;
2. configurar las variables de entorno si se van a usar funciones de IA;
3. desplegar;
4. mantener Supabase como base de datos.

## Demo sugerida para el TFM

Flujo paciente:

1. iniciar sesion;
2. registrar constantes en Diario;
3. corregir un registro anterior;
4. completar VIG;
5. corregir una evaluacion VIG desde el historial;
6. subir un informe clinico y corregir o eliminarlo si hay error;
7. subir una foto de comida y corregir o eliminar el registro;
8. consultar historial y dashboard.

Flujo administrador:

1. iniciar sesion con un usuario promovido a `admin`;
2. abrir la pestaña `Admin`;
3. listar usuarios;
4. cambiar un rol;
5. activar o desactivar un usuario;
6. mostrar el `user_action_log`.

## Limitaciones conocidas

- La IA sigue siendo una funcionalidad complementaria, no el nucleo del MVP.
- La ruta `/api/gemini` mejora el planteamiento de backend, pero no sustituye una arquitectura sanitaria completa.
- La auditoria es simple: suficiente para defender el TFM, no para un entorno clinico real.
- Los buckets de Storage se mantienen publicos para no romper `getPublicUrl()`; en una version final seria mejor usar buckets privados y URLs firmadas desde backend.
