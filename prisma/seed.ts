import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';

async function main() {
  console.log('🌱 Poblando base de datos...');

  // 1. Limpiar usuarios previos para evitar colisiones con restricciones @unique
  await prisma.user.deleteMany({});

  // 2. Crear Roles (id autoincremental)
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

  // 3. Generar Hashes
  const pinHash = await bcrypt.hash('1234', 10);
  const contrasenaHash = await bcrypt.hash('Password123!', 10);

  // 4. Crear Administrador (Solo Correo + Contraseña)
  await prisma.user.create({
    data: {
      nombre: 'Admin',
      apellido: 'SushiGo',
      telefono: '3300000000',
      correoElectronico: 'admin@sushigo.com',
      contrasenaHash,
      codigoEmpleado: null,
      pinHash: null,
      rolId: rolAdmin.id,
    },
  });

  // 5. Crear Mesero (Solo Código + PIN)
  await prisma.user.create({
    data: {
      nombre: 'Carlos',
      apellido: 'Mendoza',
      telefono: '3310000001',
      codigoEmpleado: '7001',
      pinHash,
      correoElectronico: null,
      contrasenaHash: null,
      rolId: rolMesero.id,
    },
  });

  // 6. Crear Cocinero (Solo Código + PIN)
  await prisma.user.create({
    data: {
      nombre: 'Kenji',
      apellido: 'Sato',
      telefono: '3310000002',
      codigoEmpleado: '7002',
      pinHash,
      correoElectronico: null,
      contrasenaHash: null,
      rolId: rolCocina.id,
    },
  });

  console.log('✅ Base de datos poblada exitosamente.');
  console.log('--------------------------------------------------');
  console.log('🔑 ADMIN (Web):    admin@sushigo.com | Password123!');
  console.log('🔑 MESERO (POS):   Código: 7001 | PIN: 1234');
  console.log('🔑 COCINA (KDS):   Código: 7002 | PIN: 1234');
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