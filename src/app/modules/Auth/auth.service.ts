import { LogInProcess, OTPPurpose, UserStatus, UserRole, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import { otpEmail } from '../../../emails/otpEmail';
import ApiError from '../../../errors/ApiErrors';
import { generateRandomCode } from '../../../helpers/generateCode';
import { jwtHelpers } from '../../../helpers/jwtHelpers';
import { comparePassword, hashPassword } from '../../../helpers/passwordHelpers';
import prisma, { prismaRaw } from '../../../shared/prisma';
import { ForgetPasswordPayload, OTPVerifyPayload } from './auth.interface';
import { sendEmail } from '../../utils/sendEmail';

// Cast to base PrismaClient for operations requiring the password field
const prismaWithPassword = prismaRaw;

// ── Token Helpers ─────────────────────────────────────────────────────────────

const generateTokenPair = (
  user: { id: string; email: string; role: string },
  refreshExpiry?: string,
) => {
  const accessToken = jwtHelpers.generateToken(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in,
  );

  const refreshToken = jwtHelpers.generateToken(
    { id: user.id, role: user.role },
    config.jwt.refresh_secret as Secret,
    refreshExpiry ?? config.jwt.refresh_expires_in,
  );

  return { accessToken, refreshToken };
};

// ── SIGNUP ────────────────────────────────────────────────────────────────────

const signupToDb = async (payload: {
  email: string;
  password?: string;
  fcmToken?: string;
  fullName?: string;
  name?: string;
  phoneNumber?: string;
  profileImage?: string;
  logInProcess?: LogInProcess;
  keepMeLogin?: boolean;
}) => {
  const { email, password, fcmToken, phoneNumber, keepMeLogin } = payload;
  const fullName = payload.fullName || payload.name || '';
  const loginProcess = payload.logInProcess ?? LogInProcess.EMAIL;

  const exists = await prismaWithPassword.user.findUnique({ where: { email } });
  if (exists) {
    throw new ApiError(httpStatus.CONFLICT, 'An account with this email already exists');
  }

  if (loginProcess === LogInProcess.EMAIL && !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password is required for email signup');
  }

  const hashedPassword = password ? await bcrypt.hash(password, 12) : null;
  const isAutoVerified = !config.email.nodemailer_email || config.env === 'development';

  // Email signup
  if (loginProcess === LogInProcess.EMAIL) {
    const result = await prismaWithPassword.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          fcmToken,
          logInProcess: loginProcess,
          isVerified: isAutoVerified,
          isProfileCompleted: false,
          profileImage: payload.profileImage ?? null,
          fullName,
          phoneNumber: phoneNumber ?? '',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      });

      const otp = await tx.oTP.create({
        data: {
          userId: user.id,
          code: generateRandomCode(6),
          email: user.email,
          purpose: OTPPurpose.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, otp };
    });

    const html = otpEmail(result.otp.code, email, 'Verify Your Email Address');
    await sendEmail('Verify Your Email Address', email, html);

    if (isAutoVerified) {
      const { accessToken, refreshToken } = generateTokenPair(result.user, '7d');
      return {
        ...result.user,
        isVerified: true,
        accessToken,
        refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName || result.user.email.split('@')[0],
          name: result.user.fullName || result.user.email.split('@')[0],
          role: result.user.role,
          avatar: result.user.profileImage || '/assets/images/happy-students/student-1.png',
        },
      };
    }

    return { ...result.user, isVerified: false };
  }

  // Social signup (GOOGLE / APPLE) — auto-verified, return tokens
  const user = await prismaWithPassword.user.create({
    data: {
      email,
      password: null,
      fcmToken,
      logInProcess: loginProcess,
      isVerified: true,
      isProfileCompleted: false,
      fullName: fullName ?? '',
      phoneNumber: phoneNumber ?? '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  });

  const { accessToken, refreshToken } = generateTokenPair(user);
  return { isVerified: true, accessToken, refreshToken, keepMeLogin, role: user.role };
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────

const loginUser = async (payload: {
  email: string;
  password: string;
  keepMeLogin?: boolean;
}) => {
  const user = await prismaWithPassword.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No account found with this email');
  }

  if (user.logInProcess !== LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `This account uses ${user.logInProcess} login. Please sign in with ${user.logInProcess}.`,
    );
  }

  if (user.status === UserStatus.INACTIVE || user.status === UserStatus.BANNED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been suspended');
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been blocked');
  }

  if (!user.password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This account does not have a password set');
  }

  const isCorrectPassword = await bcrypt.compare(payload.password, user.password);
  if (!isCorrectPassword) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect password');
  }

  // Unverified — resend OTP, don't issue tokens
  if (!user.isVerified) {
    const otp = await prismaWithPassword.oTP.create({
      data: {
        userId: user.id,
        code: generateRandomCode(6),
        email: user.email,
        purpose: OTPPurpose.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const html = otpEmail(otp.code, user.email, 'Verify Your Email Address');
    await sendEmail('Verify Your Email Address', user.email, html);

    return { email: user.email, isVerified: false };
  }

  const refreshExpiry = payload.keepMeLogin ? '30d' : config.jwt.refresh_expires_in;
  const { accessToken, refreshToken } = generateTokenPair(user, refreshExpiry);

  return {
    isVerified: true,
    accessToken,
    refreshToken,
    keepMeLogin: payload.keepMeLogin ?? false,
    role: user.role,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.email.split('@')[0],
      name: user.fullName || user.email.split('@')[0],
      role: user.role,
      avatar: user.profileImage || '/assets/images/happy-students/student-1.png',
      profileImage: user.profileImage,
    },
  };
};

// ── SOCIAL LOGIN / SIGNUP ─────────────────────────────────────────────────────

const socialSignupOrLogin = async (payload: {
  email: string;
  logInProcess: LogInProcess;
  fcmToken?: string;
  fullName?: string;
  phoneNumber?: string;
  profileImage?: string;
  keepMeLogin?: boolean;
}) => {
  const {
    email,
    logInProcess,
    fcmToken,
    fullName,
    phoneNumber,
    profileImage,
    keepMeLogin = false,
  } = payload;

  const existingUser = await prismaWithPassword.user.findUnique({ where: { email } });

  if (existingUser) {
    // Login path
    if (existingUser.logInProcess !== logInProcess) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `This account uses ${existingUser.logInProcess} login. Please sign in with ${existingUser.logInProcess}.`,
      );
    }

    if (existingUser.status === UserStatus.INACTIVE || existingUser.status === UserStatus.BANNED) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been suspended');
    }

    if (existingUser.status === UserStatus.BLOCKED) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been blocked');
    }

    // Update FCM token if changed
    if (fcmToken && existingUser.fcmToken !== fcmToken) {
      await prismaWithPassword.user.update({
        where: { id: existingUser.id },
        data: { fcmToken },
      });
    }

    if (!existingUser.isVerified) {
      const otp = await prismaWithPassword.oTP.create({
        data: {
          userId: existingUser.id,
          code: generateRandomCode(6),
          email: existingUser.email,
          purpose: OTPPurpose.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const html = otpEmail(otp.code, existingUser.email, 'Verify Your Email Address');
      await sendEmail('Verify Your Email Address', existingUser.email, html);

      return { email: existingUser.email, isVerified: false };
    }

    const refreshExpiry = keepMeLogin ? '30d' : config.jwt.refresh_expires_in;
    const { accessToken, refreshToken } = generateTokenPair(existingUser, refreshExpiry);

    return {
      isVerified: true,
      accessToken,
      refreshToken,
      keepMeLogin,
      role: existingUser.role,
    };
  }

  // Signup path — social only
  if (logInProcess === LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Use the /signup endpoint for email registration',
    );
  }

  const newUser = await prismaWithPassword.user.create({
    data: {
      email,
      password: null,
      fcmToken,
      logInProcess,
      isVerified: true,
      isProfileCompleted: false,
      fullName: fullName ?? '',
      phoneNumber: phoneNumber ?? '',
      profileImage: profileImage ?? null,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  });

  const refreshExpiry = keepMeLogin ? '30d' : config.jwt.refresh_expires_in;
  const { accessToken, refreshToken } = generateTokenPair(newUser, refreshExpiry);

  return { isVerified: true, accessToken, refreshToken, keepMeLogin, role: newUser.role };
};

// ── GET ME ────────────────────────────────────────────────────────────────────

const getMe = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user; // password already omitted by prisma client config
};

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

