
async function sendEmail({ to, subject, html }) {
  console.log(`Sending email to ${to} with subject "${subject}"`);
  // Mock para testing - en producción aquí iría Resend, SendGrid, etc.
  return { success: true, messageId: 'mock-email-id' };
}

export default sendEmail;