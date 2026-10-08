import { supabase, isSupabaseConfigured } from '../config/supabase.js';

/**
 * Optional authentication middleware: extracts user identity if valid Bearer token is provided.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token || !isSupabaseConfigured()) {
      req.user = null;
      return next();
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      req.user = null;
    } else {
      req.user = data.user;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

/**
 * Strict authentication middleware: requires valid Bearer token and authenticated Supabase user.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required for this operation.',
      },
    });
  }

  const token = authHeader.split(' ')[1];
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication service is not configured on the server.',
      },
    });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'The provided authentication token is invalid or expired.',
        },
      });
    }

    req.user = data.user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: 'Authentication failed.',
      },
    });
  }
}
