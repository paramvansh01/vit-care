-- ============================================================================
-- VIT-CARE  |  Telemedicine & Attendance Condonation Platform
-- CSE2003 - Database Management Systems
-- Fully normalized (3NF) relational schema
-- ============================================================================
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- MODULE 1 : INSTITUTION  (campus / department / course / faculty / student)
-- ---------------------------------------------------------------------------

CREATE TABLE campus (
  campus_id     INTEGER PRIMARY KEY,
  code          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  city          TEXT    NOT NULL,
  state         TEXT    NOT NULL,
  established   INTEGER NOT NULL
);

CREATE TABLE department (
  dept_id       INTEGER PRIMARY KEY,
  campus_id     INTEGER NOT NULL REFERENCES campus(campus_id) ON DELETE CASCADE,
  code          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  UNIQUE (campus_id, code)
);

CREATE TABLE faculty (
  faculty_id    INTEGER PRIMARY KEY,
  dept_id       INTEGER NOT NULL REFERENCES department(dept_id),
  -- recursive relationship : a faculty member reports to another faculty member
  reports_to    INTEGER REFERENCES faculty(faculty_id),
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  designation   TEXT    NOT NULL CHECK (designation IN
                  ('Assistant Professor','Associate Professor','Professor','HOD','Dean'))
);

CREATE TABLE course (
  course_code   TEXT    PRIMARY KEY,
  dept_id       INTEGER NOT NULL REFERENCES department(dept_id),
  title         TEXT    NOT NULL,
  credits       INTEGER NOT NULL CHECK (credits BETWEEN 1 AND 6)
);

CREATE TABLE student (
  reg_no        TEXT    PRIMARY KEY,
  dept_id       INTEGER NOT NULL REFERENCES department(dept_id),
  campus_id     INTEGER NOT NULL REFERENCES campus(campus_id),
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  phone         TEXT    NOT NULL,
  dob           TEXT    NOT NULL,
  gender        TEXT    NOT NULL CHECK (gender IN ('M','F','O')),
  blood_group   TEXT,
  hostel_block  TEXT,
  room_no       TEXT,
  year_of_study INTEGER NOT NULL CHECK (year_of_study BETWEEN 1 AND 5),
  -- academic escalation chain, captured by the student at profile creation.
  -- Every medical-leave document is copied to these two people by trigger T15.
  proctor_name  TEXT,
  proctor_email TEXT,
  proctor_phone TEXT,
  hod_name      TEXT,
  hod_email     TEXT
);

CREATE TABLE enrollment (
  enrollment_id    INTEGER PRIMARY KEY,
  reg_no           TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  course_code      TEXT    NOT NULL REFERENCES course(course_code),
  faculty_id       INTEGER NOT NULL REFERENCES faculty(faculty_id),
  semester         TEXT    NOT NULL,
  classes_held     INTEGER NOT NULL DEFAULT 0,
  classes_attended INTEGER NOT NULL DEFAULT 0,
  condoned_days    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (reg_no, course_code, semester),
  CHECK (classes_attended <= classes_held)
);

-- ---------------------------------------------------------------------------
-- MODULE 2 : CLINICAL  (EER doctor specialization hierarchy)
-- ---------------------------------------------------------------------------

-- SUPERCLASS ----------------------------------------------------------------
CREATE TABLE doctor (
  doctor_id        INTEGER PRIMARY KEY,
  campus_id        INTEGER NOT NULL REFERENCES campus(campus_id),
  name             TEXT    NOT NULL,
  email            TEXT    NOT NULL UNIQUE,
  reg_council_no   TEXT    NOT NULL UNIQUE,
  -- disjoint, total specialization discriminator
  doctor_type      TEXT    NOT NULL CHECK (doctor_type IN ('GP','SPECIALIST','COUNSELOR')),
  years_experience INTEGER NOT NULL CHECK (years_experience >= 0),
  consult_fee      REAL    NOT NULL DEFAULT 0
);

-- SUBCLASS 1/3 : general practitioner ----------------------------------------
CREATE TABLE gp_doctor (
  doctor_id     INTEGER PRIMARY KEY REFERENCES doctor(doctor_id) ON DELETE CASCADE,
  opd_room      TEXT    NOT NULL,
  panel_size    INTEGER NOT NULL DEFAULT 0,
  walk_in_hours TEXT    NOT NULL
);

