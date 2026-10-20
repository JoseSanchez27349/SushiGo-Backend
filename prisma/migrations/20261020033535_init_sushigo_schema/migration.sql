-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rol_id" INTEGER NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "apellido" VARCHAR(50) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "correo_electronico" VARCHAR(100),
    "contrasena_hash" VARCHAR(255),
    "codigo_empleado" VARCHAR(4),
    "pin_hash" VARCHAR(255),
    "puntos_acumulados" INTEGER NOT NULL DEFAULT 0,
    "esta_activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "numero_mesa" VARCHAR(20) NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'disponible',

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "calle" VARCHAR(100) NOT NULL,
    "colonia" VARCHAR(100) NOT NULL,
    "ciudad" VARCHAR(50) NOT NULL,
    "codigo_postal" VARCHAR(10) NOT NULL,
    "notas_entrega" TEXT,
    "es_predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direcciones_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "descripcion" TEXT,
    "esta_activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoria_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "url_imagen" VARCHAR(255),
    "esta_disponible" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "stock_actual" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "stock_minimo" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "costo_unitario" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "esta_activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "producto_id" UUID NOT NULL,
    "ingrediente_id" UUID NOT NULL,
    "cantidad_requerida" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ingrediente_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo_movimiento" VARCHAR(30) NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "costo_total" DECIMAL(10,2) DEFAULT 0.00,
    "observaciones" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carritos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elementos_carrito" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carrito_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "elementos_carrito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio" SERIAL NOT NULL,
    "usuario_id" UUID,
    "mesero_id" UUID,
    "mesa_id" INTEGER,
    "direccion_id" UUID,
    "tipo_orden" VARCHAR(30) NOT NULL DEFAULT 'delivery',
    "estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "impreso_cocina" BOOLEAN NOT NULL DEFAULT false,
    "impreso_cuenta" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "costo_envio" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total" DECIMAL(10,2) NOT NULL,
    "notas" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_orden" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "detalles_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "metodo_pago" VARCHAR(30) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "id_transaccion" VARCHAR(100),
    "monto" DECIMAL(10,2) NOT NULL,
    "pagado_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "repartidor_id" UUID,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'asignado',
    "asignado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregado_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiempos_cocina" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "cocinero_id" UUID,
    "tiempo_estimado_minutos" INTEGER NOT NULL DEFAULT 15,
    "estado_cocina" VARCHAR(30) NOT NULL DEFAULT 'en_espera',
    "inicio_preparacion_en" TIMESTAMPTZ,
    "listo_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiempos_cocina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_puntos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "orden_id" UUID,
    "registrado_por_id" UUID,
    "tipo_movimiento" VARCHAR(30) NOT NULL,
    "puntos" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_reimpresiones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "solicitado_por_id" UUID NOT NULL,
    "tipo_ticket" VARCHAR(30) NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_reimpresiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_telefono_key" ON "usuarios"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_electronico_key" ON "usuarios"("correo_electronico");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_codigo_empleado_key" ON "usuarios"("codigo_empleado");

-- CreateIndex
CREATE INDEX "idx_usuarios_telefono" ON "usuarios"("telefono");

-- CreateIndex
CREATE INDEX "idx_usuarios_codigo_empleado" ON "usuarios"("codigo_empleado");

-- CreateIndex
CREATE INDEX "idx_usuarios_correo" ON "usuarios"("correo_electronico");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_numero_mesa_key" ON "mesas"("numero_mesa");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_nombre_key" ON "ingredientes"("nombre");

-- CreateIndex
CREATE INDEX "idx_recetas_producto" ON "recetas"("producto_id");

-- CreateIndex
CREATE INDEX "idx_recetas_ingrediente" ON "recetas"("ingrediente_id");

-- CreateIndex
CREATE UNIQUE INDEX "recetas_producto_id_ingrediente_id_key" ON "recetas"("producto_id", "ingrediente_id");

-- CreateIndex
CREATE INDEX "idx_movimientos_ingrediente" ON "movimientos_inventario"("ingrediente_id");

-- CreateIndex
CREATE UNIQUE INDEX "carritos_usuario_id_key" ON "carritos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "elementos_carrito_carrito_id_producto_id_key" ON "elementos_carrito"("carrito_id", "producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_folio_key" ON "ordenes"("folio");

-- CreateIndex
CREATE INDEX "idx_ordenes_folio" ON "ordenes"("folio");

-- CreateIndex
CREATE INDEX "idx_ordenes_creado_en" ON "ordenes"("creado_en" DESC);

-- CreateIndex
CREATE INDEX "idx_ordenes_tipo" ON "ordenes"("tipo_orden");

-- CreateIndex
CREATE INDEX "idx_ordenes_mesa" ON "ordenes"("mesa_id");

-- CreateIndex
CREATE INDEX "idx_ordenes_mesero" ON "ordenes"("mesero_id");

-- CreateIndex
CREATE INDEX "idx_ordenes_estado" ON "ordenes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_orden_id_key" ON "entregas"("orden_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiempos_cocina_orden_id_key" ON "tiempos_cocina"("orden_id");

-- CreateIndex
CREATE INDEX "idx_tiempos_cocina_estado" ON "tiempos_cocina"("estado_cocina");

-- CreateIndex
CREATE INDEX "idx_historial_puntos_usuario" ON "historial_puntos"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_historial_reimpresiones_orden" ON "historial_reimpresiones"("orden_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones_usuario" ADD CONSTRAINT "direcciones_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos" ADD CONSTRAINT "carritos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elementos_carrito" ADD CONSTRAINT "elementos_carrito_carrito_id_fkey" FOREIGN KEY ("carrito_id") REFERENCES "carritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elementos_carrito" ADD CONSTRAINT "elementos_carrito_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_mesero_id_fkey" FOREIGN KEY ("mesero_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direcciones_usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_orden" ADD CONSTRAINT "detalles_orden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_orden" ADD CONSTRAINT "detalles_orden_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiempos_cocina" ADD CONSTRAINT "tiempos_cocina_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiempos_cocina" ADD CONSTRAINT "tiempos_cocina_cocinero_id_fkey" FOREIGN KEY ("cocinero_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_puntos" ADD CONSTRAINT "historial_puntos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_puntos" ADD CONSTRAINT "historial_puntos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_puntos" ADD CONSTRAINT "historial_puntos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reimpresiones" ADD CONSTRAINT "historial_reimpresiones_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reimpresiones" ADD CONSTRAINT "historial_reimpresiones_solicitado_por_id_fkey" FOREIGN KEY ("solicitado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
