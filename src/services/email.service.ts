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

export const enviarRecuperacionContrasena = async (
  correo: string,
  codigo: string
): Promise<void> => {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'sushigo@soporte.com',
    to: correo,
    subject: 'Código de Recuperación - SushiGo',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #D32F2F; text-align: center; margin-bottom: 5px;">SushiGo</h2>
        <h3 style="text-align: center; color: #ffffff; font-weight: normal; margin-top: 0;">Recuperación de Contraseña</h3>
        <p style="color: #cccccc;">Has solicitado restablecer tu contraseña. Ingresa el siguiente código de 6 dígitos en tu aplicación:</p>
        
        <div style="background-color: #1E1E1E; border: 1px dashed #D32F2F; padding: 15px; text-align: center; border-radius: 8px; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #D32F2F; letter-spacing: 6px;">
            ${codigo}
          </span>
        </div>

        <p style="font-size: 12px; color: #888888; text-align: center;">
          Este código es válido por 15 minutos. Si no solicitaste este cambio, puedes ignorar este mensaje.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

 