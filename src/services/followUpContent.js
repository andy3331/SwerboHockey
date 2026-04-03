function buildContactDetails() {
  return {
    contactLabel: "Questions or updates",
    contactDetail: "Use the contact form and mention your player's name and session so we can route your family quickly.",
    contactHref: "/contact",
    contactCta: "Contact Swierbutowicz Hockey Development"
  };
}

function buildBookingConfirmation(clinic, confirmationCode) {
  const locationLabel = clinic?.location
    ? `${clinic.location.name}, ${clinic.location.city}, ${clinic.location.state}`
    : "South Windsor area rink";
  const arrivalInstructions = clinic?.location?.notes
    ? `${clinic.location.notes} Please arrive early enough for gear, rink check-in, and a calm transition onto the ice.`
    : "Please arrive early enough for gear, rink check-in, and a calm transition onto the ice.";

  return {
    type: "booking",
    eyebrow: "You're booked",
    title: "Your clinic request is saved.",
    intro: clinic
      ? `Your family is now in the booking flow for ${clinic.title}.`
      : "Your family is now in the booking flow for the selected clinic.",
    detail: confirmationCode
      ? `Your reference code is ${confirmationCode}. A waiver must be completed before participation is fully confirmed.`
      : "A waiver must be completed before participation is fully confirmed.",
    sessionDetails: clinic
      ? [
          { label: "Clinic", value: clinic.title },
          { label: "Date", value: clinic.dateLabel },
          { label: "Time", value: `${clinic.start_time} to ${clinic.end_time}` },
          { label: "Location", value: locationLabel },
          { label: "Coach", value: clinic.coach?.full_name || "Coach Adam Swierbutowicz" }
        ]
      : [],
    nextSteps: [
      "Complete the parent waiver before on-ice participation is finalized.",
      "Watch for follow-up with final logistics and any remaining details.",
      "Bring the equipment listed below and plan for a smooth rink arrival."
    ],
    logistics: [
      { label: "What to bring", value: clinic?.equipment_notes || "Full hockey gear and water." },
      { label: "Arrival instructions", value: arrivalInstructions },
      { label: "Questions", value: buildContactDetails().contactDetail }
    ],
    primaryCta: { href: "/waiver", label: "Complete Waiver" },
    secondaryCta: { href: "/clinics", label: "View More Clinics" },
    tertiaryCta: { href: "/contact", label: "Contact Us" },
    messagePreview: {
      subject: clinic ? `Swierbutowicz Hockey Development booking received: ${clinic.title}` : "Swierbutowicz Hockey Development booking received",
      body: clinic
        ? `We saved your booking request for ${clinic.title} on ${clinic.dateLabel}. Your reference code is ${confirmationCode || "on file"}. Please complete the waiver step before participation is finalized.`
        : "We saved your booking request and will follow up with the next steps."
    },
    contact: buildContactDetails()
  };
}

function buildWaitlistConfirmation(clinic) {
  return {
    type: "waitlist",
    eyebrow: "Waitlist saved",
    title: "Your family is on the waitlist.",
    intro: clinic
      ? `We saved your waitlist request for ${clinic.title}.`
      : "We saved your waitlist request.",
    detail: "If a spot opens, families are contacted in order. You still have other paths forward right now if timing matters.",
    sessionDetails: clinic
      ? [
          { label: "Clinic", value: clinic.title },
          { label: "Date", value: clinic.dateLabel },
          { label: "Time", value: `${clinic.start_time} to ${clinic.end_time}` },
          { label: "Location", value: `${clinic.location.name}, ${clinic.location.city}, ${clinic.location.state}` }
        ]
      : [],
    nextSteps: [
      "Your family stays in the queue for this session if a spot opens.",
      "We will contact the next family on the list when availability changes.",
      "You can still request a private lesson or compare other clinics right now."
    ],
    logistics: [
      { label: "Waitlist process", value: "Families are contacted in order as spots become available." },
      { label: "Alternative option", value: "Private lesson requests stay open if you need more scheduling flexibility." },
      { label: "Questions", value: buildContactDetails().contactDetail }
    ],
    primaryCta: { href: "/private-lessons", label: "Request a Private Lesson" },
    secondaryCta: { href: "/clinics", label: "View Other Clinics" },
    tertiaryCta: { href: "/contact", label: "Contact Us" },
    messagePreview: {
      subject: clinic ? `Swierbutowicz Hockey Development waitlist saved: ${clinic.title}` : "Swierbutowicz Hockey Development waitlist saved",
      body: clinic
        ? `We saved your family's waitlist request for ${clinic.title}. If a spot opens, families are contacted in order.`
        : "We saved your family's waitlist request and will follow up if a spot opens."
    },
    contact: buildContactDetails()
  };
}

