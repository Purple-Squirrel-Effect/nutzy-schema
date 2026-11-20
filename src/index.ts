import { z } from "zod";

// ── Shared ──────────────────────────────────────────────────────

/**
 * Multi-line headline rendered as one `<span>` per array element.
 * Empty entries (`null`, `undefined`, or `""`) are intentional line breaks —
 * YAML parses a bare `-` as `null`, so we coerce all empty-ish values to `""`.
 */
const headlineLines = z
  .array(
    z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
  )
  .describe("One array element per visible line");

/** UUID pointing at a Cloudflare Images asset. Some legacy entries append `/variant` or `?query`. */
const imageRef = z.object({
  src: z.string().min(1),
  alt: z.string().optional(),
});

/**
 * Strict `YYYY-MM-DD` or full ISO-8601 timestamp (`…T…`) — zero-padded, no
 * surrounding whitespace, no locale formats. A bare `z.string()` here passes
 * ANY string (e.g. `"17-08-2026"` DD-MM-YYYY, `"05/04/2024"`, `"2025-1-1"`),
 * which then breaks downstream `timestamptz` writes: Postgres reads
 * dash-dates as MDY by default, so day-first values with day > 12 overflow
 * the month field (`date/time field value out of range`).
 */
const isoDateOrDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/,
    "must be YYYY-MM-DD or a full ISO-8601 timestamp (…T…) — zero-padded, no locale format, no stray whitespace",
  )
  .refine((v) => {
    // Date.parse rolls over out-of-range values (e.g. "2026-02-30" -> Mar 2)
    // instead of rejecting them, so check the calendar fields by hand. The
    // regex check above may not have matched yet (zod runs all checks
    // regardless of earlier failures), so tolerate no match here.
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return true;
    const [, y, mo, d] = m;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12) return false;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day >= 1 && day <= daysInMonth;
  }, "must be a valid calendar date");

// ── Schema.org building blocks (typed per https://schema.org) ──

const countrySchema = z
  .object({
    "@type": z.literal("Country"),
    name: z.string(),
  })
  .strict();

const stateSchema = z
  .object({
    "@type": z.literal("State"),
    name: z.string(),
  })
  .strict();

const citySchema = z
  .object({
    "@type": z.literal("City"),
    name: z.string(),
  })
  .strict();

const administrativeAreaSchema = z.union([
  countrySchema,
  stateSchema,
  citySchema,
]);

const postalAddressSchema = z
  .object({
    "@type": z.literal("PostalAddress"),
    streetAddress: z.string().optional(),
    addressLocality: z.string().optional(),
    addressRegion: z.string().optional(),
    postalCode: z.string().optional(),
    postOfficeBoxNumber: z.string().optional(),
    addressCountry: z.union([z.string(), countrySchema]).optional(),
  })
  .strict();

const placeSchema = z
  .object({
    "@type": z.literal("Place"),
    address: postalAddressSchema,
  })
  .strict();

const imageObjectSchema = z
  .object({
    "@type": z.literal("ImageObject"),
    url: z.string(),
    width: z.union([z.number(), z.string()]).optional(),
    height: z.union([z.number(), z.string()]).optional(),
    caption: z.string().optional(),
  })
  .strict();

const contactPointSchema = z
  .object({
    "@type": z.literal("ContactPoint"),
    contactType: z.string().optional(),
    telephone: z.string().optional(),
    email: z.string().optional(),
    url: z.string().optional(),
  })
  .strict();

const identifierSchema = z
  .object({
    "@type": z.literal("PropertyValue"),
    name: z.string(),
    value: z.string(),
  })
  .strict();

const quantitativeValueSchema = z
  .object({
    "@type": z.literal("QuantitativeValue"),
    value: z.number().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    unitText: z.enum(["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]).optional(),
  })
  .strict();

const aggregateRatingSchema = z
  .object({
    "@type": z.literal("AggregateRating"),
    ratingValue: z.union([z.number(), z.string()]),
    ratingCount: z.number().optional(),
    reviewCount: z.number().optional(),
    bestRating: z.union([z.number(), z.string()]).optional(),
    worstRating: z.union([z.number(), z.string()]).optional(),
  })
  .strict();

const organizationSchema = z
  .object({
    "@context": z.literal("https://schema.org/").optional(),
    "@type": z.literal("Organization"),
    name: z.string(),
    url: z.string().optional(),
    logo: z.union([z.string(), imageObjectSchema]).optional(),
    description: z.string().optional(),
    address: z.union([z.string(), postalAddressSchema]).optional(),
    contactPoint: contactPointSchema.optional(),
    email: z.string().optional(),
    telephone: z.string().optional(),
    numberOfEmployees: z
      .union([quantitativeValueSchema, z.number()])
      .optional(),
    aggregateRating: aggregateRatingSchema.optional(),
    sameAs: z.union([z.string(), z.array(z.string())]).optional(),
    identifier: z.union([identifierSchema, z.string()]).optional(),
    foundingDate: z.string().optional(),
    /**
     * Precomputed backing the logo should render against, derived once
     * (offline) from the logo image's luminance: "light" = light backing for
     * dark logos, "dark" = dark backing for light logos. Lets the UI skip
     * per-view canvas luminance analysis.
     */
    logoBackground: z.enum(["dark", "light"]).optional(),
  })
  .strict();

const personSchema = z
  .object({
    "@type": z.literal("Person"),
    name: z.string(),
    url: z.string().optional(),
    image: z.union([z.string(), imageObjectSchema]).optional(),
  })
  .strict();

const monetaryAmountSchema = z
  .object({
    "@type": z.literal("MonetaryAmount"),
    currency: z.string(),
    value: z.union([quantitativeValueSchema, z.number()]),
    validFrom: z.string().optional(),
    validThrough: z.string().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
  })
  .strict();

const monetaryAmountDistributionSchema = z
  .object({
    "@type": z.literal("MonetaryAmountDistribution"),
    currency: z.string(),
    duration: z.string().optional(),
    median: z.number().optional(),
    percentile10: z.number().optional(),
    percentile25: z.number().optional(),
    percentile75: z.number().optional(),
    percentile90: z.number().optional(),
  })
  .strict();

const priceSpecificationSchema = z
  .object({
    "@type": z.literal("PriceSpecification"),
    price: z.number().optional(),
    priceCurrency: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    validFrom: z.string().optional(),
    validThrough: z.string().optional(),
  })
  .strict();

const definedTermSchema = z
  .object({
    "@type": z.literal("DefinedTerm"),
    name: z.string(),
    termCode: z.string().optional(),
    inDefinedTermSet: z.string().optional(),
  })
  .strict();

const categoryCodeSchema = z
  .object({
    "@type": z.literal("CategoryCode"),
    codeValue: z.string(),
    name: z.string(),
    inCodeSet: z.string().optional(),
  })
  .strict();

const educationalOccupationalCredentialSchema = z
  .object({
    "@type": z.literal("EducationalOccupationalCredential"),
    credentialCategory: z.union([z.string(), definedTermSchema]),
  })
  .strict();

const occupationalExperienceRequirementsSchema = z
  .object({
    "@type": z.literal("OccupationalExperienceRequirements"),
    monthsOfExperience: z.number(),
  })
  .strict();

const occupationSchema = z
  .object({
    "@type": z.literal("Occupation"),
    name: z.string(),
    occupationalCategory: z.union([categoryCodeSchema, z.string()]).optional(),
  })
  .strict();

const durationSchema = z.string().describe('ISO 8601 duration, e.g. "P1Y2M"');

const employmentTypeEnum = z.enum([
  "FULL_TIME",
  "PART_TIME",
  "CONTRACTOR",
  "TEMPORARY",
  "INTERN",
  "VOLUNTEER",
  "PER_DIEM",
  "OTHER",
]);

/** Text fields that schema.org/JSON-LD permit as array-of-values. */
const stringOrStringArray = z.union([z.string(), z.array(z.string())]);

// ── job-post (exact schema.org JobPosting) ────────────────

export const jobPostSchema = z
  .object({
    // JSON-LD envelope
    "@context": z.literal("https://schema.org/"),
    "@type": z.literal("JobPosting"), // Required per Google

    title: z.string(),
    description: z
      .string()
      .describe("Long-form role description (HTML/markdown)"),
    datePosted: isoDateOrDateTime.describe(
      "Strict ISO 8601 date (YYYY-MM-DD) or datetime",
    ),
    hiringOrganization: z.union([organizationSchema, personSchema]),
    // Required per Google unless jobLocationType is TELECOMMUTE (enforced below)
    jobLocation: z.union([placeSchema, z.array(placeSchema)]).optional(),

    jobLocationType: z.literal("TELECOMMUTE").optional(),
    // Required per Google in place of jobLocation when jobLocationType is TELECOMMUTE (enforced below)
    applicantLocationRequirements: z
      .union([administrativeAreaSchema, z.array(administrativeAreaSchema)])
      .optional(), // Salary

    baseSalary: z
      .union([monetaryAmountSchema, priceSpecificationSchema, z.number()])
      .optional(),
    salaryCurrency: z.string().optional(),
    estimatedSalary: z
      .union([
        monetaryAmountSchema,
        monetaryAmountDistributionSchema,
        z.number(),
      ])
      .optional(), // Employment terms

    employmentType: z
      .union([employmentTypeEnum, z.array(employmentTypeEnum)])
      .optional(),
    employmentUnit: organizationSchema.optional(),
    workHours: z.string().optional(),
    hours: z
      .object({
        value: z.number().optional(),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
      })
      .strict()
      .optional(),
    jobImmediateStart: z.boolean().optional(),
    jobStartDate: z.string().optional(),
    jobDuration: z.union([durationSchema, quantitativeValueSchema]).optional(),
    totalJobOpenings: z.number().int().optional(),
    validThrough: z.string().optional(), // Identity / apply

    identifier: z.union([identifierSchema, z.string()]).optional(),
    directApply: z.boolean().optional(),
    applicationContact: contactPointSchema.optional(),
    url: z.string().optional(), // Education / qualifications / experience

    educationRequirements: z
      .union([educationalOccupationalCredentialSchema, stringOrStringArray])
      .optional(),
    experienceRequirements: z
      .union([occupationalExperienceRequirementsSchema, stringOrStringArray])
      .optional(),
    experienceInPlaceOfEducation: z.boolean().optional(),
    qualifications: z
      .union([educationalOccupationalCredentialSchema, stringOrStringArray])
      .optional(),
    skills: z.union([definedTermSchema, stringOrStringArray]).optional(), // Responsibilities / benefits / commitments

    responsibilities: stringOrStringArray.optional(),
    jobBenefits: stringOrStringArray.optional(),
    benefits: stringOrStringArray.optional(),
    incentiveCompensation: stringOrStringArray.optional(),
    employerOverview: stringOrStringArray.optional(),
    specialCommitments: stringOrStringArray.optional(), // Category / industry

    occupationalCategory: z.union([categoryCodeSchema, z.string()]).optional(),
    industry: z.union([definedTermSchema, z.string()]).optional(),
    relevantOccupation: occupationSchema.optional(), // Role requirements

    physicalRequirement: z
      .union([definedTermSchema, stringOrStringArray])
      .optional(),
    sensoryRequirement: z
      .union([definedTermSchema, stringOrStringArray])
      .optional(),
    securityClearanceRequirement: stringOrStringArray.optional(),
    eligibilityToWorkRequirement: stringOrStringArray.optional(), // From Thing (inherited)

    name: z.string().optional(),
    image: z
      .union([
        z.string(),
        imageObjectSchema,
        z.array(z.union([z.string(), imageObjectSchema])),
      ])
      .optional(),
    sameAs: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Per Google's JobPosting requirements: jobLocation is required unless
    // the posting is fully remote (jobLocationType: TELECOMMUTE), in which
    // case applicantLocationRequirements takes its place.
    if (data.jobLocationType === "TELECOMMUTE") {
      if (!data.applicantLocationRequirements) {
        ctx.addIssue({
          code: "custom",
          path: ["applicantLocationRequirements"],
          message:
            "applicantLocationRequirements is required when jobLocationType is TELECOMMUTE (Google JobPosting requirement)",
        });
      }
      return;
    }

    if (!data.jobLocation) {
      ctx.addIssue({
        code: "custom",
        path: ["jobLocation"],
        message:
          "jobLocation is required unless jobLocationType is TELECOMMUTE (Google JobPosting requirement)",
      });
      return;
    }

    const places = Array.isArray(data.jobLocation)
      ? data.jobLocation
      : [data.jobLocation];
    places.forEach((place, i) => {
      if (!place.address.addressCountry) {
        ctx.addIssue({
          code: "custom",
          path: Array.isArray(data.jobLocation)
            ? ["jobLocation", i, "address", "addressCountry"]
            : ["jobLocation", "address", "addressCountry"],
          message:
            "addressCountry is required within jobLocation.address (Google JobPosting requirement)",
        });
      }
    });
  });

// ── Nutzy extensions (no schema.org equivalent) ──────────────────

const videoSchema = z
  .object({
    src: z.string().describe("Relative video filename, not a UUID"),
    /**
     * Short, muted teaser clip that plays as the looping background on the
     * job page (currently the mobile hero) instead of the full `src` video.
     * Relative filename prefixed with https://ebnd.nl/ at render time, like
     * `src`. Mainly for YouTube `src` videos, whose embed is heavy and can't
     * be cropped; the full `src` still opens from the play button.
     */
    loopSrc: z
      .string()
      .optional()
      .describe("Relative filename of a short muted loop, not a UUID"),
    title: headlineLines,
    subtitle: z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
    buttonText: z.string(),
  })
  .strict();

const testimonialSchema = z
  .object({
    comment: z.string(),
    name: z.string(),
    avatar: z
      .string()
      .describe("Full URL — CDN, placeholder service, or custom"),
  })
  .strict();

const applyStepSchema = z
  .object({
    icon: z.string(),
    title: z.string(),
    description: z.string(),
  })
  .strict();

const aiHighlightSchema = z
  .object({
    text: z.string(),
    chips: z.array(z.string()).default([]),
  })
  .strict();

const testimonialsSectionSchema = z
  .object({
    headline: headlineLines.optional(),
    items: z.array(testimonialSchema).default([]),
  })
  .strict();

const moodBoardSectionSchema = z
  .object({
    headline: headlineLines.optional(),
  })
  .strict();

const applyProcedureSectionSchema = z
  .object({
    headline: z.string().optional(),
    steps: z.array(applyStepSchema).default([]),
  })
  .strict();

const faqItemSchema = z
  .object({
    question: z.string().min(1),
    /**
     * Plain text. `**bold**` is supported for a short lead-in, e.g.
     * "**Nee.** Je wordt ingewerkt op de werkvloer."
     */
    answer: z.string().min(1),
    /** Material Symbols name (or an emoji). Omitted = generic help icon. */
    icon: z.string().optional(),
  })
  .strict();

const contactPersonSchema = z
  .object({
    name: z.string().optional(),
    role: z.string().optional(),
    description: z.string().optional(),
    message: z.string().optional(),
    whatsapp: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    avatar: z.string().optional(),
  })
  .strict();

const geolocSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
  })
  .strict();

