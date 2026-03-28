export default (sequelize, DataTypes) => {
  const UserProfile = sequelize.define(
    "UserProfile",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users", // Points to the 'users' table created by Auth model
          key: "id",
        },
        onDelete: "CASCADE",
      },
      photo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      interests: {
        type: DataTypes.JSON, // Stores array of strings like ["Music", "Travel"]
        allowNull: true,
        defaultValue: [],
      },
      relationshipGoal: {
        type: DataTypes.STRING, // "Long-term relationship", "Short-term relationship", etc.
        allowNull: true,
      },
      filterCity: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isProfileVisible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      vibe: {
        type: DataTypes.STRING, // stores strings like "Midnight Drive", "Quiet Beach"
        allowNull: true,
      },
      vibeUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "user_profiles",
      timestamps: true,
      underscored: true,
    }
  );

  return UserProfile;
};
