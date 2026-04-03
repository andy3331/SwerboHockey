const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { createSeedStore } = require("../data/seedData");

const storePath = path.join(__dirname, "..", "..", "data", "store.json");

function ensureStore() {
  const directoryPath = path.dirname(storePath);

  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(createSeedStore(), null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function updateStore(mutator) {
  const store = readStore();
  const result = mutator(store);
  writeStore(store);
  return result;
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

function chooseIncomingValue(nextValue, currentValue = "") {
  if (typeof nextValue === "string") {
    return nextValue.trim() ? nextValue : currentValue;
  }

  if (typeof nextValue === "number") {
    return nextValue;
  }

  return nextValue ? nextValue : currentValue;
}

function parseInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "yes";
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureUniqueClinicSlug(store, title, clinicId = "") {
  const baseSlug = slugify(title) || `clinic-${randomUUID().slice(0, 8)}`;
  let candidate = baseSlug;
  let counter = 2;

  while (store.clinics.some((clinic) => clinic.slug === candidate && clinic.id !== clinicId)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function buildAvailabilityNotes(input) {
  const segments = [];

  if (input.availability_notes) {
    segments.push(input.availability_notes.trim());
  }

  if (input.notes) {
    segments.push(`Additional notes: ${input.notes.trim()}`);
  }

  return segments.join("\n\n");
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(`${dateString}T12:00:00`));
}

function formatPrice(clinic) {
  if (typeof clinic.price_amount === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(clinic.price_amount);
  }

  return "Contact for pricing";
}

function getClinicStatus(clinic) {
  const spotsRemaining = Math.max(clinic.max_enrollment - clinic.enrolled_count, 0);

  if (clinic.clinic_status === "canceled") {
    return {
      label: "Canceled",
      className: "badge-full",
      actionLabel: "View Details",
      bookingMode: "closed"
    };
  }

  if (clinic.clinic_status === "tentative") {
    return {
      label: "Tentative",
      className: "badge-tentative",
      actionLabel: "Reserve Interest",
      bookingMode: "interest"
    };
  }

  if (clinic.clinic_status === "full" || spotsRemaining === 0) {
    return {
      label: "Full",
      className: "badge-full",
      actionLabel: "Join Waitlist",
      bookingMode: "waitlist"
    };
  }

  if (spotsRemaining <= 3) {
    return {
      label: "Few Spots Left",
      className: "badge-few",
      actionLabel: "Book Now",
      bookingMode: "book"
    };
  }

  return {
    label: "Open",
    className: "badge-open",
    actionLabel: "Book Now",
    bookingMode: "book"
  };
}

function hydrateClinic(store, clinic) {
  const coach = store.coaches.find((entry) => entry.id === clinic.coach_id);
  const location = store.locations.find((entry) => entry.id === clinic.location_id);
  const status = getClinicStatus(clinic);

  return {
    ...clinic,
    coach,
    location,
    status,
    dateLabel: formatDate(clinic.date),
    priceLabel: formatPrice(clinic),
    spotsRemaining: Math.max(clinic.max_enrollment - clinic.enrolled_count, 0),
    fillPercent: Math.round((clinic.enrolled_count / clinic.max_enrollment) * 100),
    needsMinimumNotice: clinic.enrolled_count < clinic.minimum_enrollment,
    sessionFocus: clinic.marketing_notes || clinic.description
  };
}

function getVisibleClinics() {
  const store = readStore();

  return store.clinics
    .filter((clinic) => clinic.is_visible && !["canceled", "completed"].includes(clinic.clinic_status))
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((clinic) => hydrateClinic(store, clinic));
}

function getClinicBySlug(slug) {
  const store = readStore();
  const clinic = store.clinics.find((entry) => entry.slug === slug && entry.is_visible);

  if (!clinic) {
    return null;
  }

  return hydrateClinic(store, clinic);
}

function getClinicById(store, clinicId) {
  return store.clinics.find((clinic) => clinic.id === clinicId);
}

function isActiveBooking(booking) {
  return ["initiated", "pending_payment", "paid", "reserved", "completed"].includes(booking.booking_status);
}

function isActiveWaitlistEntry(entry) {
  return ["active", "invited"].includes(entry.waitlist_status);
}

function isOpenInquiry(inquiry) {
  return ["new", "reviewed", "contacted", "scheduled"].includes(inquiry.inquiry_status);
}

function findExistingLead(store, email, phone) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  return store.leads.find((lead) => {
    if (normalizedEmail && normalizeEmail(lead.parent_email) === normalizedEmail) {
      return true;
    }

    return normalizedPhone && normalizePhone(lead.parent_phone) === normalizedPhone;
  });
}

function getLeadById(store, leadId) {
  return store.leads.find((lead) => lead.id === leadId);
}

function getLeadFullName(lead) {
  return `${lead?.parent_first_name || ""} ${lead?.parent_last_name || ""}`.trim() || "Unknown lead";
}

function getPlayerFullName(lead) {
  return `${lead?.player_first_name || ""} ${lead?.player_last_name || ""}`.trim() || "Player not set";
}

function getLeadSourceLabel(lead) {
  const source = String(lead?.source || "").trim();

  if (source === "clinic_booking") {
    return "Website booking";
  }

  if (source === "clinic_waitlist") {
    return "Website waitlist";
  }

  if (source === "private_lesson") {
    return "Private lesson request";
  }

  if (source === "general_interest") {
    return "Express interest";
  }

  if (source === "admin_manual") {
    return "Manual admin add";
  }

  return lead?.source_detail || source || "Unknown source";
}

function buildLeadClinicAssignments(store, leadId) {
  const bookingAssignments = store.bookings
    .filter((booking) => booking.lead_id === leadId && isActiveBooking(booking))
    .map((booking) => {
      const clinic = getClinicById(store, booking.clinic_id);

      return {
        type: "booking",
        clinicId: booking.clinic_id,
        clinicTitle: clinic ? clinic.title : "Unknown clinic"
      };
    });

  const waitlistAssignments = store.waitlistEntries
    .filter((entry) => entry.lead_id === leadId && isActiveWaitlistEntry(entry))
    .map((entry) => {
      const clinic = getClinicById(store, entry.clinic_id);

      return {
        type: "waitlist",
        clinicId: entry.clinic_id,
        clinicTitle: clinic ? clinic.title : "Unknown clinic"
      };
    });

  return [...bookingAssignments, ...waitlistAssignments].sort((left, right) =>
    left.clinicTitle.localeCompare(right.clinicTitle)
  );
}

function buildRosterEntry(store, assignment, assignmentType) {
  const lead = getLeadById(store, assignment.lead_id);

  return {
    id: assignment.id,
    leadId: assignment.lead_id,
    parentName: getLeadFullName(lead),
    playerName: getPlayerFullName(lead),
    playerAge: lead?.player_age || "",
    skillLevel: lead?.player_skill_level || "",
    sourceLabel: getLeadSourceLabel(lead),
    sourceDetail: lead?.source_detail || "",
    leadStatus: lead?.lead_status || "",
    assignmentType,
    assignmentStatus: assignmentType === "booking" ? assignment.booking_status : assignment.waitlist_status,
    createdAt: assignment.created_at,
    confirmationCode: assignment.confirmation_code || "",
    priorityOrder: assignment.priority_order || ""
  };
}

function formatAdminDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function getAdminClinicSummaryStatus(clinic) {
  const spotsRemaining = Math.max((clinic.max_enrollment || 0) - (clinic.enrolled_count || 0), 0);

  if (clinic.clinic_status === "canceled") {
    return {
      label: "Canceled",
      tone: "urgent"
    };
  }

  if (clinic.clinic_status === "full" || spotsRemaining === 0) {
    return {
      label: "Full",
      tone: "urgent"
    };
  }

  if ((clinic.enrolled_count || 0) < (clinic.minimum_enrollment || 0)) {
    return {
      label: "Below Minimum",
      tone: "pending"
    };
  }

  if (spotsRemaining <= 3) {
    return {
      label: "Nearly Full",
      tone: "pending"
    };
  }

  return {
    label: "Open",
    tone: "completed"
  };
}

function getLeadFollowUpTone(leadStatus) {
  if (leadStatus === "new") {
    return "urgent";
  }

  if (["awaiting_response", "private_inquiry", "waitlisted"].includes(leadStatus)) {
    return "pending";
  }

  if (["booked_clinic", "scheduled_private", "converted"].includes(leadStatus)) {
    return "completed";
  }

  return "neutral";
}

function buildBookingSummary(store, booking) {
  const clinic = getClinicById(store, booking.clinic_id);
  const lead = getLeadById(store, booking.lead_id);

  return {
    ...booking,
    clinicTitle: clinic ? clinic.title : "Unknown clinic",
    clinicDateLabel: clinic ? formatDate(clinic.date) : "Unknown date",
    parentName: getLeadFullName(lead),
    playerName: getPlayerFullName(lead),
    parentEmail: lead?.parent_email || "Not provided",
    parentPhone: lead?.parent_phone || "Not provided",
    sourceLabel: getLeadSourceLabel(lead),
    createdDateLabel: formatAdminDate(booking.created_at),
    statusTone: booking.booking_status === "reserved" ? "completed" : booking.booking_status === "canceled" ? "urgent" : "pending",
    paymentTone: booking.payment_status === "paid" ? "completed" : booking.payment_status === "pending" ? "pending" : "neutral"
  };
}

function buildWaitlistSummary(store, entry) {
  const clinic = getClinicById(store, entry.clinic_id);
  const lead = getLeadById(store, entry.lead_id);
  const spotsRemaining = clinic ? Math.max((clinic.max_enrollment || 0) - (clinic.enrolled_count || 0), 0) : 0;

  return {
    ...entry,
    clinicTitle: clinic ? clinic.title : "Unknown clinic",
    clinicDateLabel: clinic ? formatDate(clinic.date) : "Unknown date",
    parentName: getLeadFullName(lead),
    playerName: getPlayerFullName(lead),
    parentEmail: lead?.parent_email || "Not provided",
    parentPhone: lead?.parent_phone || "Not provided",
    sourceLabel: getLeadSourceLabel(lead),
    createdDateLabel: formatAdminDate(entry.created_at),
    spotsRemaining,
    canPromote: spotsRemaining > 0 && clinic && ["open", "confirmed"].includes(clinic.clinic_status),
    statusTone: entry.waitlist_status === "active" ? "pending" : entry.waitlist_status === "converted" ? "completed" : "neutral"
  };
}

function buildPrivateInquirySummary(store, inquiry) {
  const lead = getLeadById(store, inquiry.lead_id);
  const needsResponse = ["new", "reviewed"].includes(inquiry.inquiry_status);

  return {
    ...inquiry,
    parentName: getLeadFullName(lead),
    playerName: getPlayerFullName(lead),
    playerAge: lead?.player_age || "",
    availability: [inquiry.preferred_days, inquiry.preferred_times].filter(Boolean).join(" | ") || "Not provided",
    goals: lead?.goals || "Not provided",
    parentEmail: lead?.parent_email || "Not provided",
    parentPhone: lead?.parent_phone || "Not provided",
    createdDateLabel: formatAdminDate(inquiry.created_at),
    dueDateLabel: formatAdminDate(inquiry.response_due_at),
    needsResponse,
    tone: needsResponse ? "urgent" : inquiry.inquiry_status === "scheduled" ? "completed" : "pending"
  };
}

function deriveLeadStatus(store, lead) {
  const hasActiveBooking = store.bookings.some(
    (booking) => booking.lead_id === lead.id && isActiveBooking(booking)
  );

  if (hasActiveBooking) {
    return "booked_clinic";
  }

  const hasActiveWaitlist = store.waitlistEntries.some(
    (entry) => entry.lead_id === lead.id && isActiveWaitlistEntry(entry)
  );

  if (hasActiveWaitlist) {
    return "waitlisted";
  }

  const hasOpenPrivateInquiry = store.privateInquiries.some(
    (inquiry) => inquiry.lead_id === lead.id && isOpenInquiry(inquiry)
  );

  if (hasOpenPrivateInquiry) {
    return "private_inquiry";
  }

  return "new";
}

function upsertLead(store, input) {
  const timestamp = new Date().toISOString();
  const existingLead = findExistingLead(store, input.parent_email, input.parent_phone);

  if (existingLead) {
    existingLead.updated_at = timestamp;
    existingLead.source = input.source;
    existingLead.source_detail = input.source_detail;
    existingLead.lead_status = input.lead_status;
    existingLead.parent_first_name = chooseIncomingValue(input.parent_first_name, existingLead.parent_first_name);
    existingLead.parent_last_name = chooseIncomingValue(input.parent_last_name, existingLead.parent_last_name);
    existingLead.parent_email = normalizeEmail(input.parent_email);
    existingLead.parent_phone = input.parent_phone;
    existingLead.preferred_contact_method = input.preferred_contact_method || "email";
    existingLead.player_first_name = chooseIncomingValue(input.player_first_name, existingLead.player_first_name);
    existingLead.player_last_name = chooseIncomingValue(input.player_last_name, existingLead.player_last_name);
    existingLead.player_age = chooseIncomingValue(input.player_age, existingLead.player_age);
    existingLead.player_birth_year = chooseIncomingValue(input.player_birth_year, existingLead.player_birth_year);
    existingLead.player_position = chooseIncomingValue(input.player_position, existingLead.player_position);
    existingLead.player_team = chooseIncomingValue(input.player_team, existingLead.player_team);
    existingLead.player_skill_level = chooseIncomingValue(input.player_skill_level, existingLead.player_skill_level);
    existingLead.goals = chooseIncomingValue(input.goals, existingLead.goals);
    existingLead.availability_notes = chooseIncomingValue(buildAvailabilityNotes(input), existingLead.availability_notes);

    return existingLead;
  }

  const lead = {
    id: randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
    source: input.source,
    source_detail: input.source_detail,
    lead_status: input.lead_status,
    parent_first_name: input.parent_first_name,
    parent_last_name: input.parent_last_name,
    parent_email: normalizeEmail(input.parent_email),
    parent_phone: input.parent_phone,
    preferred_contact_method: input.preferred_contact_method || "email",
    player_first_name: input.player_first_name || "",
    player_last_name: input.player_last_name || "",
    player_age: input.player_age,
    player_birth_year: input.player_birth_year || "",
    player_position: input.player_position || "",
    player_team: input.player_team || "",
    player_skill_level: input.player_skill_level || "",
    goals: input.goals || "",
    availability_notes: buildAvailabilityNotes(input),
    notes_internal: "",
    assigned_owner: "coach-swerbo"
  };

  store.leads.push(lead);

  return lead;
}

function addActivity(store, entityType, entityId, action, metadata = {}) {
  const activity = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    actor_type: "system",
    actor_name: "website_mvp",
    entity_type: entityType,
    entity_id: entityId,
    action,
    metadata_json: JSON.stringify(metadata)
  };

  store.activityLog.push(activity);
  console.log(`[swierbutowicz-hockey] ${action}`, metadata);
}

function findExistingBooking(store, leadId, clinicId) {
  return store.bookings.find((booking) => booking.lead_id === leadId && booking.clinic_id === clinicId && isActiveBooking(booking));
}

function findExistingWaitlistEntry(store, leadId, clinicId) {
  return store.waitlistEntries.find(
    (entry) => entry.lead_id === leadId && entry.clinic_id === clinicId && isActiveWaitlistEntry(entry)
  );
}

function findExistingPrivateInquiry(store, leadId) {
  return store.privateInquiries.find((inquiry) => inquiry.lead_id === leadId && isOpenInquiry(inquiry));
}

function updateClinicEnrollment(clinic) {
  if (["canceled", "completed"].includes(clinic.clinic_status)) {
    return;
  }

  if (clinic.enrolled_count >= clinic.max_enrollment) {
    clinic.clinic_status = "full";
    return;
  }

  if (clinic.clinic_status !== "tentative" && clinic.enrolled_count >= clinic.minimum_enrollment) {
    clinic.clinic_status = "confirmed";
    return;
  }

  if (clinic.clinic_status !== "tentative") {
    clinic.clinic_status = "open";
  }
}

function submitClinicInterestInternal(store, input, clinic, source = "general_interest") {
  const lead = upsertLead(store, {
    ...input,
    source,
    source_detail: clinic.title,
    lead_status: "new",
    interest_type: `${clinic.title} unavailable`
  });

  addActivity(store, "lead", lead.id, "clinic_unavailable_interest_captured", {
    clinic_id: clinic.id,
    clinic_status: clinic.clinic_status,
    source
  });

  return {
    outcome: "general_interest",
    clinicSlug: clinic.slug,
    interestType: clinic.title
  };
}

function submitWaitlistInternal(store, input, clinic, source) {
  const lead = upsertLead(store, {
    ...input,
    source: source === "booking_fallback" ? "clinic_waitlist" : source,
    source_detail: clinic.title,
    lead_status: "waitlisted"
  });

  const existingWaitlistEntry = findExistingWaitlistEntry(store, lead.id, clinic.id);

  if (existingWaitlistEntry) {
    addActivity(store, "waitlist", existingWaitlistEntry.id, "waitlist_duplicate_prevented", {
      clinic_id: clinic.id,
      lead_id: lead.id,
      source
    });

    return {
      outcome: "waitlist",
      clinicSlug: clinic.slug,
      clinicTitle: clinic.title,
      duplicate: true
    };
  }

  const waitlistEntry = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lead_id: lead.id,
    clinic_id: clinic.id,
    waitlist_status: "active",
    priority_order: clinic.waitlist_count + 1,
    notified_at: "",
    response_deadline_at: "",
    converted_booking_id: ""
  };

  store.waitlistEntries.push(waitlistEntry);
  clinic.waitlist_count += 1;
  clinic.clinic_status = "full";

  addActivity(store, "waitlist", waitlistEntry.id, "waitlist_joined", {
    clinic_id: clinic.id,
    lead_id: lead.id,
    source
  });

  return {
    outcome: "waitlist",
    clinicSlug: clinic.slug,
    clinicTitle: clinic.title
  };
}

function submitBooking(input) {
  return updateStore((store) => {
    const clinic = getClinicById(store, input.clinic_id);

    if (!clinic) {
      throw new Error("Clinic not found.");
    }

    if (!clinic.is_visible || ["canceled", "completed", "tentative"].includes(clinic.clinic_status)) {
      return submitClinicInterestInternal(store, input, clinic, "clinic_unavailable_interest");
    }

    // Protect the zero-lead-loss rule if another family fills the last spot first.
    if (clinic.clinic_status === "full" || clinic.enrolled_count >= clinic.max_enrollment) {
      return submitWaitlistInternal(store, input, clinic, "booking_fallback");
    }

    const lead = upsertLead(store, {
      ...input,
      source: "clinic_booking",
      source_detail: clinic.title,
      lead_status: "booked_clinic"
    });

    const existingBooking = findExistingBooking(store, lead.id, clinic.id);

    if (existingBooking) {
      addActivity(store, "booking", existingBooking.id, "booking_duplicate_prevented", {
        clinic_id: clinic.id,
        lead_id: lead.id
      });

      return {
        outcome: "booking",
        clinicSlug: clinic.slug,
        clinicTitle: clinic.title,
        confirmationCode: existingBooking.confirmation_code,
        duplicate: true
      };
    }

    const booking = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lead_id: lead.id,
      clinic_id: clinic.id,
      booking_status: "reserved",
      payment_status: "pending",
      payment_method: "",
      amount_due: clinic.price_amount || 0,
      amount_paid: 0,
      stripe_payment_intent_id: "",
      confirmation_code: `SWHD-${Math.floor(100000 + Math.random() * 900000)}`,
      canceled_at: "",
      cancellation_reason: "",
      refund_status: "",
      check_in_status: "not_checked_in"
    };

    store.bookings.push(booking);
    clinic.enrolled_count += 1;
    updateClinicEnrollment(clinic);

    addActivity(store, "booking", booking.id, "booking_created", {
      clinic_id: clinic.id,
      lead_id: lead.id
    });

    return {
      outcome: "booking",
      clinicSlug: clinic.slug,
      clinicTitle: clinic.title,
      confirmationCode: booking.confirmation_code
    };
  });
}

