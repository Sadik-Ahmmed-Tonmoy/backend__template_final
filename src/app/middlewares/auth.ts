import { NextFunction, Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import { UserStatus } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/ApiErrors';
import { jwtHelpers } from '../../helpers/jwtHelpers';
import prisma from '../../shared/prisma';
import type { MyUser } from '../../interfaces';
import config from '../../config';

/**
 * Auth middleware — verifies Bearer token or accessToken cookie and enforces role-based access.
 *
 * Usage:
 *   auth()                         — any authenticated user
 *   auth('ADMIN', 'SUPER_ADMIN')   — specific roles only
 */
const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: MyUser },
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      let token: string | undefined;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
      }

      if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Authorization token required');
      }

      const verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt.access_secret as Secret,
      );

      // Fetch fresh user status from DB on every request
      const user = await prisma.user.findUnique({
        where: { id: verifiedUser.id },
      });

      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
      }

      if (user.status === UserStatus.INACTIVE || user.status === UserStatus.BANNED) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been suspended');
      }

      if (user.status === UserStatus.BLOCKED) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been blocked');
      }

      if (!user.isVerified) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Please verify your email first');
      }

      if (roles.length && !roles.includes(verifiedUser.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action');
      }

      req.user = verifiedUser as MyUser;
      next();
    } catch (err) {
      next(err);
    }
  };
};

export default auth;
