import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      default: "for_sale",
      index: true,
    },

    propertyType: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      default: "available",
      index: true,
    },

    price: {
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: "AED",
      },
    },

    sizeSqft: {
      type: Number,
      required: true,
      min: 0,
    },

    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    bedrooms: {
      type: Number,
      min: 0,
    },

    bathrooms: {
      type: Number,
      min: 0,
    },

    amenities: {
      type: [String],
      default: [],
    },

    images: [
      {
        url: { type: String, required: true },
        isCover: { type: Boolean, default: false },
      },
    ],

    documentPdf: {
      url: { type: String, default: "" },
      fileName: { type: String, default: "" },
    },

    location: {
      type: String,
      required: true,
      default: "downtown_dubai",
    },

    phone: {
      type: String,
      required: false,
    },

    whatsAppNumber: {
      type: String,
      required: false,
    },

    contactEmail: {
      type: String,
      default: "",
      trim: true,
    },

    developerName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    developerSlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast public reads
propertySchema.index({ isActive: 1, publishedAt: 1 });
propertySchema.index({ "price.amount": 1 });
propertySchema.index({ category: 1, developerSlug: 1, isActive: 1 });

// Virtual for frontend compatibility
propertySchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
propertySchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const Property = mongoose.model("Property", propertySchema);
export default Property;
