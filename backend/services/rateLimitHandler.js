// backend/services/rateLimitHandler.js

// In-flight request deduplication map to prevent redundant concurrent operations
const inFlightRequests = new Map();

/**
 * Custom error thrown when a GitHub rate limit exceeds the immediate execution window
 */
export class RateLimitExceededError extends Error {
    constructor(userMessage, { resetTime = null, status = 429, retryAfterSeconds = null } = {}) {
        super(userMessage);
        this.name = 'RateLimitExceededError';
        this.isRateLimit = true;
        this.resetTime = resetTime;
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
        this.userFacingMessage = userMessage;
    }
}

/**
 * Sanitizes messages and errors to ensure no sensitive tokens, credentials, or secrets leak into logs
 */
export function sanitizeLog(input) {
    if (!input) return '';
    let str = typeof input === 'string' ? input : (input.message || JSON.stringify(input));
    
    // Mask GitHub tokens (classic ghp_ and fine-grained github_pat_)
    str = str.replace(/ghp_[a-zA-Z0-9]{30,}/g, 'ghp_***');
    str = str.replace(/github_pat_[a-zA-Z0-9_]{40,}/g, 'github_pat_***');
    str = str.replace(/token\s+([a-zA-Z0-9_-]{20,})/gi, 'token ***');
    str = str.replace(/Bearer\s+([a-zA-Z0-9_.-]{20,})/gi, 'Bearer ***');
    
    // Mask database credentials in connection URIs
    str = str.replace(/postgresql:\/\/[^:]+:([^@]+)@/gi, 'postgresql://***:***@');
    
    // Mask email SMTP passwords
    str = str.replace(/SMTP_PASS=[^\s&]+/gi, 'SMTP_PASS=***');
    
    return str;
}

/**
 * Normalizes headers from either Fetch Headers or plain object (Octokit)
 */
export function parseRateLimitHeaders(headers) {
    if (!headers) return {};
    
    const getHeader = (name) => {
        if (typeof headers.get === 'function') {
            return headers.get(name);
        }
        return headers[name.toLowerCase()] || headers[name];
    };

    const retryAfter = getHeader('retry-after');
    const reset = getHeader('x-ratelimit-reset');
    const remaining = getHeader('x-ratelimit-remaining');
    const limit = getHeader('x-ratelimit-limit');
    const used = getHeader('x-ratelimit-used');
    const resource = getHeader('x-ratelimit-resource');

    return {
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
        resetTime: reset ? parseInt(reset, 10) : null,
        remaining: remaining !== undefined && remaining !== null ? parseInt(remaining, 10) : null,
        limit: limit !== undefined && limit !== null ? parseInt(limit, 10) : null,
        used: used ? parseInt(used, 10) : null,
        resource: resource || null,
    };
}

/**
 * Accurately determines if an error is a confirmed GitHub rate limit (primary or secondary)
 * rather than a permission/authorization failure or resource absence.
 */
export function isConfirmedRateLimit(err) {
    if (!err) return false;
    const status = err.status || err.response?.status;
    
    if (status === 429) return true;
    
    if (status === 403) {
        // Inspect headers for exhausted quota
        let headers = {};
        if (err.response?.headers) {
            headers = parseRateLimitHeaders(err.response.headers);
        } else if (err.headers) {
            headers = parseRateLimitHeaders(err.headers);
        }
        
        if (headers.remaining === 0 || (headers.retryAfter && headers.retryAfter > 0)) {
            return true;
        }
        
        // Inspect error message for rate limit / secondary limit keywords
        const msg = String(err.message || '').toLowerCase();
        if (
            msg.includes('rate limit') ||
            msg.includes('secondary rate') ||
            msg.includes('abuse detection') ||
            msg.includes('too many requests')
        ) {
            return true;
        }
        
        // 403 without rate limit indicators is a permission/private repo error
        return false;
    }
    
    return false;
}

/**
 * Checks if an error is a transient network or server failure
 */
export function isTransientError(err) {
    if (!err) return false;
    const status = err.status || err.response?.status;
    if (status >= 500 && status <= 504) return true;
    
    const code = err.code || err.cause?.code;
    const transientCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);
    if (code && transientCodes.has(code)) return true;
    
    const msg = String(err.message || '').toLowerCase();
    if (msg.includes('socket hang up') || msg.includes('timeout') || msg.includes('network error')) {
        return true;
    }
    
    return false;
}

/**
 * Formats safe, accurate user feedback for rate-limited conversions
 * Never fabricates wait estimates.
 */
export function formatRateLimitMessage(resetTimeOrObj) {
    const resetTime = (resetTimeOrObj && typeof resetTimeOrObj === 'object') ? resetTimeOrObj.resetTime : resetTimeOrObj;
    if (resetTime && !isNaN(resetTime)) {
        const nowSec = Math.floor(Date.now() / 1000);
        const diffSec = resetTime - nowSec;
        if (diffSec > 0) {
            const minutes = Math.max(1, Math.ceil(diffSec / 60));
            return `GitHub is temporarily limiting requests. Your conversion has been paused. Please try again in approximately ${minutes} minute${minutes === 1 ? '' : 's'}.`;
        }
    }
    return 'GitHub is temporarily limiting requests. Your conversion has been paused. The retry time is not yet available. Please try again shortly.';
}

