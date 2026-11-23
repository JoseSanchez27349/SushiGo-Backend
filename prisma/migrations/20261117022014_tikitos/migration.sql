-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "cobradoPorId" UUID,
ADD COLUMN     "turnoId" UUID;

-- CreateTable
CREATE TABLE "TurnoCaja" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "asignadoPorId" UUID,
    "fondoInicial" DECIMAL(10,2) NOT NULL,
    "efectivoEsperado" DECIMAL(10,2),
    "efectivoContado" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "totalVentasEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalVentasTarjeta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalVentasTransferencia" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "notasCierre" TEXT,
    "abiertoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "TurnoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" UUID NOT NULL,
    "turnoId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "autorizadoPorId" UUID,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
