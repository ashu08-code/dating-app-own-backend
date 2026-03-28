import crypto from 'crypto';

export default (sequelize, DataTypes) => {
  const Auth = sequelize.define(
    "Auth",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },

      contact: {
        type: DataTypes.STRING(15),
        allowNull: true,
      },

      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      role: {
        type: DataTypes.ENUM("user", "admin"),
        defaultValue: "user",
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      otp: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },

      otpExpire: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastSeen: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
    }
  );

  Auth.prototype.generateOtp = function () {
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set to otp field
    this.otp = otp;

    // Set expire
    this.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    return otp;
  };

  return Auth;
};
