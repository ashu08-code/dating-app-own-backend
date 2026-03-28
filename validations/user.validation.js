import Joi from "joi";

export const profileSchema = Joi.object({
  city: Joi.string().min(2).max(100).optional(),
  
  relationshipGoal: Joi.string()
    .max(500)
    .optional(),

  // Interests come as a JSON string when using FormData in Postman
  // We allow string (which we parse in controller) or array (if sent as raw JSON)
  interests: Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.array().items(Joi.string())
  ).optional(),

  // Photo is handled by multer, so we just allow it to be ignored by body validation
  // or explicitly allow existing strings if we needed to validation URLs.
  // Since stripUnknown is true in middleware, unknown fields are removed, 
  // but we should probably just rely on the controller logic for photo upload.
});
