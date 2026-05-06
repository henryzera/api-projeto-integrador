"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const contratacoes_routes_1 = __importDefault(require("./routes/contratacoes.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// rotas
app.use('/health', health_routes_1.default);
app.use('/contratacoes', contratacoes_routes_1.default);
app.use((error, _req, res, _next) => {
    console.error(error);
    return res.status(500).json({
        message: 'Internal server error'
    });
});
exports.default = app;
