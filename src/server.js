const express = require("express");
const path = require("path");
const { coachProfile } = require("./data/coachProfile");
const { buildConfirmationContent } = require("./services/followUpContent");
const {
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
} = require("./services/dataStore");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

function renderPage(res, view, options = {}) {
  const clinics = getVisibleClinics();

  res.render(view, {
    siteTitle: "Swierbutowicz Hockey Development",
    currentPath: options.currentPath || "",
    clinics,
    coachProfile,
    form: {},
    formError: "",
    ...options
  });
}

function requireFields(input, fields) {
  const missingField = fields.find((field) => !String(input[field] || "").trim());

  if (!missingField) {
    return "";
  }

  return "Please complete every required field before submitting.";
}

app.get("/", (req, res) => {
  const clinics = getVisibleClinics().slice(0, 3);
  const stats = getHomeStats();

  renderPage(res, "home", {
    title: "Youth Hockey Skill Development in South Windsor, CT",
    currentPath: "/",
    clinics,
    stats
  });
});

app.get("/clinics", (req, res) => {
  renderPage(res, "clinics", {
    title: "Upcoming Clinics",
    currentPath: "/clinics"
  });
});

app.get("/clinics/:slug", (req, res) => {
  const clinic = getClinicBySlug(req.params.slug);

  if (!clinic) {
    res.status(404);
    return renderPage(res, "404", {
      title: "Clinic Not Found",
      currentPath: "/clinics"
    });
  }

  return renderPage(res, "clinic-detail", {
    title: clinic.title,
    currentPath: "/clinics",
    clinic
  });
});

app.get("/private-lessons", (req, res) => {
  renderPage(res, "private-lessons", {
    title: "Private Lessons",
    currentPath: "/private-lessons"
  });
});

app.get("/about-coach", (req, res) => {
  renderPage(res, "about-coach", {
    title: "About Coach Swerbo",
    currentPath: "/about-coach"
  });
});

app.get("/contact", (req, res) => {
  renderPage(res, "contact", {
    title: "Contact and Express Interest",
    currentPath: "/contact"
  });
});

app.get("/waiver", (req, res) => {
  renderPage(res, "waiver", {
    title: "Parent Waiver",
    currentPath: ""
  });
});

app.get("/admin", (req, res) => {
  const overview = getAdminOverview();

  renderPage(res, "admin", {
    title: "Admin Overview",
    currentPath: "",
    overview,
    adminNotice: req.query.notice || "",
    adminError: req.query.error || ""
  });
});

app.post("/admin/clinics/:id", (req, res) => {
  try {
    updateAdminClinic(req.params.id, req.body);
    return res.redirect("/admin?notice=Clinic+updated");
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not update clinic."
    });
  }
});

app.post("/admin/clinics/:id/status", (req, res) => {
  try {
    updateAdminClinicStatus(req.params.id, req.body.clinic_status);
    return res.redirect("/admin?notice=Clinic+status+updated");
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not update clinic status."
    });
  }
});

app.post("/admin/clinics", (req, res) => {
  try {
    createAdminClinic(req.body);
    return res.redirect("/admin?notice=Clinic+created");
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not create clinic."
    });
  }
});

app.post("/admin/leads/:id", (req, res) => {
  try {
    updateAdminLead(req.params.id, req.body);
    return res.redirect("/admin?notice=Lead+updated");
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not update lead."
    });
  }
});

app.post("/admin/leads", (req, res) => {
  try {
    const result = createAdminLead(req.body);
    const notice = result.assignment
      ? result.assignment.notice
      : result.wasExisting
        ? "Lead updated"
        : "Lead created";

    return res.redirect(`/admin?notice=${encodeURIComponent(notice)}`);
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not create lead."
    });
  }
});

app.post("/admin/session-assignments", (req, res) => {
  try {
    const result = assignLeadToClinic(req.body);
    return res.redirect(`/admin?notice=${encodeURIComponent(result.notice || "Lead assigned to session")}`);
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not assign lead to session."
    });
  }
});

app.post("/admin/session-assignments/remove", (req, res) => {
  try {
    const result = removeLeadFromClinicAssignment(req.body);
    return res.redirect(`/admin?notice=${encodeURIComponent(result.notice || "Lead removed from session")}`);
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not remove lead from session."
    });
  }
});

app.post("/admin/waitlist/:id/promote", (req, res) => {
  try {
    const result = promoteWaitlistEntryToBooking(req.params.id);
    return res.redirect(`/admin?notice=${encodeURIComponent(result.notice || "Waitlist entry promoted")}`);
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not promote waitlist entry."
    });
  }
});

app.post("/admin/private-inquiries/:id", (req, res) => {
  try {
    updateAdminPrivateInquiry(req.params.id, req.body);
    return res.redirect("/admin?notice=Private+inquiry+updated");
  } catch (error) {
    const overview = getAdminOverview();

    return renderPage(res, "admin", {
      title: "Admin Overview",
      currentPath: "",
      overview,
      adminNotice: "",
      adminError: error.message || "Could not update private inquiry."
    });
  }
});

app.get("/thanks", (req, res) => {
  const clinic = req.query.clinic ? getClinicBySlug(req.query.clinic) : null;
  const content = buildConfirmationContent({
    type: req.query.type,
    clinic,
    confirmationCode: req.query.code,
    interestType: req.query.interest
  });

  renderPage(res, "thanks", {
    title: content.title,
    currentPath: "",
    thanks: content,
    confirmationClinic: clinic
  });
});

app.post("/forms/bookings", (req, res) => {
  const clinic = getClinicBySlug(req.body.clinic_slug);
  const formError = requireFields(req.body, [
    "parent_first_name",
    "parent_last_name",
    "parent_email",
    "parent_phone",
    "player_first_name",
    "player_last_name",
    "player_age",
    "player_skill_level",
    "goals"
  ]);

  if (!clinic) {
    res.status(404);
    return renderPage(res, "404", {
      title: "Clinic Not Found",
      currentPath: "/clinics"
    });
  }

  if (formError) {
    return renderPage(res, "clinic-detail", {
      title: clinic.title,
      currentPath: "/clinics",
      clinic,
      form: req.body,
      formError
    });
  }

  const result = submitBooking(req.body);

  if (result.outcome === "waitlist") {
    return res.redirect(`/thanks?type=waitlist&clinic=${encodeURIComponent(result.clinicSlug)}`);
  }

  if (result.outcome === "general_interest") {
    return res.redirect(`/thanks?type=interest&interest=${encodeURIComponent(result.interestType || clinic.title)}`);
  }

  return res.redirect(
    `/thanks?type=booking&clinic=${encodeURIComponent(result.clinicSlug)}&code=${encodeURIComponent(result.confirmationCode)}`
  );
});

app.post("/forms/waitlist", (req, res) => {
  const clinic = getClinicBySlug(req.body.clinic_slug);
  const formError = requireFields(req.body, [
    "parent_first_name",
    "parent_last_name",
    "parent_email",
    "parent_phone",
    "player_first_name",
    "player_last_name",
    "player_age",
    "player_skill_level"
  ]);

  if (!clinic) {
    res.status(404);
    return renderPage(res, "404", {
      title: "Clinic Not Found",
      currentPath: "/clinics"
    });
  }

  if (formError) {
    return renderPage(res, "clinic-detail", {
      title: clinic.title,
      currentPath: "/clinics",
      clinic,
      form: req.body,
      formError
    });
  }

  const result = submitWaitlist(req.body);

  if (result.outcome === "general_interest") {
    return res.redirect(`/thanks?type=interest&interest=${encodeURIComponent(result.interestType || clinic.title)}`);
  }

  return res.redirect(`/thanks?type=waitlist&clinic=${encodeURIComponent(result.clinicSlug)}`);
});

app.post("/forms/private-inquiries", (req, res) => {
  const formError = requireFields(req.body, [
    "parent_first_name",
    "parent_last_name",
    "parent_email",
    "parent_phone",
    "player_first_name",
    "player_last_name",
    "player_age",
    "player_birth_year",
    "player_position",
    "player_team",
    "goals",
    "preferred_days",
    "preferred_times"
  ]);

  if (formError) {
    return renderPage(res, "private-lessons", {
      title: "Private Lessons",
      currentPath: "/private-lessons",
      form: req.body,
      formError
    });
  }

  submitPrivateInquiry(req.body);
  return res.redirect("/thanks?type=private");
});

app.post("/forms/general-interest", (req, res) => {
  const formError = requireFields(req.body, [
    "parent_first_name",
    "parent_last_name",
    "parent_email",
    "parent_phone",
    "player_age",
    "interest_type"
  ]);

  if (formError) {
    const viewName = req.body.return_to === "clinic" ? "clinic-detail" : "contact";

    if (viewName === "clinic-detail") {
      const clinic = getClinicBySlug(req.body.clinic_slug);

      if (!clinic) {
        res.status(404);
        return renderPage(res, "404", {
          title: "Clinic Not Found",
          currentPath: "/clinics"
        });
      }

      return renderPage(res, "clinic-detail", {
        title: clinic.title,
        currentPath: "/clinics",
        clinic,
        form: req.body,
        formError
      });
    }

    return renderPage(res, "contact", {
      title: "Contact and Express Interest",
      currentPath: "/contact",
      form: req.body,
      formError
    });
  }

  submitGeneralInterest(req.body);
  return res.redirect(`/thanks?type=interest&interest=${encodeURIComponent(req.body.interest_type)}`);
});

app.use((req, res) => {
  res.status(404);
  renderPage(res, "404", {
    title: "Page Not Found",
    currentPath: ""
  });
});

app.listen(port, () => {
  console.log(`Swierbutowicz Hockey Development listening on http://localhost:${port}`);
});
