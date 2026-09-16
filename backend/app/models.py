from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: Optional[str] = "student"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = None
    teacher: Optional[str] = None
    color: Optional[str] = "blue"


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = None
    teacher: Optional[str] = None
    color: Optional[str] = None


class AssignmentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    subject_id: str
    description: Optional[str] = ""
    due_date: str
    priority: Optional[str] = "medium"
    status: Optional[str] = "pending"
    details: Optional[str] = ""
    pdf_filename: Optional[str] = ""
    pdf_text: Optional[str] = ""



class AttendanceCreate(BaseModel):
    subject_id: str
    total_classes: int
    attended_classes: int
    required_percentage: Optional[float] = 75.0


class AttendanceUpdate(BaseModel):
    total_classes: Optional[int] = None
    attended_classes: Optional[int] = None
    required_percentage: Optional[float] = None