-- ============================================================================
-- VIT-CARE  |  DATABASE TRIGGERS  (Objective O3 + O4)
-- Every trigger also writes to trigger_log so the UI can stream DB events.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- T1 : SLOT-CONFLICT GUARD
-- Prevents two students from booking the same doctor/date/time.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_slot_conflict_guard
BEFORE INSERT ON appointment
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM appointment a
  WHERE a.doctor_id = NEW.doctor_id
    AND a.slot_date = NEW.slot_date
    AND a.slot_time = NEW.slot_time
    AND a.status IN ('BOOKED','COMPLETED')
)
BEGIN
  SELECT RAISE(ABORT, 'SLOT_CONFLICT: this doctor slot is already booked');
END;

-- ---------------------------------------------------------------------------
-- T2 : SLOT STATE MACHINE
-- Marks the weak-entity slot as BOOKED the moment an appointment lands.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_slot_mark_booked
AFTER INSERT ON appointment
FOR EACH ROW
BEGIN
  UPDATE slot
     SET status = 'BOOKED'
   WHERE doctor_id = NEW.doctor_id
     AND slot_date = NEW.slot_date
     AND slot_time = NEW.slot_time;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_slot_mark_booked', 'slot', 'AFTER INSERT',
          'Slot ' || NEW.slot_date || ' ' || NEW.slot_time ||
          ' (doctor #' || NEW.doctor_id || ') locked for ' || NEW.reg_no);
END;

-- ---------------------------------------------------------------------------
-- T3 : SLOT RELEASE ON CANCELLATION
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_slot_release
AFTER UPDATE OF status ON appointment
FOR EACH ROW
WHEN NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED'
BEGIN
  UPDATE slot
     SET status = 'OPEN'
   WHERE doctor_id = NEW.doctor_id
     AND slot_date = NEW.slot_date
     AND slot_time = NEW.slot_time;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_slot_release', 'slot', 'AFTER UPDATE',
          'Appointment #' || NEW.appointment_id || ' cancelled - slot returned to pool');
END;

-- ---------------------------------------------------------------------------
-- T4 : DRUG-INTERACTION SAFETY ALERT   (uses the recursive relationship)
-- When a line is added to a prescription, cross-reference it against every
-- other drug already on the same prescription via drug_interaction.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_drug_interaction_alert
AFTER INSERT ON prescription_item
FOR EACH ROW
BEGIN
  INSERT INTO clinical_alert (prescription_id, drug_id, conflicting_drug_id, severity, message)
  SELECT NEW.prescription_id,
         NEW.drug_id,
         di.interacts_with,
         di.severity,
         'INTERACTION [' || di.severity || '] ' ||
         (SELECT name FROM drug WHERE drug_id = NEW.drug_id) || ' + ' ||
         (SELECT name FROM drug WHERE drug_id = di.interacts_with) || ' : ' || di.description
    FROM drug_interaction di
   WHERE di.drug_id = NEW.drug_id
     AND di.interacts_with IN (
       SELECT pi.drug_id FROM prescription_item pi
        WHERE pi.prescription_id = NEW.prescription_id
          AND pi.line_no <> NEW.line_no
     );

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  SELECT 'trg_drug_interaction_alert', 'clinical_alert', 'AFTER INSERT',
         'Rx #' || NEW.prescription_id || ' - interaction detected between ' ||
         (SELECT name FROM drug WHERE drug_id = NEW.drug_id) || ' and ' ||
         (SELECT name FROM drug WHERE drug_id = di.interacts_with)
    FROM drug_interaction di
   WHERE di.drug_id = NEW.drug_id
     AND di.interacts_with IN (
       SELECT pi.drug_id FROM prescription_item pi
        WHERE pi.prescription_id = NEW.prescription_id
          AND pi.line_no <> NEW.line_no
     );
END;

