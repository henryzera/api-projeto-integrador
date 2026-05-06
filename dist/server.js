"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const mongo_1 = require("./database/mongo");
const user_repository_1 = require("./repositories/user.repository");
async function startServer() {
    await (0, mongo_1.connectMongo)();
    await (0, user_repository_1.ensureUserIndexes)();
    app_1.default.listen(env_1.env.PORT, () => {
        console.log(`Server running on port ${env_1.env.PORT}`);
        console.log('MongoDB connected');
    });
}
startServer().catch((error) => {
    console.error('Failed to start server');
    console.error(error);
    process.exit(1);
});
