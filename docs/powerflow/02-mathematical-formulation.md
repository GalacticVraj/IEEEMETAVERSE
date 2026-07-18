# 02 — Mathematical Formulation

This document gives the exact linear algebra the solver implements, term for
term, matching `dc-model.ts` (matrix assembly) and `dc-power-flow.ts`
(the per-island solve). Every symbol below maps to a named field on `DcIsland`
or a step in `solveIsland`.

## 1. Branch susceptance

Each DC branch is a graph line reduced to its series reactance. Its
**susceptance** is the reciprocal of the per-unit reactance:

$$
b = \frac{1}{x} = \frac{1}{\texttt{reactancePu}}
$$

In code (`dc-model.ts`): `susceptance: 1 / line.reactancePu`. A non-positive
`reactancePu` would make `b` infinite/invalid and is rejected up front
(`INVALID_REACTANCE`).

## 2. Bus susceptance matrix B

For an island of `n` buses, `B` is the `n × n` symmetric bus susceptance
matrix. It is the weighted graph Laplacian using branch susceptances as edge
weights:

$$
B_{ii} = \sum_{k \,\in\, \text{branches incident to } i} b_k,
\qquad
B_{ij} = -\!\!\sum_{k \,\in\, \text{branches between } i,j} b_k \quad (i \neq j).
$$

Assembly (`dc-model.ts`) accumulates each branch's contribution into four cells:

```text
for each branch (i, j) with susceptance b:
    B[i][i] += b
    B[j][j] += b
    B[i][j] -= b
    B[j][i] -= b
```

Properties: `B` is symmetric, each row sums to zero, and — for a connected
island — it is singular with a one-dimensional null space (the all-ones vector).
That singularity is exactly why an angle reference (the slack) is required.

## 3. Net injection vector P

The net real-power injection at each bus is generation minus load, in MW:

$$
P_i^{\text{MW}} = \text{generation}_i - \text{load}_i .
$$

- **generation** defaults to the summed nameplate `capacityMw` of generators at
  the bus; a `generationMw(bus)` override (for Phase-5 dispatch) replaces it.
- **load** is the summed `nominalDemandMw` of loads at the bus.

Stored on `DcIsland` as `generationMw[]`, `loadMw[]`, and
`netInjectionMw[] = generationMw − loadMw`. Before entering the linear solve,
injections are converted to **per unit** by dividing by the system base
(`baseMva`, default **100**):

$$
P_i^{\text{pu}} = \frac{P_i^{\text{MW}}}{\texttt{baseMva}} .
$$

## 4. The DC system Bθ = P

With flat voltages and the small-angle linearization, the vector of bus angles
`θ` (radians) satisfies

$$
B\,\theta = P^{\text{pu}} .
$$

Because `B` is singular for a connected island, we cannot invert it directly.
We fix a **reference**: the **slack bus** angle is pinned at 0.

$$
\theta_{\text{slack}} = 0 .
$$

## 5. The reduced system B′θ′ = P′

Pinning the slack angle lets us **remove the slack row and column** from `B` and
the slack entry from `P`, giving a reduced, non-singular system over the
non-slack buses only:

$$
B'\,\theta' = P',
$$

where $B'$ is `B` with the slack row/column deleted, $P'$ is the per-unit
injection over non-slack buses, and $\theta'$ are the unknown non-slack angles.
In `solveIsland` this is built directly from the non-slack index set:

```text
nonSlack = [ every bus index i where i != slackIndex ]
B'[r][c] = B[nonSlack[r]][nonSlack[c]]
P'[r]    = netInjectionMw[nonSlack[r]] / baseMva
θ'       = solveLinearSystem(B', P')     // dense Gaussian elimination
```

The solved non-slack angles are scattered back into the full angle vector; the
slack entry stays 0. A single-bus island (`n === 1`) skips the solve entirely:
its angle is 0 and it is marked **`trivial`**.

## 6. Line flows

Once angles are known, the real-power flow on each branch (MW, positive =
`from → to`) is

$$
P_{\text{flow}} = b\,\big(\theta_{\text{from}} - \theta_{\text{to}}\big)\cdot \texttt{baseMva}.
$$