-- SUBCLASS 2/3 : specialist --------------------------------------------------
CREATE TABLE specialist_doctor (
  doctor_id           INTEGER PRIMARY KEY REFERENCES doctor(doctor_id) ON DELETE CASCADE,
  board_certification TEXT    NOT NULL,
  referral_only       INTEGER NOT NULL DEFAULT 1 CHECK (referral_only IN (0,1)),
  tertiary_hospital   TEXT
);

-- SUBCLASS 3/3 : counselor ---------------------------------------------------
CREATE TABLE counselor (
  doctor_id            INTEGER PRIMARY KEY REFERENCES doctor(doctor_id) ON DELETE CASCADE,
  therapy_modality     TEXT    NOT NULL,
  confidentiality_tier TEXT    NOT NULL CHECK (confidentiality_tier IN ('STANDARD','ELEVATED','SEALED')),
  supervised_hours     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE specialization (
  spec_id     INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,
  body_system TEXT    NOT NULL,
  description TEXT
);

-- M:N  doctor <-> specialization ---------------------------------------------
CREATE TABLE doctor_specialization (
  doctor_id    INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
  spec_id      INTEGER NOT NULL REFERENCES specialization(spec_id) ON DELETE CASCADE,
  certified_on TEXT    NOT NULL,
  is_primary   INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  PRIMARY KEY (doctor_id, spec_id)
);

-- WEAK ENTITY : a slot cannot exist without its owning doctor ----------------
-- partial key = (slot_date, slot_time) ; identifying owner = doctor
CREATE TABLE slot (
  doctor_id  INTEGER NOT NULL REFERENCES doctor(doctor_id) ON DELETE CASCADE,
  slot_date  TEXT    NOT NULL,
  slot_time  TEXT    NOT NULL,
  mode       TEXT    NOT NULL DEFAULT 'VIDEO' CHECK (mode IN ('VIDEO','IN_PERSON')),
  status     TEXT    NOT NULL DEFAULT 'OPEN'  CHECK (status IN ('OPEN','BOOKED','BLOCKED')),
  PRIMARY KEY (doctor_id, slot_date, slot_time)
);

CREATE TABLE symptom (
  symptom_id      INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL UNIQUE,
  body_system     TEXT    NOT NULL,
  default_triage  TEXT    NOT NULL CHECK (default_triage IN ('GREEN','AMBER','RED'))
);

CREATE TABLE appointment (
  appointment_id  INTEGER PRIMARY KEY,
  reg_no          TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  doctor_id       INTEGER NOT NULL,
  slot_date       TEXT    NOT NULL,
  slot_time       TEXT    NOT NULL,
  mode            TEXT    NOT NULL DEFAULT 'VIDEO' CHECK (mode IN ('VIDEO','IN_PERSON')),
  triage_level    TEXT    NOT NULL DEFAULT 'GREEN' CHECK (triage_level IN ('GREEN','AMBER','RED')),
  chief_complaint TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'BOOKED'
                    CHECK (status IN ('BOOKED','COMPLETED','CANCELLED','NO_SHOW')),
  booked_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  -- composite foreign key onto the weak entity
  FOREIGN KEY (doctor_id, slot_date, slot_time)
    REFERENCES slot(doctor_id, slot_date, slot_time) ON DELETE CASCADE
);

CREATE TABLE appointment_symptom (
  appointment_id INTEGER NOT NULL REFERENCES appointment(appointment_id) ON DELETE CASCADE,
  symptom_id     INTEGER NOT NULL REFERENCES symptom(symptom_id),
  severity       INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
  duration_days  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (appointment_id, symptom_id)
);

CREATE TABLE consultation (
  consultation_id INTEGER PRIMARY KEY,
  appointment_id  INTEGER NOT NULL UNIQUE REFERENCES appointment(appointment_id) ON DELETE CASCADE,
  doctor_id       INTEGER NOT NULL REFERENCES doctor(doctor_id),
  started_at      TEXT    NOT NULL,
  ended_at        TEXT,
  diagnosis       TEXT    NOT NULL,
  clinical_notes  TEXT,
  -- confidentiality modelled at the DB layer (RBAC views filter on this flag)
  is_sensitive    INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0,1)),
  video_room_code TEXT,
  follow_up_date  TEXT
);

