# 01 — DC Power-Flow Assumptions

The Phase-4 solver uses the **DC power-flow** approximation: a linearization of
the full AC power-flow equations that reduces the problem to a single sparse
linear system per island. It is the standard first-order model for real-power
(MW) analysis in transmission planning, contingency screening, and market
dispatch, precisely because it is fast, robust, and always converges when the
network is connected and reactances are positive.

## The AC equations we are linearizing

Real power injected at bus _i_ in the exact AC model is

$$
P_i = \sum_{j} |V_i|\,|V_j|\,\big( G_{ij}\cos\theta_{ij} + B_{ij}\sin\theta_{ij} \big),
\qquad \theta_{ij} = \theta_i - \theta_j .
$$

The DC approximation applies four simplifications to this expression.

## The four DC assumptions

| #   | Assumption                                                                                          | Consequence in the equations                                          |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Flat voltage magnitude** — every bus is at 1.0 pu                                                 | $\lvert V_i\rvert = \lvert V_j\rvert = 1$ drops out of every term     |
| 2   | **Lossless network / resistance ignored** — branches modeled by reactance only                      | series conductance $G_{ij} \to 0$; only the susceptance term survives |
| 3   | **Small angle differences** — $\sin\theta_{ij} \approx \theta_{ij}$ and $\cos\theta_{ij} \approx 1$ | the sine linearizes; the cosine term vanishes with $G_{ij}$           |
| 4   | **Reactive power ignored** — only the real-power (P–θ) sub-problem is solved                        | no Q, no voltage-magnitude unknowns                                   |

Applying all four collapses the injection equation to a **linear** relationship
between real-power injections and angles:

$$
P_i \approx \sum_j B_{ij}\,\theta_{ij}
\quad\Longrightarrow\quad
P_{\text{line}} \approx \frac{\theta_{\text{from}} - \theta_{\text{to}}}{x}
= b\,(\theta_{\text{from}} - \theta_{\text{to}}).
$$

Because resistance is dropped, a branch is characterized **entirely by its
series reactance** `reactancePu` (per unit). Its susceptance is `b = 1/x`
(this is why a non-positive reactance is rejected before solving — see
[06-validation.md](./06-validation.md)). The full derivation and matrix
assembly are in [02-mathematical-formulation.md](./02-mathematical-formulation.md).

## What the DC model computes — and what it ignores

| Quantity                            | DC model                                      |
| ----------------------------------- | --------------------------------------------- |
| Bus voltage **angles** (θ)          | **Computed** (relative to the slack)          |
| Real-power **line flows** (MW)      | **Computed**, `b·(θ_from − θ_to)·baseMVA`     |
| Line **loading** vs. thermal rating | **Computed**, `\|flow\| / capacityMw`         |
| Aggregate real-power **balance**    | **Computed** (= 0 within tolerance, lossless) |
| Voltage **magnitudes** (\|V\|)      | **Ignored** — fixed at 1.0 pu                 |
| **Reactive** power (Q, MVAr)        | **Ignored**                                   |
| Real-power **losses** (I²R)         | **Ignored** — network is lossless             |
| Line **resistance**                 | **Ignored** — reactance only                  |

## When the DC approximation is valid

The approximation is accurate when the assumptions above roughly hold, i.e. a
**high-voltage transmission network** operating near nominal voltage:

- voltage magnitudes stay close to 1.0 pu across the system;
- branch **X ≫ R** (reactance dominates resistance), as on HV lines;
- angle differences across any branch are **small** (a few degrees), so
  `sin θ ≈ θ` holds;
- the study cares about **real-power (MW) flows and thermal loading**, not
  voltages or reactive dispatch.

## When it is not appropriate

The DC model should not be trusted where its assumptions break down:

- **distribution networks** and cables, where R is comparable to or larger than X;
- **voltage / reactive-power studies** (voltage stability, VAr planning) — the
  model has no |V| or Q at all;
- **loss accounting** — DC is lossless by construction, so
  generation exactly equals load;
- **heavily loaded** corridors with large angle spreads, where the small-angle
  linearization loses accuracy.

For those, the future **AC solver** — restoring |V|, Q, resistance, and the
nonlinear equations via Newton–Raphson — is the intended successor. It plugs in
behind the same read-only graph surface; see
[07-limitations-and-ac-extension.md](./07-limitations-and-ac-extension.md).
