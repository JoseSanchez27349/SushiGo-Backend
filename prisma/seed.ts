import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Poblando base de datos inicial...');

  // 1. Roles del sistema
  const roles = [
    { id: 1, nombre: 'administrador', descripcion: 'Acceso total al sistema' },
    { id: 2, nombre: 'cliente', descripcion: 'Cliente registrado en App/Web' },
    { id: 3, nombre: 'repartidor', descripcion: 'Repartidor de pedidos Delivery' },
    { id: 4, nombre: 'cocinero', descripcion: 'Personal de cocina KDS' },
    { id: 5, nombre: 'mesero', descripcion: 'Atención en salón POS' },
  ];

  for (const rol of roles) {
    await prisma.role.upsert({
      where: { id: rol.id },
      update: {},
      create: rol,
    });
  }

  // 2. Mesas iniciales
  const mesas = [
    { numeroMesa: 'Mesa 1', capacidad: 4 },
    { numeroMesa: 'Mesa 2', capacidad: 4 },
    { numeroMesa: 'Mesa 3', capacidad: 2 },
    { numeroMesa: 'Mesa 4', capacidad: 6 },
    { numeroMesa: 'Barra 1', capacidad: 1 },
  ];

  for (const mesa of mesas) {
    await prisma.table.upsert({
      where: { numeroMesa: mesa.numeroMesa },
      update: {},
      create: mesa,
    });
  }

  console.log('✅ Base de datos poblada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el proceso de seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });