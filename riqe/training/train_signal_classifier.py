"""
Augmented Training for RIQESignalClassifier
─────────────────────────────────────────────
1. Loads the 50 labeled quant signals
2. Augments text with paraphrasing variations (noise injection on embeddings)
3. Also generates additional topically-coherent signals using keyword injection
4. Trains with train/val split and reports metrics
"""

from __future__ import annotations

import json
import random

import numpy as np
import torch
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset

from riqe.config import (
    TEXT_EMBED_DIM,
    N_TOPICS,
    NUM_SIGNAL_TYPES,
    DEFAULT_LR,
    CHECKPOINTS_DIR,
    TRAINING_DATA_DIR,
    TOPICS_FILE,
)
from riqe.models.encoders import TextEncoder
from riqe.models.models import RIQESignalClassifier


# ── Topic mapping ────────────────────────────────────────────────────

def _load_topic_index() -> dict[str, int]:
    with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
        topics = json.load(f)
    return {t["topic_id"]: i for i, t in enumerate(topics)}

def _load_topic_texts() -> dict[str, str]:
    with open(str(TOPICS_FILE), "r", encoding="utf-8") as f:
        topics = json.load(f)
    return {t["topic_id"]: f"{t['title']}. {t['description']}" for t in topics}

TOPIC_TO_IDX = _load_topic_index()
SIGNAL_TYPE_TO_IDX = {"new_info": 0, "reinforcement": 1, "contradiction": 2}


# ── Augmentation helpers ─────────────────────────────────────────────

