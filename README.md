# 🍣 Plataforma E-Commerce — Servidor API Backend

Este repositorio contiene la **API Backend centralizada** del proyecto **SushiGo**, encargada de la lógica de negocio, persistencia de datos, autenticación segura stateless (JWT), procesamiento transaccional de pedidos y comunicación bidireccional en tiempo real mediante WebSockets.

---

## 👥 Información del Proyecto

- **Integrantes del Equipo:**
  - José Armando Abarca Sánchez
  - Isaac Alejandro Padrón Becerra
  - Jorge Alexis Ramos Equihua
  - Leticia Guadalupe

---

## 🛠️ Tecnologías Utilizadas

- **Entorno de Ejecución:** Node.js
- **Framework Web:** Express.js
- **Lenguaje:** JavaScript (ES6+) / TypeScript
- **Base de Datos y ORM:** PostgreSQL / MySQL con Prisma ORM (o Sequelize)
- **Seguridad y Autenticación:** JSON Web Tokens (JWT), Bcrypt (Hashing de contraseñas), Helmet, CORS
- **Comunicación en Tiempo Real:** Socket.io / WebSockets
- **Calidad y Estilo de Código:** ESLint, Prettier, Jest / Supertest

---

## 📋 Módulos del Sistema y Requerimientos Cubiertos

### 1. Módulo: Autenticación y Control de Acceso (RF-BAC-AUTH)
Encargado de la gestión de identidades y la seguridad stateless de la plataforma.
- **RF-BAC-AUTH-01 (Registro de Usuarios):** Creación de cuentas con validación de datos y encriptación de contraseñas con hash Bcrypt.
- **RF-BAC-AUTH-02 (Autenticación Multinivel):** Inicio de sesión con generación de Access Tokens y Refresh Tokens para clientes, repartidores y administradores.
- **RF-BAC-AUTH-03 (Middleware de Autorización):** Protección de rutas privadas mediante verificación de firma JWT y Control de Acceso Basado en Roles (RBAC).

### 2. Módulo: Catálogo e Inventario (RF-BAC-CAT)
Servicios para la consulta y administración de productos disponibles.
- **RF-BAC-CAT-01 (Consulta de Productos):** Endpoints paginados con soporte para filtros por categorías (Rolls, Nigiris, Bebidas) y búsqueda por texto.
- **RF-BAC-CAT-02 (Ficha y Disponibilidad):** Exposición de detalle de producto, ingredientes, precio y validación de stock en tiempo real.
- **RF-BAC-CAT-03 (Gestión de Catálogo):** Operaciones CRUD restringidas para el Administrador.

### 3. Módulo: Pedidos y Transacciones (RF-BAC-PED)
Motor principal de procesamiento de compras y ciclo de vida de la orden.
- **RF-BAC-PED-01 (Creación de Pedidos Atómica):** Procesamiento de compras mediante **transacciones ACID** en base de datos para garantizar la consistencia entre la cabecera de la orden y sus detalles.
- **RF-BAC-PED-02 (Cálculo del Total):** Verificación en servidor de precios, impuestos y costo de envío para evitar manipulación desde los clientes.
- **RF-BAC-PED-03 (Gestión de Estados):** Control del flujo de estados de la orden (*Recibido ➔ En preparación ➔ En camino ➔ Entregado*).
- **RF-BAC-PED-04 (Asignación a Repartidor):** Vinculación de pedidos confirmados a repartidores disponibles.

### 4. Módulo: Servidor de Tiempo Real (RF-BAC-TR)
Infraestructura de comunicación asíncrona para rastreo en vivo.
- **RF-BAC-TR-01 (Emisión de Eventos WebSockets):** Difusión instantánea de cambios de estado de pedidos hacia las apps móviles (Clientes y Repartidores) y la web.

---

## 🛡️ Requerimientos No Funcionales (RNF-BAC)

- **RNF-BAC-01 (Rendimiento):** Tiempo de respuesta promedio menor a 200 ms en peticiones REST estándar.
- **RNF-BAC-02 (Integridad de Datos):** Garantía de atomicidad ($ACID$) con ejecución de `ROLLBACK` automático ante cualquier fallo durante la creación de pedidos.
- **RNF-BAC-03 (Seguridad Estricta):** Sanitización de parámetros contra Inyección SQL y ataques XSS, además de limitación de tasa de peticiones (*Rate Limiting*).
- **RNF-BAC-04 (Escalabilidad en Tiempo Real):** Manejo eficiente de conexiones concurrentes vía WebSockets con resiliencia y soporte para reconexión.

---

## API: Rutas para Postman

El servidor local escucha por defecto en `http://localhost:3000`. En Postman,
crea una variable `baseUrl` con el valor `http://localhost:3000` y usa las rutas
completas de esta sección. Para enviar JSON, selecciona **Body → raw → JSON**.

### Autenticación y prueba de conexión