function submitWaitlist(input) {
  return updateStore((store) => {
    const clinic = getClinicById(store, input.clinic_id);

    if (!clinic) {
      throw new Error("Clinic not found.");
    }

    if (!clinic.is_visible || ["canceled", "completed"].includes(clinic.clinic_status)) {
      return submitClinicInterestInternal(store, input, clinic, "clinic_unavailable_interest");
    }

    return submitWaitlistInternal(store, input, clinic, "clinic_waitlist");
  });
}

function submitPrivateInquiry(input) {
  return updateStore((store) => {
    const lead = upsertLead(store, {
      ...input,
      source: "private_lesson",
      source_detail: "private_lesson_request",
      lead_status: "private_inquiry"
    });

    const existingInquiry = findExistingPrivateInquiry(store, lead.id);

    if (existingInquiry) {
      addActivity(store, "private_inquiry", existingInquiry.id, "private_inquiry_duplicate_prevented", {
        lead_id: lead.id
      });

      return {
        outcome: "private_inquiry",
        duplicate: true
      };
    }

    const inquiry = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lead_id: lead.id,
      inquiry_status: "new",
      preferred_days: input.preferred_days || "",
      preferred_times: input.preferred_times || "",
      rink_preference: "South Windsor area",
      willing_group_with_others: input.willing_group_with_others || "no_preference",
      budget_range: "",
      requested_duration: "",
      requested_format: "private_lesson",
      response_owner: "coach-swerbo",
      response_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      scheduled_session_id: ""
    };

    store.privateInquiries.push(inquiry);

    addActivity(store, "private_inquiry", inquiry.id, "private_inquiry_created", {
      lead_id: lead.id
    });

    return {
      outcome: "private_inquiry"
    };
  });
}

