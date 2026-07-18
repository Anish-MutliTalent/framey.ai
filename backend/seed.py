"""
Seed script: creates a sample school with classes, subjects, teachers, students,
timetable, announcements, marks, and events.

Run: python seed.py
"""
import os
import sys
from datetime import date, datetime, time, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from database import Base, SessionLocal, engine
import models

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
db = SessionLocal()


def seed():
    # Tables are freshly created by drop_all/create_all above
    print("Schema ready — seeding data…")

    # ── School ────────────────────────────────────────────────────────────────
    school = models.School(
        name="Springfield Academy",
        grading_system="percentage",
        address="123 Education Lane, Springfield",
        phone="+1-555-0100",
        email="admin@springfield.edu",
    )
    db.add(school)
    db.flush()

    # ── Academic Year & Terms ─────────────────────────────────────────────────
    ay = models.AcademicYear(
        school_id=school.id,
        name="2024-25",
        start_date=date(2024, 6, 1),
        end_date=date(2025, 5, 31),
        is_current=True,
    )
    db.add(ay)
    db.flush()

    term1 = models.Term(academic_year_id=ay.id, name="Term 1", start_date=date(2024, 6, 1), end_date=date(2024, 11, 30))
    term2 = models.Term(academic_year_id=ay.id, name="Term 2", start_date=date(2025, 1, 1), end_date=date(2025, 5, 31))
    db.add_all([term1, term2])
    db.flush()

    # ── Subjects ──────────────────────────────────────────────────────────────
    subjects_data = [
        ("Mathematics", "MATH", "#4F46E5"),
        ("English", "ENG", "#7C3AED"),
        ("Science", "SCI", "#059669"),
        ("History", "HIST", "#D97706"),
        ("Computer Science", "CS", "#0EA5E9"),
    ]
    subjects = []
    for name, code, color in subjects_data:
        s = models.Subject(school_id=school.id, name=name, code=code, color=color)
        db.add(s)
        subjects.append(s)
    db.flush()

    # ── Rooms ─────────────────────────────────────────────────────────────────
    rooms = []
    for rname in ["Room 101", "Room 102", "Room 103", "Lab 1", "Gymnasium"]:
        r = models.Room(school_id=school.id, name=rname, capacity=35)
        db.add(r)
        rooms.append(r)
    db.flush()

    # ── Classes & Sections ────────────────────────────────────────────────────
    classes_data = [
        ("Grade 9", 9),
        ("Grade 10", 10),
        ("Grade 11", 11),
    ]
    classes = []
    for cname, level in classes_data:
        c = models.Class(school_id=school.id, name=cname, level=level)
        db.add(c)
        classes.append(c)
    db.flush()

    sections = []
    for cls in classes:
        for sname in ["A", "B"]:
            s = models.Section(class_id=cls.id, name=sname)
            db.add(s)
            sections.append(s)
    db.flush()

    # ── Time Slots ────────────────────────────────────────────────────────────
    period_times = [
        (1, time(8, 0), time(8, 45)),
        (2, time(8, 50), time(9, 35)),
        (3, time(9, 40), time(10, 25)),
        (4, time(10, 40), time(11, 25)),
        (5, time(11, 30), time(12, 15)),
        (6, time(13, 0), time(13, 45)),
        (7, time(13, 50), time(14, 35)),
    ]
    time_slots = []
    for dow in range(5):  # Mon-Fri
        for period, start, end in period_times:
            ts = models.TimeSlot(
                school_id=school.id,
                period_number=period,
                start_time=start,
                end_time=end,
                day_of_week=dow,
            )
            db.add(ts)
            time_slots.append(ts)
    db.flush()

    # ── Users ─────────────────────────────────────────────────────────────────
    # Tech Admin
    tech_admin = models.User(google_id="google_tech_admin_001", email="tech@springfield.edu", name="Tech Admin")
    db.add(tech_admin)
    db.flush()
    db.add(models.UserRole(user_id=tech_admin.id, role="tech_admin"))

    # Principal
    principal = models.User(google_id="google_principal_001", email="principal@springfield.edu", name="Dr. Eleanor Reed")
    db.add(principal)
    db.flush()
    db.add(models.UserRole(user_id=principal.id, role="principal"))

    # Coordinator
    coordinator = models.User(google_id="google_coord_001", email="coordinator@springfield.edu", name="Mr. James Okafor")
    db.add(coordinator)
    db.flush()
    db.add(models.UserRole(user_id=coordinator.id, role="coordinator"))

    # Teachers
    teacher_data = [
        ("google_t1", "alice@springfield.edu", "Ms. Alice Chen", ["teacher"]),
        ("google_t2", "bob@springfield.edu", "Mr. Bob Patel", ["teacher", "class_teacher"]),
        ("google_t3", "carol@springfield.edu", "Mrs. Carol Davis", ["teacher"]),
        ("google_t4", "david@springfield.edu", "Mr. David Kim", ["teacher", "class_teacher"]),
    ]
    teachers = []
    for gid, email, name, roles in teacher_data:
        u = models.User(google_id=gid, email=email, name=name)
        db.add(u)
        db.flush()
        for role in roles:
            db.add(models.UserRole(user_id=u.id, role=role))
        teachers.append(u)
    db.flush()

    # ── Counselors (online school counselors — separate private channel) ──────
    counselor_data = [
        ("google_c1", "counselor1@springfield.edu", "Dr. Elena Foster", ["counselor"]),
        ("google_c2", "counselor2@springfield.edu", "Marcus Chen", ["counselor"]),
    ]
    counselors = []
    for gid, email, name, roles in counselor_data:
        u = models.User(google_id=gid, email=email, name=name)
        db.add(u)
        db.flush()
        for role in roles:
            db.add(models.UserRole(user_id=u.id, role=role))
        counselors.append(u)
    db.flush()

    # ── Nurses (infirmary staff — log infirmary visits) ───────────────────────
    nurse_data = [
        ("google_n1", "nurse1@springfield.edu", "Nurse Priya Rao", ["nurse"]),
        ("google_n2", "nurse2@springfield.edu", "Nurse Tom Alvarez", ["nurse"]),
    ]
    nurses = []
    for gid, email, name, roles in nurse_data:
        u = models.User(google_id=gid, email=email, name=name)
        db.add(u)
        db.flush()
        for role in roles:
            db.add(models.UserRole(user_id=u.id, role=role))
        nurses.append(u)
    db.flush()

    # Assign class teachers to first two sections
    sections[0].class_teacher_id = teachers[1].id
    sections[1].class_teacher_id = teachers[3].id

    # Students (2 per section for demo)
    student_data = [
        ("google_s1", "student1@springfield.edu", "Emma Johnson"),
        ("google_s2", "student2@springfield.edu", "Liam Smith"),
        ("google_s3", "student3@springfield.edu", "Olivia Brown"),
        ("google_s4", "student4@springfield.edu", "Noah Wilson"),
        ("google_s5", "student5@springfield.edu", "Ava Martinez"),
        ("google_s6", "student6@springfield.edu", "William Lee"),
    ]
    student_users = []
    for gid, email, name in student_data:
        u = models.User(google_id=gid, email=email, name=name)
        db.add(u)
        db.flush()
        db.add(models.UserRole(user_id=u.id, role="student"))
        student_users.append(u)
    db.flush()

    # Create student profiles — 3 in section[0] (9A), 3 in section[1] (9B)
    students = []
    for i, u in enumerate(student_users[:3]):
        s = models.Student(
            user_id=u.id,
            section_id=sections[0].id,
            roll_number=str(i + 1),
            admission_number=f"ADM2024{i+1:03d}",
            date_of_birth=date(2009, i + 1, 15),
        )
        db.add(s)
        students.append(s)
    for i, u in enumerate(student_users[3:]):
        s = models.Student(
            user_id=u.id,
            section_id=sections[1].id,
            roll_number=str(i + 1),
            admission_number=f"ADM2024{i+4:03d}",
            date_of_birth=date(2009, i + 4, 15),
        )
        db.add(s)
        students.append(s)
    db.flush()

    # ── Teacher Subject Section assignments ───────────────────────────────────
    # Alice teaches Math to 9A and 9B
    # Bob teaches English to 9A
    # Carol teaches Science to 9A and 9B
    # David teaches CS to 9B
    tss_data = [
        (teachers[0].id, subjects[0].id, sections[0].id),  # Alice - Math - 9A
        (teachers[0].id, subjects[0].id, sections[1].id),  # Alice - Math - 9B
        (teachers[1].id, subjects[1].id, sections[0].id),  # Bob - English - 9A
        (teachers[2].id, subjects[2].id, sections[0].id),  # Carol - Science - 9A
        (teachers[2].id, subjects[2].id, sections[1].id),  # Carol - Science - 9B
        (teachers[3].id, subjects[4].id, sections[1].id),  # David - CS - 9B
    ]
    for teacher_id, subject_id, section_id in tss_data:
        tss = models.TeacherSubjectSection(
            teacher_id=teacher_id,
            subject_id=subject_id,
            section_id=section_id,
            academic_year_id=ay.id,
        )
        db.add(tss)
    db.flush()

    # ── Timetable (partial for section 9A, Mon-Wed) ───────────────────────────
    # Filter slots by day/period for 9A
    def get_slot(day, period):
        return next(ts for ts in time_slots if ts.day_of_week == day and ts.period_number == period)

    timetable_data = [
        # (day, period, subject_idx, teacher_idx, room_idx)
        (0, 1, 0, 0, 0),  # Mon P1 - Math - Alice - R101
        (0, 2, 1, 1, 1),  # Mon P2 - English - Bob - R102
        (0, 3, 2, 2, 2),  # Mon P3 - Science - Carol - Lab1... idx=3
        (1, 1, 0, 0, 0),  # Tue P1 - Math
        (1, 2, 4, 3, 4),  # Tue P2 - CS - David - CS Room
        (2, 1, 1, 1, 1),  # Wed P1 - English
        (2, 2, 2, 2, 3),  # Wed P2 - Science - Carol - Lab1
    ]
    for day, period, subj_idx, teach_idx, room_idx in timetable_data:
        entry = models.TimetableEntry(
            section_id=sections[0].id,
            subject_id=subjects[subj_idx].id,
            teacher_id=teachers[teach_idx].id,
            room_id=rooms[min(room_idx, len(rooms)-1)].id,
            time_slot_id=get_slot(day, period).id,
            academic_year_id=ay.id,
        )
        db.add(entry)
    db.flush()

    # ── Classroom Stream Posts (one per section×subject so every classroom has content) ─

    # ── Grade 9A posts ──
    # Math 9A — Alice — announcement + assignment + material
    math9a_welcome = models.ClassroomPost(
        section_id=sections[0].id, subject_id=subjects[0].id, author_id=teachers[0].id,
        post_type="announcement",
        title="Welcome to Grade 9A Math!",
        content="Hi everyone — I look forward to a great year of problem solving. Please bring your textbook and a notebook to every class.",
    )
    db.add(math9a_welcome); db.flush()

    math9a_assignment = models.ClassroomPost(
        section_id=sections[0].id, subject_id=subjects[0].id, author_id=teachers[0].id,
        post_type="assignment",
        title="Chapter 1 Exercise Set",
        content="Complete exercises 1-20 from Chapter 1. Show all working.",
        topic="Algebra",
    )
    db.add(math9a_assignment); db.flush()
    math9a_assignment_obj = models.AssignmentPost(
        post_id=math9a_assignment.id, subject_id=subjects[0].id,
        due_date=datetime.now() + timedelta(days=7), max_marks=50, is_homework=True,
    )
    db.add(math9a_assignment_obj); db.flush()

    math9a_material = models.ClassroomPost(
        section_id=sections[0].id, subject_id=subjects[0].id, author_id=teachers[0].id,
        post_type="material",
        title="Formula Sheet: Linear Equations",
        content="Reference sheet you can use throughout the term.",
        topic="Algebra",
    )
    db.add(math9a_material); db.flush()

    # Comments on the Math 9A welcome
    db.add(models.Comment(
        post_id=math9a_welcome.id, author_id=students[0].user_id,
        content="Excited for the new year, Ms. Chen!",
    ))
    db.add(models.Comment(
        post_id=math9a_welcome.id, author_id=teachers[0].id,
        content="Welcome back Emma! Looking forward to a great year.",
    ))

    # English 9A — Bob (class teacher) — announcement
    english9a_post = models.ClassroomPost(
        section_id=sections[0].id, subject_id=subjects[1].id, author_id=teachers[1].id,
        post_type="announcement",
        title="Reading List for Term 1",
        content="Please pick up the reading list from the class shelf. We start with 'Animal Farm' next week — make sure you have a copy.",
    )
    db.add(english9a_post); db.flush()

    # Science 9A — Carol — announcement
    science9a_post = models.ClassroomPost(
        section_id=sections[0].id, subject_id=subjects[2].id, author_id=teachers[2].id,
        post_type="announcement",
        title="Lab safety contract — please sign",
        content="Reminder: every student must sign and return the lab safety contract before our first lab session. See the attached PDF.",
    )
    db.add(science9a_post); db.flush()

    # ── Grade 9B posts ──
    # Math 9B — Alice
    math9b_post = models.ClassroomPost(
        section_id=sections[1].id, subject_id=subjects[0].id, author_id=teachers[0].id,
        post_type="announcement",
        title="Welcome to Grade 9B Math",
        content="Welcome — same standards as 9A, different room. Make sure to bring your calculator to every class.",
    )
    db.add(math9b_post); db.flush()

    # Science 9B — Carol
    science9b_post = models.ClassroomPost(
        section_id=sections[1].id, subject_id=subjects[2].id, author_id=teachers[2].id,
        post_type="announcement",
        title="Term 1 overview — Science 9B",
        content="Term 1 we'll cover chemistry basics and forces. Lab schedule attached.",
    )
    db.add(science9b_post); db.flush()

    # CS 9B — David
    cs9b_post = models.ClassroomPost(
        section_id=sections[1].id, subject_id=subjects[4].id, author_id=teachers[3].id,
        post_type="announcement",
        title="Welcome to Computer Science",
        content="Bring your laptop to class. We'll set up a Python environment in week 2.",
    )
    db.add(cs9b_post); db.flush()
    # Student comment on CS post
    db.add(models.Comment(
        post_id=cs9b_post.id, author_id=students[3].user_id,
        content="Do we need to install anything before class?",
    ))

    # Diary entries for students in 9A (kept from original) — for the homework flow
    for student in students[:3]:
        de = models.DiaryEntry(
            student_id=student.id,
            assignment_id=math9a_assignment_obj.id,
            title="Chapter 1 Exercise Set",
            description="Complete exercises 1-20 from Chapter 1.",
            due_date=datetime.now() + timedelta(days=7),
            subject_id=subjects[0].id,
        )
        db.add(de)

    # ── Marks ─────────────────────────────────────────────────────────────────
    assessment_scores = [
        (students[0].id, subjects[0].id, term1.id, "Midterm", 82, 100),
        (students[0].id, subjects[1].id, term1.id, "Midterm", 75, 100),
        (students[0].id, subjects[2].id, term1.id, "Midterm", 90, 100),
        (students[1].id, subjects[0].id, term1.id, "Midterm", 70, 100),
        (students[1].id, subjects[1].id, term1.id, "Midterm", 88, 100),
        (students[2].id, subjects[0].id, term1.id, "Midterm", 95, 100),
        (students[2].id, subjects[2].id, term1.id, "Midterm", 78, 100),
    ]
    for sid, subj_id, term_id, assess, obtained, max_m in assessment_scores:
        db.add(models.Mark(
            student_id=sid,
            subject_id=subj_id,
            term_id=term_id,
            assessment_name=assess,
            marks_obtained=obtained,
            max_marks=max_m,
            entered_by=teachers[0].id,
        ))

    # ── Attendance (day-wise, marked by class teacher) ────────────────────────
    class_teacher_id = teachers[1].id  # Bob is class teacher of 9A
    for day_offset in range(5):  # seed last 5 school days
        att_date = date.today() - timedelta(days=day_offset)
        if att_date.weekday() >= 5:  # skip weekends
            continue
        for i, student in enumerate(students[:3]):
            status = "present" if i < 2 else ("half_day" if day_offset == 0 else "absent")
            db.add(models.Attendance(
                student_id=student.id,
                section_id=sections[0].id,
                date=att_date,
                status=status,
                marked_by=class_teacher_id,
            ))

    # ── Announcements ─────────────────────────────────────────────────────────
    db.add(models.Announcement(
        author_id=principal.id,
        title="Annual Sports Day",
        content="Annual Sports Day will be held on March 15th. All students must participate.",
        scope="school_wide",
        priority="normal",
    ))
    db.add(models.Announcement(
        author_id=coordinator.id,
        title="Parent-Teacher Meeting",
        content="PTM scheduled for next Saturday, 9 AM to 12 PM. All parents are requested to attend.",
        scope="school_wide",
        priority="urgent",
    ))
    db.add(models.Announcement(
        author_id=teachers[1].id,
        title="Homework Reminder",
        content="Please submit your English assignments by Friday.",
        scope="class_wide",
        section_id=sections[0].id,
    ))

    # ── Events ────────────────────────────────────────────────────────────────
    # Use relative dates from today so seeded events always cover "near future"
    days = lambda n: datetime.now() + timedelta(days=n)
    events_data = [
        ("Annual Sports Meet",    "All students participate in the inter-house sports meet.", "school_event",  days(7),  days(8),  "school_wide"),
        ("Unit Test Week",         "Weekly assessments across all subjects.",                  "exam",         days(10), days(14), "school_wide"),
        ("Holiday — Republic Day", "School closed for the national holiday.",                  "holiday",      days(20), days(21), "school_wide"),
        ("Parent-Teacher Meet",     "Quarterly PTM — parents are requested to attend.",         "school_event", days(28), days(28), "school_wide"),
        ("Annual Day",              "Annual school celebration with performances.",            "school_event",  days(45), days(45), "school_wide"),
        ("Science Fair",            "Students present class projects.",                         "school_event",  days(60), days(60), "school_wide"),
        ("Term-end Exams",          "Final exams for the term.",                                "exam",          days(75), days(80), "school_wide"),
        ("Staff PD Day",            "Professional development workshop.",                        "pd_day",        days(35), days(35), "teacher_only"),
        ("Department Meeting",      "Monthly meeting of teaching staff.",                       "staff_meeting", days(14), days(14), "teacher_only"),
    ]
    for title, desc, etype, start, end, scope in events_data:
        db.add(models.Event(
            school_id=school.id,
            title=title,
            description=desc,
            event_type=etype,
            start_date=start,
            end_date=end,
            scope=scope,
            created_by=principal.id,
        ))

    # ── Tasks ─────────────────────────────────────────────────────────────────
    db.add(models.Task(
        assigned_by=coordinator.id,
        assigned_to=teachers[0].id,
        title="Submit Term 1 Grade Report",
        description="Please submit all student grades for Term 1 by end of month.",
        due_date=datetime(2024, 11, 30),
        status="pending",
    ))

    # ── Wellness: a sample infirmary visit + counselor message ────────────────
    db.add(models.InfirmaryVisit(
        student_id=students[0].id, nurse_id=nurses[0].id,
        reason="Headache", symptoms="Mild headache, no fever",
        treatment="Rest + water, paracetamol", notes="Sent back to class after 20 min",
    ))
    db.add(models.CounselorMessage(
        student_user_id=student_users[0].id, counselor_id=counselors[0].id,
        sender_id=student_users[0].id,
        content="Hi Dr. Foster, I've been feeling a bit overwhelmed with exams coming up.",
    ))
    db.add(models.MoodCheckin(user_id=student_users[0].id, mood=3, note="Okay day."))

    db.commit()
    print("Seed complete!")
    print("\nSample user emails (login with Google, these must be your Google accounts):")
    print(f"  Tech Admin:  tech@springfield.edu")
    print(f"  Principal:   principal@springfield.edu")
    print(f"  Coordinator: coordinator@springfield.edu")
    print(f"  Teacher:     alice@springfield.edu (Math teacher)")
    print(f"  Teacher:     bob@springfield.edu (English teacher, class teacher 9A)")
    print(f"  Counselor:   counselor1@springfield.edu (Dr. Elena Foster)")
    print(f"  Nurse:       nurse1@springfield.edu (Nurse Priya Rao)")
    print(f"  Student:     student1@springfield.edu (Emma Johnson, 9A)")
    print(f"  Student:     student4@springfield.edu (Noah Wilson, 9B)")


if __name__ == "__main__":
    seed()
    db.close()
