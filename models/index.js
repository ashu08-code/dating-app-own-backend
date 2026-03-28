import sequelize from "../config/database.js";
import { DataTypes, Sequelize } from "sequelize";
import AuthModel from "./auth.model.js";
import UserModel from "./user.model.js";

import LikeModel from "./like.model.js";
import SubscriptionModel from "./subscription.model.js";
import PostModel from "./post.model.js";
import PostLikeModel from "./postLike.model.js";
import CommentModel from "./comment.model.js";
import BlockedUserModel from "./blockedUser.model.js";

import MessageModel from "./message.model.js";
import ArchivedChatModel from "./archivedChat.model.js";
import PinnedChatModel from "./pinnedChat.model.js";
import NotificationModel from "./notification.model.js";

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize; // Add this line
db.Auth = AuthModel(sequelize, DataTypes);
db.UserProfile = UserModel(sequelize, DataTypes);
db.Like = LikeModel(sequelize, DataTypes);
db.Subscription = SubscriptionModel(sequelize, DataTypes);
db.Post = PostModel(sequelize, DataTypes);
db.PostLike = PostLikeModel(sequelize, DataTypes);
db.Comment = CommentModel(sequelize, DataTypes);
db.BlockedUser = BlockedUserModel(sequelize, DataTypes);
db.Message = MessageModel(sequelize, DataTypes);
db.ArchivedChat = ArchivedChatModel(sequelize, DataTypes);
db.PinnedChat = PinnedChatModel(sequelize, DataTypes);
db.Notification = NotificationModel(sequelize, DataTypes);

// Associations
db.Auth.hasOne(db.UserProfile, {
  foreignKey: "userId",
  as: "profile",
});
db.UserProfile.belongsTo(db.Auth, {
  foreignKey: "userId",
  as: "user",
});

// Like Associations
db.Auth.hasMany(db.Like, { foreignKey: "senderId", as: "sentLikes" });
db.Auth.hasMany(db.Like, { foreignKey: "receiverId", as: "receivedLikes" });

db.Like.belongsTo(db.Auth, { foreignKey: "senderId", as: "sender" });
db.Like.belongsTo(db.Auth, { foreignKey: "receiverId", as: "receiver" });

// Subscription Associations
db.Auth.hasOne(db.Subscription, {
  foreignKey: "userId",
  as: "subscription",
});
db.Subscription.belongsTo(db.Auth, {
  foreignKey: "userId",
  as: "user",
});

// Post Associations
db.Auth.hasMany(db.Post, { foreignKey: "userId", as: "posts" });
db.Post.belongsTo(db.Auth, { foreignKey: "userId", as: "author" });

// Post Like Associations
db.Post.hasMany(db.PostLike, { foreignKey: "postId", as: "likes" });
db.PostLike.belongsTo(db.Post, { foreignKey: "postId", as: "post" });

db.Auth.hasMany(db.PostLike, { foreignKey: "userId", as: "postLikes" });
db.PostLike.belongsTo(db.Auth, { foreignKey: "userId", as: "user" });

// Comment Associations
db.Post.hasMany(db.Comment, { foreignKey: "postId", as: "comments" });
db.Comment.belongsTo(db.Post, { foreignKey: "postId", as: "post" });

db.Auth.hasMany(db.Comment, { foreignKey: "userId", as: "postComments" });
db.Comment.belongsTo(db.Auth, { foreignKey: "userId", as: "author" });

// Blocked User Associations
db.Auth.hasMany(db.BlockedUser, { foreignKey: "blockerId", as: "blockedUsers" });
db.BlockedUser.belongsTo(db.Auth, { foreignKey: "blockerId", as: "blocker" });

db.Auth.hasMany(db.BlockedUser, { foreignKey: "blockedId", as: "blockedBy" });
db.BlockedUser.belongsTo(db.Auth, { foreignKey: "blockedId", as: "blockedUser" });

// Message Associations
db.Auth.hasMany(db.Message, { foreignKey: "senderId", as: "sentMessages" });
db.Auth.hasMany(db.Message, { foreignKey: "receiverId", as: "receivedMessages" });
db.Message.belongsTo(db.Auth, { foreignKey: "senderId", as: "sender" });
db.Message.belongsTo(db.Auth, { foreignKey: "receiverId", as: "receiver" });

db.Message.belongsTo(db.Message, { foreignKey: "replyToId", as: "replyTo" });
db.Message.hasMany(db.Message, { foreignKey: "replyToId", as: "replies" });

// Archived Chat Associations
db.Auth.hasMany(db.ArchivedChat, { foreignKey: "userId", as: "archivedChats" });
db.ArchivedChat.belongsTo(db.Auth, { foreignKey: "userId", as: "userAccount" });
db.ArchivedChat.belongsTo(db.Auth, { foreignKey: "targetUserId", as: "targetUser" });

// Pinned Chat Associations
db.Auth.hasMany(db.PinnedChat, { foreignKey: "userId", as: "pinnedChats" });
db.PinnedChat.belongsTo(db.Auth, { foreignKey: "userId", as: "userAccount" });
db.PinnedChat.belongsTo(db.Auth, { foreignKey: "targetUserId", as: "targetUser" });

// Notification Associations
db.Auth.hasMany(db.Notification, { foreignKey: "userId", as: "notifications" });
db.Notification.belongsTo(db.Auth, { foreignKey: "userId", as: "user" });
db.Notification.belongsTo(db.Auth, { foreignKey: "senderId", as: "sender" });

export default db;