function buildPrivateInquiryConfirmation() {
  return {
    type: "private",
    eyebrow: "Private request received",
    title: "Your private lesson request is in the follow-up queue.",
    intro: "We saved your player's goals and availability.",
    detail: "You can expect a response within 24 hours with the next step or the best-fit option for your family.",
    sessionDetails: [],
    nextSteps: [
      "We review your player's goals, age, and availability.",
      "You can expect a response within 24 hours.",
      "If a clinic becomes a better fit first, you can still book one anytime."
    ],
    logistics: [
      { label: "Expected response", value: "Within 24 hours" },
      { label: "What we review", value: "Goals, age group, scheduling fit, and whether private or small-group work makes more sense." },
      { label: "Questions", value: buildContactDetails().contactDetail }
    ],
    primaryCta: { href: "/clinics", label: "View Clinics" },
    secondaryCta: { href: "/contact", label: "Share More Details" },
    tertiaryCta: { href: "/private-lessons", label: "Review Private Lesson Info" },
    messagePreview: {
      subject: "Swierbutowicz Hockey Development private lesson request received",
      body: "We saved your private lesson request and will follow up within 24 hours after reviewing goals and availability."
    },
    contact: buildContactDetails()
  };
}

function buildInterestConfirmation(interestType = "") {
  const normalizedInterestType = String(interestType || "").trim() || "General interest";

  return {
    type: "interest",
    eyebrow: "Interest saved",
    title: "Your family is in the follow-up queue.",
    intro: `We saved your interest details for ${normalizedInterestType.toLowerCase()}.`,
    detail: "If there is not a perfect fit today, your information is still captured so we can route the next best option.",
    sessionDetails: [{ label: "Interest type", value: normalizedInterestType }],
    nextSteps: [
      "Your interest stays captured for future outreach and routing.",
      "We review age group, level, and scheduling notes before following up.",
      "You can still move into a clinic or private lesson path right now if needed."
    ],
    logistics: [
      { label: "What happens next", value: "We review the request and use it to guide follow-up or future clinic planning." },
      { label: "Fastest path", value: "If you already know you want private coaching, the private lesson form is the quickest next step." },
      { label: "Questions", value: buildContactDetails().contactDetail }
    ],
    primaryCta: { href: "/clinics", label: "View Clinics" },
    secondaryCta: { href: "/private-lessons", label: "Request a Private Lesson" },
    tertiaryCta: { href: "/contact", label: "Update Your Interest" },
    messagePreview: {
      subject: "Swierbutowicz Hockey Development interest received",
      body: `We saved your interest for ${normalizedInterestType.toLowerCase()} and will follow up when there is a strong fit for your family.`
    },
    contact: buildContactDetails()
  };
}

function buildConfirmationContent({ type, clinic, confirmationCode, interestType }) {
  if (type === "booking") {
    return buildBookingConfirmation(clinic, confirmationCode);
  }

  if (type === "waitlist") {
    return buildWaitlistConfirmation(clinic);
  }

  if (type === "private") {
    return buildPrivateInquiryConfirmation();
  }

  return buildInterestConfirmation(interestType);
}

module.exports = {
  buildConfirmationContent
};