function submitGeneralInterest(input) {
  return updateStore((store) => {
    const lead = upsertLead(store, {
      ...input,
      source: input.source || "general_interest",
      source_detail: input.source_detail || input.interest_type || "general_interest",
      lead_status: "new"
    });

    addActivity(store, "lead", lead.id, "general_interest_submitted", {
      interest_type: input.interest_type || "general_interest",
      notes: input.notes || ""
    });

    return {
      outcome: "general_interest"
    };
  });
}

function getHomeStats() {
  const clinics = getVisibleClinics();
  const openClinics = clinics.filter((clinic) => clinic.status.bookingMode === "book").length;
  const waitlistClinics = clinics.filter((clinic) => clinic.status.bookingMode === "waitlist").length;

  return {
    openClinics,
    waitlistClinics,
    upcomingCount: clinics.length
  };
}

function getAdminOverview() {
  const store = readStore();
  const hydratedClinics = store.clinics
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((clinic) => hydrateClinic(store, clinic))
    .map((clinic) => {
      const activeBookings = store.bookings.filter(
        (booking) => booking.clinic_id === clinic.id && isActiveBooking(booking)
      );
      const activeWaitlist = store.waitlistEntries.filter(
        (entry) => entry.clinic_id === clinic.id && isActiveWaitlistEntry(entry)
      );

      return {
        ...clinic,
        adminSummaryStatus: getAdminClinicSummaryStatus(clinic),
        activeBookingCount: activeBookings.length,
        activeWaitlistCount: activeWaitlist.length,
        bookingRoster: activeBookings
          .map((booking) => buildRosterEntry(store, booking, "booking"))
          .sort((left, right) => left.parentName.localeCompare(right.parentName)),
        waitlistRoster: activeWaitlist
          .map((entry) => buildRosterEntry(store, entry, "waitlist"))
          .sort((left, right) => (left.priorityOrder || 999) - (right.priorityOrder || 999))
      };
    });

  const recentLeads = [...store.leads]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 10);

  const allLeads = [...store.leads]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((lead) => {
      const activeAssignments = buildLeadClinicAssignments(store, lead.id);

      return {
        ...lead,
        sourceLabel: getLeadSourceLabel(lead),
        createdDateLabel: formatAdminDate(lead.created_at),
        followUpTone: getLeadFollowUpTone(lead.lead_status),
        isNewLead: lead.lead_status === "new",
        needsFollowUp: ["new", "awaiting_response", "private_inquiry"].includes(lead.lead_status),
        activeAssignments,
        activeAssignmentSummary: activeAssignments.length
          ? activeAssignments.map((assignment) => `${assignment.clinicTitle} (${assignment.type})`).join(", ")
          : "No session linked yet"
      };
    });

  const allBookings = [...store.bookings]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((booking) => buildBookingSummary(store, booking));

  const recentBookings = allBookings
    .slice(0, 10);

  const allWaitlistEntries = [...store.waitlistEntries]
    .filter((entry) => isActiveWaitlistEntry(entry))
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((entry) => buildWaitlistSummary(store, entry));

  const recentWaitlistEntries = allWaitlistEntries.slice(0, 10);

  const allPrivateInquiries = [...store.privateInquiries]
    .sort((left, right) => left.response_due_at.localeCompare(right.response_due_at))
    .map((inquiry) => buildPrivateInquirySummary(store, inquiry));

  const privateInquiriesNeedingResponse = allPrivateInquiries.filter((inquiry) => inquiry.needsResponse).length;

  return {
    totals: {
      clinics: hydratedClinics.length,
      leads: store.leads.length,
      activeBookings: store.bookings.filter((booking) => isActiveBooking(booking)).length,
      bookings: store.bookings.length,
      waitlistEntries: store.waitlistEntries.length,
      privateInquiries: store.privateInquiries.length,
      privateInquiriesNeedingResponse
    },
    coaches: [...store.coaches].filter((coach) => coach.is_active),
    locations: [...store.locations],
    clinics: hydratedClinics,
    allLeads,
    recentLeads,
    allBookings,
    recentBookings,
    allWaitlistEntries,
    recentWaitlistEntries,
    allPrivateInquiries
  };
}

