"""TraceBack AI - Copilot Request & Response Schemas
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    """Previous exchange turn for bounded conversational context."""
    role: str = Field(description="'user' or 'assistant'")
    content: str


class CopilotChatRequest(BaseModel):
    """User inquiry to the AI Copilot."""
    question: str = Field(min_length=1, max_length=1000, description="The natural language question to ask.")
    machine_id: Optional[str] = Field(default=None, description="Active machine under investigation, if any.")
    conversation_history: Optional[List[ConversationTurn]] = Field(
        default=None,
        description="Bounded previous conversation turns (max 6 turns recommended)."
    )


class EvidenceReference(BaseModel):
    """Evidence source pointer returned by the Copilot."""
    evidence_type: str = Field(description="ROOT_CAUSE, HEALTH_SCORE, SENSOR_DRIFT, HISTORICAL_MATCH")
    sensor_name: Optional[str] = None
    cycle: Optional[int] = None
    metric_value: Optional[float] = None
    detail: str


class CopilotChatResponse(BaseModel):
    """Grounded AI Copilot response."""
    answer: str
    machine_id: Optional[str] = None
    evidence_references: List[EvidenceReference] = []
    suggested_actions: List[str] = []
    limitations: List[str] = []
    provider: str
    model: str
    tokens_used: Optional[int] = None


class CopilotStatusResponse(BaseModel):
    """Operational status of the AI Copilot integration."""
    provider: str
    is_available: bool
    model: str
    available_tools: List[str]
    mock_fallback_active: bool
