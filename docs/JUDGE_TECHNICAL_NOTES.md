# TraceBack AI — Judge Technical Q&A & Methodology Notes

This document provides rigorous, defensible technical answers to the 14 core questions evaluated by hackathon judges and industrial technical reviewers.

---

### 1. Why is this predictive maintenance rather than a generic chatbot?
TraceBack AI is an analytical analytics pipeline and telemetry investigation engine, **not an LLM with database access**.
- All calculations (sensor baselines, standardized deviations, rolling drift rates, health indices, root-cause contribution rankings, failure signature clusters, and RUL regression) are computed **deterministically in SQL and analytical services**.
- The AI Copilot is strictly a **read-only interpretation interface**. It receives structured, numerical evidence bundles retrieved from the database repository and translates them into operational language.
- If the LLM provider is disconnected or offline, the entire predictive maintenance engine (fleet rankings, deep-dive telemetry, drift charts, root cause evidence, and historical matching) functions 100% identically.

---

### 2. What is the difference between anomaly detection and failure prediction?
- **Anomaly Detection:** Measures whether current sensor readings deviate from historical healthy operating baselines (e.g. sensor $s_8$ has drifted $5.16\sigma$ from its learned mean). This identifies *abnormal behaviour*, but does not specify how much life remains or whether the component will survive the shift.
- **Failure Prediction (RUL):** Models the remaining operating cycles before the machine reaches an unserviceable state. TraceBack combines anomaly detection (early warning lead time: ~110 cycles ahead) with Ridge regression (evaluating remaining cycles with 17.68 cycles MAE) to answer both *how abnormal is it* and *how much operational life remains*.

---

### 3. How is the machine risk index calculated?
The risk score (0–100) is a composite index derived from the top 5 abnormal sensors at each operating cycle:
$$\text{Top5 Mean Anomaly} = \frac{1}{5} \sum_{k=1}^5 |z_k|$$
$$\text{Risk Score} = \min\left(100.0, \, \max\left(0.0, \, \frac{\text{Top5 Mean Anomaly}}{4.0} \times 100.0\right)\right)$$
$$\text{Health Score} = 100.0 - \text{Risk Score}$$

- **Thresholds:**
  - $\ge 75.0$: `CRITICAL` (Urgent inspection required)
  - $\ge 45.0$: `WATCH` (Early emerging drift)
  - $< 45.0$: `HEALTHY` (Operating within nominal parameters)
- **Early Protection:** If cycle $< 30$ (initial observation window), the machine is classified as `INSUFFICIENT_DATA`, preventing false healthy or false alarming before a reliable baseline exists.

---

### 4. Why does a high sensor deviation not automatically establish physical causation?
Statistical abnormality indicates that a sensor is reading far outside its historical distribution. However:
1. **Sensor Transducer Faults:** Thermocouples or pressure transducers can drift or degrade electrically without mechanical failure in the engine core.
2. **Coupled Aerodynamics:** In a gas turbine, a compressor bleed leak alters downstream turbine inlet temperatures and pressures simultaneously. The first sensor to cross a threshold is not necessarily the physical component that fractured.
3. **TraceBack Terminology:** We strictly use *"Leading anomaly indicator"*, *"Strongest statistical deviation"*, and *"Suspected contributing sensor requiring physical borescope verification"*, explicitly avoiding unproven physical causality claims.

---

### 5. How is the first sustained anomaly cycle determined?
To prevent false alarms from transient operational noise or sensor spikes:
1. Anomaly hits are flagged when $|z| \ge 2.0$.
2. TraceBack evaluates a rolling 7-cycle window:
   $$\text{Sustained Hit Count} = \sum_{t-6}^t \mathbb{I}(|z_i| \ge 2.0)$$
3. An anomaly is classified as **sustained** only when $\text{Sustained Hit Count} \ge 5$ (at least 5 out of 7 consecutive cycles).
4. The cycle where this condition is first satisfied is recorded as `first_sustained_anomaly_cycle`.

---

### 6. How are historical failure signatures extracted and compared?
1. For historical run-to-failure machines, TraceBack extracts the set and relative onset latency of all sensors exhibiting sustained degradation.
2. These vectors are clustered using K-Means into signature archetypes (e.g. HPC Thermal Drift vs High Bypass Degradation).
3. When investigating an active machine, TraceBack computes the **Jaccard similarity coefficient** between the active machine's sustained sensor set ($S_{\text{query}}$) and historical run-to-failure machines ($S_{\text{hist}}$):
   $$J(S_{\text{query}}, S_{\text{hist}}) = \frac{|S_{\text{query}} \cap S_{\text{hist}}|}{|S_{\text{query}} \cup S_{\text{hist}}|}$$
4. Cases with $J \ge 0.30$ are returned with their historical outcome cycle and shared sensor evidence. If no case meets this bar, the API returns: *"No sufficiently similar historical signature found with current observation window."*

---

