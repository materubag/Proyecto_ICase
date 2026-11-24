'use strict';

/**
 * Documentation Generator for ICASE Studio
 * Generates comprehensive project documentation:
 * - README.md (Overview, quickstart, ports, demo accounts)
 * - CONTRIBUTING.md (Contribution guidelines, code & git standards)
 * - docs/MANUAL_USUARIO.md (End-user guide by role: Admin & Vendedor)
 * - docs/MANUAL_DESARROLLADOR.md (Architecture, ERD, API specs, deployment)
 */

function generateReadme(projectName = 'Tienda', entities = [], options = {}) {
  const safeName = projectName || 'Tienda';
  const isTaller = /herramienta|taller|prestamo/i.test(safeName);
  const frontPort = options.frontendPort || (isTaller ? '3012' : '3010');
  const backPort = options.backendPort || (isTaller ? '8088' : '8087');
  const dbPort = options.dbPort || (isTaller ? '5439' : '5438');

  let entityLines;
  if (entities && entities.length > 0) {
    entityLines = entities.map(e => `- **${e.modelName || e.name}**: \`/api/${(e.endpoint || e.name).toLowerCase()}\``).join('\n');
  } else if (isTaller) {
    entityLines = `- **HERRAMIENTA**: Catálogo e inventario de herramientas del taller (\`/api/herramientas\`)
- **PRESTAMO**: Solicitudes, entregas y devoluciones con control de vencimiento (\`/api/prestamos\`)
- **USUARIO**: Cuentas con roles Encargado y Estudiante (\`/api/usuarios\`)`;
  } else {
    entityLines = `- **PRODUCTO**: Catálogo e inventario de productos
- **VENTA**: Emisión de facturas y registro de ventas
- **USUARIO**: Gestión de usuarios y credenciales de acceso
- **ROL**: Matriz de permisos y perfiles (Administrador, Vendedor)`;
  }

  const systemTitle = isTaller
    ? `# ${safeName} — Sistema de Préstamo y Control de Herramientas de Taller`
    : `# ${safeName} — Sistema de Punto de Venta y Gestión de Inventario`;

  const systemDescription = isTaller
    ? `Sistema full-stack modular para la gestión de solicitudes, entregas, devoluciones y control de inventario de herramientas de taller. Incorpora reglas de negocio formales (plazos de 1 a 3 días, bloqueo por mora o stock cero y reposición atómica de inventario). Generado automáticamente por **ICASE Studio**.`
    : `Sistema full-stack modular para la gestión comercial, control de inventario en tiempo real, facturación ágil de mostrador y administración de cuentas de vendedores. Generado automáticamente por **ICASE Studio**.`;

  const accountsTable = isTaller
    ? `| Rol | Correo / Identificador | Contraseña | Pantallas Asignadas |
| :--- | :--- | :--- | :--- |
| **Encargado** | \`encargado@taller.edu.ec\` | \`Password123!\` | Catálogo y Registro de Herramientas, Bandeja de Solicitudes, Entregas y Devoluciones, Préstamos Vencidos |
| **Estudiante** | \`estudiante@taller.edu.ec\` | \`Password123!\` | Catálogo de Herramientas, Solicitud de Préstamo, Historial de Mis Solicitudes |`
    : `| Rol | Correo / Identificador | Contraseña | Pantallas Asignadas |
| :--- | :--- | :--- | :--- |
| **Administrador** | \`admin@nexora.ec\` | \`Password123!\` | Gestión de Inventario, Gestión de Vendedores, Historial de Ventas, Catálogo, Punto de Venta |
| **Vendedor** | \`vendedor@nexora.ec\` | \`Password123!\` | Catálogo de Productos, Punto de Venta y Facturación, Historial y Consulta de Ventas |`;

  return `${systemTitle}

${systemDescription}

---

## 🚀 Arquitectura y Tecnologías

El sistema está construido siguiendo las mejores prácticas de desarrollo web moderno:

| Componente | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TailwindCSS | Single Page Application (SPA) responsiva con navegación dinámica por roles. |
| **Backend API** | Node.js 20, Express, Sequelize | API RESTful protegida con JWT, validación de contratos y transacciones ACID. |
| **Base de Datos** | PostgreSQL 16 | Motor relacional con integridad referencial y migraciones versionadas. |
| **Contenedores** | Docker & Docker Compose | Entorno aislado multi-contenedor con red interna privada. |

---

## 📌 Puertos y Enlaces de Acceso Local

Una vez iniciado el entorno Docker, los servicios están disponibles en:

- 🌐 **Aplicación Web (Frontend):** [http://localhost:${frontPort}](http://localhost:${frontPort})
- 📡 **API REST (Backend):** [http://localhost:${backPort}/api](http://localhost:${backPort}/api)
- 📖 **Explorador OpenAPI / Swagger:** [http://localhost:${backPort}/docs](http://localhost:${backPort}/docs)
- 🗄️ **Base de Datos PostgreSQL:** \`127.0.0.1:${dbPort}\` (Usuario: \`postgres\`)

---

## 👥 Cuentas de Acceso y Demostración

El sistema se inicializa con cuentas demo para facilitar pruebas y evaluación:

${accountsTable}

---

## ⚙️ Instrucciones de Instalación y Puesta en Marcha

### Prerrequisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado y en ejecución en Windows, Linux o macOS.
- Git instalado en el equipo.

### Despliegue con Docker Compose (Recomendado)

1. Clonar el repositorio y ubicarse en la carpeta raíz:
   \`\`\`bash
   git clone <url-del-repositorio>
   cd ${safeName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app'}
   \`\`\`

2. Iniciar todos los contenedores con reconstrucción limpia:
   \`\`\`bash
   docker compose up --build -d
   \`\`\`

3. Verificar que los 3 contenedores estén saludables:
   \`\`\`bash
   docker compose ps
   \`\`\`

4. Abrir en el navegador [http://localhost:${frontPort}](http://localhost:${frontPort}) e iniciar sesión con cualquiera de las cuentas demo.

### Detener el entorno
\`\`\`bash
docker compose down
\`\`\`

Si desea reiniciar la base de datos limpiando volúmenes:
\`\`\`bash
docker compose down -v
docker compose up --build -d
\`\`\`

---

## 📚 Documentación Adicional

Consulte los manuales detallados incluidos en el repositorio:
- [Guía de Contribución](CONTRIBUTING.md): Flujo de Git, estándares de código y pruebas.
- [Manual de Usuario](docs/MANUAL_USUARIO.md): Guía paso a paso ilustrada según el perfil asignado.
- [Manual de Desarrollador](docs/MANUAL_DESARROLLADOR.md): Arquitectura, DER, endpoints de la API y despliegue.

---

## 📄 Módulos y Entidades de Datos
${entityLines}

---
*Generado automáticamente con arquitectura de software por ICASE Studio.*
`;
}