# Extra text templates per topic for generating synthetic labeled signals
TOPIC_TEMPLATES: dict[str, list[str]] = {
    "probability_theory": [
        "The law of total probability states that P(A) = sum P(A|B_i)P(B_i). This is used extensively in risk neutral pricing.",
        "Conditional expectation E[X|Y] is fundamental to derivatives pricing. Tower property means E[E[X|Y]] = E[X].",
        "Markov chains model state transitions in credit ratings. The transition matrix gives probabilities of moving between ratings.",
        "The moment generating function uniquely determines a distribution. For normal distribution, MGF = exp(mu*t + sigma^2*t^2/2).",
        "Joint distributions of asset returns are often modeled with copulas, which separate marginal distributions from dependence structure.",
        "Kolmogorov axioms: non-negativity, normalization, countable additivity. These are the foundation of all probability theory and measure theory.",
        "The strong law of large numbers guarantees that sample averages converge almost surely to the expected value. Essential for Monte Carlo methods.",
        "Characteristic functions phi(t) = E[exp(itX)] uniquely determine distributions and are used in Fourier-based option pricing methods.",
        "Conditional probability P(A|B) = P(A and B)/P(B) is the basis for Bayesian inference and market regime detection.",
        "The central limit theorem explains why sums of iid random variables converge to normal. But fat tails in finance violate the finite variance assumption.",
    ],
    "stochastic_calculus": [
        "Geometric Brownian Motion dS = mu*S*dt + sigma*S*dW is the foundation of the Black-Scholes model. The solution is S_T = S_0*exp((mu-sigma^2/2)*T + sigma*W_T).",
        "Stochastic integrals are different from ordinary integrals. The Ito integral uses the left endpoint which gives non-zero E[integral(W dW)] = 0.",
        "The Feynman-Kac formula connects PDEs to expectations of stochastic processes. The BS PDE can be solved as an expectation under the risk-neutral measure.",
        "Radon-Nikodym derivative dQ/dP defines the change of measure. The likelihood ratio process must be a P-martingale for the change to be valid.",
        "Stochastic differential equations for interest rates: Vasicek, CIR, and Hull-White models all use mean-reverting SDEs with different diffusion terms.",
        "The Ornstein-Uhlenbeck process dX = theta*(mu-X)*dt + sigma*dW is mean-reverting. Used for interest rates and pairs trading signals.",
        "Ito's isometry states E[(integral f dW)^2] = E[integral f^2 dt]. This is key for computing variances of stochastic integrals.",
        "Brownian motion has continuous paths, independent increments, and W_t ~ N(0,t). It is the building block of all continuous-time financial models.",
        "The martingale representation theorem: every Q-martingale can be written as a stochastic integral against Brownian motion. Basis for complete markets.",
        "Levy processes generalize Brownian motion by adding jumps. Jump-diffusion models like Merton's capture sudden price moves better than pure diffusion.",
    ],
    "linear_algebra_quant": [
        "Eigendecomposition of the covariance matrix: Sigma = Q*Lambda*Q^T where columns of Q are eigenvectors (risk factors) and Lambda has eigenvalues (variances).",
        "Singular value decomposition is more numerically stable than eigendecomposition for near-singular covariance matrices. SVD gives U*S*V^T.",
        "Matrix exponential exp(A*t) appears in continuous-time Markov chains for credit rating transitions and in the solution of Vasicek-type models.",
        "QR decomposition is used in solving least squares problems for factor model estimation. More stable than normal equations (X^T*X)^-1 * X^T*y.",
        "Kronecker product appears in vectorization of matrix equations. Vec(AXB) = (B^T kron A) * vec(X) is useful in multivariate GARCH estimation.",
        "Random matrix theory detects genuine correlations vs noise. The Marchenko-Pastur distribution gives the theoretical eigenvalue distribution of random covariance matrices.",
        "PCA on the yield curve: first 3 principal components explain 95% of movements. PC1=level, PC2=slope, PC3=curvature. Great for risk decomposition.",
        "Cholesky decomposition L*L^T of a positive-definite matrix is used to generate correlated random variables for Monte Carlo simulation.",
        "Condition number of a matrix measures numerical stability. Ill-conditioned covariance matrices lead to unstable portfolio weights in mean-variance optimization.",
        "Sparse matrix operations in Python using scipy.sparse are essential for large-scale portfolio optimization with thousands of assets and constraints.",
    ],
    "statistics_econometrics": [
        "Instrumental variables estimation handles endogeneity in financial regressions. Two-stage least squares is the standard approach.",
        "The Newey-West estimator provides HAC standard errors robust to both heteroscedasticity and autocorrelation.",
        "Fama-MacBeth regression: first run cross-sectional regressions each period, then average the coefficients over time.",
        "AIC and BIC for model selection in time series: BIC penalizes complexity more heavily and tends to select parsimonious models.",
        "Bootstrap methods can construct confidence intervals without distributional assumptions. Block bootstrap preserves temporal dependence.",
        "Generalized method of moments (GMM) estimation is widely used in asset pricing. The Hansen-Jagannathan bound constrains the stochastic discount factor.",
        "Maximum likelihood estimation (MLE) finds parameters that maximize the likelihood function. For GARCH models, MLE with t-distributed innovations improves fit.",
        "Heteroscedasticity means non-constant variance of errors. White standard errors correct for this. Breusch-Pagan test detects heteroscedasticity.",
        "Panel data methods: fixed effects control for unobserved time-invariant heterogeneity. Random effects assume individual effects are uncorrelated with regressors.",
        "Quantile regression estimates conditional quantiles instead of the conditional mean. Useful for risk analysis: model the 5th percentile of returns for VaR.",
    ],
    "time_series_analysis": [
        "ARMA models combine autoregressive and moving average components. An ARMA(p,q) has p AR lags and q MA lags. Box-Jenkins methodology: identify, estimate, diagnose.",
        "Johansen cointegration test uses eigenvalues of a matrix involving the levels of the VAR. Trace and max eigenvalue statistics test for cointegrating relationships.",
        "Exponentially weighted moving average (EWMA) for volatility: sigma_t^2 = lambda*sigma^2_{t-1} + (1-lambda)*r^2_{t-1}. RiskMetrics uses lambda=0.94.",
        "Regime switching models (Hamilton): the process switches between states according to a hidden Markov chain. Each state has its own mean and variance.",
        "Granger causality tests whether past values of X improve prediction of Y beyond Y's own past. Does not imply true causation.",
        "The Augmented Dickey-Fuller test checks for unit roots. Most price series are I(1) non-stationary, but returns are I(0) stationary.",
        "VAR models: each variable is regressed on lags of itself and all other variables. Impulse response functions show how shocks propagate through the system.",
        "Seasonal decomposition: STL separates time series into trend, seasonal, and residual components. Useful for detrending financial data before modeling.",
        "Autocorrelation function (ACF) and partial ACF (PACF) are used to identify ARMA order. ACF cuts off for MA, PACF cuts off for AR processes.",
        "Spectral analysis decomposes time series into frequency components using the Fourier transform. Low-frequency components capture long-run trends in volatility.",
    ],
    "derivatives_pricing": [
        "Binomial tree pricing: at each node, option value is the discounted expected value under risk-neutral probabilities. Work backwards from maturity.",
        "Exotic options: barrier options knock in/out at a barrier. Asian options average the price. Lookback options use the path max or min.",
        "The Greeks: delta, gamma, vega, theta, rho represent sensitivities of option price to underlying, time, volatility, and rates.",
        "Implied volatility is backed out from market option prices using Newton-Raphson on the Black-Scholes formula. IV surface varies by strike and maturity.",
        "American options can be exercised early. Longstaff-Schwartz regression estimates continuation value for Monte Carlo pricing of American options.",
        "The Black-Scholes formula for a European call: C = S*N(d1) - K*exp(-rT)*N(d2). d1 and d2 involve the forward price and volatility.",
        "Risk-neutral pricing: the fair price of a derivative equals the discounted expectation under the risk-neutral measure Q. Fundamental theorem of asset pricing.",
        "Put-call parity for European options: C - P = S*exp(-qT) - K*exp(-rT). Model-independent relationship from no-arbitrage.",
        "Volatility smile: out-of-the-money puts have higher implied vol than ATM options. This contradicts Black-Scholes constant vol assumption.",
        "Swaptions give the right to enter an interest rate swap. Priced using the Black model with the swap rate as the underlying and annuity as numeraire.",
    ],
    "portfolio_optimization": [
        "Risk parity equalizes risk contribution from each asset. Marginal risk contribution = weight * covariance with portfolio / portfolio vol.",
        "Factor models reduce dimensionality: R_i = alpha + sum(beta_j * F_j) + epsilon. Common factors: market, size, value, momentum, quality.",
        "The Markowitz efficient frontier is sensitive to estimation error. Resampled efficiency averages portfolios across simulations.",
        "Transaction costs make optimization dynamic. Balance tracking error reduction against trading costs at each rebalance period.",
        "Robust optimization uses uncertainty sets for parameters. Worst-case optimization protects against estimation error.",
        "Black-Litterman model combining equilibrium returns with investor views. Solves the problem of extreme weights from pure mean-variance.",
        "Minimum variance portfolio requires only the covariance matrix, not expected returns. Often outperforms mean-variance in practice.",
        "Mean-CVaR optimization: minimize conditional value at risk instead of variance. Better for assets with skewed and fat-tailed returns.",
        "Kelly criterion determines optimal bet size: f = (bp - q) / b where b is odds, p is win probability. Maximizes long-run growth rate.",
        "Hierarchical risk parity: cluster assets by correlation, then allocate within and across clusters. More stable than mean-variance optimization.",
    ],
    "risk_management": [
        "Stress testing involves revaluing the portfolio under extreme scenarios. Historical (2008, COVID) and hypothetical (rate shock, equity crash).",
        "Credit Value Adjustment (CVA) adjusts derivative value for counterparty credit risk. CVA = integral of expected exposure * default prob * LGD.",
        "Risk attribution decomposes portfolio risk into contributions from each position or factor. Euler decomposition is additive by construction.",
        "Margin requirements: initial margin covers potential future exposure, variation margin settles daily P&L. ISDA SIMM standardizes IM calculation.",
        "Operational risk modeling uses loss distribution approach: frequency and severity distributions convolved to get aggregate loss.",
        "Expected Shortfall ES = E[Loss | Loss > VaR]. Coherent risk measure unlike VaR. Basel III requires ES at 97.5% for market risk capital.",
        "Backtesting VaR models: count the number of days actual losses exceed VaR. Kupiec test and Christoffersen test check coverage and independence.",
        "Credit risk: PD (probability of default), LGD (loss given default), EAD (exposure at default). Expected loss = PD * LGD * EAD.",
        "Liquidity risk: the risk that assets cannot be sold quickly without significant price impact. Bid-ask spread is a simple liquidity measure.",
        "Model risk: the risk from using inaccurate models. Model validation involves backtesting, sensitivity analysis, and benchmark comparison.",
    ],
    "algorithmic_trading": [
        "Optimal execution: trade off market impact vs timing risk. Almgren-Chriss gives the efficient frontier of expected cost vs variance.",
        "Market making: post bid/ask quotes, earn when spread is crossed, manage inventory risk. Avellaneda-Stoikov optimizes quotes by inventory and vol.",
        "Dark pools and alternative venues: route orders across venues to minimize information leakage and achieve best execution.",
        "Statistical arbitrage: pairs trading, PCA-based basket trading, mean-reversion in factor residuals. Distinguish mean-reversion from trend.",
        "High-frequency data: tick data needs special handling. Realized variance estimators handle microstructure noise in intraday data.",
        "VWAP and TWAP algorithms: Volume Weighted Average Price slices orders by historical volume profiles. Time Weighted spreads evenly over time.",
        "Implementation shortfall = decision price - execution price. Decompose into timing cost, market impact, and opportunity cost.",
        "Order book dynamics: limit orders provide liquidity, market orders consume it. Queue position matters for passive execution strategies.",
        "Latency arbitrage exploits speed differences between venues. Requires co-location and optimized network infrastructure.",
        "Transaction cost analysis (TCA) evaluates execution quality. Compare actual fills vs benchmarks like arrival price, VWAP, or close price.",
    ],
    "ml_for_finance": [
        "Feature engineering for finance: RSI, MACD, cross-sectional rankings, z-scores relative to sector, and fundamental-price interactions.",
        "Purged k-fold cross validation: remove training observations that could leak info through overlapping return windows. Essential for time series.",
        "Neural ODEs for irregularly sampled financial data: model latent state evolution as a continuous-time ODE. Handle asynchronous observations.",
        "GANs for synthetic financial data: train a generator to produce realistic price paths for scenario analysis and model stress testing.",
        "Knowledge graphs for financial ML: encode company-sector-macro relationships. Graph neural networks exploit these for better prediction.",
        "Walk-forward analysis: train on a rolling window, predict the next period, accumulate out-of-sample results. No look-ahead bias.",
        "XGBoost and LightGBM for cross-sectional return prediction. Feature importance via SHAP values. Watch for multicollinearity instability.",
        "LSTM and transformer architectures for financial time series. Non-stationarity requires rolling retraining with expanding windows.",
        "Ensemble methods: combine diverse models (linear, tree, neural) for robust trading signals. Stacking typically outperforms simple averaging.",
        "Autoencoders for anomaly detection in market data: reconstruct normal patterns, flag high reconstruction error as anomalies.",
    ],
    "fixed_income": [
        "Key rate durations measure sensitivity of bond price to specific yield curve points. Useful for hedging non-parallel movements.",
        "Mortgage prepayment models: PSA benchmark. Sophisticated models use pool characteristics and interest rate path dependence.",
        "Credit spread modeling: structural (Merton) derives spreads from fundamentals. Reduced-form (Jarrow-Turnbull) models default intensity.",
        "Inflation-linked bonds (TIPS): pay real yield plus inflation adjustment. Break-even inflation = nominal - real yield.",
        "Repo markets provide short-term secured financing for bond traders. The repo rate reflects collateral quality and market conditions.",
        "The Nelson-Siegel model parameterizes the yield curve with three factors: level, slope, and curvature. Very parsimonious fit.",
        "Bond dirty price = clean price + accrued interest. Day count conventions (ACT/360, 30/360) determine accrued interest calculation.",
        "Duration matching: immunize a bond portfolio against interest rate risk by matching asset and liability durations.",
        "Convexity measures the curvature of the price-yield relationship. Positive convexity means bonds gain more from rate drops than they lose from rate rises.",
        "Vasicek and CIR models for short rates: both mean-reverting but CIR prevents negative rates with sqrt(r) diffusion term.",
    ],
    "numerical_methods": [
        "Quasi-random sequences (Sobol, Halton) fill space more uniformly than pseudorandom. Reduce Monte Carlo error toward O(1/N) for smooth functions.",
        "Calibration of stochastic vol models: minimize squared difference between model and market implied vols. Levenberg-Marquardt for optimization.",
        "Fourier methods for option pricing: characteristic function of log-price enables fast FFT-based European option pricing under Heston.",
        "Adjoint algorithmic differentiation: compute Greeks at O(1) cost relative to pricing, regardless of parameter count. Essential for xVA.",
        "Implicit finite difference schemes are unconditionally stable but require solving a tridiagonal system each step. Thomas algorithm is O(N).",
        "Newton-Raphson method for implied vol: iterate v_{n+1} = v_n - (BS(v_n)-C_mkt)/vega(v_n) until convergence. Converges quadratically.",
        "Trapezoidal rule and Simpson's rule for numerical integration. Bond pricing requires numerical quadrature for complex cash flow structures.",
        "Variance reduction in Monte Carlo: antithetic variates, control variates, importance sampling. Can reduce variance by orders of magnitude.",
        "Finite element methods: more flexible than finite differences for complex domain geometries. Used in multi-factor interest rate models.",
        "Root-finding algorithms: bisection (robust but slow), Newton (fast but needs derivative), Brent's method (combines robustness and speed).",
    ],
    "volatility_modeling": [
        "Realized volatility: sum of squared intraday returns. 5-minute returns balance accuracy and microstructure noise.",
        "The leverage effect: negative returns-volatility correlation. Stock drops increase leverage, making equity riskier. Captured by rho in Heston.",
        "Variance risk premium: implied vol exceeds realized vol. Selling variance swaps captures this premium. The VRP predicts equity returns.",
        "Vol of vol: measured by VVIX or from vol surface curvature. Higher vol-of-vol leads to fatter return tails.",
        "Term structure of volatility: short-term vol is more variable than long-term. Mean reversion causes term structure to flatten.",
        "The VIX index measures 30-day expected S&P 500 volatility from option prices. Model-free calculation. Spikes signal market fear.",
        "GARCH models for conditional volatility: sigma^2_t = omega + alpha*eps^2_{t-1} + beta*sigma^2_{t-1}. Persistence alpha+beta close to 1.",
        "Implied volatility surface: plot IV against strike and maturity. Skew (strike), term structure (maturity), and smile dynamics.",
        "Stochastic volatility models (Heston, SABR): volatility follows its own SDE. More realistic than constant vol but harder to calibrate.",
        "Local volatility (Dupire): sigma(K,T)^2 = 2*(dC/dT)/(K^2*d^2C/dK^2). Forward smile flattens unrealistically fast.",
    ],
    "python_for_quant": [
        "Vectorized operations in NumPy are 10-100x faster than Python loops. Use broadcasting instead of explicit loops.",
        "QuantLib Python bindings: create Schedule, FixedRateBond, and PricingEngine objects. Lattice engine for bonds with embedded options.",
        "Zipline backtesting: define initialize() and handle_data(). Pipeline API computes factors across the universe.",
        "Multiprocessing for Monte Carlo: ProcessPoolExecutor parallelizes independent path simulations across CPU cores.",
        "Pandas time series: resample() for frequency, rolling() for windows, ewm() for EWMA statistics. BDay for business days.",
        "QuantLib's AnalyticEuropeanEngine with GeneralizedBlackScholesProcess: set up quote handle, term structure, vol, call NPV().",
        "SciPy optimize: minimize() with SLSQP for constrained portfolio optimization. Pass jacobian for faster convergence.",
        "Matplotlib and plotly for financial visualization: candlestick charts, yield curves, vol surfaces, and heatmaps.",
        "Dask and Vaex for out-of-core computation on large tick data sets that don't fit in memory. Lazy evaluation paradigm.",
        "API integration with market data providers: Alpha Vantage, Yahoo Finance, Bloomberg BQL, and Interactive Brokers TWS API.",
    ],
    "quant_interview_prep": [
        "Green-eyed logic puzzle: common knowledge reasoning. On day N, N green-eyed people leave by induction.",
        "Secretary problem (optimal stopping): skip first N/e candidates, then pick the first who beats all seen. P(best)=1/e.",
        "St. Petersburg paradox: coin flip game with expected value infinity, but finite expected utility. Illustrates risk aversion.",
        "Market making simulation: quote bid/ask, estimate fair value from trade flow. Adverse selection by informed traders.",
        "Correlation vs causation: ice cream and drowning correlate (summer confound). Factor anomalies may have common risk drivers.",
        "Two envelopes problem: you see $100, should you switch? Naive EV says yes, but the paradox comes from an improper prior.",
        "Expected number of coin flips to get heads: geometric distribution with mean 1/p. For fair coin, E[flips]=2.",
        "Mental math: estimate sqrt(2) ~ 1.414, e ~ 2.718, ln(2) ~ 0.693. Approximate option deltas and swap rates quickly.",
        "Monty Hall problem: always switch doors. The host revealing a goat changes the posterior probability from 1/3 to 2/3.",
        "Russian roulette with 2 bullets in adjacent chambers: if first chamber was empty, should you spin or shoot? Shoot has 4/5 survival.",
    ],
}


