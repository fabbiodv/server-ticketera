/**
 * Template para invitación a la ticketera
 * @param {Object} data - Datos de la invitación
 * @param {string} data.inviterName - Nombre de quien invita
 * @param {string} data.productoraNombre - Nombre de la productora
 * @param {string} data.role - Rol asignado
 * @param {string} data.invitationLink - Link para aceptar la invitación
 * @param {string} data.expiresAt - Fecha de expiración
 * @returns {string} HTML del email
 */
export const invitationTemplate = (data) => {
  const { inviterName, productoraNombre, role, invitationLink, expiresAt } = data;
  
  const roleTranslations = {
    'LIDER': 'Líder',
    'PUBLICA': 'Relaciones Públicas',
    'SUBPUBLICA': 'Sub-Relaciones Públicas',
    'ORGANIZADOR': 'Organizador'
  };
  
  const roleDisplayName = roleTranslations[role] || role;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitación a Ticketera - ${productoraNombre}</title>
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
                font-size: 28px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #666;
                font-size: 16px;
            }
            .invitation-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 25px;
                border-radius: 12px;
                text-align: center;
                margin: 25px 0;
            }
            .invitation-card h2 {
                margin: 0 0 15px 0;
                font-size: 24px;
            }
            .role-badge {
                background-color: rgba(255,255,255,0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                display: inline-block;
                margin-top: 10px;
            }
            .content {
                margin-bottom: 30px;
                line-height: 1.8;
            }
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #16a085, #2ecc71);
                color: white;
                padding: 18px 35px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: bold;
                text-align: center;
                margin: 25px 0;
                transition: transform 0.3s ease;
                box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);
            }
            .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4);
            }
            .button-container {
                text-align: center;
                margin: 35px 0;
            }
            .info-box {
                background-color: #e8f4fd;
                border-left: 4px solid #2563eb;
                padding: 20px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }
            .warning {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 18px;
                margin: 25px 0;
                color: #856404;
            }
            .features {
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
            }
            .features h4 {
                color: #2563eb;
                margin-top: 0;
            }
            .features ul {
                margin: 10px 0;
                padding-left: 20px;
            }
            .features li {
                margin-bottom: 8px;
                color: #555;
            }
            .footer {
                text-align: center;
                color: #666;
                font-size: 14px;
                margin-top: 40px;
                border-top: 1px solid #eee;
                padding-top: 25px;
            }
            .link {
                word-break: break-all;
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 12px;
                color: #666;
                margin: 15px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎫 Ticketera</div>
                <div class="subtitle">Sistema de venta de entradas</div>
            </div>
            
            <div class="invitation-card">
                <h2>¡Has sido invitado!</h2>
                <p><strong>${inviterName}</strong> te invita a formar parte de</p>
                <h3 style="margin: 10px 0; font-size: 22px;">${productoraNombre}</h3>
                <div class="role-badge">Como: ${roleDisplayName}</div>
            </div>
            
            <div class="content">
                <div class="info-box">
                    <strong>🎯 ¿Qué significa tu rol?</strong>
                    <p style="margin: 10px 0 0 0;">
                        ${role === 'LIDER' ? 'Como Líder, podrás gestionar vendedores, asignar roles y supervisar las ventas de toda la productora.' :
                          role === 'PUBLICA' ? 'Como Relaciones Públicas, podrás vender entradas y gestionar vendedores Sub-Públicas.' :
                          role === 'SUBPUBLICA' ? 'Como Sub-Relaciones Públicas, podrás vender entradas para los eventos de la productora.' :
                          role === 'ORGANIZADOR' ? 'Como Organizador, podrás crear eventos, gestionar tipos de entradas y supervisar las ventas.' :
                          'Tendrás acceso a funcionalidades específicas de tu rol en la plataforma.'}
                    </p>
                </div>
                
                <div class="features">
                    <h4>🚀 Con Ticketera podrás:</h4>
                    <ul>
                        <li>🎟️ Gestionar ventas de entradas</li>
                        <li>📊 Ver estadísticas en tiempo real</li>
                        <li>💰 Controlar comisiones y pagos</li>
                        <li>📱 Generar códigos QR únicos</li>
                        <li>👥 Trabajar en equipo con tu productora</li>
                    </ul>
                </div>
                
                <p><strong>Para aceptar esta invitación y crear tu cuenta, haz clic en el botón de abajo:</strong></p>
                
                <div class="button-container">
                    <a href="${invitationLink}" class="button">
                        🎉 Aceptar Invitación
                    </a>
                </div>
                
                <div class="warning">
                    <strong>⏰ Importante:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Esta invitación expira el <strong>${new Date(expiresAt).toLocaleDateString('es-ES')} a las ${new Date(expiresAt).toLocaleTimeString('es-ES')}</strong></li>
                        <li>El enlace solo se puede usar una vez</li>
                        <li>Si ya tienes cuenta, se te asignará automáticamente a la productora</li>
                        <li>Si no tienes cuenta, podrás registrarte con este email</li>
                    </ul>
                </div>
                
                <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                <div class="link">${invitationLink}</div>
            </div>
            
            <div class="footer">
                <p>Este email fue enviado por <strong>${inviterName}</strong> desde <strong>${productoraNombre}</strong></p>
                <p>Si no esperabas esta invitación, puedes ignorar este mensaje de forma segura.</p>
                <p><small>© ${new Date().getFullYear()} Ticketera. Todos los derechos reservados.</small></p>
            </div>
        </div>
    </body>
    </html>
  `;
};