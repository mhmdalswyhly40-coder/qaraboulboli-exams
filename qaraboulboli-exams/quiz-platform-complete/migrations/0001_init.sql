PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 1800,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option INTEGER NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  question_ids_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percentage REAL NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON exam_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_subject ON results(subject_id, created_at DESC);

INSERT OR IGNORE INTO subjects (id, name, description, duration_seconds) VALUES
 ('general', 'ثقافة عامة', 'أسئلة عامة ومعلومات أساسية', 1800),
 ('sql', 'قواعد البيانات SQL', 'مفاهيم قواعد البيانات والاستعلامات', 1800),
 ('vb', 'برمجة VB.NET', 'أساسيات البرمجة وبيئة VB.NET', 1800),
 ('network', 'شبكات الحاسوب', 'مفاهيم الشبكات وعناوين IP', 1800);

INSERT OR IGNORE INTO questions
(id, subject_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation)
VALUES
('g1','general','ما لغة بناء هيكل صفحة الويب؟','HTML','SQL','Python','C++',0,'تُستخدم HTML لوصف بنية الصفحة.'),
('g2','general','أي مما يلي يُعد نظام تشغيل؟','MySQL','Linux','HTML','CSS',1,'Linux نظام تشغيل.'),
('s1','sql','ما الأمر المستخدم لاسترجاع بيانات من جدول؟','INSERT','UPDATE','SELECT','DELETE',2,'SELECT يُستخدم لاستعلام البيانات.'),
('s2','sql','ما وظيفة المفتاح الأساسي Primary Key؟','تكرار الصفوف','تمييز كل سجل بشكل فريد','تشفير الجدول','حذف الجدول',1,'يعرّف كل سجل تعريفًا فريدًا.'),
('v1','vb','أي كلمة تُستخدم لتعريف متغير في VB.NET؟','Dim','var فقط','let','define',0,'Dim تُستخدم لتعريف متغير.'),
('v2','vb','ما نوع البيانات المناسب للقيمة True أو False؟','String','Boolean','Date','Decimal',1,'Boolean يمثل قيمة منطقية.'),
('n1','network','أي بروتوكول يُستخدم لتصفح مواقع الويب الآمنة؟','FTP','HTTPS','SMTP','ARP',1,'HTTPS يوفّر اتصال ويب مشفرًا.'),
('n2','network','أي عنوان يقع ضمن النطاق الخاص 192.168.0.0/16؟','192.168.1.10','8.8.8.8','1.1.1.1','200.1.1.1',0,'العناوين من 192.168.0.0 إلى 192.168.255.255 خاصة.');
