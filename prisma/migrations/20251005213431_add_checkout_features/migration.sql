-- CreateEnum
CREATE TYPE "EstadoEntrada" AS ENUM ('DISPONIBLE', 'RESERVADA', 'VENDIDA', 'CANCELADA');

-- DropForeignKey
ALTER TABLE "Entrada" DROP CONSTRAINT "Entrada_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_entradaId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- AlterTable
ALTER TABLE "Entrada" ADD COLUMN     "estado" "EstadoEntrada" NOT NULL DEFAULT 'DISPONIBLE',
ADD COLUMN     "reservadaHasta" TIMESTAMP(3),
ALTER COLUMN "buyerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "metadata" TEXT,
ADD COLUMN     "mpInitPoint" TEXT,
ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "mpPreferenceId" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "entradaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Entrada" ADD CONSTRAINT "Entrada_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "Entrada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
