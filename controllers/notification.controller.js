import db from "../models/index.js";
import sendResponse, { errorResponse } from "../utils/response.js";

const { Notification, Auth, UserProfile } = db;

/**
 * FETCH NOTIFICATIONS
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.findAll({
      where: { userId },
      include: [
        {
          model: Auth,
          as: "sender",
          attributes: ["id", "name"],
          include: [{ model: UserProfile, as: "profile", attributes: ["photo"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return sendResponse(res, true, 200, notifications, "Notifications fetched");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * MARK AS READ
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const condition = id ? { id, userId } : { userId, isRead: false };
    
    await Notification.update({ isRead: true }, { where: condition });

    return sendResponse(res, true, 200, {}, "Notifications marked as read");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
