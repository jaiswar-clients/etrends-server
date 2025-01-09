"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractS3Key = exports.responseGenerator = void 0;
const responseGenerator = (message, data, success = true) => {
    return {
        message,
        data,
        success,
    };
};
exports.responseGenerator = responseGenerator;
const extractS3Key = (signedUrl) => {
    if (!signedUrl)
        return null;
    if (!signedUrl.includes('https://'))
        return signedUrl;
    const regex = /https:\/\/[^\/]+\/([^?]+)/;
    const match = signedUrl.match(regex);
    if (match && match[1]) {
        return match[1];
    }
    else {
        return null;
    }
};
exports.extractS3Key = extractS3Key;
//# sourceMappingURL=misc.js.map