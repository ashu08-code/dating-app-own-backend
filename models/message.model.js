export default (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isDelivered: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      type: {
        type: DataTypes.ENUM("text", "image", "file"),
        defaultValue: "text",
      },
      isDeletedBySender: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isDeletedByReceiver: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isEdited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isPinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isForwarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isDeletedForEveryone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      replyToId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "messages",
          key: "id",
        },
        onDelete: "SET NULL",
      },
    },
    {
      tableName: "messages",
      timestamps: true,
      underscored: true,
    }
  );

  return Message;
};
