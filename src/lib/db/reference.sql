-- ============================================================================
-- VIT-CARE  |  REFERENCE DATA
-- Institutional data a real deployment starts with: campuses, schools, faculty,
-- courses, the drug formulary, campus pharmacies and their stock, symptoms and
-- roles. No students, doctors or appointments - those are created by people
-- using the app (or loaded on demand from sample.sql).
-- ============================================================================

-- CAMPUS --------------------------------------------------------------------
INSERT INTO campus (campus_id, code, name, city, state, established) VALUES
 (1,'VLR','VIT Vellore','Vellore','Tamil Nadu',1984),
 (2,'CHE','VIT Chennai','Chennai','Tamil Nadu',2010),
 (3,'AP','VIT-AP University','Amaravati','Andhra Pradesh',2017),
 (4,'BPL','VIT Bhopal University','Bhopal','Madhya Pradesh',2017);

-- DEPARTMENT ----------------------------------------------------------------
INSERT INTO department (dept_id, campus_id, code, name) VALUES
 (1,1,'SCOPE','School of Computer Science and Engineering'),
 (2,1,'SMEC','School of Mechanical Engineering'),
 (3,1,'SELECT','School of Electrical Engineering'),
 (4,2,'SCOPE','School of Computer Science and Engineering'),
 (5,2,'SENSE','School of Electronics Engineering'),
 (6,3,'SCOPE','School of Computer Science and Engineering'),
 (7,4,'SCOPE','School of Computer Science and Engineering');

-- FACULTY (recursive reports_to hierarchy) ----------------------------------
INSERT INTO faculty (faculty_id, dept_id, reports_to, name, email, designation) VALUES
 (1,1,NULL,'Dr. Saraswathi U','saraswathi.u@vit.ac.in','Dean'),
 (2,1,1,'Dr. Ramesh Kumar','ramesh.kumar@vit.ac.in','HOD'),
 (3,1,2,'Dr. Anitha Rajan','anitha.rajan@vit.ac.in','Professor'),
 (4,1,2,'Dr. Vignesh Babu','vignesh.babu@vit.ac.in','Associate Professor'),
 (5,1,3,'Dr. Meera Krishnan','meera.krishnan@vit.ac.in','Assistant Professor'),
 (6,2,1,'Dr. Prakash Iyer','prakash.iyer@vit.ac.in','Professor'),
 (7,4,NULL,'Dr. Lakshmi Narayanan','lakshmi.n@vit.ac.in','HOD'),
 (8,4,7,'Dr. Sneha Pillai','sneha.pillai@vit.ac.in','Associate Professor'),
 (9,6,NULL,'Dr. Kiran Reddy','kiran.reddy@vitap.ac.in','HOD'),
 (10,7,NULL,'Dr. Amit Shrivastava','amit.s@vitbhopal.ac.in','HOD');

-- COURSE --------------------------------------------------------------------
INSERT INTO course (course_code, dept_id, title, credits) VALUES
 ('CSE2003',1,'Database Management Systems',4),
 ('CSE2001',1,'Data Structures and Algorithms',4),
 ('CSE3001',1,'Software Engineering',3),
 ('CSE2005',1,'Operating Systems',4),
 ('MAT2002',1,'Applications of Differential Equations',4),
 ('MEE1001',2,'Engineering Mechanics',3),
 ('CSE2004',4,'Computer Networks',4),
 ('CSE1002',6,'Problem Solving using Java',4);

-- SPECIALIZATION ------------------------------------------------------------
INSERT INTO specialization (spec_id, name, body_system, description) VALUES
 (1,'General Medicine','Systemic','Primary care, fevers, infections and routine illness'),
 (2,'Dermatology','Integumentary','Skin, hair and nail conditions'),
 (3,'Clinical Psychology','Neuropsychiatric','Counselling, anxiety, depression and exam stress'),
 (4,'Orthopaedics','Musculoskeletal','Sports injuries, fractures and joint pain'),
 (5,'ENT','Respiratory','Ear, nose and throat conditions'),
 (6,'Gastroenterology','Digestive','Mess-food related GI complaints and hyperacidity');

