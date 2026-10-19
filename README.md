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

## 🌐 API Centralizada: Endpoints Expuestos

El servidor escucha por defecto en el puerto `3000` (`http://localhost:3000/api`).

### 🔐 Autenticación
- `POST /api/auth/register` — Registro de cliente.
- `POST /api/auth/login` — Inicio de sesión (Cliente, Repartidor, Admin).
- `POST /api/auth/refresh` — Renovación de Access Token expirado.

### 🍣 Catálogo y Productos
- `GET /api/productos` — Obtener catálogo completo con filtros y búsqueda.
- `GET /api/productos/:id` — Obtener detalle de un producto específico.
- `GET /api/categorias` — Listar categorías activas.

### 🛒 Pedidos (Clientes)
- `POST /api/pedidos` — Crear y confirmar una nueva orden de compra.
- `GET /api/pedidos/cliente` — Consultar historial de compras del cliente autenticado.
- `GET /api/pedidos/:id` — Consultar detalle y estado actual de una orden.

### 🛵 Pedidos (Repartidores)
- `GET /api/repartidor/pedidos` — Listar pedidos asignados al repartidor.
- `PUT /api/pedidos/:id/estado` — Actualizar la fase del envío (*En camino*, *Entregado*).

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
