
import nodemailer from 'nodemailer';

// Configuración del transporter de email
const createTransporter = () => {
  // Para desarrollo o testing, usa un servicio como Ethereal o Gmail
  // Para producción, usa servicios como SendGrid, AWS SES, etc.
  
  if (process.env.NODE_ENV === 'production') {
    // Configuración para producción (ejemplo con Gmail)
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // App password si usas Gmail
      },
    });
  } else {
    // Para desarrollo - usar Ethereal (testing)
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }
};

async function sendEmail({ to, subject, html, text }) {
  try {
    console.log(`📧 Enviando email a: ${to}`);
    console.log(`📋 Asunto: ${subject}`);
    
    // Si estamos en testing, solo logueamos
    if (process.env.NODE_ENV === 'test') {
      console.log('🧪 Modo testing - Email simulado enviado exitosamente');
      return { success: true, messageId: 'test-email-id' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Ticketera <noreply@ticketera.com>',
      to,
      subject,
      html,
      text: text || 'Por favor, habilita HTML en tu cliente de email para ver este mensaje correctamente.'
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado exitosamente:', result.messageId);
    
    // En desarrollo, mostrar preview URL si está disponible
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(result));
    }
    
    return { 
      success: true, 
      messageId: result.messageId,
      previewUrl: nodemailer.getTestMessageUrl(result)
    };
    
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    throw new Error(`Error al enviar email: ${error.message}`);
  }
}

export default sendEmail;