const changePassword = async (
  id: string,
  newPassword: string,
  oldPassword: string,
) => {
  const user = await prismaWithPassword.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.logInProcess !== LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `This account uses ${user.logInProcess} login. Password change is not available.`,
    );
  }

  const isCorrectPassword = await comparePassword(oldPassword, user.password as string);
  if (!isCorrectPassword) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Current password is incorrect');
  }

  await prismaWithPassword.user.update({
    where: { id },
    data: { password: await hashPassword(newPassword) },
  });
};

// ── FORGET PASSWORD ───────────────────────────────────────────────────────────

const forgetPassword = async (payload: ForgetPasswordPayload) => {
  const user = await prismaWithPassword.user.findUnique({ where: { email: payload.email } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No account found with this email');
  }

  if (user.logInProcess !== LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `This account uses ${user.logInProcess} login. Password reset is not available.`,
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is not active');
  }

  const otp = await prismaWithPassword.oTP.create({
    data: {
      userId: user.id,
      code: generateRandomCode(6),
      email: user.email,
      purpose: OTPPurpose.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const html = otpEmail(otp.code, user.email, 'Reset Your Password');
  await sendEmail('Reset Your Password', user.email, html);

  return {
    email: user.email,
    expiresAt: otp.expiresAt,
  };
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────

const resetPassword = async (payload: {
  email: string;
  token: string;
  password: string;
}) => {
  const user = await prismaWithPassword.user.findUnique({
    where: { email: payload.email, status: UserStatus.ACTIVE },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isValidToken = jwtHelpers.verifyToken(
    payload.token,
    config.jwt.access_secret as Secret,
  );

  if (!isValidToken) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired reset token');
  }

  await prismaWithPassword.user.update({
    where: { email: payload.email },
    data: { password: await hashPassword(payload.password) },
  });
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────

const refreshToken = async (token: string) => {
  const decoded = jwtHelpers.verifyToken(token, config.jwt.refresh_secret as Secret);

  if (!decoded) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const user = await prismaWithPassword.user.findUnique({ where: { id: decoded.id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);
  return { accessToken, refreshToken: newRefreshToken };
};

// ── VERIFY OTP ────────────────────────────────────────────────────────────────

const verifyOTP = async (payload: OTPVerifyPayload) => {
  const { email, code, purpose } = payload;

  const user = await prismaWithPassword.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const otp = await prismaWithPassword.oTP.findFirst({
    where: {
      userId: user.id,
      code,
      purpose,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otp) {
    return { isValid: false };
  }

  await prismaWithPassword.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  if (purpose === OTPPurpose.EMAIL_VERIFICATION) {
    const updatedUser = await prismaWithPassword.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    const { accessToken, refreshToken } = generateTokenPair(updatedUser);
    return {
      isValid: true,
      isVerified: true,
      accessToken,
      refreshToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName || updatedUser.email.split('@')[0],
        name: updatedUser.fullName || updatedUser.email.split('@')[0],
        role: updatedUser.role,
        avatar: updatedUser.profileImage || '/assets/images/happy-students/student-1.png',
      },
    };
  }

  // PASSWORD_RESET — return a short-lived reset token
  const resetPasswordToken = jwtHelpers.generateToken(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.access_secret as Secret,
    '15m',
  );

  return { isValid: true, isVerified: false, resetPasswordToken, email };
};

// ── RESEND OTP ────────────────────────────────────────────────────────────────

const resendOTP = async (payload: { email: string; purpose: OTPPurpose }) => {
  const user = await prismaWithPassword.user.findUnique({
    where: { email: payload.email, status: UserStatus.ACTIVE },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const otp = await prismaWithPassword.oTP.create({
    data: {
      userId: user.id,
      code: generateRandomCode(6),
      email: user.email,
      purpose: payload.purpose,
      expiresAt,
    },
  });

  const title =
    payload.purpose === OTPPurpose.EMAIL_VERIFICATION
      ? 'Verify Your Email Address'
      : 'Reset Your Password';

  const html = otpEmail(otp.code, user.email, title);
  await sendEmail(title, user.email, html);

  return { email: user.email, expiresAt };
};

// ── UPDATE USER STATUS ────────────────────────────────────────────────────────

const userStatusUpdate = async (id: string, status: UserStatus) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return prismaWithPassword.user.update({ where: { id }, data: { status } });
};

// ── REGISTER STAFF ────────────────────────────────────────────────────────────

const registerStaff = async (
  payload: { email: string; password: string; fullName?: string; role?: string },
  createdByRole: string,
) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(createdByRole)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can register staff accounts');
  }

  const { email, password, fullName, role = 'ADMIN' } = payload;

  if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Role must be ADMIN or SUPER_ADMIN');
  }

  const exists = await prismaWithPassword.user.findUnique({ where: { email } });
  if (exists) {
    throw new ApiError(httpStatus.CONFLICT, 'An account with this email already exists');
  }

  const staff = await prismaWithPassword.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 12),
      fullName: fullName ?? '',
      role: role as UserRole,
      status: UserStatus.ACTIVE,
      isVerified: true,
      isProfileCompleted: false,
      logInProcess: LogInProcess.EMAIL,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...staffWithoutPassword } = staff;
  return staffWithoutPassword;
};

export const AuthServices = {
  signupToDb,
  loginUser,
  socialSignupOrLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  refreshToken,
  userStatusUpdate,
  verifyOTP,
  resendOTP,
  registerStaff,
};