const brandColorsSchema = z
  .object({
    primary: z.string(),
    secondary: z.string(),
  })
  .strict();

// ── Composed job schema ──────────────────────────────────────────

export const jobSchema = z
  .object({
    "job-post": jobPostSchema,

    /**
     * External destination the "Solliciteer" button points to.
     * Distinct from `job-post.url` (the canonical posting page per
     * schema.org) because the two may differ and conversion tracking
     * must target the real apply destination.
     */
    applyUrl: z.string().url().optional(),

    /**
     * Original source URL the posting was imported/scraped from, before
     * any normalization. Distinct from `applyUrl` (the apply destination)
     * and `job-post.url` (the canonical posting page).
     */
    originJobUrl: z.string().url().optional(),

    images: z.array(imageRef).default([]),
    video: videoSchema.optional(),

    /**
     * Relative filename of a short video played in place of the
     * check-circle success state after a candidate submits the apply
     * form. Prefixed with https://ebnd.nl/ at render time, matching
     * the video.src convention.
     */
    afterApplyVideoUrl: z.string().optional(),

    /**
     * Optional caption rendered under the after-apply video (e.g. the
     * team member shown in the clip). Purely decorative.
     */
    afterApplyVideoTitle: z.string().optional(),

    testimonials: testimonialsSectionSchema.optional(),
    moodBoard: moodBoardSectionSchema.optional(),
    applyProcedure: applyProcedureSectionSchema.optional(),
    aiHighlight: aiHighlightSchema.optional(),
    /**
     * One short free-text line about what makes this vacancy stand out
     * (e.g. "40% nachttoeslag"). Rendered as the leading chip in the job
     * page hero. Omitted/empty = no chip.
     */
    highlight: z.string().optional(),
    contactPerson: contactPersonSchema.optional(),

    /**
     * Opt-in flag for the "Stel een vraag" CTA on the job page, which
     * opens the vacancy's FAQ (see `faq`). Omitted/false hides the button.
     */
    enableQuestionCta: z.boolean().optional(),

    /**
     * Frequently asked questions shown on the page behind the "Stel een
     * vraag" CTA. Omitted/empty = the app falls back to a generic set of
     * questions that fits any vacancy.
     */
    faq: z.array(faqItemSchema).optional(),

    vacationDays: z.number().optional(),
    promises: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    colors: brandColorsSchema.optional(),
    _geoloc: geolocSchema.optional(),
    company_uuid: z.string().optional(),
    live: z.boolean().optional(),
  })
  .strict();