function generateContributing(projectName = 'Tienda') {
  const safeName = projectName || 'Tienda';
  return `# Guía de Contribución — ${safeName}

Agradecemos su interés en colaborar en el desarrollo y mantenimiento de **${safeName}**. Para mantener la calidad, consistencia y robustez del código, le solicitamos seguir las siguientes directrices.

---

## 🌿 Flujo de Trabajo con Git (GitFlow Simplificado)

1. **Ramas Principales:**
   - \`main\` o \`master\`: Código listo para producción. Protegida contra pushes directos.
   - \`develop\` o ramas de trabajo: Integración continua de nuevas características.

2. **Nomenclatura de Ramas de Trabajo:**
   - \`feature/nombre-funcionalidad\` (ej. \`feature/impresion-ticket-factura\`)
   - \`fix/descripcion-error\` (ej. \`fix/calculo-iva-decimales\`)
   - \`docs/actualizacion-manuales\` (ej. \`docs/guia-usuario-vendedor\`)

3. **Convención de Commits (Conventional Commits):**
   - \`feat: agregar filtro por fecha en historial de ventas\`
   - \`fix: corregir validacion de stock en facturacion\`
   - \`docs: actualizar manual de usuario para el rol Vendedor\`
   - \`refactor: optimizar consulta de kardex en Sequelize\`

---

## 💻 Estándares de Código

### Frontend (React + Vite)
- Componentes funcionales con Hooks (\`useState\`, \`useEffect\`, \`useMemo\`).
- Estilos utilitarios con **TailwindCSS**.
- Clientes HTTP centralizados en \`src/api/client.js\` utilizando Bearer Token automático.
- Nombres de archivos de componentes en **PascalCase** (\`PuntoDeVenta.jsx\`).

### Backend (Node.js + Express + Sequelize)
- Nombres de controladores en **camelCase** (\`ventaController.js\`).
- Transacciones obligatorias (\`models.sequelize.transaction\`) para operaciones que modifiquen múltiples tablas (ej. Venta + Detalle + Descuento de Inventario).
- Sin excepciones silenciosas: todo error debe manejarse con códigos de estado HTTP apropiados (\`400\`, \`401\`, \`403\`, \`404\`, \`422\`, \`500\`).
- Sanitización estricta: nunca retornar hashes de contraseña en las respuestas de la API.

---

## 🧪 Pruebas y Validación Local

Antes de enviar un Pull Request, ejecute las pruebas y validaciones locales:

\`\`\`bash
# 1. Validar sintaxis y pruebas de backend
cd backend
npm test

# 2. Validar compilación limpia de frontend
cd ../frontend
npm run build

# 3. Validar arranque completo de Docker
cd ..
docker compose down
docker compose up --build -d
\`\`\`

---

## 📋 Lista de Comprobación para Pull Requests

Antes de solicitar la revisión de su PR, asegúrese de:
- [ ] La rama compila sin errores ni advertencias críticas.
- [ ] Los nuevos endpoints están documentados en OpenAPI / Swagger.
- [ ] No se incluyen archivos temporales, carpetas \`node_modules\` ni archivos \`.env\` con credenciales reales.
- [ ] Las migraciones de base de datos son idempotentes (\`IF NOT EXISTS\`).
- [ ] Se adjunta evidencia o capturas del correcto funcionamiento en el mensaje del PR.
`;
}

