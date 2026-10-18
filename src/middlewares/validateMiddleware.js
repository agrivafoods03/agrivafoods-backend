import { ApiError } from '../utils/ApiError.js';

export const validateBody = (requiredFields = []) => {
  return (req, res, next) => {
    const missing = [];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new ApiError(400, `Missing required fields: ${missing.join(', ')}`, missing.map(f => `${f} is required`));
    }

    next();
  };
};

export const validateEmail = (emailField = 'email') => {
  return (req, res, next) => {
    const email = req.body[emailField];
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ApiError(400, 'Invalid email format', ['Email address is invalid']);
      }
    }
    next();
  };
};
