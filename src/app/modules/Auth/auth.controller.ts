import { Request, Response } from 'express';
import httpStatus from 'http-status';
import type { MyUser } from '../../../interfaces';
import ApiError from '../../../errors/ApiErrors';
import sendResponse from '../../../shared/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { AuthServices } from './auth.service';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'none' as const,
  secure: true,
};

// ── SIGNUP ────────────────────────────────────────────────────────────────────

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.signupToDb(req.body);

  if (result.isVerified && (result as any).accessToken) {
    res.cookie('accessToken', (result as any).accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', (result as any).refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.isVerified ? 'Account created and authenticated successfully.' : 'Account created. Please verify your email.',
    data: result,
  });
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.loginUser(req.body);

  if (result.isVerified && result.accessToken) {
    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: result.keepMeLogin ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isVerified ? 'Logged in successfully' : 'OTP sent to your email',
    data: result,
  });
});

// ── SOCIAL SIGNUP / LOGIN ─────────────────────────────────────────────────────

const socialSignupOrLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.socialSignupOrLogin(req.body);

  if (result.isVerified && result.accessToken) {
    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isVerified ? 'Logged in successfully' : 'OTP sent to your email',
    data: result,
  });
});

// ── GET ME ────────────────────────────────────────────────────────────────────

const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.getMe(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Profile fetched successfully',
    data: result,
  });
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  await AuthServices.changePassword(req.user.id, newPassword, oldPassword);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password changed successfully',
    data: null,
  });
});

// ── FORGET PASSWORD ───────────────────────────────────────────────────────────

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthServices.forgetPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset OTP sent to your email',
    data,
  });
});

// ── RESET PASSWORD ────────────────────────────────────────────────────────────

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthServices.resetPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successfully',
    data: null,
  });
});

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  let token = req.headers['authorization'];
  if (token?.startsWith('Bearer ')) {
    token = token.split(' ')[1];
  }
  if (!token) {
    token = req.cookies.refreshToken;
  }
  if (!token) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token required');
  }

  const result = await AuthServices.refreshToken(token as string);

  res.cookie('accessToken', result.accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.cookie('refreshToken', result.refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  });
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────

const logoutUser = catchAsync(async (_req: Request, res: Response) => {
  const clearOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});

// ── VERIFY OTP ────────────────────────────────────────────────────────────────

const verifyOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.verifyOTP(req.body);

  if (!result.isValid) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Invalid or expired OTP',
      data: null,
    });
    return;
  }

  if (result.isVerified && result.accessToken) {
    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP verified successfully',
    data: result,
  });
});

// ── RESEND OTP ────────────────────────────────────────────────────────────────

const resendOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.resendOTP(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP resent successfully',
    data: result,
  });
});

// ── USER STATUS UPDATE (Admin) ─────────────────────────────────────────────────

const userStatusUpdate = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthServices.userStatusUpdate(req.params.id as string, req.body.status);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User status updated successfully',
    data: user,
  });
});

// ── REGISTER STAFF (Admin) ────────────────────────────────────────────────────

const registerStaff = catchAsync(async (req: Request, res: Response) => {
  const callerRole = (req as Request & { user?: MyUser }).user?.role ?? 'USER';
  const result = await AuthServices.registerStaff(req.body, callerRole);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Staff member registered successfully',
    data: result,
  });
});

export const AuthController = {
  createUser,
  loginUser,
  socialSignupOrLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  refreshToken,
  logoutUser,
  verifyOTP,
  resendOTP,
  userStatusUpdate,
  registerStaff,
};
