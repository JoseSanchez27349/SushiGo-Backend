-- AlterTable
ALTER TABLE "detalles_orden" ADD COLUMN     "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estado_cocina" VARCHAR(30) NOT NULL DEFAULT 'en_espera',
ADD COLUMN     "inicio_preparacion_en" TIMESTAMPTZ,
ADD COLUMN     "listo_en" TIMESTAMPTZ,
ADD COLUMN     "ronda" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "codigo_2fa" VARCHAR(6),
ADD COLUMN     "dos_factores_activado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiracion_2fa" TIMESTAMPTZ,
ADD COLUMN     "expiracion_token_recuperacion" TIMESTAMPTZ,
ADD COLUMN     "token_recuperacion" VARCHAR(255);

-- CreateIndex
CREATE INDEX "idx_detalles_orden_estado" ON "detalles_orden"("orden_id", "estado_cocina");
