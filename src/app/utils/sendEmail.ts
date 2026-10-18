import nodemailer from 'nodemailer';
import config from '../../config';

/**
 * Sends an HTML email via Nodemailer (Gmail SMTP).
 *
 * @param subject - Email subject line
 * @param to - Recipient email address
 * @param html - HTML body content
 */
export const sendEmail = async (
  subject: string,
  to: string,
  html: string,
): Promise<void> => {
  if (!config.email.nodemailer_email || !config.email.nodemailer_pass) {
    console.warn(`[sendEmail] Mailer credentials not configured. Skipping email to ${to}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: config.email.nodemailer_email,
      pass: config.email.nodemailer_pass,
    },
  });

  await transporter.sendMail({
    from: `"${config.app_name}" <${config.email.nodemailer_email}>`,
    to,
    subject,
    html,
  });
};
