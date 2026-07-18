from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text, Time, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class School(Base):
    __tablename__ = "schools"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    logo_url = Column(String)
    grading_system = Column(String, default="percentage")  # percentage | gpa | cbse
    address = Column(Text)
    phone = Column(String)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    academic_years = relationship("AcademicYear", back_populates="school")
    classes = relationship("Class", back_populates="school")
    subjects = relationship("Subject", back_populates="school")
    rooms = relationship("Room", back_populates="school")
    time_slots = relationship("TimeSlot", back_populates="school")
    events = relationship("Event", back_populates="school")


class AcademicYear(Base):
    __tablename__ = "academic_years"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)

    school = relationship("School", back_populates="academic_years")
    terms = relationship("Term", back_populates="academic_year")
    timetable_entries = relationship("TimetableEntry", back_populates="academic_year")


class Term(Base):
    __tablename__ = "terms"
    id = Column(Integer, primary_key=True, index=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    academic_year = relationship("AcademicYear", back_populates="terms")
    marks = relationship("Mark", back_populates="term")
    reports = relationship("Report", back_populates="term")


class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    level = Column(Integer, nullable=False)

    school = relationship("School", back_populates="classes")
    sections = relationship("Section", back_populates="class_")


class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    name = Column(String, nullable=False)
    class_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    class_ = relationship("Class", back_populates="sections")
    class_teacher = relationship("User", foreign_keys=[class_teacher_id])
    students = relationship("Student", back_populates="section")
    teacher_subject_sections = relationship("TeacherSubjectSection", back_populates="section")
    timetable_entries = relationship("TimetableEntry", back_populates="section")
    classroom_posts = relationship("ClassroomPost", back_populates="section")
    announcements = relationship("Announcement", back_populates="section")


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String)
    color = Column(String, default="#4F46E5")

    school = relationship("School", back_populates="subjects")


class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    capacity = Column(Integer)

    school = relationship("School", back_populates="rooms")


class TimeSlot(Base):
    __tablename__ = "time_slots"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    period_number = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday … 4=Friday

    school = relationship("School", back_populates="time_slots")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    avatar_url = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    student_profile = relationship("Student", back_populates="user", uselist=False)
    teacher_subject_sections = relationship("TeacherSubjectSection", back_populates="teacher")
    audit_logs = relationship("AuditLog", back_populates="user")


class UserRole(Base):
    __tablename__ = "user_roles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # student|teacher|class_teacher|coordinator|principal|tech_admin

    user = relationship("User", back_populates="roles")
    __table_args__ = (UniqueConstraint("user_id", "role"),)


class TeacherSubjectSection(Base):
    __tablename__ = "teacher_subject_sections"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)

    teacher = relationship("User", back_populates="teacher_subject_sections")
    subject = relationship("Subject")
    section = relationship("Section", back_populates="teacher_subject_sections")
    academic_year = relationship("AcademicYear")
    __table_args__ = (UniqueConstraint("teacher_id", "subject_id", "section_id", "academic_year_id"),)


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    roll_number = Column(String)
    admission_number = Column(String, unique=True)
    date_of_birth = Column(Date)

    user = relationship("User", back_populates="student_profile")
    section = relationship("Section", back_populates="students")
    attendances = relationship("Attendance", back_populates="student")
    submissions = relationship("Submission", back_populates="student")
    marks = relationship("Mark", back_populates="student")
    diary_entries = relationship("DiaryEntry", back_populates="student")
    reports = relationship("Report", back_populates="student")


class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # present | absent | half_day
    marked_by = Column(Integer, ForeignKey("users.id"))
    remarks = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="attendances")
    __table_args__ = (UniqueConstraint("student_id", "date"),)


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)

    section = relationship("Section", back_populates="timetable_entries")
    subject = relationship("Subject")
    teacher = relationship("User")
    room = relationship("Room")
    time_slot = relationship("TimeSlot")
    academic_year = relationship("AcademicYear", back_populates="timetable_entries")