function generateUserManual(projectName = 'Tienda') {
  const safeName = projectName || 'Tienda';
  return `# Manual de Usuario del Sistema — ${safeName}

Manual operativo dirigido a usuarios finales del sistema: **Administradores** y **Vendedores**.

---

## 1. Introducción y Acceso al Sistema

El sistema **${safeName}** es una solución integral para la gestión comercial y venta en mostrador (POS), permitiendo controlar inventarios, registrar ventas con cálculo automático de impuestos y administrar cuentas de usuario.

### Acceso a la Plataforma
1. Abra su navegador web (Google Chrome, Firefox o Edge).
2. Ingrese a la dirección: **http://localhost:3010**
3. En la pantalla de bienvenida, ingrese su correo electrónico (o usuario) y contraseña.

---

## 2. Guía Operativa para el Rol: VENDEDOR

El rol **Vendedor** tiene acceso a las pantallas operativas de caja y consulta:

\`\`\`
[Catálogo de Productos] ──> [Punto de Venta / Facturación] ──> [Historial de Ventas]
\`\`\`

### 2.1. Catálogo de Productos para Venta
- **Objetivo:** Consultar existencias, precios y características de los productos disponibles.
- **Operaciones:**
  1. Utilice el buscador para filtrar por nombre o código de producto (ej. "Arroz", "Aceite").
  2. Verifique la columna de **Stock / Existencia Actual**. Los productos sin existencia mostrarán una alerta visual.
  3. Compruebe el **Precio de Venta** unitario actualizado.

### 2.2. Punto de Venta y Facturación (Caja)
- **Objetivo:** Registrar compras de clientes, calcular impuestos y emitir comprobantes de venta con descuento automático de inventario.
- **Paso a Paso:**
  1. **Seleccionar Productos:** Haga clic en el botón "+" o "Agregar" del producto deseado. Indique la cantidad requerida.
     - *Validación:* El sistema no permite agregar una cantidad mayor al stock disponible en bodega.
  2. **Revisar Carrito:** En el panel lateral derecho se calcularán en tiempo real:
     - **Subtotal:** Suma neta de los productos agregados.
     - **IVA (15%):** Impuesto al valor agregado calculado automáticamente.
     - **Total a Pagar:** Monto final a cobrar.
  3. **Datos del Comprobante:**
     - Ingrese el Nombre o Razón Social del cliente (o "Consumidor Final").
     - Ingrese el número de Cédula o RUC.
     - Seleccione el Método de Pago (Efectivo, Tarjeta, Transferencia).
  4. **Emitir Factura:** Presione el botón **"Emitir Factura y Cobrar"**.
  5. **Confirmación:** Aparecerá un modal de confirmación con el número de factura generado (ej. \`FAC-001-2849\`), confirmando que el inventario se descontó de inmediato.

### 2.3. Historial y Consulta de Ventas
- **Objetivo:** Consultar comprobantes emitidos en el turno o jornada.
- **Operaciones:**
  1. Revise el listado cronológico de comprobantes emitidos.
  2. Verifique fecha, número de factura, cliente, vendedor responsable y monto total.
  3. Visualice el desglose de productos vendidos por factura.

---

## 3. Guía Operativa para el Rol: ADMINISTRADOR

El rol **Administrador** cuenta con control total del sistema, incluyendo módulos de configuración y auditoría.

### 3.1. Gestión de Inventario y Productos
- **Alta de Productos:** Presione el botón **"Nuevo Producto"** y complete:
  - Código único (SKU / Código de barra).
  - Nombre descriptivo del producto.
  - Precio de venta al público.
  - Stock inicial disponible.
- **Ajuste de Stock y Precios:** Permite modificar directamente las existencias físicas ante compras a proveedores o ajustes de inventario.
- **Inactivación:** Puede desactivar productos descontinuados sin borrar el histórico de ventas anteriores.

### 3.2. Gestión de Cuentas de Vendedores
- **Creación de Vendedores:**
  1. Diríjase al menú **"Gestión de Cuentas de Vendedores"**.
  2. Complete el formulario con Nombre completo, Nombre de usuario y Contraseña inicial.
  3. Al guardar, la cuenta queda inmediatamente activa con rol **Vendedor**.
- **Control de Estado:** El administrador puede suspender temporalmente el acceso de un vendedor o restablecer su contraseña.

---

## 4. Preguntas Frecuentes y Solución de Problemas

| Problema | Causa Común | Solución |
| :--- | :--- | :--- |
| *Stock insuficiente al facturar* | La cantidad requerida supera la existencia en bodega. | Ajuste la cantidad en el carrito o actualice el stock desde el módulo de inventario. |
| *Acceso denegado / Credenciales inválidas* | Contraseña o usuario incorrectos. | Use \`Password123!\` en las cuentas demo o solicite restablecimiento al Administrador. |
| *La pantalla no carga registros* | Pérdida momentánea de conexión con la API. | Presione F5 para recargar la página o verifique que los contenedores Docker sigan activos. |
`;
}

