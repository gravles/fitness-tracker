import crypto from 'crypto';

// No 0/O/1/I/L — codes are read off a watch face and typed on a phone
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 5 * 60;

export function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

export function generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    return code;
}

/** Uppercase and strip spaces/dashes so "abc-123" and "ABC 123" both match. */
export function normalizeCode(input: string): string {
    return input.toUpperCase().replace(/[\s-]/g, '');
}