function updateAdminClinic(clinicId, input) {
  return updateStore((store) => {
    const clinic = store.clinics.find((entry) => entry.id === clinicId);

    if (!clinic) {
      throw new Error("Clinic not found.");
    }

    const ageMin = parseInteger(input.age_min, clinic.age_min);
    const ageMax = parseInteger(input.age_max, clinic.age_max);
    const minimumEnrollment = parseInteger(input.minimum_enrollment, clinic.minimum_enrollment);
    const targetEnrollment = parseInteger(input.target_enrollment, clinic.target_enrollment);
    const maxEnrollment = parseInteger(input.max_enrollment, clinic.max_enrollment);
    const enrolledCount = parseInteger(input.enrolled_count, clinic.enrolled_count);
    const waitlistCount = parseInteger(input.waitlist_count, clinic.waitlist_count);

    if (!String(input.title || "").trim()) {
      throw new Error("Clinic title is required.");
    }

    if (!String(input.date || "").trim()) {
      throw new Error("Clinic date is required.");
    }

    if (!store.coaches.some((coach) => coach.id === input.coach_id)) {
      throw new Error("Please choose a valid coach.");
    }

    if (!store.locations.some((location) => location.id === input.location_id)) {
      throw new Error("Please choose a valid location.");
    }

    if (ageMin > ageMax) {
      throw new Error("Age minimum cannot be greater than age maximum.");
    }

    if (minimumEnrollment > maxEnrollment) {
      throw new Error("Minimum enrollment cannot be greater than max enrollment.");
    }

    if (targetEnrollment > maxEnrollment) {
      throw new Error("Target enrollment cannot be greater than max enrollment.");
    }

    clinic.updated_at = new Date().toISOString();
    clinic.title = input.title.trim();
    clinic.description = String(input.description || "").trim();
    clinic.marketing_notes = String(input.marketing_notes || "").trim();
    clinic.equipment_notes = String(input.equipment_notes || "").trim();
    clinic.date = input.date;
    clinic.start_time = String(input.start_time || "").trim();
    clinic.end_time = String(input.end_time || "").trim();
    clinic.coach_id = input.coach_id;
    clinic.location_id = input.location_id;
    clinic.clinic_status = input.clinic_status || clinic.clinic_status;
    clinic.age_min = ageMin;
    clinic.age_max = ageMax;
    clinic.skill_band = String(input.skill_band || "").trim();
    clinic.slug = ensureUniqueClinicSlug(store, clinic.title, clinic.id);
    clinic.minimum_enrollment = minimumEnrollment;
    clinic.target_enrollment = targetEnrollment;
    clinic.max_enrollment = maxEnrollment;
    clinic.enrolled_count = Math.max(0, Math.min(enrolledCount, maxEnrollment));
    clinic.waitlist_count = Math.max(0, waitlistCount);
    clinic.is_visible = normalizeBoolean(input.is_visible);

    addActivity(store, "clinic", clinic.id, "admin_clinic_updated", {
      clinic_status: clinic.clinic_status,
      enrolled_count: clinic.enrolled_count,
      waitlist_count: clinic.waitlist_count
    });

    return clinic;
  });
}

