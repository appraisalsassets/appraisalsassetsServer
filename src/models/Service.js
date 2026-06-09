import mongoose from "mongoose";

const titledItemSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const stepItemSchema = new mongoose.Schema(
  {
    step: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const coverageAreaSchema = new mongoose.Schema(
  {
    region: { type: String, default: "", trim: true },
    locations: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const pricingRowSchema = new mongoose.Schema(
  {
    label: { type: String, default: "", trim: true },
    validity: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const faqItemSchema = new mongoose.Schema(
  {
    question: { type: String, default: "", trim: true },
    answer: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      default: "",
      maxlength: 500,
    },
    overview: {
      type: String,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    icon: {
      type: String,
      default: "building2",
      trim: true,
    },
    heroImage: {
      type: String,
      default: "",
    },
    whyChooseTitle: { type: String, default: "Why Choose Us" },
    whyChooseSubtitle: { type: String, default: "" },
    whyChooseItems: { type: [titledItemSchema], default: [] },
    offeringsTitle: { type: String, default: "What We Offer" },
    offeringsSubtitle: { type: String, default: "" },
    offerings: { type: [titledItemSchema], default: [] },
    stepsTitle: { type: String, default: "How We Handle It" },
    stepsSubtitle: { type: String, default: "" },
    steps: { type: [stepItemSchema], default: [] },
    coverageTitle: { type: String, default: "Areas We Serve" },
    coverageSubtitle: { type: String, default: "" },
    coverageAreas: { type: [coverageAreaSchema], default: [] },
    pricingTitle: { type: String, default: "Cost & Timeline" },
    pricingSubtitle: { type: String, default: "" },
    pricingRows: { type: [pricingRowSchema], default: [] },
    faqTitle: { type: String, default: "Common Questions" },
    faqSubtitle: { type: String, default: "" },
    faqs: { type: [faqItemSchema], default: [] },
    ctaTitle: {
      type: String,
      default: "Get Started With Us Today",
    },
    ctaDescription: { type: String, default: "" },
    ctaButtonText: { type: String, default: "Book a Free Consultation" },
    consultationPhone: { type: String, default: "" },
    consultationEmail: { type: String, default: "" },
    displayOrder: {
      type: Number,
      default: 0,
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
  { timestamps: true },
);

serviceSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

serviceSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

export const Service = mongoose.model("Service", serviceSchema);
export default Service;