class CustomClassroom(Base):
    """A Google-Classroom-style named classroom that is NOT tied to a (section, subject) pair.
    Has its own teacher, roster of students, and stream of posts."""
    __tablename__ = "custom_classrooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    color = Column(String, default="#4F46E5")
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", foreign_keys=[teacher_id])
    academic_year = relationship("AcademicYear")
    students = relationship("CustomClassroomStudent", back_populates="classroom", cascade="all, delete-orphan")
    posts = relationship("ClassroomPost", back_populates="custom_classroom", cascade="all, delete-orphan")


class CustomClassroomStudent(Base):
    """Roster membership for a custom classroom."""
    __tablename__ = "custom_classroom_students"
    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("custom_classrooms.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    classroom = relationship("CustomClassroom", back_populates="students")
    student = relationship("Student")
    __table_args__ = (UniqueConstraint("classroom_id", "student_id"),)


class ClassroomPost(Base):
    __tablename__ = "classroom_posts"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)    # null for custom-classroom posts
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)   # null = legacy / section-wide / custom
    custom_classroom_id = Column(Integer, ForeignKey("custom_classrooms.id", ondelete="CASCADE"), nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_type = Column(String, nullable=False)  # announcement | assignment | material
    title = Column(String)
    content = Column(Text)
    topic = Column(String)
    is_draft = Column(Boolean, default=False)            # teacher draft — not shown to students
    scheduled_at = Column(DateTime, nullable=True)       # publish at this time (null = immediate)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    section = relationship("Section", back_populates="classroom_posts")
    subject = relationship("Subject")
    custom_classroom = relationship("CustomClassroom", back_populates="posts")
    author = relationship("User")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    assignment = relationship("AssignmentPost", back_populates="post", uselist=False, cascade="all, delete-orphan")
    files = relationship("ClassroomPostFile", back_populates="post", cascade="all, delete-orphan")


class AssignmentPost(Base):
    __tablename__ = "assignment_posts"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("classroom_posts.id"), unique=True, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    due_date = Column(DateTime)
    max_marks = Column(Integer, default=100)
    is_homework = Column(Boolean, default=False)

    post = relationship("ClassroomPost", back_populates="assignment")
    subject = relationship("Subject")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")
    diary_entries = relationship("DiaryEntry", back_populates="assignment")


class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignment_posts.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    content = Column(Text)
    file_url = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)   # submitted project link
    submitted_at = Column(DateTime, default=datetime.utcnow)
    marks_obtained = Column(Float, nullable=True)
    feedback = Column(Text)
    marked_done = Column(Boolean, default=False)   # student marked done without submitting work

    assignment = relationship("AssignmentPost", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")
    project = relationship("Project")
    files = relationship("SubmissionFile", back_populates="submission", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)


class PrivateComment(Base):
    """Private conversation between a student and teacher on a specific post."""
    __tablename__ = "private_comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("classroom_posts.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)   # the student the thread belongs to
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("ClassroomPost")
    student = relationship("Student")
    author = relationship("User")


class SubmissionFile(Base):
    """File attached by a student when submitting an assignment."""
    __tablename__ = "submission_files"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)
    mime_type = Column(String)
    size_bytes = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("Submission", back_populates="files")


