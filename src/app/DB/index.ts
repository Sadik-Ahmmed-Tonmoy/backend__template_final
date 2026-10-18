import { LogInProcess, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../../shared/prisma';
import config from '../../config';

/**
 * Seeds the super admin account on first boot.
 * Credentials are read from environment variables — never hardcoded.
 *
 * Add any project-specific seed calls below this function.
 */
export const initiateSuperAdmin = async (): Promise<void> => {
  const email = config.super_admin_email;
  const password = config.super_admin_password;

  if (!email || !password) {
    console.warn('⚠️  SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set — skipping super admin seed');
    return;
  }

  const exists = await prisma.user.findUnique({
    where: { email },
  });

  if (exists) {
    return; // Already seeded
  }

  const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isVerified: true,
      logInProcess: LogInProcess.EMAIL,
    },
  });

  console.info(`✅ Super admin created: ${email}`);
};
