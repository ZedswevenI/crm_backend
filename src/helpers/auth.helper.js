import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_SECRET = 'admin@123';
const REFRESH_SECRET = '321@nimda';

export const signAccessToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      CRN: user.userId,
      email: user.email,
      name: user.name
    },
    ACCESS_SECRET,
    { expiresIn: '1d' }
  );

export const signRefreshToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      CRN: user.userId,
      email: user.email,
      name: user.name
    },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);
