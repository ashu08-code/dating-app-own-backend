import * as ChatService from "../services/chat.service.js";

export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, type } = req.body;
    const senderId = req.user.id;

    const message = await ChatService.createMessage({ senderId, receiverId, content, type });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error.message);
    
    const forbiddenMessages = [
      "You cannot send a message to this user."
    ];

    if (error.message === "Receiver not found") {
        return res.status(404).json({ message: "Receiver user not found" });
    }
    if (error.message === "Message content cannot be empty.") {
        return res.status(400).json({ message: error.message });
    }
    if (forbiddenMessages.includes(error.message)) {
        return res.status(403).json({ message: error.message });
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
       return res.status(404).json({ message: "User not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user.id;

    const messages = await ChatService.getMessagesBetweenUsers(myId, userId);

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const myId = req.user.id;
    const { archived } = req.query;

    const conversations = await ChatService.getUserConversations(myId, archived === "true");

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;

        await ChatService.deleteConversation(userId, targetUserId);
        res.status(200).json({ message: "Conversation deleted successfully" });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        await ChatService.deleteMessage(userId, messageId);
        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.error("Error deleting message:", error);
        if (error.message === 'Message not found') {
            return res.status(404).json({ message: "Message not found" });
        }
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ message: "Unauthorized" });
        }
        res.status(500).json({ message: "Server error" });
    }
};

export const updateMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { content } = req.body;

        const updatedMessage = await ChatService.updateMessage(userId, messageId, content);
        res.status(200).json(updatedMessage);
    } catch (error) {
        console.error("Error updating message:", error);
        if (error.message === 'Unauthorized: Only sender can edit message') {
             return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error" });
    }
};

export const forwardMessage = async (req, res) => {
    try {
        const { receiverIds, messages } = req.body; // messages should be an array of { content, type }
        const senderId = req.user.id;

        if (!receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
            return res.status(400).json({ message: "No recipients selected" });
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ message: "No messages selected to forward" });
        }

        const createdMessages = [];
        const io = req.app.get("io");

        for (const rId of receiverIds) {
            for (const msgData of messages) {
                const msg = await ChatService.createMessage({
                    senderId,
                    receiverId: rId,
                    content: msgData.content,
                    type: msgData.type || "text",
                    isForwarded: true
                });
                const messageData = msg.toJSON();
                createdMessages.push(messageData);

                // Real-time emit
                if (io) {
                    io.to(rId).emit("receiveMessage", messageData);
                }
            }
        }

        res.status(201).json(createdMessages);
    } catch (error) {
        console.error("Error forwarding messages:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const archiveConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;
        await ChatService.archiveConversation(userId, targetUserId);
        res.status(200).json({ message: "Conversation archived" });
    } catch (error) {
        console.error("Error archiving conversation:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const unarchiveConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;
        await ChatService.unarchiveConversation(userId, targetUserId);
        res.status(200).json({ message: "Conversation unarchived" });
    } catch (error) {
        console.error("Error unarchiving conversation:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const pinConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;
        await ChatService.pinConversation(userId, targetUserId);
        res.status(200).json({ message: "Conversation pinned" });
    } catch (error) {
        console.error("Error pinning conversation:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const unpinConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.params;
        await ChatService.unpinConversation(userId, targetUserId);
        res.status(200).json({ message: "Conversation unpinned" });
    } catch (error) {
        console.error("Error unpinning conversation:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { senderId } = req.params;
        await ChatService.markAsRead(userId, senderId);

        // Real-time notify via socket
        const io = req.app.get("io");
        if (io) {
            io.to(senderId).emit("messagesRead", { readerId: userId });
        }

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({ message: "Server error" });
    }
};
export const uploadImages = async (req, res) => {
    try {
        const { receiverId } = req.body;
        const senderId = req.user.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: "No images provided" });
        }

        const createdMessages = [];
        const io = req.app.get("io");

        for (const file of files) {
            const message = await ChatService.createMessage({
                senderId,
                receiverId,
                content: file.path.replace(/\\/g, "/"), // Save path
                type: "image"
            });
            
            const messageData = message.toJSON();
            createdMessages.push(messageData);

            // Real-time emit
            if (io) {
                // Determine if sender and receiver are the same person (testing)
                io.to(receiverId).emit("receiveMessage", messageData);
                // Also notify sender's own devices
                if (receiverId !== senderId) {
                    io.to(senderId).emit("messageSent", messageData);
                }
            }
        }

        res.status(201).json(createdMessages);
    } catch (error) {
        console.error("Error uploading images:", error);
        res.status(500).json({ message: "Server error" });
    }
};
