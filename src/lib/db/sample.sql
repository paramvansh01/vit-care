-- ============================================================================
-- VIT-CARE  |  SAMPLE DATA  (optional)
-- Demo people and history, loaded only when 'Reset with sample data' is chosen.
-- Runs after reference.sql. Trigger-driven rows (condonation_request,
-- clinical_alert, stock_alert, trigger_log) are intentionally NOT seeded.
-- ============================================================================

-- STUDENT -------------------------------------------------------------------
INSERT INTO student (reg_no, dept_id, campus_id, name, email, phone, dob, gender, blood_group, hostel_block, room_no, year_of_study, proctor_name, proctor_email, proctor_phone, hod_name, hod_email) VALUES
 ('25BCE1001',1,1,'Rahul Nair','rahul.nair2025@vitstudent.ac.in','9800000001','2006-04-12','M','B+','M-Block','412',1,'Dr. Anitha Rajan','anitha.rajan@vit.ac.in','9840011001','Dr. Ramesh Kumar','ramesh.kumar@vit.ac.in'),
 ('25BCE1002',1,1,'Meera Pillai','meera.pillai2025@vitstudent.ac.in','9800000002','2006-09-03','M','O+','M-Block','418',1,'Dr. Anitha Rajan','anitha.rajan@vit.ac.in','9840011001','Dr. Ramesh Kumar','ramesh.kumar@vit.ac.in'),
 ('24BCE1102',1,1,'Ananya Sharma','ananya.sharma2024@vitstudent.ac.in','9812345603','2005-01-22','F','A+','A-Block','207',2,'Dr. Vignesh Babu','vignesh.babu@vit.ac.in','9840011002','Dr. Ramesh Kumar','ramesh.kumar@vit.ac.in'),
 ('24BCE1330',1,1,'Rohan Mehta','rohan.mehta2024@vitstudent.ac.in','9812345604','2005-07-15','M','B-','K-Block','118',2,'Dr. Vignesh Babu','vignesh.babu@vit.ac.in','9840011002','Dr. Ramesh Kumar','ramesh.kumar@vit.ac.in'),
 ('23BCE0871',1,1,'Sneha Iyer','sneha.iyer2023@vitstudent.ac.in','9812345605','2004-11-30','F','AB+','D-Block','305',3,'Dr. Meera Krishnan','meera.krishnan@vit.ac.in','9840011003','Dr. Ramesh Kumar','ramesh.kumar@vit.ac.in'),
 ('23BME0455',2,1,'Karthik Subramanian','karthik.s2023@vitstudent.ac.in','9812345606','2004-03-18','M','O-','J-Block','221',3,'Dr. Prakash Iyer','prakash.iyer@vit.ac.in','9840011004','Dr. Prakash Iyer','prakash.iyer@vit.ac.in'),
 ('24BCE4501',4,2,'Divya Nair','divya.nair2024@vitstudent.ac.in','9812345607','2005-05-09','F','A-','CH-1','109',2,'Dr. Sneha Pillai','sneha.pillai@vit.ac.in','9840011005','Dr. Lakshmi Narayanan','lakshmi.n@vit.ac.in'),
 ('23BCE4210',4,2,'Arjun Venkat','arjun.venkat2023@vitstudent.ac.in','9812345608','2004-08-27','M','B+','CH-2','314',3,'Dr. Sneha Pillai','sneha.pillai@vit.ac.in','9840011005','Dr. Lakshmi Narayanan','lakshmi.n@vit.ac.in'),
 ('24BCE7701',6,3,'Priya Chowdary','priya.c2024@vitap.ac.in','9812345609','2005-02-14','F','O+','AP-Hostel-1','202',2,'Dr. Kiran Reddy','kiran.reddy@vitap.ac.in','9840011006','Dr. Kiran Reddy','kiran.reddy@vitap.ac.in'),
 ('25BCE9012',7,4,'Aditya Verma','aditya.verma2025@vitbhopal.ac.in','9812345610','2006-06-21','M','A+','BPL-A','117',1,'Dr. Amit Shrivastava','amit.s@vitbhopal.ac.in','9840011007','Dr. Amit Shrivastava','amit.s@vitbhopal.ac.in');

