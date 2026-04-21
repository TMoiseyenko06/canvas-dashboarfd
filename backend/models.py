from pydantic import BaseModel
from typing import Optional


class EstimateOverride(BaseModel):
    assignment_id: int
    hours: float


class CourseCredits(BaseModel):
    credits: float


class AssignmentNote(BaseModel):
    note: str


class SettingsUpdate(BaseModel):
    canvas_base_url: Optional[str] = None
    canvas_api_token: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    wiggle_room_hours: Optional[float] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
