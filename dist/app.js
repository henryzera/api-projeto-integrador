"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const auth_controller_1 = require("./controllers/auth.controller");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const errorHandler_1 = require("./middlewares/errorHandler");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const contratacoes_routes_1 = __importDefault(require("./routes/contratacoes.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const asyncHandler_1 = require("./utils/asyncHandler");
const app = (0, express_1.default)();
const corsOrigins = env_1.env.CORS_ORIGIN === '*'
    ? '*'
    : env_1.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: corsOrigins }));
app.use(express_1.default.json({ limit: '100kb' }));
app.use(express_1.default.urlencoded({ extended: false, limit: '100kb' }));
app.use((0, rateLimiter_1.createRateLimiter)({
    limit: 300,
    message: 'Too many requests. Try again later.',
    windowMs: 15 * 60 * 1000
}));
// rotas
app.use('/health', health_routes_1.default);
app.use('/auth', auth_routes_1.default);
app.get('/me', auth_middleware_1.requireAuth, (0, asyncHandler_1.asyncHandler)(auth_controller_1.meController));
app.use('/contratacoes', auth_middleware_1.requireAuth, contratacoes_routes_1.default);
app.use(errorHandler_1.errorHandler);
exports.default = app;
