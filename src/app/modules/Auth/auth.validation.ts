import { z } from 'zod';

const signup = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    fullName: z.string().min(1, 'Full name is required').optional(),
    phoneNumber: z
      .string()
      .min(8, 'Phone number must be at least 8 characters')
      .max(20, 'Phone number must not exceed 20 characters')
      .optional(),
  }),
});

const login = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    keepMeLogin: z.boolean().optional(),
  }),
});

const changePassword = z.object({
  body: z.object({
    oldPassword: z.string().min(6, 'Old password must be at least 6 characters'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});

const forgetPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

const resetPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    token: z.string({ required_error: 'Reset token is required' }),
    password: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});

const verify = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    code: z.string({ required_error: 'OTP code is required' }),
    purpose: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET'] as const, {
      required_error: 'Purpose is required',
    }),
  }),
});

const resend = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    purpose: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET'] as const, {
      required_error: 'Purpose is required',
    }),
  }),
});

export const authValidation = {
  signup,
  login,
  changePassword,
  forgetPassword,
  resetPassword,
  verify,
  resend,
};