CREATE TABLE medical_certificate (
  certificate_id  INTEGER PRIMARY KEY,
  consultation_id INTEGER NOT NULL UNIQUE REFERENCES consultation(consultation_id) ON DELETE CASCADE,
  reg_no          TEXT    NOT NULL REFERENCES student(reg_no),
  issued_by       INTEGER NOT NULL REFERENCES doctor(doctor_id),
  valid_from      TEXT    NOT NULL,
  valid_to        TEXT    NOT NULL,
  reason          TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','VERIFIED','REVOKED')),
  issued_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (valid_to >= valid_from)
);

-- ---------------------------------------------------------------------------
-- MODULE 3 : ACADEMIC CONDONATION  (the health -> academics bridge)
-- ---------------------------------------------------------------------------

CREATE TABLE condonation_request (
  request_id     INTEGER PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES medical_certificate(certificate_id) ON DELETE CASCADE,
  enrollment_id  INTEGER NOT NULL REFERENCES enrollment(enrollment_id) ON DELETE CASCADE,
  faculty_id     INTEGER NOT NULL REFERENCES faculty(faculty_id),
  days_requested INTEGER NOT NULL CHECK (days_requested > 0),
  status         TEXT    NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  raised_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_at     TEXT,
  remarks        TEXT,
  UNIQUE (certificate_id, enrollment_id)
);

-- ---------------------------------------------------------------------------
-- MODULE 4 : PHARMACY & E-COMMERCE
-- ---------------------------------------------------------------------------

CREATE TABLE drug (
  drug_id        INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL UNIQUE,
  generic_name   TEXT    NOT NULL,
  form           TEXT    NOT NULL CHECK (form IN ('TABLET','CAPSULE','SYRUP','INJECTION','OINTMENT','DROPS')),
  strength       TEXT    NOT NULL,
  schedule_class TEXT    NOT NULL CHECK (schedule_class IN ('OTC','H','H1','X')),
  unit_price     REAL    NOT NULL CHECK (unit_price >= 0),
  requires_rx    INTEGER NOT NULL DEFAULT 0 CHECK (requires_rx IN (0,1))
);

-- RECURSIVE RELATIONSHIP : drug <-> drug cross reference ---------------------
CREATE TABLE drug_interaction (
  drug_id        INTEGER NOT NULL REFERENCES drug(drug_id) ON DELETE CASCADE,
  interacts_with INTEGER NOT NULL REFERENCES drug(drug_id) ON DELETE CASCADE,
  severity       TEXT    NOT NULL CHECK (severity IN ('MINOR','MODERATE','SEVERE')),
  description    TEXT    NOT NULL,
  PRIMARY KEY (drug_id, interacts_with),
  CHECK (drug_id <> interacts_with)
);

