import db from "../models/index.js";
import { Op } from "sequelize";

const Message = db.Message;
const Auth = db.Auth;
const User = db.UserProfile;
const Like = db.Like;
const BlockedUser = db.BlockedUser;
const ArchivedChat = db.ArchivedChat;
const PinnedChat = db.PinnedChat;

export const createMessage = async ({ senderId, receiverId, content, type, isForwarded = false, replyToId = null, isDelivered = false }) => {
  if (!content || (typeof content === "string" && content.trim() === "")) {
      throw new Error("Message content cannot be empty.");
  }

  const receiverExists = await Auth.findByPk(receiverId);
  if (!receiverExists) {
    throw new Error("Receiver not found");
  }

  // Check if they are blocked
  const isBlocked = await BlockedUser.findOne({
      where: {
          [Op.or]: [
              { blockerId: senderId, blockedId: receiverId },
              { blockerId: receiverId, blockedId: senderId }
          ]
      }
  });

  if (isBlocked) {
      throw new Error("You cannot send a message to this user.");
  }

  const result = await Message.create({
    senderId,
    receiverId,
    content,
    type: type || "text",
    isForwarded,
    replyToId,
    isDelivered,
  });

  // Automatically unarchive for both sender and receiver if a message is sent
  await ArchivedChat.destroy({
      where: {
          [Op.or]: [
              { userId: senderId, targetUserId: receiverId },
              { userId: receiverId, targetUserId: senderId }
          ]
      }
  });

  return result;
};

export const markMessagesAsRead = async (receiverId, senderId) => {
    return await Message.update(
        { isRead: true },
        { 
            where: { 
                receiverId, 
                senderId, 
                isRead: false 
            } 
        }
    );
};

export const getMessagesBetweenUsers = async (userId1, userId2) => {
  return await Message.findAll({
    where: {
      [Op.or]: [
        { 
            senderId: userId1, 
            receiverId: userId2,
            isDeletedBySender: { [Op.ne]: true },
            isDeletedForEveryone: { [Op.ne]: true } 
        },
        { 
            senderId: userId2, 
            receiverId: userId1,
            isDeletedByReceiver: { [Op.ne]: true },
            isDeletedForEveryone: { [Op.ne]: true } 
        },
      ],
    },
    order: [["createdAt", "ASC"]],
    include: [
        {
            model: db.Message,
            as: "replyTo",
            attributes: ["id", "content", "senderId"]
        }
    ]
  });
};

export const getUserConversations = async (userId, getArchived = false) => {
  const archivedRecords = await ArchivedChat.findAll({
      where: { userId },
      attributes: ["targetUserId"]
  });
  const archivedIds = archivedRecords.map(r => r.targetUserId);

  const pinnedRecords = await PinnedChat.findAll({
      where: { userId },
      attributes: ["targetUserId"]
  });
  const pinnedIds = pinnedRecords.map(r => r.targetUserId);

  const messages = await Message.findAll({
    where: {
        [Op.or]: [
          { senderId: userId, isDeletedBySender: { [Op.ne]: true }, isDeletedForEveryone: { [Op.ne]: true } },
          { receiverId: userId, isDeletedByReceiver: { [Op.ne]: true }, isDeletedForEveryone: { [Op.ne]: true } }
      ],
    },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Auth,
        as: "sender",
        attributes: ["id", "name", "email"],
        include: [{ model: User, as: "profile", attributes: ["photo"] }],
      },
      {
        model: Auth,
        as: "receiver",
        attributes: ["id", "name", "email"],
        include: [{ model: User, as: "profile", attributes: ["photo"] }],
      },
    ],
  });

  const conversations = [];
  const seenUsers = new Set();

  for (const msg of messages) {
    const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
    
    // Skip if we want active chats but this one is archived, OR vice versa
    const isArchived = archivedIds.includes(otherUser.id);
    if (getArchived && !isArchived) continue;
    if (!getArchived && isArchived) continue;

    if (!seenUsers.has(otherUser.id)) {
      seenUsers.add(otherUser.id);
      
      const unreadCount = await Message.count({
          where: {
              senderId: otherUser.id,
              receiverId: userId,
              isRead: false
          }
      });

      conversations.push({
        user: otherUser,
        lastMessage: msg.content,
        timestamp: msg.createdAt,
        isPinned: pinnedIds.includes(otherUser.id),
        unreadCount
      });
    }
  }

  // Sort: Pinned first, then by timestamp
  return conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
};

export const pinConversation = async (userId, targetUserId) => {
    return await PinnedChat.findOrCreate({
        where: { userId, targetUserId }
    });
};

export const unpinConversation = async (userId, targetUserId) => {
    return await PinnedChat.destroy({
        where: { userId, targetUserId }
    });
};

export const archiveConversation = async (userId, targetUserId) => {
    return await ArchivedChat.findOrCreate({
        where: { userId, targetUserId }
    });
};

export const unarchiveConversation = async (userId, targetUserId) => {
    return await ArchivedChat.destroy({
        where: { userId, targetUserId }
    });
};

export const deleteConversation = async (userId, targetUserId) => {
    // Mark sent messages as deleted
    await Message.update(
        { isDeletedBySender: true },
        {
            where: {
                senderId: userId,
                receiverId: targetUserId
            }
        }
    );

    // Mark received messages as deleted
    await Message.update(
        { isDeletedByReceiver: true },
        {
            where: {
                senderId: targetUserId,
                receiverId: userId
            }
        }
    );
    
    return true;
};

export const deleteMessage = async (userId, messageId, forEveryone = false) => {
    const message = await Message.findByPk(messageId);
    if (!message) {
        throw new Error("Message not found");
    }

    if (forEveryone) {
        if (message.senderId !== userId) {
            throw new Error("Unauthorized to delete for everyone");
        }
        message.isDeletedForEveryone = true;
    } else {
        if (message.senderId === userId) {
            message.isDeletedBySender = true;
        } else if (message.receiverId === userId) {
            message.isDeletedByReceiver = true;
        } else {
            throw new Error("Unauthorized");
        }
    }

    await message.save();
    return message;
};

export const updateMessage = async (userId, messageId, newContent) => {
    const message = await Message.findByPk(messageId);
    if (!message) {
        throw new Error("Message not found");
    }

    // Only sender can edit content
    if (message.senderId !== userId) {
        throw new Error("Unauthorized: Only sender can edit message");
    }

    message.content = newContent;
    message.isEdited = true;
    await message.save();
    return message;
};

export const pinMessage = async (userId, messageId, isPinned) => {
    const message = await Message.findByPk(messageId);
    if (!message) {
        throw new Error("Message not found");
    }

    // Usually either person in the chat can pin a message
    if (message.senderId !== userId && message.receiverId !== userId) {
        throw new Error("Unauthorized");
    }

    message.isPinned = isPinned;
    await message.save();
    return message;
};

export const markAsRead = async (userId, senderId) => {
    return await Message.update(
        { isRead: true },
        {
            where: {
                senderId,
                receiverId: userId,
                isRead: false
            }
        }
    );
};

export const markMessagesAsDelivered = async (receiverId) => {
    try {
        await Message.update(
            { isDelivered: true },
            {
                where: {
                    receiverId,
                    isDelivered: false
                }
            }
        );
        return true;
    } catch (e) {
        console.error('Mark Delivered Error', e);
        return false;
    }
};