-- ENROLLMENT (attendance ledger) --------------------------------------------
INSERT INTO enrollment (enrollment_id, reg_no, course_code, faculty_id, semester, classes_held, classes_attended, condoned_days) VALUES
 (1,'25BCE1001','CSE2003',2,'FALL-2026',45,31,0),
 (2,'25BCE1001','CSE2001',3,'FALL-2026',42,36,0),
 (3,'25BCE1001','MAT2002',5,'FALL-2026',40,29,0),
 (4,'25BCE1002','CSE2003',2,'FALL-2026',45,33,0),
 (5,'25BCE1002','CSE2001',3,'FALL-2026',42,38,0),
 (6,'25BCE1002','CSE2005',4,'FALL-2026',38,27,0),
 (7,'24BCE1102','CSE2003',2,'FALL-2026',45,41,0),
 (8,'24BCE1102','CSE3001',4,'FALL-2026',36,25,0),
 (9,'24BCE1330','CSE2001',3,'FALL-2026',42,30,0),
 (10,'24BCE1330','CSE2005',4,'FALL-2026',38,34,0),
 (11,'23BCE0871','CSE3001',4,'FALL-2026',36,33,0),
 (12,'23BCE0871','CSE2003',2,'FALL-2026',45,35,0),
 (13,'23BME0455','MEE1001',6,'FALL-2026',40,28,0),
 (14,'24BCE4501','CSE2004',8,'FALL-2026',44,39,0),
 (15,'23BCE4210','CSE2004',8,'FALL-2026',44,31,0),
 (16,'24BCE7701','CSE1002',9,'FALL-2026',40,36,0),
 (17,'25BCE9012','CSE1002',10,'FALL-2026',40,29,0);

-- DOCTOR (EER superclass) ---------------------------------------------------
INSERT INTO doctor (doctor_id, campus_id, name, email, reg_council_no, doctor_type, years_experience, consult_fee) VALUES
 (1,1,'Dr. Meenakshi Sundaram','meenakshi.s@vithealth.in','TNMC-44120','GP',14,0),
 (2,1,'Dr. Rajiv Anand','rajiv.anand@vithealth.in','TNMC-51033','GP',8,0),
 (3,1,'Dr. Fatima Sheikh','fatima.sheikh@vithealth.in','TNMC-38874','SPECIALIST',19,250),
 (4,1,'Dr. Nandini Rao','nandini.rao@vithealth.in','RCI-CP-2291','COUNSELOR',11,0),
 (5,2,'Dr. Suresh Balaji','suresh.balaji@vithealth.in','TNMC-47712','GP',10,0),
 (6,2,'Dr. Kavita Menon','kavita.menon@vithealth.in','TNMC-40911','SPECIALIST',16,250),
 (7,3,'Dr. Harish Varma','harish.varma@vithealth.in','APMC-33240','GP',7,0),
 (8,4,'Dr. Neha Trivedi','neha.trivedi@vithealth.in','MPMC-29188','COUNSELOR',9,0);

-- EER SUBCLASSES ------------------------------------------------------------
INSERT INTO gp_doctor (doctor_id, opd_room, panel_size, walk_in_hours) VALUES
 (1,'OPD-101',420,'09:00-13:00'),
 (2,'OPD-102',365,'14:00-18:00'),
 (5,'CH-OPD-01',290,'09:00-13:00'),
 (7,'AP-OPD-01',210,'10:00-14:00');

INSERT INTO specialist_doctor (doctor_id, board_certification, referral_only, tertiary_hospital) VALUES
 (3,'MD Dermatology, DNB',1,'CMC Vellore'),
 (6,'MD General Medicine',1,'Apollo Chennai');

INSERT INTO counselor (doctor_id, therapy_modality, confidentiality_tier, supervised_hours) VALUES
 (4,'Cognitive Behavioural Therapy','SEALED',1200),
 (8,'Solution-Focused Brief Therapy','ELEVATED',760);

INSERT INTO doctor_specialization (doctor_id, spec_id, certified_on, is_primary) VALUES
 (1,1,'2012-06-01',1),
 (1,5,'2016-03-14',0),
 (2,1,'2018-07-20',1),
 (2,6,'2020-01-10',0),
 (3,2,'2008-11-05',1),
 (3,1,'2010-02-18',0),
 (4,3,'2015-08-09',1),
 (5,1,'2016-05-23',1),
 (6,1,'2010-09-30',1),
 (6,6,'2013-04-02',0),
 (7,1,'2019-02-11',1),
 (8,3,'2017-10-16',1);

-- SLOT (weak entity) --------------------------------------------------------
INSERT INTO slot (doctor_id, slot_date, slot_time, mode, status) VALUES
 (1,'2026-09-17','09:00','VIDEO','OPEN'),
 (1,'2026-09-17','09:30','VIDEO','OPEN'),
 (1,'2026-09-17','10:00','VIDEO','OPEN'),
 (1,'2026-09-17','10:30','IN_PERSON','OPEN'),
 (1,'2026-09-18','09:00','VIDEO','OPEN'),
 (1,'2026-09-18','09:30','VIDEO','OPEN'),
 (2,'2026-09-17','14:00','VIDEO','OPEN'),
 (2,'2026-09-17','14:30','VIDEO','OPEN'),
 (2,'2026-09-17','15:00','VIDEO','OPEN'),
 (2,'2026-09-18','14:00','VIDEO','OPEN'),
 (3,'2026-09-17','11:00','VIDEO','OPEN'),
 (3,'2026-09-17','11:30','VIDEO','OPEN'),
 (3,'2026-09-18','11:00','IN_PERSON','OPEN'),
 (4,'2026-09-17','16:00','VIDEO','OPEN'),
 (4,'2026-09-17','16:45','VIDEO','OPEN'),
 (4,'2026-09-18','16:00','VIDEO','OPEN'),
 (5,'2026-09-17','09:00','VIDEO','OPEN'),
 (5,'2026-09-17','09:30','VIDEO','OPEN'),
 (5,'2026-09-18','10:00','VIDEO','OPEN'),
 (6,'2026-09-17','12:00','VIDEO','OPEN'),
 (6,'2026-09-18','12:00','VIDEO','OPEN'),
 (7,'2026-09-17','10:00','VIDEO','OPEN'),
 (7,'2026-09-18','10:00','VIDEO','OPEN'),
 (8,'2026-09-17','15:30','VIDEO','OPEN'),
 (8,'2026-09-18','15:30','VIDEO','OPEN');

-- APPOINTMENT (fires trg_slot_mark_booked) ----------------------------------
INSERT INTO appointment (appointment_id, reg_no, doctor_id, slot_date, slot_time, mode, triage_level, chief_complaint, status, booked_at) VALUES
 (1,'25BCE1001',1,'2026-09-17','09:00','VIDEO','AMBER','High fever with body ache for 3 days','COMPLETED','2026-09-16 21:14:00'),
 (2,'25BCE1002',2,'2026-09-17','14:00','VIDEO','AMBER','Severe stomach pain after mess dinner','COMPLETED','2026-09-16 22:02:00'),
 (3,'24BCE1102',3,'2026-09-17','11:00','VIDEO','GREEN','Persistent skin rash on forearms','COMPLETED','2026-09-16 19:30:00'),
 (4,'24BCE1330',4,'2026-09-17','16:00','VIDEO','AMBER','Exam anxiety and sleeplessness','COMPLETED','2026-09-15 20:45:00'),
 (5,'23BCE0871',1,'2026-09-17','09:30','VIDEO','AMBER','Viral fever, throat pain','COMPLETED','2026-09-16 08:10:00'),
 (6,'23BME0455',1,'2026-09-17','10:00','IN_PERSON','GREEN','Ankle sprain during inter-hostel football','BOOKED','2026-09-17 07:55:00'),
 (7,'24BCE4501',5,'2026-09-17','09:00','VIDEO','GREEN','Recurring migraine before class hours','COMPLETED','2026-09-16 18:20:00'),
 (8,'23BCE4210',6,'2026-09-17','12:00','VIDEO','AMBER','Acid reflux and nausea','COMPLETED','2026-09-16 13:05:00'),
 (9,'24BCE7701',7,'2026-09-17','10:00','VIDEO','GREEN','Dry cough for a week','BOOKED','2026-09-17 06:40:00'),
 (10,'25BCE9012',8,'2026-09-17','15:30','VIDEO','AMBER','Homesickness, low mood','BOOKED','2026-09-16 23:11:00');