CREATE TABLE pharmacy (
  pharmacy_id INTEGER PRIMARY KEY,
  campus_id   INTEGER NOT NULL REFERENCES campus(campus_id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  location    TEXT    NOT NULL,
  phone       TEXT    NOT NULL,
  opens_at    TEXT    NOT NULL DEFAULT '08:00',
  closes_at   TEXT    NOT NULL DEFAULT '22:00'
);

CREATE TABLE pharmacist (
  pharmacist_id INTEGER PRIMARY KEY,
  pharmacy_id   INTEGER NOT NULL REFERENCES pharmacy(pharmacy_id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  license_no    TEXT    NOT NULL UNIQUE,
  shift         TEXT    NOT NULL CHECK (shift IN ('MORNING','EVENING','NIGHT'))
);

CREATE TABLE inventory (
  pharmacy_id   INTEGER NOT NULL REFERENCES pharmacy(pharmacy_id) ON DELETE CASCADE,
  drug_id       INTEGER NOT NULL REFERENCES drug(drug_id) ON DELETE CASCADE,
  batch_no      TEXT    NOT NULL,
  qty_on_hand   INTEGER NOT NULL CHECK (qty_on_hand >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 20,
  expiry_date   TEXT    NOT NULL,
  PRIMARY KEY (pharmacy_id, drug_id)
);

CREATE TABLE prescription (
  prescription_id INTEGER PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultation(consultation_id) ON DELETE CASCADE,
  issued_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  advice          TEXT,
  status          TEXT    NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','DISPENSED','EXPIRED'))
);

-- WEAK ENTITY : a prescription line cannot exist without its prescription ----
CREATE TABLE prescription_item (
  prescription_id INTEGER NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
  line_no         INTEGER NOT NULL,
  drug_id         INTEGER NOT NULL REFERENCES drug(drug_id),
  dosage          TEXT    NOT NULL,
  frequency       TEXT    NOT NULL,
  duration_days   INTEGER NOT NULL CHECK (duration_days > 0),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (prescription_id, line_no)
);

CREATE TABLE delivery_address (
  address_id    INTEGER PRIMARY KEY,
  reg_no        TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  campus_id     INTEGER NOT NULL REFERENCES campus(campus_id),
  label         TEXT    NOT NULL,
  hostel_block  TEXT    NOT NULL,
  room_no       TEXT    NOT NULL,
  contact_phone TEXT    NOT NULL,
  is_default    INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1))
);

CREATE TABLE pharmacy_order (
  order_id        INTEGER PRIMARY KEY,
  reg_no          TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  pharmacy_id     INTEGER NOT NULL REFERENCES pharmacy(pharmacy_id),
  address_id      INTEGER NOT NULL REFERENCES delivery_address(address_id),
  prescription_id INTEGER REFERENCES prescription(prescription_id),
  order_type      TEXT    NOT NULL CHECK (order_type IN ('OTC','RX')),
  payment_mode    TEXT    NOT NULL DEFAULT 'COD' CHECK (payment_mode IN ('COD','UPI','CARD')),
  status          TEXT    NOT NULL DEFAULT 'PLACED'
                    CHECK (status IN ('PLACED','PACKED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED')),
  total_amount    REAL    NOT NULL DEFAULT 0,
  placed_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_item (
  order_id   INTEGER NOT NULL REFERENCES pharmacy_order(order_id) ON DELETE CASCADE,
  line_no    INTEGER NOT NULL,
  drug_id    INTEGER NOT NULL REFERENCES drug(drug_id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL    NOT NULL,
  line_total REAL    NOT NULL,
  PRIMARY KEY (order_id, line_no)
);

CREATE TABLE delivery (
  delivery_id   INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL UNIQUE REFERENCES pharmacy_order(order_id) ON DELETE CASCADE,
  agent_name    TEXT    NOT NULL,
  agent_phone   TEXT    NOT NULL,
  dispatched_at TEXT,
  delivered_at  TEXT,
  status        TEXT    NOT NULL DEFAULT 'ASSIGNED'
                  CHECK (status IN ('ASSIGNED','PICKED','IN_TRANSIT','DELIVERED','FAILED'))
);

-- ---------------------------------------------------------------------------
-- MODULE 5 : SECURITY / RBAC  +  SYSTEM EVENT TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE app_role (
  role_id     INTEGER PRIMARY KEY,
  role_name   TEXT    NOT NULL UNIQUE
                CHECK (role_name IN ('STUDENT','DOCTOR','PHARMACIST','FACULTY','ADMIN')),
  description TEXT    NOT NULL
);

CREATE TABLE app_user (
  user_id       INTEGER PRIMARY KEY,
  role_id       INTEGER NOT NULL REFERENCES app_role(role_id),
  username      TEXT    NOT NULL UNIQUE,
  display_name  TEXT    NOT NULL,
  linked_ref    TEXT,
  last_login_at TEXT
);

CREATE TABLE access_audit (
  audit_id   INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES app_user(user_id),
  table_name TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  row_ref    TEXT,
  at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE clinical_alert (
  alert_id            INTEGER PRIMARY KEY,
  prescription_id     INTEGER NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
  drug_id             INTEGER NOT NULL REFERENCES drug(drug_id),
  conflicting_drug_id INTEGER NOT NULL REFERENCES drug(drug_id),
  severity            TEXT    NOT NULL,
  message             TEXT    NOT NULL,
  acknowledged        INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged IN (0,1)),
  raised_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stock_alert (
  stock_alert_id INTEGER PRIMARY KEY,
  pharmacy_id    INTEGER NOT NULL REFERENCES pharmacy(pharmacy_id) ON DELETE CASCADE,
  drug_id        INTEGER NOT NULL REFERENCES drug(drug_id),
  qty_on_hand    INTEGER NOT NULL,
  reorder_level  INTEGER NOT NULL,
  raised_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- every trigger writes here, so the UI can stream DB-level events live
CREATE TABLE trigger_log (
  log_id       INTEGER PRIMARY KEY,
  trigger_name TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  event        TEXT NOT NULL,
  message      TEXT NOT NULL,
  at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- MODULE 6 : CARE LOOP  (cart / notifications / leave documents / video)
-- Everything in this module is written by triggers, not by application code.
-- ---------------------------------------------------------------------------

-- A student's standing cart. Prescribed lines land here automatically (T12);
-- self-service OTC lines are added by the student. Cleared on checkout (T17).
CREATE TABLE cart_item (
  cart_item_id    INTEGER PRIMARY KEY,
  reg_no          TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  drug_id         INTEGER NOT NULL REFERENCES drug(drug_id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  -- RX lines were pushed by a doctor and cannot be edited away by the student
  source          TEXT    NOT NULL DEFAULT 'SELF' CHECK (source IN ('RX','SELF')),
  prescription_id INTEGER REFERENCES prescription(prescription_id) ON DELETE SET NULL,
  dosage          TEXT,
  frequency       TEXT,
  added_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reg_no, drug_id, source)
);

-- In-platform inbox. Rows are raised by triggers so the notification can never
-- drift out of sync with the fact that caused it.
CREATE TABLE notification (
  notification_id INTEGER PRIMARY KEY,
  reg_no          TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  kind            TEXT    NOT NULL CHECK (kind IN
                    ('APPOINTMENT','PRESCRIPTION','ORDER','LEAVE','ALERT')),
  title           TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  ref_table       TEXT,
  ref_id          INTEGER,
  is_read         INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The generated VIT-letterhead medical-leave letter. One per certificate.
CREATE TABLE leave_document (
  document_id     INTEGER PRIMARY KEY,
  certificate_id  INTEGER NOT NULL UNIQUE REFERENCES medical_certificate(certificate_id) ON DELETE CASCADE,
  reg_no          TEXT    NOT NULL REFERENCES student(reg_no) ON DELETE CASCADE,
  issued_by       INTEGER NOT NULL REFERENCES doctor(doctor_id),
  ref_no          TEXT    NOT NULL UNIQUE,
  days_granted    INTEGER NOT NULL CHECK (days_granted > 0),
  valid_from      TEXT    NOT NULL,
  valid_to        TEXT    NOT NULL,
  diagnosis_note  TEXT    NOT NULL,
  advice          TEXT,
  fit_to_resume   TEXT    NOT NULL,
  issued_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- WEAK ENTITY : a delivery row cannot exist without its document. The fan-out
-- to student / proctor / HOD is performed by trigger T15, never by the app.
CREATE TABLE document_recipient (
  document_id   INTEGER NOT NULL REFERENCES leave_document(document_id) ON DELETE CASCADE,
  recipient_role TEXT   NOT NULL CHECK (recipient_role IN ('STUDENT','PROCTOR','HOD')),
  recipient_name TEXT   NOT NULL,
  recipient_email TEXT,
  delivered_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (document_id, recipient_role)
);

-- WebRTC signalling relayed through the database, so the teleconsultation
-- carries no third-party service: both peers poll this table for the room.
CREATE TABLE video_signal (
  signal_id  INTEGER PRIMARY KEY,
  room_code  TEXT    NOT NULL,
  sender     TEXT    NOT NULL CHECK (sender IN ('DOCTOR','STUDENT')),
  kind       TEXT    NOT NULL CHECK (kind IN ('OFFER','ANSWER','ICE','LEAVE')),
  payload    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_student_campus      ON student(campus_id);
CREATE INDEX idx_student_dept        ON student(dept_id);
CREATE INDEX idx_appointment_student ON appointment(reg_no);
CREATE INDEX idx_appointment_slot    ON appointment(doctor_id, slot_date, slot_time);
CREATE INDEX idx_slot_open           ON slot(slot_date, status);
CREATE INDEX idx_cert_student        ON medical_certificate(reg_no, status);
CREATE INDEX idx_condonation_faculty ON condonation_request(faculty_id, status);
CREATE INDEX idx_inventory_low       ON inventory(drug_id, qty_on_hand);
CREATE INDEX idx_order_student       ON pharmacy_order(reg_no, status);
CREATE INDEX idx_enrollment_student  ON enrollment(reg_no, semester);
CREATE INDEX idx_cart_student        ON cart_item(reg_no);
CREATE INDEX idx_notify_student      ON notification(reg_no, is_read);
CREATE INDEX idx_leavedoc_student    ON leave_document(reg_no);
CREATE INDEX idx_signal_room         ON video_signal(room_code, signal_id);
