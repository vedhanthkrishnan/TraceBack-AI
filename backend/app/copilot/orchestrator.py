"""TraceBack AI - Copilot Orchestrator

Routes user questions, invokes safe analytical tools, injects grounded evidence,
and invokes the configured LLM provider to construct judge-ready answers.
"""
import re
from typing import Dict, List, Optional, Any
from backend.app.core.config import settings
from backend.app.copilot.provider import get_llm_provider
from backend.app.copilot.tools import CopilotTools
from backend.app.copilot.safety import CopilotSafetyFilter, EvidenceFormatter
from backend.app.copilot.prompts import COPILOT_SYSTEM_PROMPT
from backend.app.services.recommendation_service import RecommendationService
from backend.app.schemas.copilot import CopilotChatRequest, CopilotChatResponse, EvidenceReference
from backend.app.core.exceptions import MachineNotFoundError
from backend.app.core.logging import logger


class CopilotOrchestrator:
    def __init__(self):
        self.tools = CopilotTools()
        self.provider = get_llm_provider()

    def process_chat(self, req: CopilotChatRequest) -> CopilotChatResponse:
        """Processes conversational inquiry with grounded evidence retrieval."""
        clean_question = CopilotSafetyFilter.sanitize_user_query(req.question)
        machine_id = req.machine_id

        # If machine_id not in request body, attempt regex extraction from question text (e.g. "M104", "Machine 104")
        if not machine_id:
            match = re.search(r"\b(?:machine|engine|unit|m)\s*([0-9]{1,4}|m[0-9]{1,4})\b", clean_question, re.IGNORECASE)
            if match:
                raw_id = match.group(1).upper()
                machine_id = raw_id if raw_id.startswith("M") else f"M{int(raw_id):03d}"

        # Determine user intent
        q_lower = clean_question.lower()

        # 1. Methodology Question
        if any(w in q_lower for w in ["methodology", "how do you calculate", "what is a health index", "explain risk scoring"]):
            methodology = self.tools.explain_risk_methodology()
            return CopilotChatResponse(
                answer=methodology,
                machine_id=machine_id,
                evidence_references=[],
                suggested_actions=["Inspect fleet risk ranking", "Review individual sensor drift parameters"],
                limitations=["Statistical anomaly detection based on standardized z-score deviations."],
                provider=self.provider.provider_name,
                model="TraceBack Knowledge Base"
            )

        # 2. Comparison Question
        compare_match = re.findall(r"\b(?:m\d{1,4}|\d{1,4})\b", clean_question, re.IGNORECASE)
        if "compare" in q_lower and len(compare_match) >= 2:
            m1 = compare_match[0].upper() if compare_match[0].upper().startswith("M") else f"M{int(compare_match[0]):03d}"
            m2 = compare_match[1].upper() if compare_match[1].upper().startswith("M") else f"M{int(compare_match[1]):03d}"
            try:
                comp = self.tools.compare_machines(m1, m2)
                ans = (
                    f"Cross-machine comparison for {m1} and {m2}:\n\n"
                    f"- {m1}: Risk {comp['comparison'][0]['risk_score']}/100 ({comp['comparison'][0]['risk_category']}), "
                    f"Abnormal sensors: {', '.join(comp['comparison'][0]['top_abnormal_sensors']) if comp['comparison'][0]['top_abnormal_sensors'] else 'None'}.\n"
                    f"- {m2}: Risk {comp['comparison'][1]['risk_score']}/100 ({comp['comparison'][1]['risk_category']}), "
                    f"Abnormal sensors: {', '.join(comp['comparison'][1]['top_abnormal_sensors']) if comp['comparison'][1]['top_abnormal_sensors'] else 'None'}.\n\n"
                    f"Shared abnormal indicators: {', '.join(comp['shared_anomalies']) if comp['shared_anomalies'] else 'None'}.\n"
                    f"Divergent sensors: {', '.join(comp['divergent_sensors']) if comp['divergent_sensors'] else 'None'}."
                )
                return CopilotChatResponse(
                    answer=ans,
                    machine_id=m1,
                    suggested_actions=["Review sensor drift charts for shared sensors", "Check baseline window variance"],
                    limitations=["Comparison based on current cycle snapshot."],
                    provider=self.provider.provider_name,
                    model="TraceBack Comparative Engine"
                )
            except Exception as e:
                logger.warning(f"Comparison failed: {e}")

        # 3. Fleet Overview Question
        if any(w in q_lower for w in ["fleet", "overall", "all machines", "fleet summary"]) and not machine_id:
            fleet_info = self.tools.get_fleet_risk_summary()
            ans = (
                f"Fleet Overview:\n\n"
                f"- Total Machines Monitored: {fleet_info.get('total_machines', 0)}\n"
                f"- Critical Status: {fleet_info.get('critical', 0)} machine(s)\n"
                f"- Watch Status: {fleet_info.get('watch', 0)} machine(s)\n"
                f"- Healthy Status: {fleet_info.get('healthy', 0)} machine(s)\n"
                f"- Insufficient Data: {fleet_info.get('insufficient_data', 0)} machine(s)\n"
                f"- Average Fleet Health Score: {fleet_info.get('average_health_score', 100.0)}/100"
            )
            return CopilotChatResponse(
                answer=ans,
                suggested_actions=["Inspect critical machines in Fleet View", "Filter by Watch status to detect early drift"],
                limitations=["Aggregate snapshot across most recent cycle per machine."],
                provider=self.provider.provider_name,
                model="TraceBack Fleet Aggregator"
            )

        # 4. Machine-Specific Deep Dive Question
        if not machine_id:
            return CopilotChatResponse(
                answer=(
                    "Please specify a machine identifier (e.g., Machine M104 or M001) or select a machine from the "
                    "Fleet list so I can retrieve its telemetry evidence."
                ),
                suggested_actions=["Select a machine in Fleet Overview", "Ask 'Explain fleet risk summary'"],
                limitations=["No machine identifier provided."],
                provider=self.provider.provider_name,
                model="TraceBack Assistant"
            )

        try:
            m_health = self.tools.get_machine_health(machine_id)
            root_cause = self.tools.get_root_cause_evidence(machine_id)
            hist_matches = self.tools.get_historical_matches(machine_id)
        except MachineNotFoundError:
            return CopilotChatResponse(
                answer=f"Machine '{machine_id}' was not found in the database. Please verify the machine ID.",
                machine_id=machine_id,
                suggested_actions=["Check available IDs in the Fleet view", "Confirm data ingestion has run"],
                limitations=["Machine identifier does not exist in MACHINE_HEALTH table."],
                provider=self.provider.provider_name,
                model="TraceBack Assistant"
            )

        # Format evidence for model
        evidence_text, evidence_refs = EvidenceFormatter.build_evidence_context(
            machine_health=m_health,
            root_cause=root_cause,
            historical_matches=hist_matches
        )

        # Build prompt
        prompt = (
            f"USER QUESTION: {clean_question}\n\n"
            f"RETRIEVED BACKEND EVIDENCE:\n"
            f"{evidence_text}\n\n"
            f"Provide a concise, direct, judge-ready explanation addressing the question based on this evidence. "
            f"Explain which sensors show the strongest abnormalities, when drift began, and mention historical matches if available."
        )

        raw_answer = self.provider.generate_response(prompt, COPILOT_SYSTEM_PROMPT)
        safe_answer, safety_notes = CopilotSafetyFilter.inspect_response(raw_answer)

        # Determine recommended actions
        top_abnormal = [item["sensor_name"] for item in root_cause[:3]]
        actions = RecommendationService.get_maintenance_actions(m_health.get("risk_category", "HEALTHY"), top_abnormal)

        return CopilotChatResponse(
            answer=safe_answer,
            machine_id=machine_id,
            evidence_references=evidence_refs,
            suggested_actions=actions,
            limitations=[
                "Evidence reflects statistical anomaly detection, not verified physical causality.",
                "RUL estimate represents learned trajectory regression with uncertainty."
            ] + safety_notes,
            provider=self.provider.provider_name,
            model=settings.LLM_MODEL
        )


orchestrator = CopilotOrchestrator()
