"""Direct model evaluation - test signal classifier on original quant signals."""

import json
import torch
from riqe.models.encoders import TextEncoder
from riqe.models.models import RIQESignalClassifier
from riqe.config import TOPICS_FILE, TRAINING_DATA_DIR

# Load topic mapping
with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
    topics = json.load(f)
topic_ids = [t["topic_id"] for t in topics]

# Load signals
with open(str(TRAINING_DATA_DIR / "sample_signals.json"), "r", encoding="utf-8") as f:
    signals = json.load(f)

# Load model and encoder
encoder = TextEncoder()
model = RIQESignalClassifier()
model.eval()

# Test each signal
correct_topic = 0
correct_type = 0
type_labels = ["new_info", "reinforcement", "contradiction"]
misses = []

for sig in signals:
    emb = encoder.encode(sig["text"])
    t = torch.tensor(emb, dtype=torch.float32).unsqueeze(0)
    with torch.no_grad():
        topic_logits, strength, type_logits = model(t)

    pred_idx = topic_logits.argmax().item()
    pred_topic = topic_ids[pred_idx] if pred_idx < len(topic_ids) else "unknown"
    true_topic = sig["topic_label"]

    pred_type_idx = type_logits.argmax().item()
    pred_type = type_labels[pred_type_idx]
    true_type = sig["signal_type_label"]

    if pred_topic == true_topic:
        correct_topic += 1
    else:
        probs = torch.softmax(topic_logits, dim=1).squeeze()
        top3 = probs.topk(3)
        top3_str = ", ".join(
            ["%s=%.2f" % (topic_ids[i], p) for p, i in zip(top3.values.tolist(), top3.indices.tolist())]
        )
        misses.append(
            "MISS: [%s] -> [%s]  top3=[%s]  text=%.60s..." % (true_topic, pred_topic, top3_str, sig["text"])
        )

    if pred_type == true_type:
        correct_type += 1

total = len(signals)
print("=" * 80)
print("TRACK 2 SIGNAL CLASSIFIER EVALUATION")
print("=" * 80)
print("Topic Accuracy: %d/%d = %.1f%%" % (correct_topic, total, 100.0 * correct_topic / total))
print("Type Accuracy:  %d/%d = %.1f%%" % (correct_type, total, 100.0 * correct_type / total))
print()

if misses:
    print("Misclassified signals (%d):" % len(misses))
    for m in misses[:20]:
        print("  " + m)
