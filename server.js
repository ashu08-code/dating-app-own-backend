import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app.js";
import db from "./models/index.js";
import jwt from "jsonwebtoken";
import * as ChatService from "./services/chat.service.js";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = createServer(app);
// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Store connected users: userId -> Set of socketIds
const onlineUsers = new Map();

// Middleware for Socket Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  console.log(`User connected: ${userId} (Socket: ${socket.id})`);

  // Handle undelivered messages
  ChatService.markMessagesAsDelivered(userId).then(() => {
    // Notify all senders who sent messages to this user that they are now delivered
    io.emit("messagesDeliveredUpdate", { receiverId: userId });
  });

  // Join a room for self (for multi-device sync)
  socket.join(userId);

  // Send a message
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, content, type } = data;
      // Check if receiver is online
      const isOnline = onlineUsers.has(receiverId);
      
      const savedMessage = await ChatService.createMessage({
        senderId: userId,
        receiverId,
        content,
        type: type || "text",
        isForwarded: data.isForwarded || false,
        replyToId: data.replyToId || null,
        isDelivered: isOnline, // Automatically delivered if online
      });
      
      // We need to reload the message to include the replyTo data for the frontend
      const messageWithIncludes = await db.Message.findByPk(savedMessage.id, {
        include: [
          {
            model: db.Message,
            as: "replyTo",
            attributes: ["id", "content", "senderId"]
          }
        ]
      });
      
      const messageData = messageWithIncludes.toJSON();

      // Emit to receiver's room (all their devices)
      io.to(receiverId).emit("receiveMessage", messageData);

      // 🔥 Trigger Persistent Notification
      const { createNotification } = await import("./utils/notification.js");
      await createNotification(app, receiverId, userId, "message", `New message: ${content.substring(0, 30)}${content.length > 30 ? "..." : ""}`);

      // Emit back to sender's room (all their devices, to sync sent status)
      io.to(userId).emit("messageSent", messageData);

      if (isOnline) {
          // Notify sender that message was delivered
          io.to(userId).emit("messageDelivered", { messageId: messageData.id, receiverId });
      }

    } catch (error) {
      console.error("Socket sendMessage error:", error.message);
      socket.emit("error", { message: error.message || "Failed to send message" });
    }
  });

  // Mark messages as read
  socket.on("markAsRead", async (data) => {
    try {
      const { senderId } = data; // The user whose messages were read
      await ChatService.markMessagesAsRead(userId, senderId);

      // Notify the sender that their messages were read
      io.to(senderId).emit("messagesRead", { readerId: userId });
      // Notify other devices of the reader to sync UI
      io.to(userId).emit("messagesReadSync", { senderId });
    } catch (error) {
      console.error("Socket markAsRead error:", error);
    }
  });

  // Edit message
  socket.on("editMessage", async (data) => {
    try {
      const { messageId, newContent } = data;
      const updatedMessage = await ChatService.updateMessage(userId, messageId, newContent);
      
      const messageData = updatedMessage.toJSON();
      io.to(messageData.receiverId).emit("messageEdited", messageData);
      io.to(userId).emit("messageEdited", messageData); // Sync other devices
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Delete message
  socket.on("deleteMessage", async (data) => {
    try {
      const { messageId, forEveryone } = data;
      const deletedMessage = await ChatService.deleteMessage(userId, messageId, forEveryone);
      
      const payload = { 
        messageId, 
        forEveryone, 
        isDeletedForEveryone: deletedMessage.isDeletedForEveryone 
      };
      
      io.to(userId).emit("messageDeleted", payload);
      
      if (forEveryone) {
        // Notify the other person it was deleted for everyone
        const otherUserId = deletedMessage.senderId === userId ? deletedMessage.receiverId : deletedMessage.senderId;
        io.to(otherUserId).emit("messageDeleted", payload);
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Pin message
  socket.on("pinMessage", async (data) => {
    try {
      const { messageId, isPinned } = data;
      const pinnedMessage = await ChatService.pinMessage(userId, messageId, isPinned);
      
      const messageData = pinnedMessage.toJSON();
      io.to(userId).emit("messagePinned", messageData);
      
      // Notify the other person
      const otherUserId = messageData.senderId === userId ? messageData.receiverId : messageData.senderId;
      io.to(otherUserId).emit("messagePinned", messageData);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Typing indicators
  socket.on("typing", (data) => {
    const { receiverId } = data;
    io.to(receiverId).emit("userTyping", { userId });
  });
  
  socket.on("stopTyping", (data) => {
    const { receiverId } = data;
    io.to(receiverId).emit("userStoppedTyping", { userId });
  });

  socket.on("disconnect", async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        console.log(`User fully offline: ${userId}`);
        
        // Update Last Seen in DB
        try {
          await db.Auth.update({ lastSeen: new Date() }, { where: { id: userId } });
        } catch (e) { console.error("Update LastSeen Error", e); }

        // Broadcast offline status
        io.emit("userStatusChanged", { userId, status: "offline", lastSeen: new Date() });
      }
    }
  });

  // New: Get status of a user
  socket.on("getUserStatus", (data) => {
      const isOnline = onlineUsers.has(data.userId);
      socket.emit("userStatusChanged", { 
          userId: data.userId, 
          status: isOnline ? "online" : "offline" 
      });
  });

  // Broadcast online status on join
  io.emit("userStatusChanged", { userId, status: "online" });
});

db.sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("Database connected");
    httpServer.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
  });
