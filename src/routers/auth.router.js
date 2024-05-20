import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants/http-status.constant.js';
import { MESSAGES } from '../constants/message.constant.js';
import { signUpValidator } from '../middlewares/validators/sign-up-validator.middleware.js';
import { prisma } from '../utils/prisma.util.js';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  HASH_SALT_ROUNDS,
  REFRESH_TOKEN_EXPIRES_IN,
} from '../constants/auth.constant.js';
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
} from '../constants/env.constant.js';

const authRouter = express.Router();

authRouter.post('/sign-up', signUpValidator, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    const existedUser = await prisma.user.findUnique({ where: { email } });

    // 이메일이 중복된 경우
    if (existedUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        status: HTTP_STATUS.CONFLICT,
        message: MESSAGES.AUTH.COMMON.EMAIL.DUPLICATED,
      });
    }

    const hashedPassword = bcrypt.hashSync(password, HASH_SALT_ROUNDS);

    const data = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    data.password = undefined;

    return res.status(HTTP_STATUS.CREATED).json({
      status: HTTP_STATUS.CREATED,
      message: MESSAGES.AUTH.SIGN_UP.SUCCEED,
      data,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/sign-in', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    const isPasswordMatched =
      user && bcrypt.compareSync(password, user.password);

    if (!isPasswordMatched) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        status: HTTP_STATUS.UNAUTHORIZED,
        message: MESSAGES.AUTH.COMMON.UNAUTHORIZED,
      });
    }

    const payload = { id: user.id };

    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    const hashedRefreshToken = bcrypt.hashSync(refreshToken, HASH_SALT_ROUNDS);

    // RefreshToken을 생성 또는 갱신
    await prisma.refreshToken.upsert({
      where: {
        userId: user.id,
      },
      update: {
        refreshToken: hashedRefreshToken,
      },
      create: {
        userId: user.id,
        refreshToken: hashedRefreshToken,
      },
    });

    return res.status(HTTP_STATUS.OK).json({
      status: HTTP_STATUS.OK,
      message: MESSAGES.AUTH.SIGN_IN.SUCCEED,
      data: { accessToken, refreshToken },
    });
  } catch (error) {
    next(error);
  }
});

export { authRouter };