-- SYMPTOM -------------------------------------------------------------------
INSERT INTO symptom (symptom_id, name, body_system, default_triage) VALUES
 (1,'Fever','Systemic','AMBER'),
 (2,'Sore throat','Respiratory','GREEN'),
 (3,'Cough','Respiratory','GREEN'),
 (4,'Headache','Neurological','GREEN'),
 (5,'Abdominal pain','Digestive','AMBER'),
 (6,'Vomiting','Digestive','AMBER'),
 (7,'Skin rash','Integumentary','GREEN'),
 (8,'Breathlessness','Respiratory','RED'),
 (9,'Chest pain','Cardiovascular','RED'),
 (10,'Anxiety / panic','Neuropsychiatric','AMBER'),
 (11,'Sleeplessness','Neuropsychiatric','GREEN'),
 (12,'Ankle sprain','Musculoskeletal','GREEN'),
 (13,'Dehydration','Systemic','AMBER'),
 (14,'Ear pain','Respiratory','GREEN');

-- DRUG ----------------------------------------------------------------------
INSERT INTO drug (drug_id, name, generic_name, form, strength, schedule_class, unit_price, requires_rx) VALUES
 (1,'Dolo 650','Paracetamol','TABLET','650 mg','OTC',2.20,0),
 (2,'Crocin Advance','Paracetamol','TABLET','500 mg','OTC',1.80,0),
 (3,'Azithral 500','Azithromycin','TABLET','500 mg','H',22.50,1),
 (4,'Augmentin 625','Amoxicillin + Clavulanate','TABLET','625 mg','H',18.90,1),
 (5,'Pan-D','Pantoprazole + Domperidone','CAPSULE','40 mg','H',9.40,1),
 (6,'Meftal Spas','Mefenamic acid + Dicyclomine','TABLET','250 mg','H',6.10,1),
 (7,'ORS Orange','Oral Rehydration Salts','SYRUP','21.8 g','OTC',18.00,0),
 (8,'Betnovate-N','Betamethasone + Neomycin','OINTMENT','20 g','H',48.00,1),
 (9,'Cetirizine','Cetirizine HCl','TABLET','10 mg','OTC',1.40,0),
 (10,'Sumatriptan','Sumatriptan Succinate','TABLET','50 mg','H',34.00,1),
 (11,'Ibuprofen 400','Ibuprofen','TABLET','400 mg','OTC',2.60,0),
 (12,'Warfarin','Warfarin Sodium','TABLET','5 mg','H1',12.50,1),
 (13,'Volini Gel','Diclofenac Diethylamine','OINTMENT','30 g','OTC',132.00,0),
 (14,'Benadryl Syrup','Diphenhydramine','SYRUP','100 ml','OTC',124.00,0),
 (15,'Vitamin D3 60K','Cholecalciferol','CAPSULE','60000 IU','OTC',28.00,0),
 (16,'Escitalopram','Escitalopram Oxalate','TABLET','10 mg','H1',16.80,1),
 (17,'Ondansetron','Ondansetron','TABLET','4 mg','H',5.90,1),
 (18,'Betadine Gargle','Povidone Iodine','SYRUP','100 ml','OTC',96.00,0);

-- DRUG INTERACTION (recursive relationship on drug) -------------------------
INSERT INTO drug_interaction (drug_id, interacts_with, severity, description) VALUES
 (11,12,'SEVERE','NSAID with anticoagulant markedly raises GI bleed risk'),
 (12,11,'SEVERE','Anticoagulant with NSAID markedly raises GI bleed risk'),
 (3,12,'MODERATE','Macrolide potentiates anticoagulant effect - monitor INR'),
 (12,3,'MODERATE','Anticoagulant effect potentiated by macrolide - monitor INR'),
 (1,11,'MINOR','Overlapping analgesia - watch cumulative hepatic load'),
 (11,1,'MINOR','Overlapping analgesia - watch cumulative hepatic load'),
 (10,16,'SEVERE','Triptan with SSRI carries serotonin-syndrome risk'),
 (16,10,'SEVERE','SSRI with triptan carries serotonin-syndrome risk'),
 (9,14,'MODERATE','Additive sedation from two antihistamines'),
 (14,9,'MODERATE','Additive sedation from two antihistamines'),
 (5,3,'MINOR','PPI may marginally alter macrolide absorption'),
 (3,5,'MINOR','Macrolide absorption marginally altered by PPI');

-- PHARMACY ------------------------------------------------------------------
INSERT INTO pharmacy (pharmacy_id, campus_id, name, location, phone, opens_at, closes_at) VALUES
 (1,1,'VIT Health Centre Pharmacy','Health Centre, Near Anna Auditorium','0416-220-2001','08:00','22:00'),
 (2,1,'Men''s Hostel Medical Store','MH Foodys Complex','0416-220-2044','09:00','23:00'),
 (3,2,'VIT Chennai Campus Pharmacy','Health Centre Block','044-3993-1100','08:00','21:00'),
 (4,3,'VIT-AP Wellness Pharmacy','Central Block, Ground Floor','0863-237-0100','08:30','21:30'),
 (5,4,'VIT Bhopal Medical Store','Academic Block A','0755-698-0100','09:00','21:00');

