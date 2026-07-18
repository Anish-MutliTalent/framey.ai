from typing import List


def percentage_to_grade_cbse(pct: float) -> str:
    if pct >= 91:
        return "A1"
    if pct >= 81:
        return "A2"
    if pct >= 71:
        return "B1"
    if pct >= 61:
        return "B2"
    if pct >= 51:
        return "C1"
    if pct >= 41:
        return "C2"
    if pct >= 33:
        return "D"
    return "E"


def percentage_to_gpa(pct: float) -> float:
    if pct >= 90:
        return 4.0
    if pct >= 80:
        return 3.7
    if pct >= 70:
        return 3.3
    if pct >= 60:
        return 3.0
    if pct >= 50:
        return 2.7
    if pct >= 40:
        return 2.3
    if pct >= 33:
        return 2.0
    return 0.0


def percentage_to_letter(pct: float) -> str:
    if pct >= 90:
        return "A+"
    if pct >= 80:
        return "A"
    if pct >= 70:
        return "B+"
    if pct >= 60:
        return "B"
    if pct >= 50:
        return "C"
    if pct >= 40:
        return "D"
    return "F"


def compute_grade(percentage: float, grading_system: str) -> str:
    if grading_system == "cbse":
        return percentage_to_grade_cbse(percentage)
    if grading_system == "gpa":
        return str(percentage_to_gpa(percentage))
    return percentage_to_letter(percentage)


def compute_subject_percentage(marks: List[dict]) -> float:
    """marks: list of {marks_obtained, max_marks}"""
    total_obtained = sum(m["marks_obtained"] for m in marks)
    total_max = sum(m["max_marks"] for m in marks)
    if total_max == 0:
        return 0.0
    return round((total_obtained / total_max) * 100, 2)


def compute_overall_percentage(subject_percentages: List[float]) -> float:
    if not subject_percentages:
        return 0.0
    return round(sum(subject_percentages) / len(subject_percentages), 2)