INSERT INTO appointment_symptom (appointment_id, symptom_id, severity, duration_days) VALUES
 (1,1,8,3),(1,4,5,3),
 (2,5,7,1),(2,6,6,1),
 (3,7,4,12),
 (4,10,7,14),(4,11,6,14),
 (5,1,6,2),(5,2,5,2),
 (6,12,5,1),
 (7,4,6,30),
 (8,5,6,4),(8,6,4,2),
 (9,3,3,7),
 (10,10,5,21),(10,11,4,21);

-- CONSULTATION (fires trg_sensitive_consultation_audit on sensitive rows) ----
INSERT INTO consultation (consultation_id, appointment_id, doctor_id, started_at, ended_at, diagnosis, clinical_notes, is_sensitive, video_room_code, follow_up_date) VALUES
 (1,1,1,'2026-09-17 09:02','2026-09-17 09:18','Acute viral pyrexia','Temp 102.4F. Advised hydration and rest. Certificate issued for 3 days.',0,'VC-8821-AA','2026-09-20'),
 (2,2,2,'2026-09-17 14:03','2026-09-17 14:21','Acute gastroenteritis','Food-borne. ORS + antispasmodic. Avoid mess food 48h.',0,'VC-9134-BC','2026-09-19'),
 (3,3,3,'2026-09-17 11:01','2026-09-17 11:14','Contact dermatitis','Likely detergent reaction. Topical steroid prescribed.',0,'VC-7710-DE','2026-09-24'),
 (4,4,4,'2026-09-17 16:00','2026-09-17 16:50','Generalised anxiety - exam related','SEALED RECORD. CBT plan initiated, 6 weekly sessions.',1,'VC-5502-ZX','2026-09-24'),
 (5,5,1,'2026-09-17 09:31','2026-09-17 09:44','Viral pharyngitis','Throat congestion, mild fever. 2-day rest advised.',0,'VC-8822-AB','2026-09-19'),
 (6,7,5,'2026-09-17 09:04','2026-09-17 09:19','Migraine without aura','Trigger: skipped breakfast + screen time. Prophylaxis discussed.',0,'VC-3301-CH','2026-10-01'),
 (7,8,6,'2026-09-17 12:02','2026-09-17 12:22','GERD','Lifestyle counselling, PPI course prescribed.',0,'VC-3390-CH','2026-09-30');

-- PRESCRIPTION --------------------------------------------------------------
INSERT INTO prescription (prescription_id, consultation_id, issued_at, advice, status) VALUES
 (1,1,'2026-09-17 09:18','Plenty of fluids. Return if fever persists beyond 3 days.','ACTIVE'),
 (2,2,'2026-09-17 14:21','Bland diet for 48 hours. ORS after every loose motion.','ACTIVE'),
 (3,3,'2026-09-17 11:14','Apply thinly twice daily. Switch to mild detergent.','ACTIVE'),
 (4,6,'2026-09-17 09:19','Take at onset of aura. Maintain headache diary.','ACTIVE'),
 (5,7,'2026-09-17 12:22','Take 30 min before breakfast. Avoid late-night meals.','ACTIVE');

-- PRESCRIPTION ITEM (weak entity; fires trg_drug_interaction_alert) ---------
INSERT INTO prescription_item (prescription_id, line_no, drug_id, dosage, frequency, duration_days, quantity) VALUES
 (1,1,1,'1 tablet','TDS after food',3,9),
 (1,2,9,'1 tablet','OD at bedtime',3,3),
 (1,3,11,'1 tablet','BD after food',3,6),
 (2,1,5,'1 capsule','OD before breakfast',5,5),
 (2,2,6,'1 tablet','BD when pain',3,6),
 (2,3,7,'1 sachet','After each episode',2,6),
 (2,4,17,'1 tablet','SOS for vomiting',2,4),
 (3,1,8,'Thin layer','BD topical',7,1),
 (3,2,9,'1 tablet','OD at bedtime',7,7),
 (4,1,10,'1 tablet','SOS at onset',30,6),
 (4,2,1,'1 tablet','SOS',30,10),
 (5,1,5,'1 capsule','OD before breakfast',14,14),
 (5,2,17,'1 tablet','SOS',7,5);