| Método | URL | Acceso |
|---|---|---|
| `GET` | `{{baseUrl}}/api/health` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/login-admin` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/login-staff` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/customer/register` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/customer/login` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/customer/verify-2fa` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/customer/forgot-password` | Público |
| `POST` | `{{baseUrl}}/api/v1/auth/customer/reset-password` | Público |
| `GET` | `{{baseUrl}}/api/v1/auth/me` | Bearer token |
| `GET` | `{{baseUrl}}/api/v1/auth/admin/dashboard-stats` | Admin |

Para obtener un token de administrador:

```json
{
  "correoElectronico": "admin@ejemplo.com",
  "password": "tu-contrasena"
}
```

Para obtener un token de personal:

```json
{
  "codigoEmpleado": "0001",
  "pin": "1234"
}
```

En las peticiones protegidas, configura **Authorization → Bearer Token** y pega
el valor `token` que devuelve el login (sin escribir `Bearer ` en el campo del
token). Las rutas de escritura y administración requieren un usuario con rol
`Admin`.

### Personal y operaciones

| Método | URL | Acceso |
|---|---|---|
| `POST` | `{{baseUrl}}/api/v1/usuarios/staff` | Admin |
| `GET` | `{{baseUrl}}/api/v1/usuarios/staff` | Admin |
| `PUT` | `{{baseUrl}}/api/v1/usuarios/staff/:id` | Admin |
| `DELETE` | `{{baseUrl}}/api/v1/usuarios/staff/:id` | Admin |
| `GET` | `{{baseUrl}}/api/v1/staff/kitchen/orders` | Admin o Cocina |
| `GET` | `{{baseUrl}}/api/v1/staff/pos/tables` | Admin o Mesero |

Ejemplo de `POST /api/v1/usuarios/staff`:

```json
{
  "nombre": "Ana",
  "apellido": "Lopez",
  "telefono": "5551234567",
  "codigoEmpleado": "0002",
  "pin": "1234",
  "rolNombre": "Cocina"
}
```

`rolNombre` acepta `Mesero` o `Cocina`.

### Categorías y productos

| Método | URL | Acceso |
|---|---|---|
| `GET` | `{{baseUrl}}/api/v1/categorias` | Bearer token |
| `POST` | `{{baseUrl}}/api/v1/categorias` | Admin |
| `PUT` | `{{baseUrl}}/api/v1/categorias/:id` | Admin |
| `DELETE` | `{{baseUrl}}/api/v1/categorias/:id` | Admin |
| `GET` | `{{baseUrl}}/api/v1/productos` | Bearer token |
| `GET` | `{{baseUrl}}/api/v1/productos/:id` | Bearer token |
| `POST` | `{{baseUrl}}/api/v1/productos` | Admin |
| `PUT` | `{{baseUrl}}/api/v1/productos/:id` | Admin |
| `DELETE` | `{{baseUrl}}/api/v1/productos/:id` | Admin |

Ejemplo de creación de categoría:

```json
{
  "nombre": "Rolls",
  "descripcion": "Rollos de sushi"
}
```

Ejemplo de creación de producto (usa el `id` numérico de una categoría existente):

```json
{
  "categoriaId": 1,
  "nombre": "California roll",
  "descripcion": "Aguacate y pepino",
  "precio": 120,
  "urlImagen": "https://ejemplo.com/roll.jpg",
  "estaDisponible": true
}
```

Se pueden filtrar productos con `GET /api/v1/productos?categoriaId=1&disponible=true`.

### Inventario y recetas

| Método | URL | Acceso |
|---|---|---|
| `GET` | `{{baseUrl}}/api/v1/ingredientes` | Admin o Cocina |
| `POST` | `{{baseUrl}}/api/v1/ingredientes` | Admin |
| `PUT` | `{{baseUrl}}/api/v1/ingredientes/:id` | Admin |
| `DELETE` | `{{baseUrl}}/api/v1/ingredientes/:id` | Admin |
| `GET` | `{{baseUrl}}/api/v1/recetas/producto/:productoId` | Admin o Cocina |
| `POST` | `{{baseUrl}}/api/v1/recetas/producto/:productoId` | Admin |
| `DELETE` | `{{baseUrl}}/api/v1/recetas/producto/:productoId/ingrediente/:ingredienteId` | Admin |

Ejemplo de `POST /api/v1/ingredientes`:

```json
{
  "nombre": "Arroz",
  "unidadMedida": "kg",
  "stockActual": 10,
  "stockMinimo": 2,
  "costoUnitario": 50
}
```

Ejemplo de `POST /api/v1/recetas/producto/:productoId` (reemplaza la receta del producto):

```json
{
  "ingredientes": [
    {
      "ingredienteId": "UUID-DEL-INGREDIENTE",
      "cantidad": 0.2
    }
  ]
}
```

### Mesas, órdenes y cocina