export type JobFrontmatter = z.infer<typeof jobSchema>;

// ── Company ─────────────────────────────────────────────────────

const companyVideoSchema = z.object({
  thumbnail: z.string(),
  title: z.string(),
  presenter: z.string(),
});

const companyPerkSchema = z.object({
  icon: z.string(),
  text: z.string(),
  color: z.string(),
});

const companyTeamMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
});

const companyColorsSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  primaryLight: z.string().optional(),
  tertiary: z.string().optional(),
  surface: z.string().optional(),
});

export const companySchema = z
  .object({
    organization: organizationSchema,

    // Nutzy extensions (no schema.org equivalent)
    slug: z.string(),
    banner: z.string().optional(),
    heroBackgroundImage: z.string().optional(),
    mission: z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
    videos: z.array(companyVideoSchema).default([]),
    perks: z.array(companyPerkSchema).default([]),
    team: z.array(companyTeamMemberSchema).default([]),
    live: z.boolean().optional(),
    /**
     * Manually-curated trust signal: shows a "Populaire werkgever" chip on
     * this company's job pages. Omitted/false = no chip.
     */
    isPopularEmployer: z.boolean().optional(),
    colors: companyColorsSchema.optional(),
  })
  .strict();

export type CompanyFrontmatter = z.infer<typeof companySchema>;