class ClassroomPostFile(Base):
    """File attached to a classroom post (announcement, assignment, material)."""
    __tablename__ = "classroom_post_files"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("classroom_posts.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)
    mime_type = Column(String)
    file_type = Column(String)        # pdf | docx | image | text | other
    size_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("ClassroomPost", back_populates="files")
    uploader = relationship("User")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("classroom_posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("ClassroomPost", back_populates="comments")
    author = relationship("User")


class Mark(Base):
    __tablename__ = "marks"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    term_id = Column(Integer, ForeignKey("terms.id"), nullable=False)
    assessment_name = Column(String, nullable=False)
    marks_obtained = Column(Float, nullable=False)
    max_marks = Column(Float, default=100)
    entered_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject")
    term = relationship("Term", back_populates="marks")
    __table_args__ = (UniqueConstraint("student_id", "subject_id", "term_id", "assessment_name"),)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    term_id = Column(Integer, ForeignKey("terms.id"), nullable=False)
    overall_grade = Column(String)
    overall_percentage = Column(Float)
    rank = Column(Integer)
    generated_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="reports")
    term = relationship("Term", back_populates="reports")
    remarks = relationship("Remark", back_populates="report", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("student_id", "term_id"),)


class Remark(Base):
    __tablename__ = "remarks"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="remarks")
    teacher = relationship("User")
    subject = relationship("Subject")


class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    scope = Column(String, nullable=False)  # school_wide | class_wide
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    priority = Column(String, default="normal")  # normal | urgent
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User")
    section = relationship("Section", back_populates="announcements")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    due_date = Column(DateTime)
    status = Column(String, default="pending")  # pending | in_progress | completed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignor = relationship("User", foreign_keys=[assigned_by])
    assignee = relationship("User", foreign_keys=[assigned_to])


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    event_type = Column(String, default="school_event")  # holiday | exam | staff_meeting | pd_day | school_event
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    scope = Column(String, default="school_wide")  # school_wide | teacher_only | class
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School", back_populates="events")
    section = relationship("Section")
    creator = relationship("User")


class HomeworkEntry(Base):
    """Teacher-authored classwork/homework for a section, date, and subject."""
    __tablename__ = "homework_entries"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    date = Column(Date, nullable=False)

    # Classwork (what happened in class today)
    classwork_title = Column(String)
    classwork_description = Column(Text)

    # Homework (what students must do)
    homework_title = Column(String)
    homework_description = Column(Text)
    homework_due_date = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    teacher = relationship("User")
    section = relationship("Section")
    subject = relationship("Subject")
    diary_entries = relationship("DiaryEntry", back_populates="homework_entry", cascade="all, delete-orphan")
    files = relationship("HomeworkFile", back_populates="homework_entry", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("section_id", "subject_id", "date"),)


class HomeworkFile(Base):
    """Files attached to a homework entry by the teacher."""
    __tablename__ = "homework_files"
    id = Column(Integer, primary_key=True, index=True)
    homework_entry_id = Column(Integer, ForeignKey("homework_entries.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)
    file_type = Column(String)          # pdf | docx | image | other
    size_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    homework_entry = relationship("HomeworkEntry", back_populates="files")
    uploader = relationship("User")


class DiaryNote(Base):
    """Teacher ↔ parent/student communication notes — the 'Communication Log'."""
    __tablename__ = "diary_notes"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)   # null = whole section
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_role = Column(String, default="teacher")   # teacher | parent | school
    content = Column(Text, nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    section = relationship("Section")
    author = relationship("User")


class DiaryEntry(Base):
    __tablename__ = "diary_entries"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    assignment_id = Column(Integer, ForeignKey("assignment_posts.id"), nullable=True)
    homework_entry_id = Column(Integer, ForeignKey("homework_entries.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    due_date = Column(DateTime)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="diary_entries")
    assignment = relationship("AssignmentPost", back_populates="diary_entries")
    homework_entry = relationship("HomeworkEntry", back_populates="diary_entries")
    subject = relationship("Subject")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    resource_type = Column(String)
    resource_id = Column(Integer)
    details = Column(Text)
    ip_address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")


# ═══════════════════════════════════════════════════════
#  STUDENT TOOLS  (Notes, Progress, Projects, Wellness)
# ═══════════════════════════════════════════════════════

class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Untitled Note")
    content = Column(Text, default="")         # HTML (Quill)
    canvas_data = Column(Text)                  # base64 PNG
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class ProgressLog(Base):
    __tablename__ = "progress_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity = Column(String, nullable=False)
    subject = Column(String, default="")
    duration_minutes = Column(Integer, default=30)
    mastery_score = Column(Integer)             # 0-100, nullable
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    subject = Column(String, default="")
    status = Column(String, default="In Progress")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


# ═══════════════════════════════════════════════════════
#  MESSAGING  (Direct Messages + Group Chats)
# ═══════════════════════════════════════════════════════

class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])


class GroupChat(Base):
    __tablename__ = "group_chats"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("GroupMessage", back_populates="group", cascade="all, delete-orphan")
    events = relationship("GroupEvent", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("GroupChat", back_populates="members")
    user = relationship("User")
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)


class GroupMessage(Base):
    __tablename__ = "group_messages"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("GroupChat", back_populates="messages")
    sender = relationship("User")


class GroupEvent(Base):
    __tablename__ = "group_events"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    event_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("GroupChat", back_populates="events")


# ═══════════════════════════════════════════════════════
#  PROJECT WORKSPACE  (Files, Notes, Activity)
# ═══════════════════════════════════════════════════════

class ProjectFile(Base):
    __tablename__ = "project_files"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String, nullable=False)       # display name
    stored_name = Column(String, nullable=False)         # filename on disk
    file_type = Column(String, nullable=False)           # pdf | html | pptx | docx | image | other
    mime_type = Column(String)
    size_bytes = Column(Integer, default=0)
    is_submitted = Column(Boolean, default=False)        # visible to teacher
    folder = Column(String, default="")                  # optional sub-folder label
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    uploader = relationship("User")


class ProjectNote(Base):
    __tablename__ = "project_notes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Untitled Note")
    content = Column(Text, default="")   # HTML from Quill
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    author = relationship("User")


