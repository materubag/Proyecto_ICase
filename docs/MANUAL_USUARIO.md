# Manual de Usuario del Sistema — Tienda

Manual operativo dirigido a usuarios finales del sistema: **Administradores** y **Vendedores**.

---

## 1. Introducción y Acceso al Sistema

El sistema **Tienda** es una solución integral para la gestión comercial y venta en mostrador (POS), permitiendo controlar inventarios, registrar ventas con cálculo automático de impuestos y administrar cuentas de usuario.

### Acceso a la Plataforma
1. Abra su navegador web (Google Chrome, Firefox o Edge).
2. Ingrese a la dirección: **http://localhost:3010**
3. En la pantalla de bienvenida, ingrese su correo electrónico (o usuario) y contraseña.

---

## 2. Guía Operativa para el Rol: VENDEDOR

El rol **Vendedor** tiene acceso a las pantallas operativas de caja y consulta:

```
[Catálogo de Productos] ──> [Punto de Venta / Facturación] ──> [Historial de Ventas]
```

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
  5. **Confirmación:** Aparecerá un modal de confirmación con el número de factura generado (ej. `FAC-001-2849`), confirmando que el inventario se descontó de inmediato.

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
| *Acceso denegado / Credenciales inválidas* | Contraseña o usuario incorrectos. | Use `Password123!` en las cuentas demo o solicite restablecimiento al Administrador. |
| *La pantalla no carga registros* | Pérdida momentánea de conexión con la API. | Presione F5 para recargar la página o verifique que los contenedores Docker sigan activos. |