-- DELIVERY ADDRESS ----------------------------------------------------------
INSERT INTO delivery_address (address_id, reg_no, campus_id, label, hostel_block, room_no, contact_phone, is_default) VALUES
 (1,'25BCE1001',1,'Hostel Room','M-Block','412','9800000001',1),
 (2,'25BCE1002',1,'Hostel Room','M-Block','418','9800000002',1),
 (3,'24BCE1102',1,'Hostel Room','A-Block','207','9812345603',1),
 (4,'24BCE1330',1,'Hostel Room','K-Block','118','9812345604',1),
 (5,'23BCE0871',1,'Hostel Room','D-Block','305','9812345605',1),
 (6,'23BME0455',1,'Hostel Room','J-Block','221','9812345606',1),
 (7,'24BCE4501',2,'Hostel Room','CH-1','109','9812345607',1),
 (8,'23BCE4210',2,'Hostel Room','CH-2','314','9812345608',1),
 (9,'24BCE7701',3,'Hostel Room','AP-Hostel-1','202','9812345609',1),
 (10,'25BCE9012',4,'Hostel Room','BPL-A','117','9812345610',1);

-- PHARMACY ORDERS (fires trg_stock_deduct via order_item) -------------------
INSERT INTO pharmacy_order (order_id, reg_no, pharmacy_id, address_id, prescription_id, order_type, payment_mode, status, total_amount, placed_at) VALUES
 (1,'25BCE1001',1,1,1,'RX','COD','DELIVERED',0,'2026-09-17 09:25:00'),
 (2,'25BCE1002',1,2,2,'RX','COD','OUT_FOR_DELIVERY',0,'2026-09-17 14:30:00'),
 (3,'24BCE1102',1,3,3,'RX','UPI','PACKED',0,'2026-09-17 11:20:00'),
 (4,'23BCE0871',2,5,NULL,'OTC','COD','DELIVERED',0,'2026-09-16 19:40:00'),
 (5,'23BME0455',1,6,NULL,'OTC','COD','PLACED',0,'2026-09-17 08:15:00'),
 (6,'24BCE4501',3,7,4,'RX','COD','PLACED',0,'2026-09-17 09:35:00'),
 (7,'24BCE1330',2,4,NULL,'OTC','COD','DELIVERED',0,'2026-09-16 18:05:00');

INSERT INTO order_item (order_id, line_no, drug_id, quantity, unit_price, line_total) VALUES
 (1,1,1,9,2.20,19.80),
 (1,2,9,3,1.40,4.20),
 (1,3,11,6,2.60,15.60),
 (2,1,5,5,9.40,47.00),
 (2,2,6,6,6.10,36.60),
 (2,3,7,6,18.00,108.00),
 (3,1,8,1,48.00,48.00),
 (3,2,9,7,1.40,9.80),
 (4,1,18,1,96.00,96.00),
 (4,2,2,10,1.80,18.00),
 (5,1,13,1,132.00,132.00),
 (5,2,11,10,2.60,26.00),
 (6,1,1,10,2.20,22.00),
 -- hostel flu wave: this line pulls Betadine Gargle under its reorder level
 -- and makes trg_low_stock_alert fire during seeding.
 (7,1,18,22,96.00,2112.00),
 (7,2,2,12,1.80,21.60);

INSERT INTO delivery (delivery_id, order_id, agent_name, agent_phone, dispatched_at, delivered_at, status) VALUES
 (1,1,'Ravi Kumar','9600011122','2026-09-17 09:50','2026-09-17 10:22','DELIVERED'),
 (2,2,'Suresh M','9600011133','2026-09-17 14:55',NULL,'IN_TRANSIT'),
 (3,4,'Ravi Kumar','9600011122','2026-09-16 20:05','2026-09-16 20:31','DELIVERED'),
 (4,7,'Ganesh K','9600011144','2026-09-16 18:20','2026-09-16 18:52','DELIVERED');

-- MEDICAL CERTIFICATE -------------------------------------------------------
-- #1 and #2 are inserted as DRAFT; verifying them in the UI fires the
-- auto-condonation trigger live. #3 is seeded pre-verified so the pipeline
-- already has history to show.
INSERT INTO medical_certificate (certificate_id, consultation_id, reg_no, issued_by, valid_from, valid_to, reason, status, issued_at) VALUES
 (1,1,'25BCE1001',1,'2026-09-15','2026-09-17','Acute viral pyrexia - bed rest advised','DRAFT','2026-09-17 09:20:00'),
 (2,2,'25BCE1002',2,'2026-09-17','2026-09-18','Acute gastroenteritis - 48h rest','DRAFT','2026-09-17 14:25:00'),
 (3,5,'23BCE0871',1,'2026-09-14','2026-09-16','Viral pharyngitis - rest advised','VERIFIED','2026-09-17 09:45:00'),
 (4,4,'24BCE1330',4,'2026-09-16','2026-09-17','Medical leave advised by counselling services','DRAFT','2026-09-17 16:55:00');

-- Every sample student and doctor gets a login (password "vitcare", hashed by
-- the app on load). Usernames follow the live sign-up rules: a student signs in
-- with their registration number, a doctor with their email.
INSERT INTO app_user (user_id, role_id, username, display_name, linked_ref, last_login_at) VALUES
 (5,3,'ph.selvam','Mr. Selvam R','1','2026-09-17 08:05'),
 (6,4,'prof.ramesh','Dr. Ramesh Kumar','2','2026-09-17 09:10'),
 (7,5,'admin.vitcare','VIT-Care Administrator',NULL,'2026-09-17 07:30');

INSERT INTO app_user (role_id, username, display_name, linked_ref)
SELECT 1, reg_no, name, reg_no FROM student ORDER BY reg_no;

INSERT INTO app_user (role_id, username, display_name, linked_ref)
SELECT 2, LOWER(email), name, CAST(doctor_id AS TEXT) FROM doctor ORDER BY doctor_id;

-- audit_id is left to AUTOINCREMENT: the sensitive-consultation trigger has
-- already written its own rows into this table by the time the seed gets here.
INSERT INTO access_audit (user_id, table_name, action, row_ref, at) VALUES
 (5,'consultation','READ_DENIED','consultation_id=4','2026-09-17 16:58'),
 (6,'medical_certificate','READ','certificate_id=3','2026-09-17 09:50'),
 (7,'v_admin_campus_overview','READ','all','2026-09-17 07:31');

-- ---------------------------------------------------------------------------
-- ROLLING SLOT GENERATION
-- The static slots above anchor the seeded appointments. These are generated
-- relative to date('now') with a recursive CTE so a live demo always has open
-- slots to book, whatever day the database is rebuilt on.
-- ---------------------------------------------------------------------------
WITH RECURSIVE days(n) AS (
  SELECT 0 UNION ALL SELECT n + 1 FROM days WHERE n < 6
),
times(t, mode) AS (
  SELECT '09:00','VIDEO' UNION ALL SELECT '09:30','VIDEO' UNION ALL
  SELECT '10:00','VIDEO' UNION ALL SELECT '10:30','IN_PERSON' UNION ALL
  SELECT '11:00','VIDEO' UNION ALL SELECT '11:30','VIDEO' UNION ALL
  SELECT '14:00','VIDEO' UNION ALL SELECT '14:30','VIDEO' UNION ALL
  SELECT '15:00','VIDEO' UNION ALL SELECT '15:30','IN_PERSON' UNION ALL
  SELECT '16:00','VIDEO'
)
INSERT OR IGNORE INTO slot (doctor_id, slot_date, slot_time, mode, status)
SELECT d.doctor_id, date('now', '+' || days.n || ' day'), times.t, times.mode, 'OPEN'
  FROM doctor d, days, times;
