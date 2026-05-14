/* ─────────────────────────────────────────────────────────────────────
   SKEPTIC'S READ ENGINE — asset-class-agnostic synthesis core
   ─────────────────────────────────────────────────────────────────────
   The reusable architectural piece of The Filter Lab. Every asset class
   (equities, options, fixed income, FX, commodities) implements three
   independent lenses that emit a structured "read." This engine counts
   convergence across them and synthesizes a verdict.

   USAGE:
     // Each asset-class module provides three lens functions
     var lenses = [
       equityISCLens(data),         // {lens, label, color, flag, note}
       equityTraditionalLens(data),
       equityForensicLens(data)
     ];
     var read = SkepticEngine.synthesize(lenses, { contextHint: 'biotech' });
     // → {verdict, color, prose, lenses, watchItems, convergenceCount, availableCount}

   LENS CONTRACT:
     A lens function returns: {
       lens:   string,  // display name e.g. "ISC", "Traditional", "Forensic"
       label:  string,  // short status word e.g. "Distressed", "Strong", "Clean"
       color:  string,  // CSS var or hex e.g. "var(--red)"
       flag:   one of 'stress' | 'clean' | 'strong' | 'mixed' | 'insufficient'
       note:   string   // one-sentence detail
     }

   SYNTHESIS RULES (count-based, not weighted):
     - 3 stress lenses available + all stressed   → MULTI-LENS WARNING (red, loud)
     - 2 stress lenses + 1 non-stress             → PARTIAL CONVERGENCE (amber)
     - 1 stress lens only                         → SINGLE-LENS FLAG (amber, quiet)
     - 2+ strong/clean lenses, 0 stress           → CLEAN ACROSS LENSES (green)
     - Otherwise                                  → MIXED / INSUFFICIENT (dim)

   CONTEXT HINTS:
     'biotech' — replace generic watchItems with cash runway / clinical milestones
     'high-growth' — soften the "single forensic flag" warning (Beneish noisier here)
     Add more as needed; the engine accepts any string and dispatches via
     contextWatchItemOverrides{}.
   ───────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  var SkepticEngine = {};

  // ─────────────────────────────────────────────────────────────────
  // synthesize — the core function
  // ─────────────────────────────────────────────────────────────────
  SkepticEngine.synthesize = function (lenses, options) {
    options = options || {};
    var contextHint = options.contextHint || null;

    // Filter to lenses that produced a real signal
    var available = lenses.filter(function (l) { return l.flag !== 'insufficient'; });
    var stress = available.filter(function (l) { return l.flag === 'stress'; });
    var strong = available.filter(function (l) { return l.flag === 'strong' || l.flag === 'clean'; });

    var verdict, vColor, prose, watchItems = [];

    // Three or more lenses agree on stress
    if (stress.length >= 3) {
      verdict = '\u26A0 Multi-Lens Warning';
      vColor = 'var(--red)';
      prose = 'All three lenses point to structural stress. ' +
              lenses.map(function (l) { return l.lens; }).join(', ') +
              ' converge on the same signal &mdash; the high-conviction warning configuration. ' +
              'In retrospective testing, convergent multi-lens signals preceded the most significant ' +
              'adverse outcomes.';
      watchItems.push('Monitor for accelerating deterioration in any single lens.');
      watchItems.push('Cross-check with insider transaction patterns when available.');

    // Two lenses agree on stress, one disagrees
    } else if (stress.length === 2) {
      var convergingNames = stress.map(function (l) { return l.lens; });
      var nonStress = available.filter(function (l) { return l.flag !== 'stress'; });
      verdict = '\u25CB Partial Convergence';
      vColor = 'var(--amber)';
      var nonStressDesc = nonStress.length > 0
        ? nonStress[0].lens + ' (' + nonStress[0].label.toLowerCase() + ')'
        : 'remaining lenses';
      prose = convergingNames.join(' and ') + ' both indicate stress; ' + nonStressDesc +
              ' does not confirm. The signal is real but not yet fully corroborated. ' +
              tailoredPartialProse(stress);
      watchItems.push('Whether the non-confirming lens crosses into stress in subsequent observations.');

    // Single stress lens
    } else if (stress.length === 1) {
      var singleLens = stress[0];
      verdict = '\u25CB ' + singleLens.lens + ' Flag Only';
      vColor = 'var(--amber)';
      prose = singleLens.lens + ' shows ' + singleLens.label.toLowerCase() +
              ' (' + singleLens.note.toLowerCase().replace(/\.$/, '') + '), ' +
              'but the other lenses are clean. ' +
              tailoredSingleProse(singleLens, contextHint);
      watchItems.push('Whether a second lens begins to confirm in the next 1-2 observations.');

    // All clean / strong, no stress
    } else if (strong.length >= 2 && stress.length === 0) {
      verdict = '\u2713 Clean Across Lenses';
      vColor = 'var(--green)';
      prose = 'No lens flags structural stress, manipulation pattern, or fundamental weakness. ';
      if (strong.length === 3) {
        prose += 'All three lenses (' + lenses.map(function (l) { return l.lens; }).join(', ') +
                 ') actively confirm a healthy profile.';
      } else {
        prose += strong.map(function (l) { return l.lens; }).join(' and ') +
                 ' both indicate a clean profile; remaining lenses do not contradict.';
      }
      watchItems.push('No active signal &mdash; routine monitoring sufficient.');

    // Mixed / insufficient
    } else {
      verdict = '\u25CB Mixed / Insufficient Signal';
      vColor = 'var(--dim)';
      prose = 'Available lenses do not produce a coherent signal. ';
      if (available.length < 2) {
        prose += 'Insufficient data across multiple lenses to synthesize a multi-perspective read. ' +
                 'Try a longer analysis window, or load a historical demo for a fully-populated example.';
      } else {
        prose += 'Lenses show mixed signals without strong stress or strong-health convergence. ' +
                 'The subject is in a transition zone &mdash; either lens could lead the next regime change.';
      }
      watchItems.push('Direction of the lens currently in transition.');
    }

    // Apply context-based watchItem overrides
    if (contextHint && contextWatchItemOverrides[contextHint]) {
      watchItems = contextWatchItemOverrides[contextHint](watchItems, verdict);
    }

    return {
      verdict: verdict,
      color: vColor,
      prose: prose,
      lenses: lenses,
      watchItems: watchItems,
      convergenceCount: stress.length,
      availableCount: available.length
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // Helpers for tailored prose in specific synthesis cases
  // ─────────────────────────────────────────────────────────────────
  function tailoredPartialProse(stressLenses) {
    var names = stressLenses.map(function (l) { return l.lens; });
    // Domain-aware enrichment: callers can register tailored prose via
    // SkepticEngine.registerPartialNarrative(['Lens A','Lens B'], fn)
    var key = names.sort().join('|');
    if (partialNarratives[key]) return partialNarratives[key](stressLenses);
    return 'When two lenses agree, the signal warrants close monitoring; the third lens may lag.';
  }

  function tailoredSingleProse(lens, contextHint) {
    // Caller-registered tailoring takes priority
    if (singleLensNarratives[lens.lens]) {
      return singleLensNarratives[lens.lens](lens, contextHint);
    }
    return 'Single-lens flags are common in transient conditions and frequently do not indicate ' +
           'underlying issues. Monitor whether other lenses begin to confirm.';
  }

  // ─────────────────────────────────────────────────────────────────
  // Extension points: asset-class modules register narrative tailoring
  // ─────────────────────────────────────────────────────────────────
  var partialNarratives = {};
  var singleLensNarratives = {};
  var contextWatchItemOverrides = {};

  SkepticEngine.registerPartialNarrative = function (lensNamesArr, fn) {
    var key = lensNamesArr.slice().sort().join('|');
    partialNarratives[key] = fn;
  };

  SkepticEngine.registerSingleLensNarrative = function (lensName, fn) {
    singleLensNarratives[lensName] = fn;
  };

  SkepticEngine.registerContextHint = function (hintName, fn) {
    contextWatchItemOverrides[hintName] = fn;
  };

  // ─────────────────────────────────────────────────────────────────
  // Built-in equity-domain narrative registrations
  //   (consumers of this engine can override or extend.)
  // ─────────────────────────────────────────────────────────────────

  // Two-lens partial: ISC + Traditional both stress
  SkepticEngine.registerPartialNarrative(['ISC', 'Traditional'], function () {
    return 'When ISC and traditional metrics agree, the structural and accounting pictures align ' +
           '&mdash; even without a forensic flag, this configuration warrants close monitoring.';
  });

  // Two-lens partial: anything + Forensic
  SkepticEngine.registerPartialNarrative(['Forensic', 'ISC'], function () {
    return 'The forensic flag is the more specific signal; review the Forensic tab for which ' +
           'Beneish components are driving it.';
  });
  SkepticEngine.registerPartialNarrative(['Forensic', 'Traditional'], function () {
    return 'The forensic flag is the more specific signal; review the Forensic tab for which ' +
           'Beneish components are driving it.';
  });

  // Single-lens tailoring
  SkepticEngine.registerSingleLensNarrative('Forensic', function () {
    return 'Beneish was calibrated on more mature firms; high-growth companies trigger frequently ' +
           'without manipulation. Review the Forensic tab for component-level drivers.';
  });
  SkepticEngine.registerSingleLensNarrative('ISC', function () {
    return 'ISC variance can elevate during market regime shifts unrelated to firm fundamentals. ' +
           'Monitor whether traditional metrics begin to confirm.';
  });

  // Biotech context override: replace generic watchItems with sector-canonical ones
  SkepticEngine.registerContextHint('biotech', function () {
    return [
      'Cash runway &mdash; quarters of operating cash at current burn rate.',
      'Clinical trial milestones (Phase II/III readouts, FDA action dates).',
      'Dilution risk &mdash; recent equity issuance or convertible activity.'
    ];
  });

  // ─────────────────────────────────────────────────────────────────
  // Helpers for lens authors: standard label/color generators
  //   (so equity, options, FX modules don't reinvent these.)
  // ─────────────────────────────────────────────────────────────────
  SkepticEngine.helpers = {
    // Count-based binary scoring → flag + label.
    // Used by lenses where you tally how many sub-indicators are stress/strong.
    classifyCount: function (stressCount, strongCount, total) {
      if (total === 0) {
        return { flag: 'insufficient', label: 'Insufficient', color: 'var(--dim)' };
      }
      if (stressCount >= 2 && stressCount > strongCount) {
        return { flag: 'stress', label: 'Stress', color: 'var(--red)' };
      }
      if (strongCount >= 3 && strongCount > stressCount) {
        return { flag: 'strong', label: 'Strong', color: 'var(--green)' };
      }
      if (stressCount >= 1 && strongCount >= 1) {
        return { flag: 'mixed', label: 'Mixed', color: 'var(--amber)' };
      }
      return { flag: 'clean', label: 'Clean', color: 'var(--green)' };
    },

    // Threshold-based scoring → flag for a single value.
    classifyThreshold: function (value, stressCutoff, strongCutoff, opts) {
      opts = opts || {};
      var direction = opts.higherIsBetter !== false ? 'higher' : 'lower';
      if (value == null) return { flag: 'insufficient', color: 'var(--dim)' };
      var isStress, isStrong;
      if (direction === 'higher') {
        isStress = value < stressCutoff;
        isStrong = value > strongCutoff;
      } else {
        isStress = value > stressCutoff;
        isStrong = value < strongCutoff;
      }
      if (isStress) return { flag: 'stress', color: 'var(--red)' };
      if (isStrong) return { flag: 'strong', color: 'var(--green)' };
      return { flag: 'clean', color: 'var(--amber)' };  // middle is "watch" but flag-wise neutral
    }
  };

  // Expose
  global.SkepticEngine = SkepticEngine;
})(typeof window !== 'undefined' ? window : this);


/* ─────────────────────────────────────────────────────────────────────
   EQUITY ADAPTER — the asset-class-specific lens functions
   ─────────────────────────────────────────────────────────────────────
   Translates the existing equity data shape (d.isc, d.traditional, etc.)
   into three lens results. Other asset classes will have their own
   adapter file: options-adapter.js, fx-adapter.js, etc.

   IMPORTANT: This adapter currently REPLICATES the logic from the
   existing computeSkepticRead() in index.html. Once both produce
   identical outputs, the inline copy can be removed and replaced with:

       var read = SkepticEngine.synthesize(EquityAdapter.makeLenses(d, r, C),
                                            { contextHint: d.sector_bucket });

   For testing during transition: compare outputs side-by-side.
   ───────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  var EquityAdapter = {};

  // Helper that mirrors gv() in the host file
  function gv(obj, k) {
    if (!obj || obj[k] == null) return null;
    var v = obj[k];
    return (typeof v === 'object' && 'val' in v) ? v.val : v;
  }

  // ─────────── LENS 1: ISC (variance EWS) ───────────
  EquityAdapter.iscLens = function (regime, C) {
    if (C == null || !regime) {
      return {
        lens: 'ISC',
        label: 'Insufficient',
        color: 'var(--dim)',
        flag: 'insufficient',
        note: 'No structural signal available.'
      };
    }
    var r = String(regime).toLowerCase();
    if (r.indexOf('distressed') !== -1 || r.indexOf('bifurcating') !== -1) {
      return { lens: 'ISC', label: 'Distressed', color: 'var(--red)', flag: 'stress',
               note: 'Variance ' + C.toFixed(3) + ' in distressed band.' };
    }
    if (r.indexOf('rising') !== -1) {
      return { lens: 'ISC', label: 'Rising', color: 'var(--amber)', flag: 'stress',
               note: 'Variance ' + C.toFixed(3) + ' with rising trajectory.' };
    }
    if (r.indexOf('elevated') !== -1 || r.indexOf('trans') !== -1) {
      return { lens: 'ISC', label: 'Elevated', color: 'var(--amber)', flag: 'stress',
               note: 'Variance ' + C.toFixed(3) + ' above stable baseline.' };
    }
    if (r.indexOf('stable') !== -1 || r.indexOf('regulated') !== -1) {
      return { lens: 'ISC', label: 'Stable', color: 'var(--green)', flag: 'clean',
               note: 'Variance ' + C.toFixed(3) + ' within stable range.' };
    }
    return { lens: 'ISC', label: 'Insufficient', color: 'var(--dim)', flag: 'insufficient',
             note: 'Unknown regime.' };
  };

  // ─────────── LENS 2: Traditional ───────────
  EquityAdapter.traditionalLens = function (d) {
    var TM = d.traditional || {}, IS = d.income_statement || {}, CF = d.cash_flow || {};
    var bucket = d.sector_bucket || 'industrial';
    var sm = d.sector_metrics || {};

    var altZ = gv(TM, 'altman_z'), piF = gv(TM, 'piotroski_f');
    var om = gv(TM, 'op_margin_pct'), rg = gv(IS, 'revenue_growth');
    var intCov = gv(TM, 'interest_coverage');
    var altZApplies = (bucket === 'industrial');

    var stress = 0, strong = 0, total = 0;
    if (altZApplies && altZ != null) {
      total++;
      if (altZ < 1.81) stress++;
      else if (altZ > 3.0) strong++;
    }
    if (piF != null && bucket !== 'biotech') {
      total++;
      if (piF < 4) stress++;
      else if (piF >= 7) strong++;
    }
    if (intCov != null && bucket === 'industrial') {
      total++;
      if (intCov < 1.5) stress++;
      else if (intCov > 5) strong++;
    }
    if (om != null && bucket === 'industrial') {
      total++;
      if (om < 0) stress++;
      else if (om > 15) strong++;
    }
    if (rg != null && bucket === 'industrial') {
      total++;
      if (rg < -5) stress++;
      else if (rg > 10) strong++;
    }

    // Sector-canonical signals
    if (bucket === 'bank') {
      if (sm.tier1_ratio != null) { total++; if (sm.tier1_ratio > 0.105) strong++; else if (sm.tier1_ratio < 0.08) stress++; }
      if (sm.efficiency_ratio != null) { total++; if (sm.efficiency_ratio < 0.60) strong++; else if (sm.efficiency_ratio > 0.70) stress++; }
      if (sm.net_interest_margin != null) { total++; if (sm.net_interest_margin > 0.03) strong++; else if (sm.net_interest_margin < 0.02) stress++; }
    } else if (bucket === 'insurance') {
      if (sm.combined_ratio != null) { total++; if (sm.combined_ratio < 1.0) strong++; else if (sm.combined_ratio > 1.05) stress++; }
      if (sm.loss_ratio != null) { total++; if (sm.loss_ratio < 0.65) strong++; else if (sm.loss_ratio > 0.75) stress++; }
    } else if (bucket === 'reit') {
      if (sm.ffo_ttm != null) { total++; if (sm.ffo_ttm > 0) strong++; else stress++; }
      if (sm.noi_yield != null) { total++; if (sm.noi_yield > 0.06) strong++; else if (sm.noi_yield < 0.03) stress++; }
    }

    if (total === 0) {
      return { lens: 'Traditional', label: 'Insufficient', color: 'var(--dim)',
               flag: 'insufficient', note: 'Core metrics unavailable.' };
    }

    // Severe-single-signal escalation
    var severeSingle = false, severeNote = '';
    if (altZApplies && altZ != null && altZ < 1.81) {
      severeSingle = true; severeNote = 'Altman Z ' + altZ.toFixed(2) + ' in distress zone';
    } else if (piF != null && piF <= 2 && bucket !== 'biotech') {
      severeSingle = true; severeNote = 'Piotroski F ' + piF + '/9 weak';
    } else if (bucket === 'industrial' && intCov != null && intCov < 0) {
      severeSingle = true; severeNote = 'Interest coverage negative';
    }

    if (stress >= 2 && stress > strong) {
      return { lens: 'Traditional', label: 'Stress', color: 'var(--red)', flag: 'stress',
               note: stress + ' of ' + total + ' core metrics in stress range.' };
    }
    if (severeSingle && stress >= strong) {
      return { lens: 'Traditional', label: 'Stress', color: 'var(--red)', flag: 'stress',
               note: 'Severe single signal: ' + severeNote + '.' };
    }
    if (strong >= 3 && strong > stress) {
      return { lens: 'Traditional', label: 'Strong', color: 'var(--green)', flag: 'strong',
               note: strong + ' of ' + total + ' core metrics in strong range.' };
    }
    if (stress >= 1 && strong >= 1) {
      return { lens: 'Traditional', label: 'Mixed', color: 'var(--amber)', flag: 'mixed',
               note: stress + ' stress, ' + strong + ' strong across ' + total + ' metrics.' };
    }
    if (total >= 2) {
      return { lens: 'Traditional', label: 'Clean', color: 'var(--green)', flag: 'clean',
               note: 'No core metric in stress range across ' + total + ' observed.' };
    }
    return { lens: 'Traditional', label: 'Insufficient', color: 'var(--dim)',
             flag: 'insufficient', note: 'Insufficient metric coverage.' };
  };

  // ─────────── LENS 3: Forensic (Beneish M-Score) ───────────
  EquityAdapter.forensicLens = function (d) {
    var bn = d.beneish;
    if (!bn) {
      return { lens: 'Forensic', label: 'Insufficient', color: 'var(--dim)',
               flag: 'insufficient', note: 'M-Score not computable.' };
    }
    if (bn.sector_eligible === false) {
      return { lens: 'Forensic', label: 'N/A', color: 'var(--dim)',
               flag: 'insufficient', note: 'Beneish not applicable to this sector.' };
    }
    if (bn.annual && bn.annual.m_score != null) {
      var m = bn.annual.m_score;
      if (bn.annual.flag_original === true) {
        return { lens: 'Forensic', label: 'Flagged', color: 'var(--red)', flag: 'stress',
                 note: 'M-Score ' + m.toFixed(2) + ' above Beneish 1999 threshold.' };
      }
      if (bn.annual.flag_strict === true) {
        return { lens: 'Forensic', label: 'Watch', color: 'var(--amber)', flag: 'stress',
                 note: 'M-Score ' + m.toFixed(2) + ' above strict (-2.22) threshold.' };
      }
      return { lens: 'Forensic', label: 'Clean', color: 'var(--green)', flag: 'clean',
               note: 'M-Score ' + m.toFixed(2) + ' within normal range.' };
    }
    return { lens: 'Forensic', label: 'Insufficient', color: 'var(--dim)',
             flag: 'insufficient', note: 'M-Score not computable.' };
  };

  // ─────────── Convenience: build all three lenses for an equity ───────────
  EquityAdapter.makeLenses = function (d, regime, C) {
    return [
      EquityAdapter.iscLens(regime, C),
      EquityAdapter.traditionalLens(d),
      EquityAdapter.forensicLens(d)
    ];
  };

  global.EquityAdapter = EquityAdapter;
})(typeof window !== 'undefined' ? window : this);