function generateDeveloperManual(projectName = 'Tienda') {
  const safeName = projectName || 'Tienda';
  return `# Manual del Desarrollador — ${safeName}

Documentación técnica, arquitectura de software, especificación de API y guía de mantenimiento para **${safeName}**.

---

## 1. Arquitectura General del Sistema

El sistema implementa una arquitectura cliente-servidor desacoplada basada en microservicios contenerizados:

\`\`\`mermaid
flowchart LR
    Browser["Navegador Web\n(Cliente SPA)"] -- "HTTP :3010" --> Nginx["Contenedor: tienda\n(Nginx 1.25)"]
    Nginx -- "Proxy Reverse\n/api/*" --> Express["Contenedor: tienda_backend\n(Node.js 20 Express)"]
    Express -- "Sequelize ORM\nPuerto 5432" --> Postgres["Contenedor: tienda_postgres\n(PostgreSQL 16)"]
\`\`\`

### Componentes:
1. **Frontend (Contenedor \`${safeName.toLowerCase()}\`):**
   - Servidor Nginx sirviendo la SPA compilada con Vite.
   - Proxy reverso interno configurado en \`/etc/nginx/conf.d/default.conf\` que redirige \`/api/\` hacia el backend en el puerto 8080 interno de Docker.
2. **Backend (Contenedor \`${safeName.toLowerCase()}_backend\`):**
   - Servidor Express en puerto 8080.
   - Capa de autenticación con JSON Web Tokens (JWT) firmados con \`HS256\`.
   - ORM Sequelize para abstracción y persistencia relacional con PostgreSQL.
3. **Base de Datos (Contenedor \`${safeName.toLowerCase()}_postgres\`):**
   - PostgreSQL 16 con volumen persistente para datos transaccionales.

---

## 2. Modelo Relacional de Base de Datos (DER)

\`\`\`mermaid
erDiagram
    ROLES ||--o{ USUARIOS : "asigna perfil"
    USUARIOS ||--o{ VENTAS : "emite"
    USUARIOS ||--o{ PRODUCTOS : "registra"
    PRODUCTOS ||--o{ DETALLE_VENTAS : "incluido en"
    VENTAS ||--o{ DETALLE_VENTAS : "contiene"
    PRODUCTOS ||--o{ MOVIMIENTO_INVENTARIOS : "kardex"

    ROLES {
        int id PK
        string nombre
        string descripcion
    }
    USUARIOS {
        int id PK
        int rol_id FK
        string nombre
        string nombre_usuario
        string contrasena_hash
        boolean activo
    }
    PRODUCTOS {
        int id PK
        string codigo
        string nombre
        decimal precio_venta
        int existencia_actual
        boolean activo
    }
    VENTAS {
        int id PK
        int vendedor_id FK
        int usuario_id FK
        string numero_factura
        timestamp fecha_venta
        decimal total
        decimal monto_total
    }
    DETALLE_VENTAS {
        int id PK
        int venta_id FK
        int producto_id FK
        int cantidad
        decimal precio_unitario
        decimal subtotal
    }
\`\`\`

---

## 3. Catálogo de la API REST

Todos los endpoints (a excepción de login y healthcheck) requieren el encabezado:
\`Authorization: Bearer <token_jwt>\`

### 3.1. Autenticación (\`/api/auth\`)
- \`POST /api/auth/login\`
  - **Body:** \`{ "identifier": "vendedor@nexora.ec", "password": "Password123!" }\`
  - **Respuesta (200):** \`{ "success": true, "token": "...", "user": { "id": 4, "role": "Vendedor" } }\`
- \`GET /api/auth/me\`
  - **Respuesta (200):** Datos del usuario autenticado en sesión.

### 3.2. Productos e Inventario (\`/api/productos\`)
- \`GET /api/productos\`
  - Retorna el listado completo de productos activos con existencia y precio.
- \`POST /api/productos\` (Requiere rol: Administrador)
  - **Body:** \`{ "codigo": "PROD-001", "nombre": "Arroz 1kg", "precio": 1.50, "stock": 50 }\`
  - Normalización automática: El backend traduce \`precio\` a \`precio_venta\` y \`stock\` a \`existencia_actual\`.
- \`PUT /api/productos/:id\` (Requiere rol: Administrador)
  - Actualiza existencias o precio de un producto.

### 3.3. Ventas y Facturación (\`/api/ventas\`)
- \`GET /api/ventas\` (Roles: Administrador, Vendedor)
  - Retorna el histórico cronológico de comprobantes emitidos.
- \`POST /api/ventas\` (Roles: Administrador, Vendedor)
  - Emite factura con validación atómica y descuento de stock.
  - **Body de ejemplo:**
    \`\`\`json
    {
      "numeroFactura": "FAC-001-9482",
      "cliente": "Consumidor Final",
      "identificacion": "9999999999",
      "metodoPago": "Efectivo",
      "subtotal": 10.00,
      "iva": 1.50,
      "total": 11.50,
      "items": [
        { "productoId": 1, "cantidad": 2, "precio": 5.00 }
      ]
    }
    \`\`\`
  - **Respuesta (201):** Venta creada, stock actualizado y registro en kardex.
  - **Errores posibles:** \`400 Bad Request\` si el stock solicitado supera la existencia física.

### 3.4. Vendedores y Usuarios (\`/api/vendedores\` y \`/api/usuarios\`)
- \`GET /api/vendedores\`
  - Lista todas las cuentas con perfil de ventas.
- \`POST /api/vendedores\` o \`POST /api/usuarios\`
  - Registra un nuevo usuario con hashing seguro de contraseña mediante \`bcryptjs\` (salt rounds = 10).

---

## 4. Variables de Entorno y Configuración

El archivo \`.env\` del backend contiene las siguientes variables críticas:

\`\`\`ini
PORT=8080
APP_NAME=Tienda
NODE_ENV=production
DB_HOST=db
DB_PORT=5432
DB_NAME=tienda_db
DB_USER=postgres
DB_PASSWORD=pg_secure_password
JWT_SECRET=super_secret_jwt_key_2026_icase
AUTO_SYNC_DB=false
\`\`\`

---

## 5. Procedimientos de Mantenimiento y Depuración

### Ver logs en tiempo real
\`\`\`bash
# Logs del backend Express
docker logs -f tienda_backend

# Logs del servidor web Nginx
docker logs -f tienda

# Logs de la base de datos PostgreSQL
docker logs -f tienda_postgres
\`\`\`

### Ejecutar consultas directas en PostgreSQL
\`\`\`bash
docker exec -it tienda_postgres psql -U postgres -d tienda_db -c "SELECT id, nombre_usuario, activo FROM usuarios;"
\`\`\`

### Migraciones y Semillas
El contenedor backend ejecuta automáticamente \`npm run migrate\` y el script de demo users (\`src/seed-demo-users.js\`) en cada inicio para asegurar la integridad referencial.
`;
}

module.exports = {
  generateReadme,
  generateContributing,
  generateUserManual,
  generateDeveloperManual
};