function createAdminClinic(input) {
  return updateStore((store) => {
    const timestamp = new Date().toISOString();
    const title = String(input.title || "").trim();
    const description = String(input.description || "").trim();
    const marketingNotes = String(input.marketing_notes || "").trim();
    const startTime = String(input.start_time || "").trim();
    const endTime = String(input.end_time || "").trim();
    const skillBand = String(input.skill_band || "").trim();
    const clinicStatus = String(input.clinic_status || "tentative").trim();
    const ageMin = parseInteger(input.age_min, 6);
    const ageMax = parseInteger(input.age_max, 14);
    const minimumEnrollment = parseInteger(input.minimum_enrollment, 6);
    const targetEnrollment = parseInteger(input.target_enrollment, 8);
    const maxEnrollment = parseInteger(input.max_enrollment, 10);
    const enrolledCount = parseInteger(input.enrolled_count, 0);
    const waitlistCount = parseInteger(input.waitlist_count, 0);
    const coachId = input.coach_id;
    const locationId = input.location_id;

    if (!title) {
      throw new Error("Clinic title is required.");
    }

    if (!String(input.date || "").trim()) {
      throw new Error("Clinic date is required.");
    }

    if (!startTime || !endTime) {
      throw new Error("Clinic start and end time are required.");
    }

    if (!skillBand) {
      throw new Error("Skill band is required.");
    }

    if (!store.coaches.some((coach) => coach.id === coachId)) {
      throw new Error("Please choose a valid coach.");
    }

    if (!store.locations.some((location) => location.id === locationId)) {
      throw new Error("Please choose a valid location.");
    }

    if (ageMin > ageMax) {
      throw new Error("Age minimum cannot be greater than age maximum.");
    }

    if (minimumEnrollment > maxEnrollment) {
      throw new Error("Minimum enrollment cannot be greater than max enrollment.");
    }

    if (targetEnrollment > maxEnrollment) {
      throw new Error("Target enrollment cannot be greater than max enrollment.");
    }

    const clinic = {
      id: `clinic-${randomUUID().slice(0, 8)}`,
      slug: ensureUniqueClinicSlug(store, title),
      created_at: timestamp,
      updated_at: timestamp,
      title,
      description,
      location_id: locationId,
      coach_id: coachId,
      clinic_status: clinicStatus,
      age_min: ageMin,
      age_max: ageMax,
      skill_band: skillBand,
      date: input.date,
      start_time: startTime,
      end_time: endTime,
      timezone: "America/New_York",
      price_type: "contact",
      price_amount: null,
      deposit_amount: null,
      minimum_enrollment: minimumEnrollment,
      target_enrollment: targetEnrollment,
      max_enrollment: maxEnrollment,
      enrolled_count: Math.max(0, Math.min(enrolledCount, maxEnrollment)),
      waitlist_count: Math.max(0, waitlistCount),
      is_visible: normalizeBoolean(input.is_visible),
      cancellation_policy: "",
      equipment_notes: String(input.equipment_notes || "").trim(),
      marketing_notes: marketingNotes
    };

    store.clinics.push(clinic);

    addActivity(store, "clinic", clinic.id, "admin_clinic_created", {
      clinic_status: clinic.clinic_status,
      title: clinic.title
    });

    return clinic;
  });
}