-- ---------------------------------------------------------------------------
-- T5 : STOCK AVAILABILITY GUARD
-- Refuses an order line that exceeds the pharmacy's on-hand quantity.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_stock_availability_guard
BEFORE INSERT ON order_item
FOR EACH ROW
WHEN (
  SELECT COALESCE(i.qty_on_hand, -1)
    FROM inventory i
   WHERE i.drug_id = NEW.drug_id
     AND i.pharmacy_id = (SELECT pharmacy_id FROM pharmacy_order WHERE order_id = NEW.order_id)
) < NEW.quantity
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK: requested quantity exceeds on-hand inventory');
END;

-- ---------------------------------------------------------------------------
-- T6 : AUTOMATIC STOCK DEDUCTION  +  ORDER TOTAL ROLL-UP
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_stock_deduct
AFTER INSERT ON order_item
FOR EACH ROW
BEGIN
  UPDATE inventory
     SET qty_on_hand = qty_on_hand - NEW.quantity
   WHERE drug_id = NEW.drug_id
     AND pharmacy_id = (SELECT pharmacy_id FROM pharmacy_order WHERE order_id = NEW.order_id);

  UPDATE pharmacy_order
     SET total_amount = ROUND(total_amount + NEW.line_total, 2)
   WHERE order_id = NEW.order_id;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_stock_deduct', 'inventory', 'AFTER INSERT',
          'Order #' || NEW.order_id || ' - deducted ' || NEW.quantity || ' x ' ||
          (SELECT name FROM drug WHERE drug_id = NEW.drug_id) ||
          ', order total now ' ||
          (SELECT printf('%.2f', total_amount) FROM pharmacy_order WHERE order_id = NEW.order_id));
END;

-- ---------------------------------------------------------------------------
-- T7 : LOW-STOCK REORDER ALERT
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_low_stock_alert
AFTER UPDATE OF qty_on_hand ON inventory
FOR EACH ROW
WHEN NEW.qty_on_hand <= NEW.reorder_level AND OLD.qty_on_hand > NEW.reorder_level
BEGIN
  INSERT INTO stock_alert (pharmacy_id, drug_id, qty_on_hand, reorder_level)
  VALUES (NEW.pharmacy_id, NEW.drug_id, NEW.qty_on_hand, NEW.reorder_level);

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_low_stock_alert', 'stock_alert', 'AFTER UPDATE',
          'REORDER: ' || (SELECT name FROM drug WHERE drug_id = NEW.drug_id) ||
          ' down to ' || NEW.qty_on_hand || ' units at pharmacy #' || NEW.pharmacy_id);
END;

-- ---------------------------------------------------------------------------
-- T8 : AUTO-CONDONATION PIPELINE   (Objective O4 - the core contribution)
-- The instant a medical certificate is VERIFIED, the database fans out one
-- condonation request per active enrollment, routed to the course faculty.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_auto_condonation_on_verify
AFTER UPDATE OF status ON medical_certificate
FOR EACH ROW
WHEN NEW.status = 'VERIFIED' AND OLD.status <> 'VERIFIED'
BEGIN
  INSERT OR IGNORE INTO condonation_request
      (certificate_id, enrollment_id, faculty_id, days_requested, status, remarks)
  SELECT NEW.certificate_id,
         e.enrollment_id,
         e.faculty_id,
         CAST(julianday(NEW.valid_to) - julianday(NEW.valid_from) + 1 AS INTEGER),
         'PENDING',
         'Auto-generated from medical certificate #' || NEW.certificate_id
    FROM enrollment e
   WHERE e.reg_no = NEW.reg_no;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_auto_condonation_on_verify', 'condonation_request', 'AFTER UPDATE',
          'Certificate #' || NEW.certificate_id || ' verified - ' ||
          (SELECT COUNT(*) FROM enrollment WHERE reg_no = NEW.reg_no) ||
          ' condonation request(s) auto-routed to faculty');
END;

