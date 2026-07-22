/**
 * operator-actions.ts — the standing operator action catalog.
 *
 * Each action is a LEARNING DECISION, not a raw engineering control: it names
 * the human intervention, its cost, benefit, and risk. Executing one emits a
 * DecisionCommitted with the matching `op-*` decision id; the engine maps that
 * id to real load-model interventions (see simulation-engine DecisionCommitted
 * handler). The UI never touches the engine directly.
 */

export interface OperatorAction {
  readonly id: string;
  readonly label: string;
  /** Plain-language effect line shown under the label. */
  readonly plainEffect: string;
  readonly cost: string;
  readonly benefit: string;
  readonly risk: string;
}

export const OPERATOR_ACTIONS: readonly OperatorAction[] = [
  {
    id: 'op-ac-residential',
    label: 'Reduce residential AC',
    plainEffect: 'Cycles air-conditioning off across both residential districts.',
    cost: 'Homes warm up a few degrees',
    benefit: 'Large, fast demand drop',
    risk: 'Public discomfort in a heatwave',
  },
  {
    id: 'op-ev-pause',
    label: 'Pause public EV charging',
    plainEffect: 'Suspends every public charging station city-wide.',
    cost: 'Drivers wait to charge',
    benefit: 'Removes concentrated fast-charge spikes',
    risk: 'Airport and fleet vehicles delayed',
  },
  {
    id: 'op-lights-commercial',
    label: 'Dim commercial lighting',
    plainEffect: 'Cuts non-essential lighting in downtown offices.',
    cost: 'Dimmer offices and storefronts',
    benefit: 'Relieves downtown corridor stress',
    risk: 'Minimal — lowest-impact lever',
  },
  {
    id: 'op-shed-industrial',
    label: 'Controlled industrial shed',
    plainEffect: 'Sheds 30 % of heavy and light industrial load.',
    cost: 'Factory output lost',
    benefit: 'Big relief on the southern backbone',
    risk: 'Economic cost; restart takes time',
  },
  {
    id: 'op-shed-harbor',
    label: 'Emergency harbor shed',
    plainEffect: 'Sheds 25 % of harbor industry and shipping load.',
    cost: 'Port operations slow',
    benefit: 'Frees the harbor interconnect for imports',
    risk: 'Water treatment stays protected, but margins thin',
  },
];