### 7. How is Remaining Useful Life (RUL) estimated and evaluated?
- **Model:** Ridge regression ($\alpha = 1.0$) trained on multi-sensor rolling drift features.
- **Target Formulation:** True RUL capped at 125 cycles (standard NASA C-MAPSS prognostics convention, reflecting linear degradation onset after early stable life).
- **Evaluation:** Evaluated on 30 held-out test engines (no row mixing):
  - Model MAE: **17.68 cycles** (vs Mean Baseline MAE of 37.05 cycles)
  - Error Reduction: **52.3% improvement over baseline**
  - Model RMSE: **21.83 cycles**
  - Model $R^2$: **0.725**

---

### 8. How do you avoid data leakage?
1. **Strict Engine-Level Splitting:** Splits are performed strictly by `machine_id` (70 training engines, 30 held-out test engines). Individual cycle rows from the same engine are never shuffled across train and test sets.
2. **Preprocessing Isolation:** Healthy baseline statistics ($\mu_{\text{baseline}}, \sigma_{\text{baseline}}$) are calculated strictly on training engines during their initial healthy cycles ($t \le 30$). Test engine cycles are normalized using training statistics.
3. **Causal Rolling Windows:** Rolling drift features at cycle $t$ use only cycles $\le t$ (`ROWS BETWEEN 14 PRECEDING AND CURRENT ROW`). Future cycles are strictly excluded.
4. **Historical Matching Exclusion:** When searching for resembling historical failure signatures, the query machine is explicitly excluded (`WHERE machine_id != :machine_id`).

---

### 9. Why use Exasol for analytics?
- **Massively Parallel Processing (MPP):** Industrial fleets produce millions of sensor readings per day. Exasol stores cycle readings in high-performance columnar tables with automated compression.
- **In-Database Analytics:** Rolling drift smoothing, anomaly counting, and root-cause rankings are executed directly inside Exasol using SQL window functions (`AVG() OVER (PARTITION BY ... ROWS BETWEEN ...)`).
- **Scalability:** Moving the compute to the data avoids exporting raw multi-gigabyte time-series tables into Python memory for fleet-wide scoring.

---

### 10. What happens when Exasol is unavailable?
TraceBack implements an isolated local mock engine (`MockExasolEngine` backed by SQLite).
- The transition is completely automatic and logged: if port 8563 is offline, the backend activates the mock engine.
- **Execution Mode Transparency:** Both `/api/v1/health` and `/api/v1/readiness` accurately report `engine: "Mock Engine (Isolated SQLite)"` and `is_mock: true`. The frontend displays this clearly so judges know the demonstration is running in local offline mode without faking Exasol connectivity.

---

### 11. What evidence does the Copilot receive?
The Copilot context builder extracts only structured numerical facts:
- Machine ID and Current Cycle
- Computed Health Score, Risk Score, and Classification
- First sustained anomaly cycle
- Top 4 root-cause sensors with standardized z-score deviation magnitudes, drift rates, and human-readable rationale
- Matched historical engines with similarity percentages and shared sensor lists
- Fleet aggregate distribution

---

### 12. How do you prevent the Copilot from inventing sensor readings?
1. **Read-Only Tools:** The LLM cannot query arbitrary SQL tables or run system commands. It can only call predefined, parameter-checked tools.
2. **Grounding Prompt:** Strict system prompt: *"Answer using retrieved evidence only. Never fabricate sensor readings, cycle numbers, or failure labels. If evidence is missing, state that insufficient evidence is available."*
3. **Safety Inspection:** Output filter scans for hallucinated certainty phrases (e.g. *"will definitely fail at cycle X"* or *"100% chance of failure"*) and replaces them with qualified probabilistic inspection advice.
4. **Offline Determinism:** The offline provider formats the retrieved database evidence directly, ensuring zero variance or drift across repeated evaluations.

---

### 13. What has been evaluated against held-out data?
Evaluated using `backend/scripts/evaluate_models.py` on 30 held-out test engines from NASA C-MAPSS FD001 (6,189 evaluation records):
- **RUL Prediction MAE:** 17.68 cycles (52.3% improvement over mean baseline).
- **RUL Prediction RMSE:** 21.83 cycles.
- **Early Warning Lead Time:** Average of 110.5 cycles before failure.
- **Early Warning Success Rate:** 100.0% of engines triggered alerts $\ge 20$ cycles prior to complete failure.

---

### 14. What remains a limitation of the current prototype?
1. **Operating Regime Normalization:** C-MAPSS FD001 uses a single sea-level operating condition. Multi-regime engines (e.g. FD002 with varying altitudes and Mach numbers) will require operational regime clustering (e.g. k-means on altitude, throttle, and ambient temperature) before computing baseline deviations.
2. **Physical Causality:** Root-cause ranking identifies leading statistical anomalies, not metallurgic crack propagation. On-wing inspection remains essential before component condemnation.
3. **Local Exasol Daemon:** In this local evaluation environment, Exasol port 8563 was offline; all queries executed seamlessly on the isolated local mock engine.