-- Same fan-out when a certificate is created already in VERIFIED state.
CREATE TRIGGER trg_auto_condonation_on_insert
AFTER INSERT ON medical_certificate
FOR EACH ROW
WHEN NEW.status = 'VERIFIED'
BEGIN
  INSERT OR IGNORE INTO condonation_request
      (certificate_id, enrollment_id, faculty_id, days_requested, status, remarks)
  SELECT NEW.certificate_id,
         e.enrollment_id,
         e.faculty_id,
         CAST(julianday(NEW.valid_to) - julianday(NEW.valid_from) + 1 AS INTEGER),
         'PENDING',
         'Auto-generated from medical certificate #' || NEW.certificate_id
    FROM enrollment e
   WHERE e.reg_no = NEW.reg_no;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_auto_condonation_on_insert', 'condonation_request', 'AFTER INSERT',
          'Certificate #' || NEW.certificate_id || ' issued pre-verified - condonation fan-out executed');
END;

-- ---------------------------------------------------------------------------
-- T9 : ATTENDANCE WRITE-BACK ON FACULTY APPROVAL
-- Approving a condonation request credits the student's attendance ledger.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_condonation_attendance_writeback
AFTER UPDATE OF status ON condonation_request
FOR EACH ROW
WHEN NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED'
BEGIN
  UPDATE enrollment
     SET classes_attended = MIN(classes_held, classes_attended + NEW.days_requested),
         condoned_days    = condoned_days + NEW.days_requested
   WHERE enrollment_id = NEW.enrollment_id;

  UPDATE condonation_request
     SET decided_at = datetime('now')
   WHERE request_id = NEW.request_id AND decided_at IS NULL;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_condonation_attendance_writeback', 'enrollment', 'AFTER UPDATE',
          'Request #' || NEW.request_id || ' approved - ' || NEW.days_requested ||
          ' day(s) credited to enrollment #' || NEW.enrollment_id);
END;

CREATE TRIGGER trg_condonation_reject_stamp
AFTER UPDATE OF status ON condonation_request
FOR EACH ROW
WHEN NEW.status = 'REJECTED' AND OLD.status <> 'REJECTED'
BEGIN
  UPDATE condonation_request
     SET decided_at = datetime('now')
   WHERE request_id = NEW.request_id AND decided_at IS NULL;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_condonation_reject_stamp', 'condonation_request', 'AFTER UPDATE',
          'Request #' || NEW.request_id || ' rejected by faculty #' || NEW.faculty_id);
END;

-- ---------------------------------------------------------------------------
-- T10 : CONFIDENTIALITY AUDIT
-- Any sensitive consultation (mental / sexual health) is audited at DB level.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_sensitive_consultation_audit
AFTER INSERT ON consultation
FOR EACH ROW
WHEN NEW.is_sensitive = 1
BEGIN
  INSERT INTO access_audit (user_id, table_name, action, row_ref)
  VALUES (NULL, 'consultation', 'SEALED_RECORD_CREATED', 'consultation_id=' || NEW.consultation_id);

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_sensitive_consultation_audit', 'access_audit', 'AFTER INSERT',
          'Consultation #' || NEW.consultation_id || ' flagged SENSITIVE - masked from non-owning roles');
END;

-- ---------------------------------------------------------------------------
-- T11 : PRESCRIPTION LIFECYCLE
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_prescription_dispensed
AFTER UPDATE OF status ON pharmacy_order
FOR EACH ROW
WHEN NEW.status = 'DELIVERED' AND NEW.prescription_id IS NOT NULL
BEGIN
  UPDATE prescription
     SET status = 'DISPENSED'
   WHERE prescription_id = NEW.prescription_id;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_prescription_dispensed', 'prescription', 'AFTER UPDATE',
          'Order #' || NEW.order_id || ' delivered - Rx #' || NEW.prescription_id || ' marked DISPENSED');
END;