/**
 * Calculates backoff delay based on Retry-After and X-RateLimit-Reset headers
 */
export function calculateBackoffDelay(headersOrError, attempt = 0, maxWaitMs = 15000) {
    if (typeof headersOrError === 'number') {
        const tmp = headersOrError;
        headersOrError = (attempt && typeof attempt === 'object') ? attempt : null;
        attempt = tmp;
    }

    let headers = {};
    if (headersOrError) {
        if (headersOrError.response?.headers) {
            headers = parseRateLimitHeaders(headersOrError.response.headers);
        } else if (headersOrError.headers) {
            headers = parseRateLimitHeaders(headersOrError.headers);
        } else {
            headers = parseRateLimitHeaders(headersOrError);
        }
    }

    let delayMs = 0;

    // 1. Check Retry-After (seconds)
    if (headers.retryAfter && !isNaN(headers.retryAfter)) {
        delayMs = headers.retryAfter * 1000;
    }
    // 2. Check X-RateLimit-Reset (Unix timestamp in seconds)
    else if (headers.resetTime && !isNaN(headers.resetTime)) {
        const nowSec = Math.floor(Date.now() / 1000);
        const diffSec = headers.resetTime - nowSec;
        delayMs = diffSec > 0 ? diffSec * 1000 : 1000;
    }
    // 3. Fall back to exponential backoff with jitter
    else {
        const base = 1000 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        delayMs = base + jitter;
    }

    // Guard: If the rate-limit reset is beyond maxWaitMs (e.g. minutes/hours), do not block execution
    if (delayMs > maxWaitMs) {
        return {
            waitMs: delayMs,
            shouldRetry: false,
            reason: `Rate limit reset window (${Math.round(delayMs / 1000)}s) exceeds max allowed backoff (${Math.round(maxWaitMs / 1000)}s)`,
            headers,
        };
    }

    return {
        waitMs: Math.max(delayMs, 500),
        shouldRetry: true,
        reason: null,
        headers,
    };
}

/**
 * Deduplicates in-flight promises so concurrent requests for the same repo/tree don't duplicate work
 */
export async function deduplicateRequest(key, fn) {
    if (!key) return fn();
    if (inFlightRequests.has(key)) {
        return inFlightRequests.get(key);
    }
    const promise = (async () => {
        try {
            return await fn();
        } finally {
            inFlightRequests.delete(key);
        }
    })();
    inFlightRequests.set(key, promise);
    return promise;
}

/**
 * Executes an async operation with rate limit and transient error retry handling.
 * Distinguishes confirmed rate limits from permission errors and network failures.
 */
export async function withRateLimitRetry(operation, {
    stage = 'OPERATION',
    maxRetries = 2,
    maxWaitMs = 15000,
    onRetry = null,
} = {}) {
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            return await operation();
        } catch (err) {
            const status = err.status || err.response?.status;
            const isRL = isConfirmedRateLimit(err);
            const isTransient = isTransientError(err);

            // Fast-fail permanent errors (404 Not Found, 400 Bad Request, 401 Unauthorized, or permission 403)
            if (!isRL && !isTransient) {
                throw err;
            }

            if (attempt >= maxRetries) {
                if (isRL) {
                    const headers = err.response?.headers || err.headers;
                    const parsedHeaders = parseRateLimitHeaders(headers);
                    const userMsg = formatRateLimitMessage(parsedHeaders.resetTime);
                    throw new RateLimitExceededError(userMsg, {
                        resetTime: parsedHeaders.resetTime,
                        status: status || 429,
                        retryAfterSeconds: parsedHeaders.retryAfter,
                    });
                }
                throw err;
            }

            const backoff = calculateBackoffDelay(err, attempt, maxWaitMs);
            if (!backoff.shouldRetry) {
                console.warn(sanitizeLog(`[RateLimit:${stage}] Cannot wait in-process: ${backoff.reason}`));
                if (isRL) {
                    const userMsg = formatRateLimitMessage(backoff.headers.resetTime);
                    throw new RateLimitExceededError(userMsg, {
                        resetTime: backoff.headers.resetTime,
                        status: status || 429,
                        retryAfterSeconds: backoff.headers.retryAfter,
                    });
                }
                throw err;
            }

            attempt++;
            const sanitizedMsg = sanitizeLog(
                `[RateLimit:${stage}] HTTP ${status || 'ERR'} encountered. Backing off ${backoff.waitMs}ms (retry ${attempt}/${maxRetries}). Headers: [rem=${backoff.headers.remaining}, reset=${backoff.headers.resetTime}]`
            );
            console.log(sanitizedMsg);

            if (typeof onRetry === 'function') {
                onRetry({ attempt, waitMs: backoff.waitMs, stage, status, headers: backoff.headers });
            }

            await new Promise((resolve) => setTimeout(resolve, backoff.waitMs));
        }
    }
}