| Método | URL | Acceso |
|---|---|---|
| `GET` | `{{baseUrl}}/api/v1/mesas` | Bearer token |
| `POST` | `{{baseUrl}}/api/v1/mesas` | Admin |
| `PUT` | `{{baseUrl}}/api/v1/mesas/:id/estado` | Admin o Mesero |
| `GET` | `{{baseUrl}}/api/v1/ordenes/activas` | Admin, Mesero o Cocina |
| `POST` | `{{baseUrl}}/api/v1/ordenes` | Admin o Mesero |
| `GET` | `{{baseUrl}}/api/v1/cocina/comandas` | Admin o Cocina |
| `PUT` | `{{baseUrl}}/api/v1/cocina/comandas/:ordenId/estado` | Admin o Cocina |

Ejemplo para crear una mesa:

```json
{
  "numeroMesa": "M-01",
  "capacidad": 4
}
```

Ejemplo para cambiar su estado (`disponible`, `ocupada`, `reservada` o `mantenimiento`):

```json
{
  "estado": "disponible"
}
```

Para crear una orden, usa el UUID de un producto existente. Las órdenes de tipo
`comedor` necesitan una mesa existente; la API calcula los precios usando el
catálogo y descuenta existencias según la receta configurada:

```json
{
  "tipoOrden": "comedor",
  "mesaId": 1,
  "notas": "Sin wasabi",
  "items": [
    {
      "productoId": "UUID-DEL-PRODUCTO",
      "cantidad": 2
    }
  ]
}
```

Para avanzar una comanda en cocina, reemplaza `:ordenId` por el UUID devuelto
al crear la orden:

```json
{
  "estadoCocina": "en_preparacion"
}
```

Los estados de cocina aceptados son `en_espera`, `en_preparacion` y `listo`.
Al cambiar a `en_preparacion` comienza el temporizador. `GET /api/v1/cocina/comandas`
devuelve `contadorEnVivo` con minutos transcurridos y restantes, el tiempo estimado,
si está retrasada y su nivel de alerta (`normal` antes de 10 minutos,
`advertencia` desde los 10 minutos y `critico` al exceder el tiempo estimado).
La respuesta conserva además los datos relacionados de la comanda (orden, mesa,
productos y cocinero). Mientras la comanda está en espera, el contador muestra
cero minutos y la hora de inicio es `null`.

### Pagos y reimpresión de tickets

| Método | URL | Acceso |
|---|---|---|
| `POST` | `{{baseUrl}}/api/v1/pagos/orden/:ordenId` | Admin o Mesero |
| `POST` | `{{baseUrl}}/api/v1/pagos/orden/:ordenId/reimpresion` | Admin o Mesero |
| `GET` | `{{baseUrl}}/api/v1/pagos/orden/:ordenId` | Admin o Mesero |

Todas requieren Bearer token. Sustituye `:ordenId` por el UUID que devuelve la
creación de la orden.

Ejemplo para cobrar una orden (el monto debe cubrir el total):

```json
{
  "pagos": [
    {
      "metodoPago": "efectivo",
      "monto": 250
    },
    {
      "metodoPago": "tarjeta",
      "monto": 100,
      "idTransaccion": "TX-12345"
    }
  ]
}
```

Los métodos aceptados son `efectivo`, `tarjeta` y `transferencia`. Para solicitar
una reimpresión, envía `tipoTicket` con uno de estos valores: `precuenta`,
`ticket_final` o `cocina`.

```json
{
  "tipoTicket": "ticket_final"
}
```

---

## 📁 Estructura del Proyecto

```text
sushigo-backend/
├── src/
│   ├── config/             # Configuración de BD, JWT, WebSockets y variables de entorno
│   ├── controllers/        # Controladores de lógica de peticiones HTTP
│   ├── middlewares/        # Validación JWT, verificación de roles, Helmet y rate limiter
│   ├── models/             # Esquemas y modelos de ORM (User, Product, Order, OrderItem)
│   ├── routes/             # Definición de rutas REST (auth, productos, pedidos, repartidor)
│   ├── services/           # Lógica de negocio pura y transacciones de base de datos
│   ├── sockets/            # Handlers de conexión y eventos de WebSockets (Socket.io)
│   └── utils/              # Funciones auxiliares (Hashing Bcrypt, firmas JWT, respuestas)
├── tests/                  # Pruebas unitarias y de integración
├── .eslintrc.json          # Reglas de estandarización del Linter
├── .prettierrc            # Reglas de formateo automático de código
├── .env.example            # Plantilla de variables de entorno requeridas
├── server.js               # Punto de entrada e inicialización del servidor
├── package.json            # Scripts de ejecución y dependencias del proyecto
└── README.md               # Documentación del repositorio

Guia de Instalacion y Ejecucion rapida

# 1. Clonar el repositorio
git clone [https://github.com/JoseSanchez27349/sushigo-backend.git](https://github.com/JoseSanchez27349/sushigo-backend.git)
cd sushigo-backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Iniciar en modo desarrollo
npm run dev

# 5. Ejecutar análisis de código y formato
npm run lint
