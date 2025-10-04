/**
 * Template para el magic link de autenticación
 * @param {string} magicLink - URL del magic link
 * @returns {string} HTML del email
 */
export const magicLinkTemplate = (magicLink) => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inicia sesión en Ticketera</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #666;
                font-size: 16px;
            }
            .content {
                margin-bottom: 30px;
            }
            .button {
                display: inline-block;
                background-color: #2563eb;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                text-align: center;
                margin: 20px 0;
                transition: background-color 0.3s;
            }
            .button:hover {
                background-color: #1d4ed8;
            }
            .button-container {
                text-align: center;
                margin: 30px 0;
            }
            .warning {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #92400e;
            }
            .footer {
                text-align: center;
                color: #666;
                font-size: 14px;
                margin-top: 30px;
                border-top: 1px solid #eee;
                padding-top: 20px;
            }
            .link {
                word-break: break-all;
                background-color: #f8f9fa;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                color: #666;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎫 Ticketera</div>
                <div class="subtitle">Sistema de venta de entradas</div>
            </div>
            
            <div class="content">
                <h2>¡Hola!</h2>
                <p>Recibimos una solicitud para iniciar sesión en tu cuenta de Ticketera.</p>
                <p>Haz clic en el botón de abajo para acceder de forma segura:</p>
                
                <div class="button-container">
                    <a href="${magicLink}" class="button">
                        🔐 Iniciar Sesión
                    </a>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Importante:</strong>
                    <ul>
                        <li>Este enlace es válido por <strong>1 hora</strong></li>
                        <li>Solo se puede usar <strong>una vez</strong></li>
                        <li>Si no solicitaste este acceso, ignora este email</li>
                    </ul>
                </div>
                
                <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                <div class="link">${magicLink}</div>
            </div>
            
            <div class="footer">
                <p>Este email fue enviado automáticamente desde Ticketera.</p>
                <p>Si tienes problemas, contacta al soporte técnico.</p>
                <p><small>© ${new Date().getFullYear()} Ticketera. Todos los derechos reservados.</small></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Template para notificación de compra exitosa
 * @param {Object} data - Datos de la compra
 * @param {string} data.buyerName - Nombre del comprador
 * @param {string} data.eventName - Nombre del evento
 * @param {string} data.eventDate - Fecha del evento
 * @param {string} data.ticketType - Tipo de entrada
 * @param {number} data.quantity - Cantidad de entradas
 * @param {number} data.amount - Monto total
 * @param {string[]} data.qrCodes - Códigos QR de las entradas
 * @returns {string} HTML del email
 */
export const purchaseConfirmationTemplate = (data) => {
  const { buyerName, eventName, eventDate, ticketType, quantity, amount, qrCodes } = data;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Compra confirmada - Ticketera</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .success {
                background-color: #dcfce7;
                border: 1px solid #16a34a;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .success h2 {
                color: #166534;
                margin: 0 0 10px 0;
            }
            .event-details {
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .qr-code {
                background-color: #fff;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                padding: 15px;
                margin: 10px 0;
                text-align: center;
                font-family: monospace;
                font-weight: bold;
                font-size: 14px;
                color: #374151;
            }
            .important {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #92400e;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px;">
                    🎫 Ticketera
                </div>
            </div>
            
            <div class="success">
                <h2>✅ ¡Compra Exitosa!</h2>
                <p>Hola ${buyerName}, tu compra se procesó correctamente.</p>
            </div>
            
            <div class="event-details">
                <h3>📋 Detalles de tu compra:</h3>
                <p><strong>Evento:</strong> ${eventName}</p>
                <p><strong>Fecha:</strong> ${new Date(eventDate).toLocaleDateString('es-ES')}</p>
                <p><strong>Tipo de entrada:</strong> ${ticketType}</p>
                <p><strong>Cantidad:</strong> ${quantity}</p>
                <p><strong>Total pagado:</strong> $${amount}</p>
            </div>
            
            <div>
                <h3>🎟️ Tus entradas:</h3>
                <p>Guarda estos códigos QR, los necesitarás para ingresar al evento:</p>
                ${qrCodes.map((qr, index) => `
                    <div class="qr-code">
                        <strong>Entrada ${index + 1}:</strong><br>
                        ${qr}
                    </div>
                `).join('')}
            </div>
            
            <div class="important">
                <strong>📱 Importante:</strong>
                <ul>
                    <li>Presenta estos códigos QR en el evento</li>
                    <li>Cada código solo se puede usar una vez</li>
                    <li>Llega con tiempo suficiente al evento</li>
                    <li>Guarda este email como comprobante</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                <p>¡Disfruta el evento! 🎉</p>
                <p><small>© ${new Date().getFullYear()} Ticketera. Todos los derechos reservados.</small></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Template para reseteo de contraseña
 * @param {string} resetLink - URL para resetear contraseña
 * @param {string} userName - Nombre del usuario
 * @returns {string} HTML del email
 */
export const passwordResetTemplate = (resetLink, userName = '') => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resetear contraseña - Ticketera</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .button {
                display: inline-block;
                background-color: #dc2626;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                text-align: center;
                margin: 20px 0;
            }
            .button-container {
                text-align: center;
                margin: 30px 0;
            }
            .warning {
                background-color: #fef2f2;
                border: 1px solid #ef4444;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #dc2626;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px;">
                    🎫 Ticketera
                </div>
            </div>
            
            <h2>🔒 Resetear Contraseña</h2>
            <p>Hola${userName ? ` ${userName}` : ''},</p>
            <p>Recibimos una solicitud para resetear la contraseña de tu cuenta.</p>
            
            <div class="button-container">
                <a href="${resetLink}" class="button">
                    Resetear Contraseña
                </a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                    <li>Este enlace es válido por <strong>1 hora</strong></li>
                    <li>Si no solicitaste este cambio, ignora este email</li>
                    <li>Tu contraseña actual seguirá siendo válida hasta que la cambies</li>
                </ul>
            </div>
            
            <p>Si el botón no funciona, copia y pega este enlace:</p>
            <div style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
                ${resetLink}
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                <p><small>© ${new Date().getFullYear()} Ticketera. Todos los derechos reservados.</small></p>
            </div>
        </div>
    </body>
    </html>
  `;
};