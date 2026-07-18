from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, EmailStr


# ── Auth ─────────────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    id_token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class RefreshRequest(BaseModel):
    refresh_token: str


# ── User ──────────────────────────────────────────────────────────────────────

class UserRoleOut(BaseModel):
    role: str
    model_config = {"from_attributes": True}

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    avatar_url: Optional[str]
    roles: List[UserRoleOut]
    is_active: bool
    model_config = {"from_attributes": True}

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    roles: List[str]

class UserRoleAssign(BaseModel):
    roles: List[str]


# ── School ────────────────────────────────────────────────────────────────────

class SchoolOut(BaseModel):
    id: int
    name: str
    logo_url: Optional[str]
    grading_system: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    model_config = {"from_attributes": True}

class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    grading_system: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


# ── AcademicYear / Term ───────────────────────────────────────────────────────

class TermOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    model_config = {"from_attributes": True}

class AcademicYearOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    is_current: bool
    terms: List[TermOut] = []
    model_config = {"from_attributes": True}

class AcademicYearCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_current: bool = False

class TermCreate(BaseModel):
    name: str
    start_date: date
    end_date: date


# ── Class / Section ───────────────────────────────────────────────────────────

class SectionOut(BaseModel):
    id: int
    name: str
    class_id: int
    class_teacher_id: Optional[int]
    model_config = {"from_attributes": True}

class ClassOut(BaseModel):
    id: int
    name: str
    level: int
    sections: List[SectionOut] = []
    model_config = {"from_attributes": True}

class ClassCreate(BaseModel):
    name: str
    level: int

class SectionCreate(BaseModel):
    name: str
    class_id: int
    class_teacher_id: Optional[int] = None


# ── Subject / Room / TimeSlot ─────────────────────────────────────────────────

class SubjectOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    color: str
    model_config = {"from_attributes": True}

class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    color: str = "#4F46E5"

class RoomOut(BaseModel):
    id: int
    name: str
    capacity: Optional[int]
    model_config = {"from_attributes": True}

class RoomCreate(BaseModel):
    name: str
    capacity: Optional[int] = None

class TimeSlotOut(BaseModel):
    id: int
    period_number: int
    start_time: time
    end_time: time
    day_of_week: int
    model_config = {"from_attributes": True}

class TimeSlotCreate(BaseModel):
    period_number: int
    start_time: time
    end_time: time
    day_of_week: int


# ── Timetable ─────────────────────────────────────────────────────────────────

class TimetableEntryOut(BaseModel):
    id: int
    section_id: int
    subject: SubjectOut
    teacher: UserOut
    room: Optional[RoomOut]
    time_slot: TimeSlotOut
    model_config = {"from_attributes": True}

class TimetableEntryCreate(BaseModel):
    section_id: int
    subject_id: int
    teacher_id: int
    room_id: Optional[int] = None
    time_slot_id: int
    academic_year_id: int


# ── TeacherSubjectSection ────────────────────────────────────────────────────

class TSSCreate(BaseModel):
    teacher_id: int
    subject_id: int
    section_id: int
    academic_year_id: int

class TSSOut(BaseModel):
    id: int
    teacher: UserOut
    subject: SubjectOut
    section: SectionOut
    model_config = {"from_attributes": True}


class ClassroomCreate(BaseModel):
    section_id: int
    subject_id: int
    teacher_id: Optional[int] = None
    academic_year_id: int


class ClassroomUpdate(BaseModel):
    teacher_id: Optional[int] = None   # null = unassign


class ClassroomAdminOut(BaseModel):
    """All (section, subject) pairs with optional teacher assignment."""
    id: int                    # = TeacherSubjectSection.id (0 if pairing exists but no teacher)
    section_id: int
    section_name: str
    class_name: str
    subject_id: int
    subject_name: str
    subject_color: str
    academic_year_id: int
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Student ───────────────────────────────────────────────────────────────────

class StudentOut(BaseModel):
    id: int
    user: UserOut
    section: SectionOut
    roll_number: Optional[str]
    admission_number: Optional[str]
    date_of_birth: Optional[date]
    model_config = {"from_attributes": True}

class StudentCreate(BaseModel):
    user_id: int
    section_id: int
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None
    date_of_birth: Optional[date] = None


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceOut(BaseModel):
    id: int
    student_id: int
    section_id: int
    date: date
    status: str          # present | absent | half_day
    remarks: Optional[str]
    model_config = {"from_attributes": True}

class AttendanceDayBulk(BaseModel):
    section_id: int
    date: date
    records: List[dict]  # [{student_id, status, remarks?}]

class AttendanceEdit(BaseModel):
    status: str
    remarks: Optional[str] = None


# ── Classroom ─────────────────────────────────────────────────────────────────

class CommentOut(BaseModel):
    id: int
    author: UserOut
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}

class AssignmentPostOut(BaseModel):
    id: int
    subject: Optional[SubjectOut]
    due_date: Optional[datetime]
    max_marks: int
    is_homework: bool
    model_config = {"from_attributes": True}