def augment_data(
    records: list[dict],
    text_encoder: TextEncoder,
    augment_factor: int = 5,
) -> list[dict]:
    """
    Augment via:
    1. Gaussian noise injection on embeddings (simulates paraphrasing)
    2. Extra template-based signals per topic
    """
    augmented = []

    # A) Noise augmentation of existing signals
    for rec in records:
        base_emb = text_encoder.encode(rec["text"])
        topic_idx = TOPIC_TO_IDX.get(rec["topic_label"], 0)
        strength = float(rec["strength_label"])
        type_idx = SIGNAL_TYPE_TO_IDX[rec["signal_type_label"]]

        # Original
        augmented.append({
            "input": torch.tensor(base_emb, dtype=torch.float32),
            "topic": torch.tensor(topic_idx, dtype=torch.long),
            "strength": torch.tensor(strength, dtype=torch.float32),
            "signal_type": torch.tensor(type_idx, dtype=torch.long),
        })

        # Noisy copies
        for _ in range(augment_factor):
            noise_scale = random.uniform(0.02, 0.08)
            noisy_emb = base_emb + np.random.randn(TEXT_EMBED_DIM).astype(np.float32) * noise_scale
            noisy_emb = noisy_emb / (np.linalg.norm(noisy_emb) + 1e-8) * np.linalg.norm(base_emb)

            # Slightly perturb strength too
            noisy_strength = np.clip(strength + random.gauss(0, 0.05), 0.0, 1.0)
            augmented.append({
                "input": torch.tensor(noisy_emb, dtype=torch.float32),
                "topic": torch.tensor(topic_idx, dtype=torch.long),
                "strength": torch.tensor(noisy_strength, dtype=torch.float32),
                "signal_type": torch.tensor(type_idx, dtype=torch.long),
            })

    # B) Template-based signals
    for topic_id, templates in TOPIC_TEMPLATES.items():
        topic_idx = TOPIC_TO_IDX.get(topic_id, 0)
        for text in templates:
            emb = text_encoder.encode(text)
            strength = random.uniform(0.6, 0.9)
            sig_type = random.choice([0, 0, 1, 1, 2])  # weighted: more new_info/reinforcement

            augmented.append({
                "input": torch.tensor(emb, dtype=torch.float32),
                "topic": torch.tensor(topic_idx, dtype=torch.long),
                "strength": torch.tensor(strength, dtype=torch.float32),
                "signal_type": torch.tensor(sig_type, dtype=torch.long),
            })

            # Noisy copies of templates too
            for _ in range(3):
                noise_scale = random.uniform(0.02, 0.06)
                noisy_emb = emb + np.random.randn(TEXT_EMBED_DIM).astype(np.float32) * noise_scale
                noisy_emb = noisy_emb / (np.linalg.norm(noisy_emb) + 1e-8) * np.linalg.norm(emb)
                augmented.append({
                    "input": torch.tensor(noisy_emb, dtype=torch.float32),
                    "topic": torch.tensor(topic_idx, dtype=torch.long),
                    "strength": torch.tensor(float(np.clip(strength + random.gauss(0, 0.05), 0, 1)), dtype=torch.float32),
                    "signal_type": torch.tensor(sig_type, dtype=torch.long),
                })

    random.shuffle(augmented)
    return augmented


