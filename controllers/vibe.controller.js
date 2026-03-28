import db from "../models/index.js";
import sendResponse, { errorResponse } from "../utils/response.js";
import { Op } from "sequelize";

const { UserProfile, Auth } = db;

/**
 * SET VIBE
 * Saves current user's vibe choice
 */
export const setVibe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vibe } = req.body;

    if (!vibe) return errorResponse(res, "Vibe is required", 400);

    const [profile] = await UserProfile.findOrCreate({ where: { userId } });
    
    await profile.update({ 
        vibe,
        vibeUpdatedAt: new Date()
    });

    return sendResponse(res, true, 200, profile, "Vibe updated! 💫");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * GET VIBE MATCHES
 * returns other users with same vibe
 */
export const getVibeMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await UserProfile.findOne({ where: { userId } });

    if (!profile?.vibe) {
        return sendResponse(res, true, 200, { count: 0, matches: [] }, "Set your vibe first 💖");
    }

    // Find others with same vibe, limited to today (last 24h) or generic
    const matches = await Auth.findAll({
        attributes: ['id', 'name'],
        where: { id: { [Op.ne]: userId } },
        include: [{
            model: UserProfile,
            as: 'profile',
            where: { 
                vibe: profile.vibe,
                // vibeUpdatedAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Optionally restrict to today
            },
            attributes: ['photo', 'city']
        }],
        limit: 10
    });

    // Check premium (mock or logic from subscription model)
    const sub = await db.Subscription.findOne({ where: { userId, status: 'active' } });
    const isPremium = !!sub;

    const formattedMatches = matches.map(m => ({
        id: m.id,
        name: m.name,
        photo: m.profile?.photo ? m.profile.photo.replace(/\\/g, '/') : null,
        city: m.profile?.city || "Nearby",
        isMatch: true
    }));

    return sendResponse(res, true, 200, {
        count: formattedMatches.length,
        vibe: profile.vibe,
        matches: formattedMatches,
        isPremium
    }, "Matches synced! 🌌");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