class ClassroomOut(BaseModel):
    """Google Classroom-style class card (section × subject pair)."""
    section_id: int
    section_name: str              # e.g. "Grade 9 A"
    section_label: str             # e.g. "9A" (short)
    subject_id: int
    subject_name: str
    subject_color: str
    subject_code: Optional[str] = None
    class_teacher_name: Optional[str] = None
    teacher_name: str              # who actually teaches this subject in section
    last_post_title: Optional[str] = None
    last_post_at: Optional[datetime] = None


class ClassroomPostFileOut(BaseModel):
    id: int
    original_name: str
    file_type: Optional[str]
    size_bytes: int
    mime_type: Optional[str]
    uploaded_by: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class SubmissionFileOut(BaseModel):
    id: int
    original_name: str
    mime_type: Optional[str]
    size_bytes: int
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class ClassroomCommentOut(BaseModel):
    id: int
    author: UserOut
    author_role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content: str


class ClassroomPostOut(BaseModel):
    id: int
    section_id: int
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_color: Optional[str] = None
    author: UserOut
    post_type: str
    title: Optional[str]
    content: Optional[str]
    topic: Optional[str]
    created_at: datetime
    updated_at: datetime
    comments: List[CommentOut] = []
    files: List[ClassroomPostFileOut] = []
    assignment: Optional[AssignmentPostOut] = None
    model_config = {"from_attributes": True}


class ClassroomPostCreate(BaseModel):
    section_id: int
    subject_id: Optional[int] = None
    post_type: str
    title: Optional[str] = None
    content: Optional[str] = None
    topic: Optional[str] = None
    due_date: Optional[datetime] = None
    max_marks: int = 100


# ── Submission ────────────────────────────────────────────────────────────────

class SubmissionOut(BaseModel):
    id: int
    student: StudentOut
    content: Optional[str]
    submitted_at: datetime
    marks_obtained: Optional[float]
    feedback: Optional[str]
    model_config = {"from_attributes": True}

class SubmissionCreate(BaseModel):
    content: Optional[str] = None

class SubmissionGrade(BaseModel):
    marks_obtained: float
    feedback: Optional[str] = None


# ── Marks / Reports ───────────────────────────────────────────────────────────

class MarkOut(BaseModel):
    id: int
    subject: SubjectOut
    term_id: int
    assessment_name: str
    marks_obtained: float
    max_marks: float
    model_config = {"from_attributes": True}

class MarkCreate(BaseModel):
    student_id: int
    subject_id: int
    term_id: int
    assessment_name: str
    marks_obtained: float
    max_marks: float = 100

class MarkBulk(BaseModel):
    subject_id: int
    term_id: int
    assessment_name: str
    max_marks: float = 100
    records: List[dict]  # [{student_id, marks_obtained}]

class RemarkOut(BaseModel):
    id: int
    teacher: UserOut
    subject: Optional[SubjectOut]
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}

class RemarkCreate(BaseModel):
    student_id: int
    term_id: int
    subject_id: Optional[int] = None
    content: str

class ReportOut(BaseModel):
    id: int
    student: StudentOut
    term: TermOut
    overall_grade: Optional[str]
    overall_percentage: Optional[float]
    rank: Optional[int]
    marks: List[MarkOut] = []
    remarks: List[RemarkOut] = []
    model_config = {"from_attributes": True}


# ── Announcements ─────────────────────────────────────────────────────────────

class AnnouncementOut(BaseModel):
    id: int
    author: UserOut
    title: str
    content: str
    scope: str
    section_id: Optional[int]
    priority: str
    created_at: datetime
    model_config = {"from_attributes": True}

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    scope: str
    section_id: Optional[int] = None
    priority: str = "normal"


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskOut(BaseModel):
    id: int
    assignor: UserOut
    assignee: UserOut
    title: str
    description: Optional[str]
    due_date: Optional[datetime]
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}

class TaskCreate(BaseModel):
    assigned_to: int
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    status: str


# ── Events / Calendar ─────────────────────────────────────────────────────────

class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    event_type: str
    start_date: datetime
    end_date: Optional[datetime]
    scope: str
    section_id: Optional[int]
    model_config = {"from_attributes": True}

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str = "school_event"
    start_date: datetime
    end_date: Optional[datetime] = None
    scope: str = "school_wide"
    section_id: Optional[int] = None


# ── Diary ─────────────────────────────────────────────────────────────────────

class DiaryEntryOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    due_date: Optional[datetime]
    subject: Optional[SubjectOut]
    is_completed: bool
    created_at: datetime
    post_id: Optional[int] = None   # set when this entry is a classroom assignment
    model_config = {"from_attributes": True}

class DiaryEntryCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    subject_id: Optional[int] = None

class DiaryEntryUpdate(BaseModel):
    is_completed: bool


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user: UserOut
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}