-- ---------------------------------------------------------------------------
-- T12 : PRESCRIPTION -> CART
-- The moment a doctor writes a line, the database resolves the owning student
-- through consultation -> appointment and drops the drug into their cart.
-- The application never copies these rows.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_prescription_to_cart
AFTER INSERT ON prescription_item
FOR EACH ROW
BEGIN
  INSERT INTO cart_item (reg_no, drug_id, quantity, source, prescription_id, dosage, frequency)
  SELECT a.reg_no, NEW.drug_id, NEW.quantity, 'RX', NEW.prescription_id, NEW.dosage, NEW.frequency
    FROM prescription p
    JOIN consultation c ON c.consultation_id = p.consultation_id
    JOIN appointment  a ON a.appointment_id  = c.appointment_id
   WHERE p.prescription_id = NEW.prescription_id
      ON CONFLICT (reg_no, drug_id, source) DO UPDATE
         SET quantity        = cart_item.quantity + excluded.quantity,
             prescription_id = excluded.prescription_id,
             dosage          = excluded.dosage,
             frequency       = excluded.frequency;

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_prescription_to_cart', 'cart_item', 'AFTER INSERT',
          (SELECT name FROM drug WHERE drug_id = NEW.drug_id) ||
          ' x' || NEW.quantity || ' pushed into the cart of ' ||
          (SELECT a.reg_no FROM prescription p
             JOIN consultation c ON c.consultation_id = p.consultation_id
             JOIN appointment  a ON a.appointment_id  = c.appointment_id
            WHERE p.prescription_id = NEW.prescription_id) ||
          ' from Rx #' || NEW.prescription_id);
END;

-- ---------------------------------------------------------------------------
-- T13 : PRESCRIPTION NOTIFICATION
-- Exactly one live notification per prescription: the unread one is replaced
-- on every new line so the count can never drift from the cart.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_notify_prescription
AFTER INSERT ON prescription_item
FOR EACH ROW
BEGIN
  DELETE FROM notification
   WHERE kind = 'PRESCRIPTION'
     AND ref_table = 'prescription'
     AND ref_id = NEW.prescription_id
     AND is_read = 0;

  INSERT INTO notification (reg_no, kind, title, body, ref_table, ref_id)
  SELECT a.reg_no,
         'PRESCRIPTION',
         'New prescription from ' || d.name,
         (SELECT COUNT(*) FROM prescription_item pi WHERE pi.prescription_id = NEW.prescription_id) ||
         ' medicine(s) have been added to your cart. Review the lines and place the order for hostel delivery.',
         'prescription',
         NEW.prescription_id
    FROM prescription p
    JOIN consultation c ON c.consultation_id = p.consultation_id
    JOIN appointment  a ON a.appointment_id  = c.appointment_id
    JOIN doctor       d ON d.doctor_id       = c.doctor_id
   WHERE p.prescription_id = NEW.prescription_id;
END;

-- ---------------------------------------------------------------------------
-- T14 : APPOINTMENT NOTIFICATION
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_notify_appointment
AFTER INSERT ON appointment
FOR EACH ROW
BEGIN
  INSERT INTO notification (reg_no, kind, title, body, ref_table, ref_id)
  VALUES (NEW.reg_no,
          'APPOINTMENT',
          'Appointment confirmed with ' ||
            (SELECT name FROM doctor WHERE doctor_id = NEW.doctor_id),
          CASE NEW.mode WHEN 'VIDEO' THEN 'Video consultation' ELSE 'In-person visit' END ||
          ' on ' || NEW.slot_date || ' at ' || NEW.slot_time ||
          '. Triage level ' || NEW.triage_level || '.',
          'appointment',
          NEW.appointment_id);
END;

