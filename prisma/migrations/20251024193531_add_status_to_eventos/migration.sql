-- CreateEnum
CREATE TYPE "estadoEvento" AS ENUM ('ACTIVO', 'INACTIVO', 'REPROGRAMADO', 'CASI_AGOTADO', 'AGOTADO', 'CANCELADO', 'FINALIZADO');

-- DropForeignKey
ALTER TABLE "Entrada" DROP CONSTRAINT "Entrada_sellerId_fkey";

-- AlterTable
ALTER TABLE "Entrada" ALTER COLUMN "sellerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Eventos" ADD COLUMN     "status" "estadoEvento" NOT NULL DEFAULT 'ACTIVO';

-- AddForeignKey
ALTER TABLE "Entrada" ADD CONSTRAINT "Entrada_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
