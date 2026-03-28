import db from "../models/index.js";
import sendResponse, { errorResponse } from "../utils/response.js";
import fs from "fs";

const { UserProfile, Auth, Like, Sequelize } = db;

/**
 * Get User Profile
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await UserProfile.findOne({
      where: { userId },
      include: [
        {
          model: Auth,
          as: "user",
          attributes: ["id", "name", "email", "contact"],
        },
      ],
    });

    if (!profile) {
      // Return basic user info even if profile doesn't exist yet
      return sendResponse(res, true, 200, {
          user: req.user,
          profile: null
      }, "Profile not found, please complete your profile");
    }

    return sendResponse(res, true, 200, profile, "Profile fetched successfully");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update (or Create) User Profile
 * Handles multipart/form-data
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { city, interests, relationshipGoal } = req.body;
    let photoUrl = null;

    if (req.file) {
      // Normalize path separator to forward slash for URLs
      photoUrl = req.file.path.replace(/\\/g, "/");
    }

    // Check if profile exists
    let profile = await UserProfile.findOne({ where: { userId } });

    // Delete old photo if new one is uploaded
    if (photoUrl && profile && profile.photo) {
      const oldPhotoPath = profile.photo;
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    let parsedInterests = [];
    if (interests) {
        try {
            parsedInterests = typeof interests === 'string' ? JSON.parse(interests) : interests;
        } catch (e) {
            // Fallback: if it's a simple string, make it an array, otherwise keep empty
            parsedInterests = [interests.toString()];
        }
    }

    const updateData = {
      ...(city && { city }),
      ...(interests && { interests: parsedInterests }),
      ...(relationshipGoal && { relationshipGoal }),
      ...(photoUrl && { photo: photoUrl }),
    };

    if (profile) {
      // Update existing
      profile = await profile.update(updateData);
    } else {
      // Create new
      profile = await UserProfile.create({
        userId,
        ...updateData,
      });
    }

    return sendResponse(
      res,
      true,
      200,
      profile,
      "Profile updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get Recommendations (for Home Screen Swipe)
 */
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get IDs of users I've already interacted with (Like/Dislike)
    const interactedUsers = await Like.findAll({
      where: { senderId: userId },
      attributes: ["receiverId"],
    });

    const interactedUserIds = interactedUsers.map((u) => u.receiverId);

    // 2. Build where clause
    const whereClause = {
      id: {
        [db.Sequelize.Op.ne]: userId,
      },
      is_active: true
    };

    if (interactedUserIds.length > 0) {
      whereClause.id[db.Sequelize.Op.notIn] = interactedUserIds;
    }

    // 3. Fetch from DB
    let users = [];
    try {
        console.log(`Executing search for userId: ${userId}`);
        users = await Auth.findAll({
            where: whereClause,
            include: [
                {
                    model: UserProfile,
                    as: "profile",
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20,
            logging: (sql) => console.log("SQL:", sql)
        });
    } catch (dbError) {
        console.error("DB Error in recommendations:", dbError.message);
        throw dbError; 
    }

    console.log(`User ${userId} - Found users: ${users.length}`);

    // 4. Map to frontend format
    const mappedUsers = users.map((u) => {
      let image = "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e";
      if (u.profile && u.profile.photo) {
          const photo = u.profile.photo.replace(/\\/g, "/");
          const baseUrl = process.env.BASE_URL || "http://10.0.2.2:5000";
          image = photo.startsWith("http") ? photo : `${baseUrl}/${photo}`.replace(/([^:]\/)\/+/g, "$1");
      }

      return {
        id: u.id,
        name: u.name || "Unknown",
        age: 24, // Fallback
        bio: u.profile?.relationshipGoal || u.profile?.city || "Looking for someone special",
        city: u.profile?.city || "Nearby",
        image: image,
      };
    });

    console.log(`Sending ${mappedUsers.length} users to frontend for user ${userId}`);

    return sendResponse(res, true, 200, mappedUsers, "Recommendations fetched successfully");
  } catch (error) {
    console.error("Recommendations Error:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get Public User Profile by ID
 */
export const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await Auth.findByPk(id, {
      include: [
        {
          model: UserProfile,
          as: "profile",
        },
      ],
    });

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    // Map to the same format the frontend expects for cards
    const mappedUser = {
      id: user.id,
      name: user.name || "Unknown",
      age: 24, // Fallback since DOB isn't in current schema
      bio: user.profile?.relationshipGoal || user.profile?.city || "Looking for someone special",
      city: user.profile?.city || "Nearby",
      interests: user.profile?.interests || [],
      photo: user.profile?.photo || null,
      image: user.profile?.photo 
        ? (user.profile.photo.startsWith("http") ? user.profile.photo : `${process.env.BASE_URL || "http://10.0.2.2:5000"}/${user.profile.photo.replace(/\\/g, "/")}`.replace(/([^:]\/)\/+/g, "$1"))
        : "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
    };

    return sendResponse(res, true, 200, mappedUser, "User profile fetched successfully");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await Auth.findByPk(userId, { attributes: ["id", "lastSeen"] });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Note: Actual online status is in the server's onlineUsers map. 
        // For REST, we can only return DB's lastSeen.
        res.status(200).json({ 
            id: user.id, 
            lastSeen: user.lastSeen 
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
