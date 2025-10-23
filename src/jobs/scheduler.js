import cron from 'node-cron';
import { limpiarReservasExpiradas } from '../controllers/checkout.controller.js';

/**
 * Configurar tareas programadas (cron jobs) para el sistema
 */

// Ejecutar cada 5 minutos para limpiar reservas expiradas
// Solo en producción, no en tests
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🧹 Ejecutando limpieza de reservas expiradas...');
      const liberadas = await limpiarReservasExpiradas();
      if (liberadas > 0) {
        console.log(`✅ Liberadas ${liberadas} entradas con reservas expiradas`);
      }
    } catch (error) {
      console.error('❌ Error en cron de limpieza de reservas:', error);
    }
  });
}

// Ejecutar cada hora un reporte de estadísticas (opcional)
cron.schedule('0 * * * *', async () => {
  try {
    console.log('📊 Ejecutando reporte de estadísticas...');
    // Aquí podrías agregar lógica para reportes automáticos
  } catch (error) {
    console.error('❌ Error en cron de reportes:', error);
  }
});

export default {
  // Exportar funciones si necesitas controlar los crons manualmente
  start: () => console.log('🕐 Cron jobs iniciados'),
  stop: () => cron.destroy()
};