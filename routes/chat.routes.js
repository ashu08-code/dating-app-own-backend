import express from "express";
import { 
    sendMessage, 
    getMessages, 
    getConversations,
    deleteConversation,
    deleteMessage,
    updateMessage,
    forwardMessage,
    archiveConversation,
    unarchiveConversation,
    pinConversation,
    unpinConversation,
    markAsRead
} from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js"; 

const router = express.Router();

router.post("/send", authenticate, sendMessage);
router.get("/conversations", authenticate, getConversations);
router.get("/:userId", authenticate, getMessages);

router.delete("/conversation/:targetUserId", authenticate, deleteConversation);
router.delete("/message/:messageId", authenticate, deleteMessage);
router.put("/message/:messageId", authenticate, updateMessage);
router.post("/forward", authenticate, forwardMessage);
router.post("/archive/:targetUserId", authenticate, archiveConversation);
router.post("/unarchive/:targetUserId", authenticate, unarchiveConversation);
router.post("/pin/:targetUserId", authenticate, pinConversation);
router.post("/unpin/:targetUserId", authenticate, unpinConversation);
router.post("/read/:senderId", authenticate, markAsRead);

export default router;
