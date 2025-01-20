"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFileKey = exports.responseGenerator = void 0;
const responseGenerator = (message, data, success = true) => {
    return {
        message,
        data,
        success,
    };
};
exports.responseGenerator = responseGenerator;
const extractFileKey = (signedUrl) => {
    if (!signedUrl)
        return null;
    try {
        new URL(signedUrl);
        const parts = signedUrl.split('/');
        return parts[parts.length - 1] || null;
    }
    catch {
        return signedUrl;
    }
};
exports.extractFileKey = extractFileKey;
//# sourceMappingURL=misc.js.map