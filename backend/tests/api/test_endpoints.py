"""TraceBack AI - API Endpoint Automated Tests
"""
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "database" in data["data"]
    assert "copilot" in data["data"]


@pytest.mark.asyncio
async def test_readiness_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/readiness")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["ready"] is True
    assert "engine" in data["data"]
    assert "is_mock" in data["data"]
    assert "dataset_mode" in data["data"]
    assert "llm_provider" in data["data"]


@pytest.mark.asyncio
async def test_fleet_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Fleet summary
        summary_resp = await ac.get("/api/v1/fleet/summary")
        assert summary_resp.status_code == 200
        summary_data = summary_resp.json()["data"]
        assert summary_data["total_machines"] > 0

        # Fleet list
        list_resp = await ac.get("/api/v1/fleet?page=1&page_size=5")
        assert list_resp.status_code == 200
        list_data = list_resp.json()["data"]
        assert len(list_data["items"]) <= 5
        assert list_data["total"] > 0


@pytest.mark.asyncio
async def test_machine_detail_and_investigation_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Valid machine M011
        resp = await ac.get("/api/v1/machines/M011")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["machine_id"] == "M011"
        assert data["risk_category"] in ["HEALTHY", "WATCH", "CRITICAL", "INSUFFICIENT_DATA"]

        # History
        hist_resp = await ac.get("/api/v1/machines/M011/history")
        assert hist_resp.status_code == 200
        assert len(hist_resp.json()["data"]["history"]) > 0

        # Sensors
        sens_resp = await ac.get("/api/v1/machines/M011/sensors")
        assert sens_resp.status_code == 200
        assert len(sens_resp.json()["data"]["drifts"]) > 0

        # Root cause
        rc_resp = await ac.get("/api/v1/machines/M011/root-cause")
        assert rc_resp.status_code == 200
        assert len(rc_resp.json()["data"]["evidence_items"]) > 0

        # Signatures
        sig_resp = await ac.get("/api/v1/machines/M011/signatures")
        assert sig_resp.status_code == 200

        # Consolidated evidence bundle
        ev_resp = await ac.get("/api/v1/machines/M011/evidence")
        assert ev_resp.status_code == 200
        assert ev_resp.json()["data"]["machine_id"] == "M011"


@pytest.mark.asyncio
async def test_invalid_machine_id_returns_404():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/machines/UNKNOWN_MACHINE_999")
        assert resp.status_code == 404
        data = resp.json()
        assert data["success"] is False
        assert "not found" in data["message"].lower()


@pytest.mark.asyncio
async def test_signature_groups():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/groups")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) > 0


@pytest.mark.asyncio
async def test_machine_comparison():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/machines/compare", json={"machine_ids": ["M011", "M001"]})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["comparison"]) == 2