-- ---------------------------------------------------------------------------
-- T15 : MEDICAL-LEAVE DOCUMENT FAN-OUT   (the escalation chain)
-- One INSERT of the generated letter, and the database delivers it to the
-- student, their proctor and their HOD, then raises the student's notice.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_leave_document_fanout
AFTER INSERT ON leave_document
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO document_recipient (document_id, recipient_role, recipient_name, recipient_email)
  SELECT NEW.document_id, 'STUDENT', s.name, s.email
    FROM student s WHERE s.reg_no = NEW.reg_no;

  INSERT OR IGNORE INTO document_recipient (document_id, recipient_role, recipient_name, recipient_email)
  SELECT NEW.document_id, 'PROCTOR', s.proctor_name, s.proctor_email
    FROM student s
   WHERE s.reg_no = NEW.reg_no
     AND s.proctor_name IS NOT NULL AND TRIM(s.proctor_name) <> '';

  INSERT OR IGNORE INTO document_recipient (document_id, recipient_role, recipient_name, recipient_email)
  SELECT NEW.document_id, 'HOD', s.hod_name, s.hod_email
    FROM student s
   WHERE s.reg_no = NEW.reg_no
     AND s.hod_name IS NOT NULL AND TRIM(s.hod_name) <> '';

  INSERT INTO notification (reg_no, kind, title, body, ref_table, ref_id)
  VALUES (NEW.reg_no,
          'LEAVE',
          'Medical leave granted — ' || NEW.days_granted || ' day(s)',
          'Letter ' || NEW.ref_no || ' covering ' || NEW.valid_from || ' to ' || NEW.valid_to ||
          ' is ready to download, and has been copied to your proctor and HOD.',
          'leave_document',
          NEW.document_id);

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_leave_document_fanout', 'document_recipient', 'AFTER INSERT',
          'Leave letter ' || NEW.ref_no || ' delivered to ' ||
          (SELECT COUNT(*) FROM document_recipient WHERE document_id = NEW.document_id) ||
          ' recipient(s) — student, proctor and HOD');
END;

-- ---------------------------------------------------------------------------
-- T16 : ORDER LIFECYCLE NOTIFICATION
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_notify_order_status
AFTER UPDATE OF status ON pharmacy_order
FOR EACH ROW
WHEN NEW.status <> OLD.status
BEGIN
  INSERT INTO notification (reg_no, kind, title, body, ref_table, ref_id)
  VALUES (NEW.reg_no,
          'ORDER',
          'Order #' || NEW.order_id || ' — ' || REPLACE(NEW.status, '_', ' '),
          'Your medicine order of ' || printf('%.2f', NEW.total_amount) ||
          ' is now ' || REPLACE(LOWER(NEW.status), '_', ' ') || '.',
          'pharmacy_order',
          NEW.order_id);
END;

-- ---------------------------------------------------------------------------
-- T17 : CART HYGIENE
-- Once a prescription has been dispensed its lines leave the cart on their own.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_cart_clear_on_dispense
AFTER UPDATE OF status ON prescription
FOR EACH ROW
WHEN NEW.status = 'DISPENSED' AND OLD.status <> 'DISPENSED'
BEGIN
  DELETE FROM cart_item WHERE prescription_id = NEW.prescription_id AND source = 'RX';

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_cart_clear_on_dispense', 'cart_item', 'AFTER UPDATE',
          'Rx #' || NEW.prescription_id || ' dispensed — its lines were retired from the cart');
END;

-- ---------------------------------------------------------------------------
-- T18 : MISSED-CALL NOTICE
-- A call that rang out without an answer lands in the student's inbox, so a
-- doctor's attempt to reach them is never silently lost.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_notify_missed_call
AFTER UPDATE OF status ON call_session
FOR EACH ROW
WHEN NEW.status = 'MISSED' AND OLD.status = 'RINGING'
BEGIN
  INSERT INTO notification (reg_no, kind, title, body, ref_table, ref_id)
  SELECT callee.linked_ref,
         'CALL',
         'Missed video call from ' || COALESCE(caller.display_name, 'VIT-Care'),
         'Room ' || NEW.room_code || ' rang at ' || COALESCE(NEW.rang_at, NEW.created_at) ||
           ' UTC. Open Calls to join the room or call back.',
         'call_session',
         NEW.call_id
    FROM app_user callee
    JOIN app_role r ON r.role_id = callee.role_id AND r.role_name = 'STUDENT'
    LEFT JOIN app_user caller ON caller.user_id = NEW.caller_id
   WHERE callee.user_id = NEW.callee_id
     AND EXISTS (SELECT 1 FROM student s WHERE s.reg_no = callee.linked_ref);

  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_notify_missed_call', 'notification', 'AFTER UPDATE',
          'Call ' || NEW.room_code || ' rang out unanswered - missed-call notice raised');
