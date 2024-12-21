"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipInterceptor = void 0;
const common_1 = require("@nestjs/common");
const SkipInterceptor = () => (0, common_1.SetMetadata)('skipInterceptor', true);
exports.SkipInterceptor = SkipInterceptor;
//# sourceMappingURL=skip-response.interceptor.js.map