# ── Dataset from pre-computed samples ─────────────────────────────────

class PrecomputedDataset(Dataset):
    def __init__(self, samples: list[dict]) -> None:
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        return self.samples[idx]


# ── Evaluation ────────────────────────────────────────────────────────

@torch.no_grad()
def evaluate(model: RIQESignalClassifier, loader: DataLoader) -> dict:
    model.eval()
    topic_correct = 0
    type_correct = 0
    strength_ae = 0.0
    total = 0
    total_loss = 0.0

    for batch in loader:
        topic_logits, strength_pred, type_logits = model(batch["input"])

        loss = RIQESignalClassifier.composite_loss(
            topic_logits=topic_logits,
            topic_targets=batch["topic"],
            strength_pred=strength_pred,
            strength_targets=batch["strength"],
            type_logits=type_logits,
            type_targets=batch["signal_type"],
        )
        total_loss += loss.item()

        topic_pred = topic_logits.argmax(dim=1)
        type_pred = type_logits.argmax(dim=1)

        topic_correct += (topic_pred == batch["topic"]).sum().item()
        type_correct += (type_pred == batch["signal_type"]).sum().item()
        strength_ae += (strength_pred.squeeze() - batch["strength"]).abs().sum().item()
        total += batch["topic"].size(0)

    model.train()
    return {
        "topic_acc": topic_correct / total,
        "type_acc": type_correct / total,
        "strength_mae": strength_ae / total,
        "loss": total_loss / len(loader),
    }


# ── Main Training ────────────────────────────────────────────────────

def train(
    epochs: int = 120,
    lr: float = 5e-4,
    batch_size: int = 16,
    val_split: float = 0.15,
) -> None:
    """Train signal classifier with augmented quant data."""

    # 1. Load labeled signals
    signals_path = TRAINING_DATA_DIR / "sample_signals.json"
    with open(str(signals_path), "r", encoding="utf-8") as f:
        all_records = json.load(f)
    print(f"Loaded {len(all_records)} labeled signals")

    # 2. Encode + augment
    print("Encoding and augmenting data...")
    text_encoder = TextEncoder()
    all_samples = augment_data(all_records, text_encoder, augment_factor=6)
    print(f"After augmentation: {len(all_samples)} samples")

    # 3. Train / val split
    random.seed(42)
    random.shuffle(all_samples)
    n_val = max(10, int(len(all_samples) * val_split))
    val_samples = all_samples[:n_val]
    train_samples = all_samples[n_val:]
    print(f"Train: {len(train_samples)}  |  Val: {len(val_samples)}")

    train_loader = DataLoader(PrecomputedDataset(train_samples), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(PrecomputedDataset(val_samples), batch_size=batch_size, shuffle=False)

    # 4. Model
    model = RIQESignalClassifier()
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_val_acc = 0.0
    print("\n--- Training ---")

    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for batch in train_loader:
            topic_logits, strength_pred, type_logits = model(batch["input"])

            loss = RIQESignalClassifier.composite_loss(
                topic_logits=topic_logits,
                topic_targets=batch["topic"],
                strength_pred=strength_pred,
                strength_targets=batch["strength"],
                type_logits=type_logits,
                type_targets=batch["signal_type"],
            )

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        scheduler.step()
        avg_train_loss = total_loss / len(train_loader)

        # Evaluate periodically
        if epoch % 10 == 0 or epoch == 1 or epoch == epochs:
            val_m = evaluate(model, val_loader)
            print(
                f"Epoch {epoch:3d}/{epochs}  "
                f"train_loss={avg_train_loss:.4f}  "
                f"val_loss={val_m['loss']:.4f}  "
                f"topic_acc={val_m['topic_acc']:.1%}  "
                f"type_acc={val_m['type_acc']:.1%}  "
                f"str_mae={val_m['strength_mae']:.4f}"
            )

            if val_m["topic_acc"] > best_val_acc:
                best_val_acc = val_m["topic_acc"]
                CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), CHECKPOINTS_DIR / "signal_classifier.pt")

    # 5. Final
    print("\n--- Final Validation ---")
    final = evaluate(model, val_loader)
    print(f"  Topic Accuracy : {final['topic_acc']:.1%}")
    print(f"  Type Accuracy  : {final['type_acc']:.1%}")
    print(f"  Strength MAE   : {final['strength_mae']:.4f}")
    print(f"  Best Topic Acc : {best_val_acc:.1%}")

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), CHECKPOINTS_DIR / "signal_classifier.pt")
    print(f"\n[OK] Saved -> {CHECKPOINTS_DIR / 'signal_classifier.pt'}")


if __name__ == "__main__":
    train()
