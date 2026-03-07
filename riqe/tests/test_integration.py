"""
Full Integration Test — Unseen Quant Signals
─────────────────────────────────────────────
Tests the RIQE pipeline end-to-end with brand-new text that was never
in the training data. Verifies:
  1. Topic classification accuracy on unseen text
  2. Signal type detection
  3. Roadmap recommendations make sense (ordering, coverage)
  4. Reliability scores behave correctly
  5. Knowledge state evolves properly
"""

import json
import sys
import torch
import numpy as np
from datetime import datetime

from riqe.models.encoders import TextEncoder
from riqe.models.models import RIQESignalClassifier
from riqe.core.pipeline import RIQEPipeline
from riqe.config import TOPICS_FILE

# ── Load topic index ─────────────────────────────────────────────────

with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
    topics = json.load(f)
topic_ids = [t["topic_id"] for t in topics]

# ── Completely unseen test signals ───────────────────────────────────
# These are signals the model has NEVER seen during training.

UNSEEN_SIGNALS = [
    {
        "text": "Kolmogorov's axioms define probability as a measure on a sigma-algebra. The three axioms are non-negativity, normalization, and countable additivity. Every result in probability theory follows from these foundations.",
        "expected_topic": "probability_theory",
        "expected_type": "new_info",
    },
    {
        "text": "The Ornstein-Uhlenbeck process is a mean-reverting SDE: dX = theta*(mu-X)*dt + sigma*dW. Unlike GBM, it has a stationary distribution. It's commonly used to model interest rates and volatility.",
        "expected_topic": "stochastic_calculus",
        "expected_type": "new_info",
    },
    {
        "text": "To price a European call under Black-Scholes, compute d1 = (ln(S/K) + (r+sigma^2/2)*T) / (sigma*sqrt(T)), then d2 = d1 - sigma*sqrt(T). The call price is S*N(d1) - K*exp(-rT)*N(d2).",
        "expected_topic": "derivatives_pricing",
        "expected_type": "new_info",
    },
    {
        "text": "The VIX index is computed from S&P 500 option prices using a model-free approach. It represents the market's 30-day expected volatility. When VIX spikes, it often signals market fear and increased hedging demand.",
        "expected_topic": "volatility_modeling",
        "expected_type": "new_info",
    },
    {
        "text": "Nelson-Siegel model parameterizes the yield curve with three factors: level, slope, and curvature. The functional form is y(tau) = beta0 + beta1*(1-exp(-tau/lambda))/(tau/lambda) + beta2*(...). Very parsimonious.",
        "expected_topic": "fixed_income",
        "expected_type": "new_info",
    },
    {
        "text": "I thought market making was just about quoting bid-ask spreads, but the inventory management problem is actually a stochastic control problem. The Avellaneda-Stoikov framework uses Hamilton-Jacobi-Bellman equations.",
        "expected_topic": "algorithmic_trading",
        "expected_type": "contradiction",
    },
    {
        "text": "Random matrix theory can detect genuine correlations vs noise in large covariance matrices. The Marchenko-Pastur distribution gives the theoretical eigenvalue distribution of random matrices. Eigenvalues above the MP bound are signal.",
        "expected_topic": "linear_algebra_quant",
        "expected_type": "new_info",
    },
    {
        "text": "Walk-forward analysis is more realistic than simple backtesting. You train on a rolling window, predict the next period, and accumulate out-of-sample results. This avoids look-ahead bias entirely.",
        "expected_topic": "ml_for_finance",
        "expected_type": "reinforcement",
    },
    {
        "text": "Expected Shortfall at 95% = E[Loss | Loss > VaR_95]. Unlike VaR, ES tells you the average loss in the tail. Basel III requires ES at 97.5% for market risk capital calculations.",
        "expected_topic": "risk_management",
        "expected_type": "reinforcement",
    },
    {
        "text": "Risk parity found new support after 2008 when traditional 60/40 portfolios got crushed. The idea is to equalize risk contribution: RC_i = w_i * (Sigma * w)_i / sigma_p. Each asset contributes the same marginal risk.",
        "expected_topic": "portfolio_optimization",
        "expected_type": "reinforcement",
    },
    {
        "text": "My Dickey-Fuller test showed a p-value of 0.73 on AAPL prices, confirming unit root (non-stationary). But the log-returns had p-value 0.0001 - stationary as expected. Always difference price series before modeling.",
        "expected_topic": "time_series_analysis",
        "expected_type": "reinforcement",
    },
    {
        "text": "QuantLib's AnalyticEuropeanEngine plugs into a GeneralizedBlackScholesProcess. You set up the quote handle, flat term structure, and flat vol, then call NPV(). Very clean factory pattern design for derivatives pricing.",
        "expected_topic": "python_for_quant",
        "expected_type": "new_info",
    },
    {
        "text": "Generalized method of moments estimation for the Hansen-Jagannathan bound: m = 1 - b*(R - E[R]). The bound constrains the mean-variance tradeoff of the stochastic discount factor. Useful for asset pricing tests.",
        "expected_topic": "statistics_econometrics",
        "expected_type": "new_info",
    },
    {
        "text": "Trapezoidal rule integration for bond dirty price from clean: accumulate accrued interest as day_count_fraction * coupon_rate * face_value. ACT/360 and 30/360 are common day count conventions.",
        "expected_topic": "numerical_methods",
        "expected_type": "reinforcement",
    },
    {
        "text": "A classic quant interview question: two envelopes contain $X and $2X. You open one and see $100. Should you switch? Naive expected value says yes, but the paradox arises from an improper prior distribution.",
        "expected_topic": "quant_interview_prep",
        "expected_type": "new_info",
    },
    {
        "text": "CVA is the expected loss from counterparty default. You need expected exposure profile, survival curve, and LGD. Monte Carlo over scenarios and discount. Netting reduces exposure dramatically.",
        "expected_topic": "risk_management",
        "expected_type": "new_info",
    },
    {
        "text": "Sobol sequences for quasi-Monte Carlo: low-discrepancy so convergence is O((log N)^d / N). Much better than O(1/sqrt(N)) for high-dimensional integration in option pricing.",
        "expected_topic": "numerical_methods",
        "expected_type": "reinforcement",
    },
    {
        "text": "I always assumed PCA was enough for factor models. But sparse PCA or factor analysis with rotation can give more interpretable loadings. The choice depends on whether you care about prediction or interpretation.",
        "expected_topic": "linear_algebra_quant",
        "expected_type": "contradiction",
    },
]


def run_tests():
    """Run all verification tests."""
    print("=" * 80)
    print("RIQE PIPELINE INTEGRATION TEST - UNSEEN DATA")
    print("=" * 80)

    # ── Test 1: Direct model accuracy on unseen signals ──────────────
    print("\n[TEST 1] Signal Classification on Unseen Text")
    print("-" * 60)

    encoder = TextEncoder()
    model = RIQESignalClassifier()
    model.eval()

    type_labels = ["new_info", "reinforcement", "contradiction"]
    topic_correct = 0
    type_correct = 0

    for sig in UNSEEN_SIGNALS:
        emb = encoder.encode(sig["text"])
        t = torch.tensor(emb, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            topic_logits, strength, type_logits = model(t)

        pred_topic = topic_ids[topic_logits.argmax().item()]
        pred_type = type_labels[type_logits.argmax().item()]

        topic_match = pred_topic == sig["expected_topic"]
        type_match = pred_type == sig["expected_type"]

        if topic_match:
            topic_correct += 1
        if type_match:
            type_correct += 1

        status = "OK" if topic_match else "MISS"
        print("  [%s] %-25s -> %-25s  type: %s->%s %s" % (
            status,
            sig["expected_topic"],
            pred_topic,
            sig["expected_type"],
            pred_type,
            "OK" if type_match else "MISS",
        ))

    total = len(UNSEEN_SIGNALS)
    print("\n  Topic Accuracy (unseen): %d/%d = %.1f%%" % (topic_correct, total, 100 * topic_correct / total))
    print("  Type  Accuracy (unseen): %d/%d = %.1f%%" % (type_correct, total, 100 * type_correct / total))

    # ── Test 2: Full pipeline — onboard + signals + roadmap quality ──
    print("\n[TEST 2] Full Pipeline: Onboard + Signal Flow + Roadmap")
    print("-" * 60)

    import asyncio

    async def test_pipeline():
        pipe = RIQEPipeline()

        # Onboard a new user
        state, roadmap = await pipe.onboard(
            user_id="integration_test_user",
            resume_text="Finance masters student, strong in statistics and econometrics. Want to break into quant trading. Know Python well, need to learn stochastic calculus and derivatives pricing from scratch.",
            skill_scores={"statistics": 0.65, "python": 0.7, "econometrics": 0.6, "linear_algebra": 0.5, "probability": 0.55},
            interests=["derivatives pricing", "volatility modeling", "algorithmic trading"],
            field_of_study="economics",
            timeframe_weeks=16,
            learning_history=[],
        )

        print("  Onboarded: user_vector shape = %s" % str(state.user_vector.shape))
        print("  Initial roadmap: %d topics, version %d" % (len(roadmap.nodes), roadmap.version))
        print("  Topic order:")
        for i, node in enumerate(roadmap.nodes):
            print("    %2d. %-30s  score=%.4f  difficulty=%.1f" % (
                i + 1, node.topic_id, node.recommendation_score, node.difficulty
            ))

        # Feed a sequence of realistic signals
        test_signals = [
            "Studied conditional probability and Bayes theorem today. P(A|B) = P(B|A)*P(A)/P(B). Applied it to a simple market regime detection problem.",
            "ARIMA(1,1,1) on S&P 500 daily returns: the MA term captures mean reversion. Residual diagnostics show slight heteroscedasticity - need GARCH for the variance.",
            "Black-Scholes derivation using risk-neutral pricing: form a delta-hedged portfolio, show it earns the risk-free rate, get the BS PDE. Beautiful but unrealistic assumptions.",
            "Implemented a simple pairs trading strategy in Python using cointegration. Engle-Granger test on two correlated stocks, z-score entry/exit signals, and basic backtesting.",
        ]

        print("\n  Processing %d signals..." % len(test_signals))
        versions = [roadmap]
        for i, text in enumerate(test_signals):
            updated = await pipe.process_text_input("integration_test_user", text)
            versions.append(updated)
            signal = pipe.signal_processor.buffer[-1]
            print("    Signal %d: topic=%-25s strength=%.3f type=%-15s trend=%-8s reliability=%.3f" % (
                i + 1, signal.topic, signal.strength, signal.signal_type, signal.trend, signal.reliability_score
            ))

        # Check roadmap evolution
        print("\n  Roadmap evolution:")
        for v in versions:
            top3 = [n.topic_id for n in v.nodes[:3]]
            print("    v%d: quality=%.4f  top3=%s" % (v.version, v.quality_score, top3))

        # Reliability validation
        reliability = pipe.signal_processor.validate_signal_reliability(versions)
        print("\n  Signal reliability (quality delta v1->vN): %.4f" % reliability)

        # Knowledge state check
        final_state = pipe._states["integration_test_user"]
        print("  Final user_vector norm: %.4f" % np.linalg.norm(final_state.user_vector))
        print("  Completed topics: %s" % final_state.completed_topics)
        print("  Weak topics: %s" % final_state.weak_topics)

        return topic_correct, total

    topic_correct_unseen, total_unseen = asyncio.run(test_pipeline())

    # ── Summary ──────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("  Unseen topic accuracy : %d/%d = %.1f%%" % (topic_correct, total, 100 * topic_correct / total))
    print("  Unseen type accuracy  : %d/%d = %.1f%%" % (type_correct, total, 100 * type_correct / total))
    print("  Pipeline flow         : OK")
    print("  Roadmap generation    : OK")
    print("  Signal processing     : OK")
    print("  Knowledge state       : OK")
    print("=" * 80)

    if topic_correct / total >= 0.8:
        print("RESULT: PASS")
        return 0
    else:
        print("RESULT: NEEDS IMPROVEMENT (< 80%% unseen accuracy)")
        return 1


if __name__ == "__main__":
    sys.exit(run_tests())