Line **loading** is the magnitude relative to the thermal rating (0 when the
line has no capacity set):

$$
\text{loading} = \frac{\lvert P_{\text{flow}}\rvert}{\texttt{capacityMw}} .
$$

## 7. Slack generation and power balance

The slack bus absorbs the network's remaining injection. Its net injection is
row `slackIndex` of `Bθ` scaled back to MW; its generation adds back the local
load:

$$
P_{\text{slack}}^{\text{net}} = (B\theta)_{\text{slack}}\cdot \texttt{baseMva},
\qquad
G_{\text{slack}} = P_{\text{slack}}^{\text{net}} + \text{load}_{\text{slack}} .
$$

Total generation is slack generation plus the (fixed) generation at every
non-slack bus; the **power balance** is total generation minus total load,
which for a lossless DC solve is ≈ 0:

$$
\text{powerBalanceMw} = \sum G - \sum \text{load} \approx 0 .
$$

## 8. Residual

The **residual** is a numerical self-check: the infinity-norm of the difference
between the injection the solved angles reproduce and the injection we asked
for, over the non-slack buses:

$$
\text{residual} = \big\lVert\, (B\theta)\cdot\texttt{baseMva} - P^{\text{MW}} \,\big\rVert_{\infty}
\quad\text{over non-slack buses} \;\approx 0 .
$$

A well-conditioned solve yields a residual near machine precision (the 30-bus
robustness test asserts `< 1e-9`). A large residual is surfaced as
`NUMERICAL_INSTABILITY` — see [06-validation.md](./06-validation.md).

---

## Worked example — two buses

**Network:** two buses `b1`, `b2`, one line between them.

| Quantity           | Value          |
| ------------------ | -------------- |
| Generation         | 100 MW at `b1` |
| Load               | 100 MW at `b2` |
| Line reactance `x` | 0.1 pu         |
| `baseMva`          | 100            |

**Step 1 — susceptance.** $b = 1/x = 1/0.1 = 10$.

**Step 2 — B matrix** (index order `b1 = 0`, `b2 = 1`):

$$
B = \begin{bmatrix} 10 & -10 \\ -10 & 10 \end{bmatrix}.
$$

**Step 3 — injections (MW → pu).**
$P^{\text{MW}} = [\,+100,\; -100\,]$, so
$P^{\text{pu}} = [\,+1,\; -1\,]$.

**Step 4 — slack.** `b1` has the largest generator capacity, so it is the slack
(`generator-priority`, see [05-slack-selection.md](./05-slack-selection.md)).
$\theta_{b1} = 0$, `slackIndex = 0`.

**Step 5 — reduced system.** Remove slack row/column 0, leaving the single
non-slack bus `b2`:

$$
B' = [\,10\,], \qquad P' = [\,-1\,], \qquad 10\,\theta_{b2} = -1
\;\Longrightarrow\; \boxed{\theta_{b2} = -0.1 \text{ rad}}.
$$

**Step 6 — line flow** (`from = b1`, `to = b2`):

$$
P_{\text{flow}} = b\,(\theta_{b1} - \theta_{b2})\cdot\texttt{baseMva}
= 10\,(0 - (-0.1))\cdot 100 = \boxed{100 \text{ MW}} \;(b1 \to b2).
$$

**Step 7 — slack generation.**
$(B\theta)_0 = 10\cdot 0 + (-10)(-0.1) = 1.0$ pu, so
$P_{\text{slack}}^{\text{net}} = 1.0 \cdot 100 = 100$ MW, and
$G_{\text{slack}} = 100 + 0 = \boxed{100 \text{ MW}}$.

**Step 8 — balance and residual.**
Power balance $= 100 - 100 = 0$ MW. The computed non-slack injection
$(B\theta)_1\cdot 100 = (-10\cdot 0 + 10\cdot(-0.1))\cdot 100 = -100$ MW equals
the requested $-100$ MW, so **residual = 0**.

This is exactly the `dc-power-flow` two-bus test: 100 MW flow, 100 MW slack
generation, zero balance, zero residual.
