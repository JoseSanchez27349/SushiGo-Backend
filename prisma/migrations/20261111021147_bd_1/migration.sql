-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "codigo_2fa" VARCHAR(6),
ADD COLUMN     "dos_factores_activado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiracion_2fa" TIMESTAMPTZ,
ADD COLUMN     "expiracion_token_recuperacion" TIMESTAMPTZ,
ADD COLUMN     "token_recuperacion" VARCHAR(255);