function updateAdminLead(leadId, input) {
  return updateStore((store) => {
    const lead = store.leads.find((entry) => entry.id === leadId);

    if (!lead) {
      throw new Error("Lead not found.");
    }

    if (!String(input.parent_first_name || "").trim() || !String(input.parent_last_name || "").trim()) {
      throw new Error("Parent first and last name are required.");
    }

    if (!String(input.parent_email || "").trim()) {
      throw new Error("Parent email is required.");
    }

    lead.updated_at = new Date().toISOString();
    lead.parent_first_name = String(input.parent_first_name || "").trim();
    lead.parent_last_name = String(input.parent_last_name || "").trim();
    lead.parent_email = normalizeEmail(input.parent_email);
    lead.parent_phone = String(input.parent_phone || "").trim();
    lead.player_first_name = String(input.player_first_name || "").trim();
    lead.player_last_name = String(input.player_last_name || "").trim();
    lead.player_age = String(input.player_age || "").trim();
    lead.player_skill_level = String(input.player_skill_level || "").trim();
    lead.lead_status = String(input.lead_status || "").trim() || lead.lead_status;
    lead.source_detail = String(input.source_detail || "").trim();
    lead.goals = String(input.goals || "").trim();
    lead.availability_notes = String(input.availability_notes || "").trim();
    lead.notes_internal = String(input.notes_internal || "").trim();
    lead.assigned_owner = String(input.assigned_owner || "").trim() || lead.assigned_owner;

    addActivity(store, "lead", lead.id, "admin_lead_updated", {
      lead_status: lead.lead_status,
      source_detail: lead.source_detail
    });

    return lead;
  });
}

function updateAdminClinicStatus(clinicId, clinicStatus) {
  return updateStore((store) => {
    const clinic = getClinicById(store, clinicId);
    const nextStatus = String(clinicStatus || "").trim();

    if (!clinic) {
      throw new Error("Clinic not found.");
    }

    if (!["open", "confirmed", "tentative", "full", "canceled"].includes(nextStatus)) {
      throw new Error("Invalid clinic status.");
    }

    clinic.updated_at = new Date().toISOString();
    clinic.clinic_status = nextStatus;

    if (nextStatus === "open" || nextStatus === "confirmed") {
      updateClinicEnrollment(clinic);
    }

    addActivity(store, "clinic", clinic.id, "admin_clinic_status_updated", {
      clinic_status: clinic.clinic_status
    });

    return clinic;
  });
}

function updateAdminPrivateInquiry(inquiryId, input) {
  return updateStore((store) => {
    const inquiry = store.privateInquiries.find((entry) => entry.id === inquiryId);
    const nextStatus = String(input.inquiry_status || "").trim();

    if (!inquiry) {
      throw new Error("Private inquiry not found.");
    }

    if (!["new", "reviewed", "contacted", "scheduled", "closed"].includes(nextStatus)) {
      throw new Error("Invalid private inquiry status.");
    }

    inquiry.updated_at = new Date().toISOString();
    inquiry.inquiry_status = nextStatus;

    const lead = getLeadById(store, inquiry.lead_id);

    if (lead) {
      lead.updated_at = new Date().toISOString();
      const preserveOperationalStatus = ["booked_clinic", "waitlisted", "scheduled_private", "converted"].includes(lead.lead_status);

      if (preserveOperationalStatus && nextStatus !== "closed") {
        // Keep stronger conversion states intact when the same lead also has a private inquiry.
      } else if (nextStatus === "contacted") {
        lead.lead_status = "contacted";
      } else if (nextStatus === "scheduled") {
        lead.lead_status = "scheduled_private";
      } else if (nextStatus === "closed") {
        lead.lead_status = deriveLeadStatus(store, lead);
      } else {
        lead.lead_status = "private_inquiry";
      }
    }

    addActivity(store, "private_inquiry", inquiry.id, "admin_private_inquiry_updated", {
      inquiry_status: inquiry.inquiry_status,
      lead_id: inquiry.lead_id
    });

    return inquiry;
  });
}

