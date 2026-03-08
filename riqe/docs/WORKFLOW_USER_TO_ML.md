# Workflow: User Info -> ML Pipeline -> Produced Outputs

This document describes how user input flows through the RIQE pipeline and what is produced. The same flow is verified step-by-step by `riqe/tests/test_workflow_user_to_ml.py` (run: `python -m riqe.tests.test_workflow_user_to_ml`).

---

## 1. User profile -> encoders -> MLP input

| Input | Component | Output |
|-------|------------|--------|
| `resume_text` | TextEncoder (all-MiniLM-L6-v2) | 384-dim vector |
| `interests` (joined string) | TextEncoder | 384-dim vector |
| `skill_scores` | StructuredEncoder | z-scored, padded to MAX_SKILLS (30) |
| `field_of_study` | StructuredEncoder | one-hot over FIELD_OF_STUDY_VOCAB (20) |
| `timeframe_weeks` | StructuredEncoder | log-scaled (1 value) |
| `learning_history` | StructuredEncoder | mean completion_rate, quiz_score, time_spent_minutes; sum revisit_count (4 values) |

StructuredEncoder output: 30 + 20 + 1 + 4 = **55 dim** (STRUCTURED_DIM).

Concatenation: resume(384) + interests(384) + struct(55) = **823 dim** (PROFILE_INPUT_DIM).

---

## 2. Concat -> UserProfileMLP -> user vector

| Input | Component | Output |
|-------|------------|--------|
| concat (823,) | UserProfileMLP | **user_vector (128,)** |

The 128-dim user vector is the main representation of the user used for topic scoring.

---

## 3. Learning history -> completed_topics, weak_topics

| learning_history entry | Rule | Result |
|------------------------|------|--------|
| `completion_rate` > COMPLETION_THRESHOLD (0.8) | topic added to | `completed_topics` |
| `quiz_score` < WEAK_TOPIC_THRESHOLD (0.5) | topic added to | `weak_topics` |

These lists are stored on KnowledgeState and used by the roadmap: completed topics are filtered out of the roadmap; weak topics can be boosted when transferring context.

---

## 4. initialize() -> KnowledgeState

KnowledgeStateManager.initialize():

1. Encodes resume + interests (TextEncoder).
2. Encodes structured profile (StructuredEncoder).
3. Concatenates and runs UserProfileMLP -> user_vector (128,).
4. Builds completed_topics and weak_topics from learning_history.
5. Returns KnowledgeState(user_id, user_vector, completed_topics, weak_topics, strong_signals=[]).

---

## 5. generate(state) -> Roadmap

RoadmapGenerator.generate(state):

1. **Score topics**: For each topic, score = 0.6 * cosine_sim(user_vector, topic.embedding_128) + 0.3 * best signal strength for that topic + 0.1 * trend_bonus (if any signal for topic has trend "rising").
2. Take top TOP_K_ROADMAP (15) topics.
3. Remove topics in state.completed_topics.
4. Topological sort by prerequisites (prerequisites.json DAG).
5. Build Roadmap with nodes: topic_id, title, description, difficulty, prerequisites, recommendation_score, signal_score, confidence.
6. quality_score is not set on first generate(); it is set in update() as mean(recommendation_score) of nodes.

So: **user_vector drives recommendation_score via cosine similarity**; **strong_signals** (from later signals) add signal_score and trend_bonus; **completed_topics** are excluded; **prerequisites** fix ordering.

---

## 6. Signal text -> SignalProcessor -> RIQESignal

When the user sends a text signal (e.g. "Studied Ito's lemma today"):

1. **TextEncoder** encodes text -> 384-dim.
2. **RIQESignalClassifier** (trained) -> topic (1 of 15), strength (0-1), signal_type (new_info | reinforcement | contradiction).
3. **TrendGRU** (over rolling buffer of 64-dim features) -> trend (rising | stable | fading).
4. Temporal decay applied to strength; reliability_score = strength * (1 - variance of recent strengths).
5. Return RIQESignal(text, timestamp, topic, strength, is_new_info, trend, reliability_score, signal_type).

---

## 7. update_from_signal(state, signal) -> updated state

KnowledgeStateManager.update_from_signal():

- **new_info** (or is_new_info): append signal to state.strong_signals.
- **reinforcement**: for existing strong_signals with same topic, boost strength by REINFORCEMENT_WEIGHT * signal.strength.
- **contradiction**: add signal.topic to state.weak_topics if not already there.
- **Always**: EMA update of user_vector with signal text embedding projected to 128-dim:  
  `user_vector = EMA_ALPHA * user_vector + (1 - EMA_ALPHA) * signal_128`.

So every signal updates the user vector; strong_signals and weak_topics change depending on signal_type.

---

## 8. update(roadmap, signal, state) -> new roadmap version

RoadmapGenerator.update():

1. Call generate(state) again (so new user_vector and strong_signals are used for scoring).
2. Keep same roadmap_id; set version = roadmap.version + 1.
3. Set quality_score = mean(recommendation_score) of nodes.

So the **produced outputs** after onboarding and after each signal are:

- **State**: user_vector (128), completed_topics, weak_topics, strong_signals (and session_history if using transfer).
- **Roadmap**: nodes (ordered by prerequisites, scored by cosine + signal + trend), version, quality_score.
- **Signal** (per incoming text): topic, strength, signal_type, trend, reliability_score.

---

## Gemini and YouTube (after roadmap is built)

Once the ML pipeline has produced **state** and **roadmap**:

1. The full pipeline summary (state + roadmap with topic titles and descriptions) is sent to **Gemini** (when `GEMINI_API_KEY` is set).
2. Gemini returns **refined, user-friendly language**: per-topic **suggestions** (Next / Resource / Watch) and **youtube_queries** (short search phrases).
3. These are attached to each roadmap node as `suggestions` and `youtube_queries`. The API returns them so the app can:
   - Show clear next steps and resources.
   - Call the YouTube API with each `youtube_queries` entry (e.g. `GET /api/youtube?query=...`) to show relevant videos.

So: **ML pipeline takes in user + signals -> produces state and roadmap -> feeds that into Gemini -> Gemini refines language and adds recommendations + YouTube queries -> roadmap nodes get a good format for maximum help**, and the frontend can use YouTube scraping for each topic.

---

## Running the verification test

```bash
python -m riqe.tests.test_workflow_user_to_ml
```

This runs all steps above with fixed test data and asserts that:

- Encoder and MLP dimensions match (384, 384, 55, 823, 128).
- completed_topics and weak_topics are derived from learning_history thresholds.
- Roadmap has nodes with recommendation_score, prerequisites, topic_id.
- Signal has topic in topic_ids, strength in [0,1], valid signal_type and trend.
- State update changes user_vector (EMA) and respects strong_signals/weak_topics rules.
- Roadmap update bumps version and sets quality_score.
- Full pipeline (onboard + process_text_input) produces state and roadmap correctly.
