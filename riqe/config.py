"""
RIQE Pipeline Configuration
All hyperparameters and environment variables in one place.
"""

import os
from pathlib import Path
from typing import Final

# Disable Hugging Face progress bars to avoid "loading weights 0%" flicker and timeout errors in subprocess
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

# Load .env from project root (Luminary) so GEMINI_API_KEY etc. are available
try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env")
except ImportError:
    pass

# ── OpenAI ────────────────────────────────────────────────────────────
OPENAI_API_KEY: Final[str] = os.getenv("OPENAI_API_KEY", "")

# ── Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL: Final[str] = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: Final[str] = os.getenv("SUPABASE_KEY", "")

# ── MLflow ────────────────────────────────────────────────────────────
MLFLOW_TRACKING_URI: Final[str] = os.getenv("MLFLOW_TRACKING_URI", "mlruns")
MLFLOW_EXPERIMENT_NAME: Final[str] = "riqe-pipeline"

# ── Encoder / Embedding Dimensions ───────────────────────────────────
TEXT_EMBED_DIM: Final[int] = 384          # all-MiniLM-L6-v2 output
USER_EMBED_DIM: Final[int] = 128         # UserProfileMLP output
SIGNAL_FEATURE_DIM: Final[int] = 64      # TrendGRU input feature dim
SENTENCE_MODEL_NAME: Final[str] = "all-MiniLM-L6-v2"
# Optional: local directory containing a pre-downloaded sentence-transformers model (avoids download/loading weights 0% errors)
RIQE_MODEL_PATH: Final[str] = os.getenv("RIQE_MODEL_PATH", "").strip()

# ── Structured Encoder ───────────────────────────────────────────────
FIELD_OF_STUDY_VOCAB: Final[list[str]] = [
    "computer_science",
    "data_science",
    "mathematics",
    "statistics",
    "physics",
    "electrical_engineering",
    "mechanical_engineering",
    "biology",
    "chemistry",
    "economics",
    "business",
    "psychology",
    "sociology",
    "philosophy",
    "linguistics",
    "medicine",
    "law",
    "education",
    "arts",
    "other",
]
NUM_FIELDS: Final[int] = len(FIELD_OF_STUDY_VOCAB)     # 20

# Learning-history stats: [avg_completion, avg_quiz, avg_time, total_revisits]
LEARNING_HISTORY_DIM: Final[int] = 4

# StructuredEncoder output dim = NUM_FIELDS + 1 (timeframe) + 1 (n_skills placeholder for z-scores …
# but skill_scores are variable-length so we pad/truncate to MAX_SKILLS)
MAX_SKILLS: Final[int] = 30
STRUCTURED_DIM: Final[int] = MAX_SKILLS + NUM_FIELDS + 1 + LEARNING_HISTORY_DIM  # 55

# UserProfileMLP input = 2 * TEXT_EMBED_DIM + STRUCTURED_DIM
PROFILE_INPUT_DIM: Final[int] = 2 * TEXT_EMBED_DIM + STRUCTURED_DIM  # 823

# ── Model Architecture ───────────────────────────────────────────────
MLP_HIDDEN_1: Final[int] = 256
MLP_HIDDEN_2: Final[int] = 128
MLP_DROPOUT: Final[float] = 0.2

SIGNAL_TRUNK_DIM: Final[int] = 128
SIGNAL_DROPOUT: Final[float] = 0.3

GRU_HIDDEN_DIM: Final[int] = 64
GRU_NUM_LAYERS: Final[int] = 2
NUM_TREND_CLASSES: Final[int] = 3         # rising, stable, fading
NUM_SIGNAL_TYPES: Final[int] = 3          # new_info, reinforcement, contradiction

# ── Topics ────────────────────────────────────────────────────────────
N_TOPICS: Final[int] = 15                 # quant-specific topic classes
TOP_K_ROADMAP: Final[int] = 15           # roadmap includes all quant topics

# ── Signal Processing ────────────────────────────────────────────────
SIGNAL_BUFFER_SIZE: Final[int] = 20
TEMPORAL_DECAY_LAMBDA: Final[float] = 0.0001
RELIABILITY_VARIANCE_WINDOW: Final[int] = 5

# ── Knowledge State ──────────────────────────────────────────────────
EMA_ALPHA: Final[float] = 0.9             # for user_vector update
COMPLETION_THRESHOLD: Final[float] = 0.8   # completion_rate > this → completed
WEAK_TOPIC_THRESHOLD: Final[float] = 0.5   # quiz_score < this → weak

# ── Roadmap Scoring Weights ──────────────────────────────────────────
SCORE_WEIGHT_COSINE: Final[float] = 0.6
SCORE_WEIGHT_SIGNAL: Final[float] = 0.3
SCORE_WEIGHT_TREND: Final[float] = 0.1
TREND_RISING_BONUS: Final[float] = 0.15

# ── Signal Classifier Loss Weights ───────────────────────────────────
LOSS_WEIGHT_TOPIC: Final[float] = 0.4
LOSS_WEIGHT_STRENGTH: Final[float] = 0.4
LOSS_WEIGHT_SIGNAL_TYPE: Final[float] = 0.2

# ── Reinforcement / Contradiction Update Weights ─────────────────────
REINFORCEMENT_WEIGHT: Final[float] = 0.1

# ── Training Defaults ────────────────────────────────────────────────
DEFAULT_LR: Final[float] = 1e-3
DEFAULT_EPOCHS: Final[int] = 50
DEFAULT_BATCH_SIZE: Final[int] = 32
TRIPLET_MARGIN: Final[float] = 1.0

# ── File Paths ────────────────────────────────────────────────────────
import pathlib

PROJECT_ROOT: Final[pathlib.Path] = pathlib.Path(__file__).resolve().parent
DATA_DIR: Final[pathlib.Path] = PROJECT_ROOT / "data"
TOPICS_FILE: Final[pathlib.Path] = DATA_DIR / "topics.json"
PREREQUISITES_FILE: Final[pathlib.Path] = DATA_DIR / "prerequisites.json"
CHECKPOINTS_DIR: Final[pathlib.Path] = PROJECT_ROOT / "models" / "checkpoints"
TRAINING_DATA_DIR: Final[pathlib.Path] = DATA_DIR / "training"
