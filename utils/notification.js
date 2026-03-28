import db from "../models/index.js";

/**
 * CREATE AND EMIT NOTIFICATION
 * @param {object} app Express app instance to get io
 * @param {string} userId Receiver's user ID
 * @param {string} senderId Sender's user ID (optional)
 * @param {string} type 'like', 'match', 'message', 'system'
 * @param {string} content Notification text
 */
export const createNotification = async (app, userId, senderId, type, content) => {
  try {
    const io = app.get("io");
    
    // 1. Save to DB
    const notification = await db.Notification.create({
      userId,
      senderId,
      type,
      content,
    });

    // 2. Add sender details for frontend real-time update
    const notificationWithSender = await db.Notification.findByPk(notification.id, {
        include: [
            {
                model: db.Auth,
                as: "sender",
                attributes: ["id", "name"],
                include: [{ model: db.UserProfile, as: "profile", attributes: ["photo"] }],
            },
        ],
    });

    // 3. Emit via Socket
    if (io) {
      console.log(`EMITTING NOTIFICATION TO ${userId}: ${content}`);
      io.to(userId).emit("newNotification", notificationWithSender);
    }

    return notificationWithSender;
  } catch (error) {
    console.error("Create Notification Error:", error.message);
  }
};
