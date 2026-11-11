import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';

async function main() {
  console.log('🌱 Poblando base de datos...');

  // 1. Crear o actualizar Roles
  const rolAdmin = await prisma.role.upsert({
    where: { nombre: 'Admin' },
    update: {},
    create: { nombre: 'Admin', descripcion: 'Administrador del sistema web' },
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

  const rolCliente = await prisma.role.upsert({
    where: { nombre: 'Cliente' },
    update: {},
    create: { nombre: 'Cliente', descripcion: 'Cliente de la aplicación móvil' },
  });

  // 2. Generar Hashes
  const pinHash = await bcrypt.hash('1234', 10);
  const contrasenaHash = await bcrypt.hash('Password123!', 10);

  // 3. Crear o actualizar Administrador (Web)
  await prisma.user.upsert({
    where: { correoElectronico: 'admin@sushigo.com' },
    update: {
      nombre: 'Admin',
      apellido: 'SushiGo',
      contrasenaHash,
      rolId: rolAdmin.id,
    },
    create: {
      nombre: 'Admin',
      apellido: 'SushiGo',
      telefono: '3300000000',
      correoElectronico: 'admin@sushigo.com',
      contrasenaHash,
      rolId: rolAdmin.id,
    },
  });

  // 4. Crear o actualizar Mesero (POS)
  const meseroExistente = await prisma.user.findFirst({ where: { codigoEmpleado: '7001' } });
  if (meseroExistente) {
    await prisma.user.update({
      where: { id: meseroExistente.id },
      data: { pinHash, rolId: rolMesero.id },
    });
  } else {
    await prisma.user.create({
      data: {
        nombre: 'Carlos',
        apellido: 'Mendoza',
        telefono: '3310000001',
        codigoEmpleado: '7001',
        pinHash,
        rolId: rolMesero.id,
      },
    });
  }

  // 5. Crear o actualizar Cocinero (KDS)
  const cocineroExistente = await prisma.user.findFirst({ where: { codigoEmpleado: '7002' } });
  if (cocineroExistente) {
    await prisma.user.update({
      where: { id: cocineroExistente.id },
      data: { pinHash, rolId: rolCocina.id },
    });
  } else {
    await prisma.user.create({
      data: {
        nombre: 'Kenji',
        apellido: 'Sato',
        telefono: '3310000002',
        codigoEmpleado: '7002',
        pinHash,
        rolId: rolCocina.id,
      },
    });
  }

  // 6. Crear o actualizar Cliente (App Móvil)
  await prisma.user.upsert({
    where: { correoElectronico: 'cliente@sushigo.com' },
    update: {
      nombre: 'Juan',
      apellido: 'Pérez',
      contrasenaHash,
      rolId: rolCliente.id,
    },
    create: {
      nombre: 'Juan',
      apellido: 'Pérez',
      telefono: '3310000003',
      correoElectronico: 'cliente@sushigo.com',
      contrasenaHash,
      rolId: rolCliente.id,
    },
  });

  console.log('✅ Base de datos poblada/actualizada exitosamente.');
  console.log('--------------------------------------------------');
  console.log('🔑 ADMIN (Web):         admin@sushigo.com | Password123!');
  console.log('🔑 MESERO (POS):        Código: 7001 | PIN: 1234');
  console.log('🔑 COCINA (KDS):        Código: 7002 | PIN: 1234');
  console.log('🔑 CLIENTE (App Móvil): cliente@sushigo.com | Password123!');
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Error en el semillero:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });