"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const mongo_1 = require("./database/mongo");
const PORT = process.env.PORT || 3000;
async function startServer() {
    await (0, mongo_1.connectMongo)();
    app_1.default.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('MongoDB connected');
    });
}
startServer().catch((error) => {
    console.error('Failed to start server');
    console.error(error);
    process.exit(1);
});