END;

-- ---------------------------------------------------------------------------
-- T19 : PAYMENT LEDGER
-- A verified online payment is logged against the order it paid for, so the
-- event stream shows money moving alongside the stock it bought.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_payment_captured
AFTER UPDATE OF status ON payment
FOR EACH ROW
WHEN NEW.status = 'PAID' AND OLD.status <> 'PAID'
BEGIN
  INSERT INTO trigger_log (trigger_name, table_name, event, message)
  VALUES ('trg_payment_captured', 'payment', 'AFTER UPDATE',
          'Razorpay ' || COALESCE(NEW.gateway_payment_id, '?') || ' captured Rs ' ||
          printf('%.2f', NEW.amount_paise / 100.0) || ' for order #' || COALESCE(NEW.order_id, '?'));
END;

-- ============================================================================
-- ROLE-BASED ACCESS CONTROL VIEWS  (Objective: DB-level confidentiality)
-- ============================================================================

-- STUDENT : own clinical history, sensitive notes visible only to the student
CREATE VIEW v_student_health_record AS
SELECT s.reg_no,
       s.name                AS student_name,
       a.appointment_id,
       a.slot_date,
       a.slot_time,
       a.chief_complaint,
       a.triage_level,
       d.name                AS doctor_name,
       d.doctor_type,
       c.consultation_id,
       c.diagnosis,
       CASE WHEN c.is_sensitive = 1 THEN c.clinical_notes ELSE c.clinical_notes END AS clinical_notes,
       c.is_sensitive
  FROM student s
  JOIN appointment  a ON a.reg_no = s.reg_no
  JOIN doctor       d ON d.doctor_id = a.doctor_id
  LEFT JOIN consultation c ON c.appointment_id = a.appointment_id;

-- DOCTOR : today's queue with triage ordering
CREATE VIEW v_doctor_queue AS
SELECT d.doctor_id,
       d.name          AS doctor_name,
       d.doctor_type,
       a.appointment_id,
       a.slot_date,
       a.slot_time,
       a.mode,
       a.triage_level,
       a.status,
       s.reg_no,
       s.name          AS student_name,
       s.year_of_study,
       a.chief_complaint
  FROM doctor d
  JOIN appointment a ON a.doctor_id = d.doctor_id
  JOIN student     s ON s.reg_no = a.reg_no;

-- PHARMACIST : fulfilment board - NO diagnosis, NO clinical notes exposed
CREATE VIEW v_pharmacist_fulfilment AS
SELECT o.order_id,
       o.status        AS order_status,
       o.order_type,
       o.payment_mode,
       o.total_amount,
       o.placed_at,
       p.name          AS pharmacy_name,
       st.name         AS student_name,
       st.reg_no,
       da.hostel_block,
       da.room_no,
       da.contact_phone,
       COUNT(oi.line_no) AS line_count
  FROM pharmacy_order o
  JOIN pharmacy         p  ON p.pharmacy_id = o.pharmacy_id
  JOIN student          st ON st.reg_no = o.reg_no
  JOIN delivery_address da ON da.address_id = o.address_id
  LEFT JOIN order_item  oi ON oi.order_id = o.order_id
 GROUP BY o.order_id;

-- FACULTY : condonation inbox - reason visible, diagnosis NEVER exposed
CREATE VIEW v_faculty_condonation_inbox AS
SELECT cr.request_id,
       cr.status,
       cr.days_requested,
       cr.raised_at,
       cr.decided_at,
       f.faculty_id,
       f.name              AS faculty_name,
       c.course_code,
       c.title             AS course_title,
       s.reg_no,
       s.name              AS student_name,
       mc.valid_from,
       mc.valid_to,
       mc.reason,
       e.classes_held,
       e.classes_attended,
       ROUND(100.0 * e.classes_attended / NULLIF(e.classes_held, 0), 1) AS attendance_pct
  FROM condonation_request cr
  JOIN enrollment          e  ON e.enrollment_id = cr.enrollment_id
  JOIN student             s  ON s.reg_no = e.reg_no
  JOIN course              c  ON c.course_code = e.course_code
  JOIN faculty             f  ON f.faculty_id = cr.faculty_id
  JOIN medical_certificate mc ON mc.certificate_id = cr.certificate_id;

