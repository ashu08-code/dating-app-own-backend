import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import likeRoutes from "./routes/like.routes.js";
import premiumRoutes from "./routes/premium.routes.js";
import communityRoutes from "./routes/community.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import vibeRoutes from "./routes/vibe.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle standard form submissions

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/vibe", vibeRoutes);
app.use("/api/notifications", notificationRoutes);

export default app;
