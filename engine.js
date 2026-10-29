/**
 * Corvetto Engine — Fase C
 * Policy ufficiale + facciata pubblica del motore.
 * La generazione resta in index.html ma è accessibile solo via API registrata.
 * Versione allineata ad APP_VERSION dell'app.
 */
(function (global) {
  'use strict';

const OFFICIAL_POLICY = {
    version: '2026-10-17',
    coverage: {
      minOpenOffice: 2,
      minCloseOffice: 1,
      // Target bilanciamento per n. presenti ufficio (Severin conta in apertura E chiusura se il suo orario copre entrambi)
      // 5+: 3 ap + 2 ch | 4: 2+2 | 3: 2+1 | 2: 1+1
      targetByPresent: {
        5: { open: 3, close: 2 },
        4: { open: 2, close: 2 },
        3: { open: 2, close: 1 },
        2: { open: 1, close: 1 }
      },
      preferMoreOpenWhenCloseOk: false, // preferisci bilanciare (es. 2+2) quando possibile
      lunchBand: { from: '12:00', to: '14:00' },
      lunchMinWorking: { slot12to13: 2, slot13to14: 2 },
      lunchStaggerWhen3: ['12:00', '12:30', '13:00'],
      lunchWhen2: { a: ['12:00','13:00'], b: ['13:00','14:00'] },
      conflictOpenAndClose: 'fixed_constraints_first' // Severin/manual prima
    },
    nastro: {
      nonSabatistaHours: 8,
      sabatistaHours: 7,
      sabatistaRole: 'apertura',
      saturdayAbsence: 'next_in_rotation',
      // Rotazione Lun–Ven (ufficio):
      // - sabatista settimana scorsa → apertura 8h 06:30–15:30
      // - chi sarà sabatista settimana prossima → chiusura 8h 08:30–17:30
      // - sabatista questa settimana → apertura 7h (nastro sabato)
      // Ciclo 3 settimane: A=7h+sabato, B=8h apertura 06:30-15:30, C=8h chiusura 08:30-17:30
      rotationCycle: ['A_sab7h_0630_1430_plus_sab', 'B_open8h_0630_1530', 'C_close8h_0830_1730'],
      rotationOrder: ['alpegiani', 'poppa', 'caregnato'],
      rotationAfterSabatista: 'apertura_8h_0630_1530',
      rotationBeforeNextSabatista: 'chiusura_8h_0830_1730'
    },
    severin: {
      shiftFixed: true,
      onlyPauseAdjustable: true,
      pauseMinutes: 30,
      pauseOptions: ['12:30-13:00', '13:00-13:30'],
      // Se già ≥2 ufficio in pausa 12:00–13:00 → pausa Severin automatica 13:00–13:30
      autoPause1300IfTwoOnBreak12: true,
      proposePauseMoveNotSilent: true
    },
    pauses: {
      minMinutesExceptSeverin: 60,
      defaultClose8h: ['13:00','14:00'],
      defaultOpen8h: ['12:00','13:00'],
      defaultSabatista: ['12:00','13:00'],
      open8hMovable: true,
      sabatistaFixed: true,
      afterCommitment: 'move_pause_after',
      fourPeoplePattern: 'two_12_13_two_13_14',
      ifMoveBreaksOpening: 'do_not_move_signal'
    },
    events: {
      insideShift: 'show_work_and_event_no_coverage',
      outsideShift: 'keep_shift_overtime_no_stretch',
      straddlingEnd: 'branch_until_event_start',
      overtimeAutoChange: 'only_if_coverage_safe',
      countsForMinCoverage: false,
      // Lezioni dalle settimane reali (es. W44):
      // - corso mattutino → non assegnare/ contare in apertura filiale
      // - trasferta pomeridiana → non assegnare in chiusura; cercare altro closer
      preferOpenWithoutMorningEvent: true,
      preferCloseWithoutAfternoonEvent: true
    },
    absences: {
      fullDayHours: 'nastro_of_day',
      partialDisplay: 'like_events',
      illnessOpenEnded: true,
      onChange: 'auto_recalc_with_message',
      generateMode: 'ask_user', // all / empty / non-manual
      weeklyTotalIncludesLeaveNastro: true
    },
    generation: {
      neverTouchManualEdit: true,
      candidateChoice: 'ask_once_clear',
      ifNoCleanSolution: 'complete_anyway_flag_coverage',
      magazziniereMonday: 'may_ask_twice'
    },
    // Schema Y + eccezione T1: Severin/manual intoccabili sempre
    priorities: [
      'nastro_e_rotazione',
      'coperture',
      'vincoli_fissi', // dopo nastro/coperture ma Severin/manual sono hard assoluti
      'pause',
      'assenze'
    ],
    hardAbsolute: ['severin_shift_fixed', 'manualEdit_never'],
    softMayBreakHard: {
      allowed: true,
      neverBreak: ['severin_shift_fixed', 'manualEdit_never'],
      mayBreak: ['coperture_minime', 'pause_preferenze']
    }
  };
global.OFFICIAL_POLICY = OFFICIAL_POLICY;


  const Engine = {
    version: '9.11.63',
    policyVersion: (OFFICIAL_POLICY && OFFICIAL_POLICY.version) || null,
    policy: OFFICIAL_POLICY,
    _api: null,

    /** Registra le funzioni implementate nell'app (dopo il parse di index.html). */
    register: function (api) {
      this._api = api || {};
      try {
        global.OFFICIAL_POLICY = OFFICIAL_POLICY;
      } catch (e) {}
      return this;
    },

    getApi: function () { return this._api || {}; },

    generate: function (options) {
      const api = this.getApi();
      if (typeof api.generateAutoProposal === 'function') return api.generateAutoProposal(options);
      throw new Error('Motore non registrato: generateAutoProposal assente');
    },

    finalize: function (week, notes, weekKey) {
      const api = this.getApi();
      if (typeof api.finalizeProposalWeek === 'function') return api.finalizeProposalWeek(week, notes, weekKey);
      throw new Error('Motore non registrato: finalizeProposalWeek assente');
    },

    verifyGaps: function (week) {
      const api = this.getApi();
      if (typeof api.getVerifiedCoverageGaps === 'function') return api.getVerifiedCoverageGaps(week);
      throw new Error('Motore non registrato: getVerifiedCoverageGaps assente');
    },

    hardViolations: function (proposal) {
      const api = this.getApi();
      if (typeof api.proposalHardViolations === 'function') return api.proposalHardViolations(proposal);
      return ['proposalHardViolations non disponibile'];
    },

    apply: function (options) {
      const api = this.getApi();
      if (typeof api.applyPendingProposal === 'function') return api.applyPendingProposal(options);
      throw new Error('Motore non registrato: applyPendingProposal assente');
    },

    /** Esegue i test già presenti in app e restituisce un report strutturato. */
    runSelfTests: function () {
      const report = {
        at: new Date().toISOString(),
        engineVersion: this.version,
        policyVersion: this.policyVersion,
        official: null,
        scenario: null,
        security: null,
        ok: true,
        fails: []
      };
      try {
        if (typeof global.runOfficialPolicyTests === 'function') {
          report.official = global.runOfficialPolicyTests();
          if (report.official && report.official.ok === false) {
            report.ok = false;
            (report.official.fails || []).forEach(function (f) { report.fails.push('policy: ' + f); });
          }
        } else {
          report.fails.push('runOfficialPolicyTests assente');
          report.ok = false;
        }
      } catch (e) {
        report.ok = false;
        report.fails.push('official: ' + (e && e.message ? e.message : e));
      }
      try {
        if (typeof global.runScenarioRulesTests === 'function') {
          report.scenario = global.runScenarioRulesTests();
          if (report.scenario && report.scenario.ok === false) {
            report.ok = false;
            (report.scenario.fails || []).forEach(function (f) { report.fails.push('scenario: ' + f); });
          }
        }
      } catch (e2) {
        report.fails.push('scenario: ' + (e2 && e2.message ? e2.message : e2));
      }
      try {
        if (typeof global.runSecurityRegressionTests === 'function') {
          report.security = global.runSecurityRegressionTests();
          if (Array.isArray(report.security)) {
            report.security.forEach(function (t) {
              if (t && t.pass === false) {
                report.ok = false;
                report.fails.push('security: ' + (t.name || '') + ' ' + (t.detail || ''));
              }
            });
          }
        }
      } catch (e3) {
        report.fails.push('security: ' + (e3 && e3.message ? e3.message : e3));
      }
      global.__engineTestReport = report;
      return report;
    }
  };

  global.CorvettoEngine = Engine;
  global.OFFICIAL_POLICY = OFFICIAL_POLICY;
})(typeof window !== 'undefined' ? window : globalThis);