function assignLeadToClinicInternal(store, input) {
  const leadId = String(input.lead_id || "").trim();
  const clinicId = String(input.clinic_id || "").trim();
  const assignmentType = String(input.assignment_type || "booking").trim() === "waitlist" ? "waitlist" : "booking";
  const timestamp = new Date().toISOString();
  const lead = getLeadById(store, leadId);
  const clinic = getClinicById(store, clinicId);

  if (!lead) {
    throw new Error("Please choose a valid lead.");
  }

  if (!clinic) {
    throw new Error("Please choose a valid clinic.");
  }

  const leadName = getLeadFullName(lead);
  const existingBooking = findExistingBooking(store, lead.id, clinic.id);
  const existingWaitlistEntry = findExistingWaitlistEntry(store, lead.id, clinic.id);

  if (assignmentType === "waitlist") {
    if (["canceled", "completed"].includes(clinic.clinic_status)) {
      throw new Error(`You cannot add ${leadName} to the waitlist for a canceled or completed clinic.`);
    }

    if (existingBooking) {
      throw new Error(`${leadName} is already booked for ${clinic.title}.`);
    }

    if (existingWaitlistEntry) {
      return {
        outcome: "waitlist",
        duplicate: true,
        notice: `${leadName} is already on the waitlist for ${clinic.title}.`
      };
    }

    const activeWaitlistCount = store.waitlistEntries.filter(
      (entry) => entry.clinic_id === clinic.id && isActiveWaitlistEntry(entry)
    ).length;

    const waitlistEntry = {
      id: randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      lead_id: lead.id,
      clinic_id: clinic.id,
      waitlist_status: "active",
      priority_order: activeWaitlistCount + 1,
      notified_at: "",
      response_deadline_at: "",
      converted_booking_id: ""
    };

    store.waitlistEntries.push(waitlistEntry);
    clinic.waitlist_count += 1;
    lead.lead_status = "waitlisted";
    lead.updated_at = timestamp;

    addActivity(store, "waitlist", waitlistEntry.id, "admin_waitlist_created", {
      clinic_id: clinic.id,
      lead_id: lead.id,
      lead_source: lead.source
    });

    return {
      outcome: "waitlist",
      duplicate: false,
      notice: `${leadName} was added to the waitlist for ${clinic.title}.`
    };
  }

  if (existingBooking) {
    return {
      outcome: "booking",
      duplicate: true,
      notice: `${leadName} is already booked for ${clinic.title}.`
    };
  }

  if (["canceled", "completed", "tentative"].includes(clinic.clinic_status)) {
    throw new Error(`You cannot assign a booking to ${clinic.title} while it is ${clinic.clinic_status}.`);
  }

  if (clinic.clinic_status === "full" || clinic.enrolled_count >= clinic.max_enrollment) {
    if (existingWaitlistEntry) {
      return {
        outcome: "waitlist",
        duplicate: true,
        fallback: true,
        notice: `${leadName} is already on the waitlist for ${clinic.title}.`
      };
    }

    const activeWaitlistCount = store.waitlistEntries.filter(
      (entry) => entry.clinic_id === clinic.id && isActiveWaitlistEntry(entry)
    ).length;

    const waitlistEntry = {
      id: randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      lead_id: lead.id,
      clinic_id: clinic.id,
      waitlist_status: "active",
      priority_order: activeWaitlistCount + 1,
      notified_at: "",
      response_deadline_at: "",
      converted_booking_id: ""
    };

    store.waitlistEntries.push(waitlistEntry);
    clinic.waitlist_count += 1;
    clinic.clinic_status = "full";
    lead.lead_status = "waitlisted";
    lead.updated_at = timestamp;

    addActivity(store, "waitlist", waitlistEntry.id, "admin_waitlist_created_from_full_booking", {
      clinic_id: clinic.id,
      lead_id: lead.id,
      lead_source: lead.source
    });

    return {
      outcome: "waitlist",
      duplicate: false,
      fallback: true,
      notice: `${clinic.title} is full, so ${leadName} was added to the waitlist instead.`
    };
  }

  const booking = {
    id: randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
    lead_id: lead.id,
    clinic_id: clinic.id,
    booking_status: "reserved",
    payment_status: "manual_admin",
    payment_method: "admin_manual",
    amount_due: clinic.price_amount || 0,
    amount_paid: 0,
    stripe_payment_intent_id: "",
    confirmation_code: `ADMIN-${Math.floor(100000 + Math.random() * 900000)}`,
    canceled_at: "",
    cancellation_reason: "",
    refund_status: "",
    check_in_status: "not_checked_in"
  };

  store.bookings.push(booking);
  clinic.enrolled_count += 1;
  lead.lead_status = "booked_clinic";
  lead.updated_at = timestamp;

  if (existingWaitlistEntry) {
    existingWaitlistEntry.waitlist_status = "converted";
    existingWaitlistEntry.updated_at = timestamp;
    existingWaitlistEntry.converted_booking_id = booking.id;
    clinic.waitlist_count = Math.max(0, clinic.waitlist_count - 1);

    addActivity(store, "waitlist", existingWaitlistEntry.id, "admin_waitlist_converted_to_booking", {
      clinic_id: clinic.id,
      lead_id: lead.id,
      booking_id: booking.id
    });
  }

  updateClinicEnrollment(clinic);

  addActivity(store, "booking", booking.id, "admin_booking_created", {
    clinic_id: clinic.id,
    lead_id: lead.id,
    lead_source: lead.source
  });

  return {
    outcome: "booking",
    duplicate: false,
    notice: `${leadName} was assigned to ${clinic.title}.`
  };
}

function assignLeadToClinic(input) {
  return updateStore((store) => assignLeadToClinicInternal(store, input));
}

