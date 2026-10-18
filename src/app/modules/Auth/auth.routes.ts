import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { authValidation } from './auth.validation';

const router = express.Router();

// ── Public Routes ─────────────────────────────────────────────────────────────

router.post('/signup', AuthController.createUser);

router.post('/login', AuthController.loginUser);

router.post('/social-signup-login', AuthController.socialSignupOrLogin);

router.post(
  '/verify-otp',
  validateRequest(authValidation.verify),
  AuthController.verifyOTP,
);

router.post(
  '/resend-otp',
  validateRequest(authValidation.resend),
  AuthController.resendOTP,
);

router.post(
  '/forget-password',
  validateRequest(authValidation.forgetPassword),
  AuthController.forgetPassword,
);

router.post(
  '/reset-password',
  validateRequest(authValidation.resetPassword),
  AuthController.resetPassword,
);

router.post('/refresh-token', AuthController.refreshToken);

router.post('/logout', AuthController.logoutUser);

// ── Authenticated Routes ──────────────────────────────────────────────────────

router.get('/me', auth(), AuthController.getMe);

router.patch(
  '/change-password',
  auth(),
  validateRequest(authValidation.changePassword),
  AuthController.changePassword,
);

// ── Admin Routes ──────────────────────────────────────────────────────────────

router.post(
  '/register-staff',
  auth('SUPER_ADMIN', 'ADMIN'),
  AuthController.registerStaff,
);

router.patch(
  '/user-status/:id',
  auth('SUPER_ADMIN', 'ADMIN'),
  AuthController.userStatusUpdate,
);

export const AuthRoutes = router;
