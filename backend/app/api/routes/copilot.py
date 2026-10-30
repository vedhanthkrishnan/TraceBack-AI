"""TraceBack AI - AI Copilot Endpoints
"""
from fastapi import APIRouter, Request
from backend.app.schemas.common import APIResponse
from backend.app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotStatusResponse
)
from backend.app.copilot.orchestrator import orchestrator
from backend.app.copilot.provider import get_llm_provider
from backend.app.core.config import settings

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])


@router.post("/chat", response_model=APIResponse[CopilotChatResponse])
async def chat_with_copilot(req: CopilotChatRequest, request: Request):
    """Processes questions grounded in actual database evidence and returns judge-ready explanations."""
    response = orchestrator.process_chat(req)
    return APIResponse(data=response, request_id=getattr(request.state, "request_id", None))


@router.get("/status", response_model=APIResponse[CopilotStatusResponse])
async def get_copilot_status(request: Request):
    """Returns Copilot integration status, provider name, and available tools without exposing secrets."""
    provider = get_llm_provider()
    tools = [
        "get_machine_health",
        "get_machine_drift",
        "get_root_cause_evidence",
        "get_historical_matches",
        "compare_machines",
        "get_fleet_risk_summary",
        "explain_risk_methodology"
    ]
    status = CopilotStatusResponse(
        provider=provider.provider_name,
        is_available=True,
        model=settings.LLM_MODEL,
        available_tools=tools,
        mock_fallback_active=not provider.is_configured
    )
    return APIResponse(data=status, request_id=getattr(request.state, "request_id", None))