INSERT INTO pharmacist (pharmacist_id, pharmacy_id, name, license_no, shift) VALUES
 (1,1,'Mr. Selvam R','TN-PH-88210','MORNING'),
 (2,1,'Ms. Deepa Ravi','TN-PH-91102','EVENING'),
 (3,2,'Mr. Ganesh K','TN-PH-77431','NIGHT'),
 (4,3,'Ms. Revathi S','TN-PH-66019','MORNING'),
 (5,4,'Mr. Naveen Kumar','AP-PH-30221','EVENING'),
 (6,5,'Ms. Pooja Sahu','MP-PH-19087','MORNING');

-- INVENTORY -----------------------------------------------------------------
INSERT INTO inventory (pharmacy_id, drug_id, batch_no, qty_on_hand, reorder_level, expiry_date) VALUES
 (1,1,'B-DL-2411',480,60,'2027-11-30'),
 (1,2,'B-CR-2402',360,50,'2027-08-31'),
 (1,3,'B-AZ-2505',140,30,'2027-05-31'),
 (1,4,'B-AU-2503',95,25,'2027-03-31'),
 (1,5,'B-PD-2508',210,40,'2027-09-30'),
 (1,6,'B-MF-2506',150,30,'2027-06-30'),
 (1,7,'B-OR-2512',260,40,'2028-01-31'),
 (1,8,'B-BN-2504',48,15,'2027-04-30'),
 (1,9,'B-CZ-2510',520,60,'2028-02-28'),
 (1,10,'B-SM-2502',36,12,'2027-02-28'),
 (1,11,'B-IB-2509',300,50,'2027-10-31'),
 (1,12,'B-WF-2501',24,10,'2027-01-31'),
 (1,13,'B-VL-2507',60,15,'2027-07-31'),
 (1,14,'B-BD-2511',44,12,'2027-12-31'),
 (1,15,'B-VD-2506',180,30,'2028-03-31'),
 (1,16,'B-ES-2503',40,12,'2027-03-31'),
 (1,17,'B-ON-2505',120,25,'2027-05-31'),
 (1,18,'B-BG-2508',70,20,'2027-09-30'),
 (2,1,'B-DL-2412',200,40,'2027-11-30'),
 (2,2,'B-CR-2403',150,30,'2027-08-31'),
 (2,7,'B-OR-2513',90,25,'2028-01-31'),
 (2,9,'B-CZ-2511',180,30,'2028-02-28'),
 (2,11,'B-IB-2510',120,30,'2027-10-31'),
 (2,13,'B-VL-2508',28,10,'2027-07-31'),
 (2,15,'B-VD-2507',75,20,'2028-03-31'),
 (2,18,'B-BG-2509',34,12,'2027-09-30'),
 (3,1,'B-DL-2413',310,50,'2027-11-30'),
 (3,3,'B-AZ-2506',88,25,'2027-05-31'),
 (3,5,'B-PD-2509',130,30,'2027-09-30'),
 (3,9,'B-CZ-2512',240,40,'2028-02-28'),
 (3,11,'B-IB-2511',160,30,'2027-10-31'),
 (3,17,'B-ON-2506',70,20,'2027-05-31'),
 (4,1,'B-DL-2414',260,50,'2027-11-30'),
 (4,2,'B-CR-2404',140,30,'2027-08-31'),
 (4,7,'B-OR-2514',110,25,'2028-01-31'),
 (4,9,'B-CZ-2513',190,30,'2028-02-28'),
 (5,1,'B-DL-2415',220,40,'2027-11-30'),
 (5,9,'B-CZ-2514',160,30,'2028-02-28'),
 (5,11,'B-IB-2512',100,25,'2027-10-31'),
 (5,15,'B-VD-2508',60,20,'2028-03-31');

-- RBAC ----------------------------------------------------------------------
INSERT INTO app_role (role_id, role_name, description) VALUES
 (1,'STUDENT','Books appointments, views own records, orders medicine'),
 (2,'DOCTOR','Runs consultations, issues prescriptions and certificates'),
 (3,'PHARMACIST','Fulfils orders; never sees diagnosis or clinical notes'),
 (4,'FACULTY','Approves or rejects condonation requests; sees no diagnosis'),
 (5,'ADMIN','Cross-campus operational oversight and audit');