function promoteWaitlistEntryToBooking(waitlistEntryId) {
  return updateStore((store) => {
    const entry = store.waitlistEntries.find((record) => record.id === waitlistEntryId);
    const timestamp = new Date().toISOString();

    if (!entry || !isActiveWaitlistEntry(entry)) {
      throw new Error("Waitlist entry not found.");
    }

    const clinic = getClinicById(store, entry.clinic_id);
    const lead = getLeadById(store, entry.lead_id);

    if (!clinic) {
      throw new Error("Clinic not found.");
    }

    if (!lead) {
      throw new Error("Lead not found.");
    }

    if (!["open", "confirmed"].includes(clinic.clinic_status)) {
      throw new Error("Only open or confirmed clinics can accept waitlist promotions.");
    }

    if (clinic.enrolled_count >= clinic.max_enrollment) {
      throw new Error("Open a spot before promoting this waitlist entry.");
    }

    const existingBooking = findExistingBooking(store, lead.id, clinic.id);

    if (existingBooking) {
      throw new Error("This lead already has a booking for the clinic.");
    }

    const booking = {
      id: randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      lead_id: lead.id,
      clinic_id: clinic.id,
      booking_status: "reserved",
      payment_status: "manual_admin",
      payment_method: "admin_manual",
      amount_due: clinic.price_amount || 0,
      amount_paid: 0,
      stripe_payment_intent_id: "",
      confirmation_code: `ADMIN-${Math.floor(100000 + Math.random() * 900000)}`,
      canceled_at: "",
      cancellation_reason: "",
      refund_status: "",
      check_in_status: "not_checked_in"
    };

    store.bookings.push(booking);
    clinic.enrolled_count += 1;
    clinic.waitlist_count = Math.max(0, clinic.waitlist_count - 1);
    entry.waitlist_status = "converted";
    entry.updated_at = timestamp;
    entry.converted_booking_id = booking.id;
    lead.lead_status = "booked_clinic";
    lead.updated_at = timestamp;

    updateClinicEnrollment(clinic);

    addActivity(store, "waitlist", entry.id, "admin_waitlist_promoted", {
      clinic_id: clinic.id,
      lead_id: lead.id,
      booking_id: booking.id
    });

    addActivity(store, "booking", booking.id, "admin_booking_created_from_waitlist", {
      clinic_id: clinic.id,
      lead_id: lead.id
    });

    return {
      notice: `${getLeadFullName(lead)} was promoted from the waitlist into ${clinic.title}.`
    };
  });
}

function removeLeadFromClinicAssignment(input) {
  return updateStore((store) => {
    const assignmentId = String(input.assignment_id || "").trim();
    const assignmentType = String(input.assignment_type || "").trim() === "waitlist" ? "waitlist" : "booking";

    if (!assignmentId) {
      throw new Error("Missing session assignment.");
    }

    if (assignmentType === "waitlist") {
      const waitlistEntry = store.waitlistEntries.find((entry) => entry.id === assignmentId);

      if (!waitlistEntry) {
        throw new Error("Waitlist entry not found.");
      }

      const clinic = getClinicById(store, waitlistEntry.clinic_id);
      const lead = getLeadById(store, waitlistEntry.lead_id);

      waitlistEntry.waitlist_status = "removed";
      waitlistEntry.updated_at = new Date().toISOString();

      if (clinic && isFinite(clinic.waitlist_count)) {
        clinic.waitlist_count = Math.max(0, clinic.waitlist_count - 1);
      }

      if (lead) {
        lead.updated_at = new Date().toISOString();
        lead.lead_status = deriveLeadStatus(store, lead);
      }

      addActivity(store, "waitlist", waitlistEntry.id, "admin_waitlist_removed", {
        clinic_id: clinic?.id || "",
        lead_id: lead?.id || ""
      });

      return {
        notice: `${getLeadFullName(lead)} was removed from the waitlist for ${clinic?.title || "that clinic"}.`
      };
    }

    const booking = store.bookings.find((entry) => entry.id === assignmentId);

    if (!booking) {
      throw new Error("Booking not found.");
    }

    const clinic = getClinicById(store, booking.clinic_id);
    const lead = getLeadById(store, booking.lead_id);

    booking.booking_status = "canceled";
    booking.canceled_at = new Date().toISOString();
    booking.cancellation_reason = "removed_by_admin";
    booking.updated_at = new Date().toISOString();

    if (clinic && isFinite(clinic.enrolled_count)) {
      clinic.enrolled_count = Math.max(0, clinic.enrolled_count - 1);
      updateClinicEnrollment(clinic);
    }

    if (lead) {
      lead.updated_at = new Date().toISOString();
      lead.lead_status = deriveLeadStatus(store, lead);
    }

    addActivity(store, "booking", booking.id, "admin_booking_removed", {
      clinic_id: clinic?.id || "",
      lead_id: lead?.id || ""
    });

    return {
      notice: `${getLeadFullName(lead)} was removed from ${clinic?.title || "that clinic"}.`
    };
  });
}

function createAdminLead(input) {
  return updateStore((store) => {
    const existingLead = findExistingLead(store, input.parent_email, input.parent_phone);

    if (!String(input.parent_first_name || "").trim() || !String(input.parent_last_name || "").trim()) {
      throw new Error("Parent first and last name are required.");
    }

    if (!String(input.parent_email || "").trim()) {
      throw new Error("Parent email is required.");
    }

    const lead = upsertLead(store, {
      ...input,
      source: existingLead ? existingLead.source : input.source || "admin_manual",
      source_detail: existingLead ? existingLead.source_detail : input.source_detail || "manual_admin_entry",
      lead_status: input.lead_status || existingLead?.lead_status || "new"
    });

    lead.notes_internal = String(input.notes_internal || "").trim();
    lead.assigned_owner = String(input.assigned_owner || "").trim() || lead.assigned_owner;
    lead.updated_at = new Date().toISOString();

    addActivity(store, "lead", lead.id, existingLead ? "admin_lead_updated_via_create" : "admin_lead_created", {
      lead_status: lead.lead_status,
      source_detail: lead.source_detail
    });

    let assignment = null;

    if (String(input.clinic_id || "").trim() && String(input.assignment_type || "").trim()) {
      assignment = assignLeadToClinicInternal(store, {
        lead_id: lead.id,
        clinic_id: input.clinic_id,
        assignment_type: input.assignment_type
      });
    }

    return {
      lead,
      assignment,
      wasExisting: Boolean(existingLead)
    };
  });
}

module.exports = {
  getVisibleClinics,
  getClinicBySlug,
  getHomeStats,
  getAdminOverview,
  assignLeadToClinic,
  promoteWaitlistEntryToBooking,
  removeLeadFromClinicAssignment,
  createAdminClinic,
  createAdminLead,
  updateAdminClinicStatus,
  updateAdminClinic,
  updateAdminLead,
  updateAdminPrivateInquiry,
  submitBooking,
  submitWaitlist,
  submitPrivateInquiry,
  submitGeneralInterest
};
