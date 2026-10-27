import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const enviarCodigo2FA = async (correo: string, codigo: string) => {
  await transporter.sendMail({
    from: '"SushiGo 🍣" <no-reply@sushigo.com>',
    to: correo,
    subject: 'Código de verificación de 2 pasos - SushiGo',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Código de Verificación</h2>
        <p>Tu código para completar el inicio de sesión es:</p>
        <h1 style="color: #E53E3E; letter-spacing: 4px;">${codigo}</h1>
        <p>Este código expira en 10 minutos.</p>
      </div>
    `,
  });
};

export const enviarRecuperacionContrasena = async (correo: string, token: string) => {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: '"SushiGo 🍣" <no-reply@sushigo.com>',
    to: correo,
    subject: 'Recuperación de contraseña - SushiGo',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Restablecer Contraseña</h2>
        <p>Haz clic en el enlace para cambiar tu contraseña:</p>
        <a href="${url}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #E53E3E; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
        <p style="margin-top: 15px; color: #666;">Este enlace vence en 1 hora.</p>
      </div>
    `,
  });
};