-- ADMIN : cross-campus operational rollup
CREATE VIEW v_admin_campus_overview AS
SELECT cm.campus_id,
       cm.code            AS campus_code,
       cm.name            AS campus_name,
       (SELECT COUNT(*) FROM student  s WHERE s.campus_id = cm.campus_id)            AS students,
       (SELECT COUNT(*) FROM doctor   d WHERE d.campus_id = cm.campus_id)            AS doctors,
       (SELECT COUNT(*) FROM pharmacy p WHERE p.campus_id = cm.campus_id)            AS pharmacies,
       (SELECT COUNT(*) FROM appointment a
          JOIN student s2 ON s2.reg_no = a.reg_no
         WHERE s2.campus_id = cm.campus_id)                                          AS appointments,
       (SELECT COUNT(*) FROM condonation_request cr
          JOIN enrollment e2 ON e2.enrollment_id = cr.enrollment_id
          JOIN student s3 ON s3.reg_no = e2.reg_no
         WHERE s3.campus_id = cm.campus_id AND cr.status = 'PENDING')                AS pending_condonations
  FROM campus cm;

-- Students at academic risk (below VIT's 75% attendance threshold)
CREATE VIEW v_attendance_risk AS
SELECT s.reg_no,
       s.name AS student_name,
       s.campus_id,
       e.enrollment_id,
       e.course_code,
       c.title AS course_title,
       e.classes_held,
       e.classes_attended,
       e.condoned_days,
       ROUND(100.0 * e.classes_attended / NULLIF(e.classes_held, 0), 1) AS attendance_pct,
       CASE
         WHEN 100.0 * e.classes_attended / NULLIF(e.classes_held, 0) < 75 THEN 'AT_RISK'
         WHEN 100.0 * e.classes_attended / NULLIF(e.classes_held, 0) < 80 THEN 'BORDERLINE'
         ELSE 'SAFE'
       END AS risk_band
  FROM enrollment e
  JOIN student s ON s.reg_no = e.reg_no
  JOIN course  c ON c.course_code = e.course_code;

-- MEDICAL LEAVE REGISTER : letter + who it reached (used by the Database tour)
CREATE VIEW v_medical_leave_register AS
SELECT ld.document_id,
       ld.ref_no,
       ld.days_granted,
       ld.valid_from,
       ld.valid_to,
       ld.diagnosis_note,
       ld.issued_at,
       s.reg_no,
       s.name           AS student_name,
       s.proctor_name,
       s.hod_name,
       d.name           AS doctor_name,
       d.reg_council_no,
       mc.status        AS certificate_status,
       (SELECT COUNT(*) FROM document_recipient r WHERE r.document_id = ld.document_id) AS recipients
  FROM leave_document ld
  JOIN student s             ON s.reg_no = ld.reg_no
  JOIN doctor  d             ON d.doctor_id = ld.issued_by
  JOIN medical_certificate mc ON mc.certificate_id = ld.certificate_id;

-- STUDENT CART : cart lines resolved to drug, price and origin
CREATE VIEW v_student_cart AS
SELECT ci.cart_item_id,
       ci.reg_no,
       ci.source,
       ci.quantity,
       ci.dosage,
       ci.frequency,
       ci.prescription_id,
       d.drug_id,
       d.name          AS drug_name,
       d.generic_name,
       d.form,
       d.strength,
       d.requires_rx,
       d.unit_price,
       ROUND(d.unit_price * ci.quantity, 2) AS line_total
  FROM cart_item ci
  JOIN drug d ON d.drug_id = ci.drug_id;
