export type MyUser = {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      user: MyUser;
    }
  }
}