class ProjectActivity(Base):
    __tablename__ = "project_activities"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)   # e.g. "uploaded file", "created note", "submitted"
    details = Column(Text)                    # JSON or plain text
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    user = relationship("User")


# ═══════════════════════════════════════════════════════
#  WELLNESS  (Counselor chat, Infirmary visits, Mood, Journal)
# ═══════════════════════════════════════════════════════

class CounselorMessage(Base):
    """Private, separate channel between a student and a school counselor."""
    __tablename__ = "counselor_messages"
    id = Column(Integer, primary_key=True, index=True)
    student_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    counselor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)   # who wrote it
    content = Column(Text, nullable=False)
    read_by_counselor = Column(Boolean, default=False)
    read_by_student = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", foreign_keys=[student_user_id])
    counselor = relationship("User", foreign_keys=[counselor_id])
    sender = relationship("User", foreign_keys=[sender_id])


class InfirmaryVisit(Base):
    """A visit to the infirmary, logged by a nurse. Visible to the student."""
    __tablename__ = "infirmary_visits"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    visited_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(String, nullable=False)          # e.g. "Headache", "Fever"
    symptoms = Column(Text)
    treatment = Column(Text)
    notes = Column(Text)
    sent_home = Column(Boolean, default=False)
    follow_up = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    nurse = relationship("User", foreign_keys=[nurse_id])


class MoodCheckin(Base):
    """A student's daily mood check-in (1–5)."""
    __tablename__ = "mood_checkins"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mood = Column(Integer, nullable=False)            # 1 (low) – 5 (great)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class WellnessJournal(Base):
    """Private journal entries a student can keep for reflection."""
    __tablename__ = "wellness_journal"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="")
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class MedicalCondition(Base):
    """A medical condition a student lists about themselves. Visible to nurses and teachers."""
    __tablename__ = "medical_conditions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    condition = Column(String, nullable=False)        # e.g. Asthma, Diabetes, Peanut allergy
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")


class MedicalCertificate(Base):
    """A medical certificate uploaded by a student to justify absence.
    Reviewed (approved/declined) by the class teacher."""
    __tablename__ = "medical_certificates"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    stored_name = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    mime_type = Column(String)
    file_type = Column(String)                         # image | pdf | other
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String, default="pending")        # pending | approved | declined
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    teacher_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
