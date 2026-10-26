import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';

async function main() {
  console.log('🌱 Poblando base de datos...');

  // 1. Crear Roles base
  const rolAdmin = await prisma.role.upsert({
    where: { nombre: 'Admin' },
    update: {},
    create: { nombre: 'Admin', descripcion: 'Administrador general con acceso total' },
  });

  const rolMesero = await prisma.role.upsert({
    where: { nombre: 'Mesero' },
    update: {},
    create: { nombre: 'Mesero', descripcion: 'Personal de salón para toma de pedidos POS' },
  });

  const rolCocina = await prisma.role.upsert({
    where: { nombre: 'Cocina' },
    update: {},
    create: { nombre: 'Cocina', descripcion: 'Personal de cocina para pantalla KDS' },
  });

  // 2. Generar Hashes de PIN (Todos usan PIN "1234" para pruebas)
  const pinHash = await bcrypt.hash('1234', 10);

  // 3. Crear Usuarios con Código de Empleado de 4 dígitos
  await prisma.user.upsert({
    where: { codigoEmpleado: '7001' },
    update: {},
    create: {
      nombre: 'Carlos',
      apellido: 'Mendoza',
      telefono: '3310000001',
      codigoEmpleado: '7001',
      pinHash,
      rolId: rolMesero.id,
    },
  });

  await prisma.user.upsert({
    where: { codigoEmpleado: '7002' },
    update: {},
    create: {
      nombre: 'Kenji',
      apellido: 'Sato',
      telefono: '3310000002',
      codigoEmpleado: '7002',
      pinHash,
      rolId: rolCocina.id,
    },
  });

  await prisma.user.upsert({
    where: { codigoEmpleado: '9999' },
    update: {},
    create: {
      nombre: 'Admin',
      apellido: 'SushiGo',
      telefono: '3310000000',
      codigoEmpleado: '9999',
      pinHash,
      rolId: rolAdmin.id,
    },
  });

  console.log('✅ Seeding completado con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });