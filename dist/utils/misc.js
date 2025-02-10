"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFileKey = exports.responseGenerator = void 0;
exports.formatCurrency = formatCurrency;
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
function formatCurrency(value, precision) {
    if (isNaN(value)) {
        return '0.00';
    }
    return value.toLocaleString('en-IN', {
        maximumFractionDigits: precision ?? 2,
        minimumFractionDigits: precision ?? 2,
        style: 'currency',
        currency: 'INR',
    });
}
//# sourceMappingURL=misc.js.map