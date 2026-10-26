/* Corvetto One scheduling guardrails — isolated lab module.
 * This module validates a proposed plan; it does not generate or apply official shifts.
 * Missing evidence is a blocker, never an implicit approval.
 */
(function (root) {
  "use strict";
  const OFFICE_WEDNESDAY_POOL = new Set(["Davide Alpegiani", "Marco Caregnato", "Severin"]);
  const REQUIRED = ["people", "assignments", "coverageWindows"];

  const result = (status, blockers, warnings, details = {}) => ({
    status, safeToApply: status === "VALID", blockers, warnings, ...details
  });
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
  const minutes = value => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(":").map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  };
  const timeRange = item => {
    const start = minutes(item.start), end = minutes(item.end);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
  };

  function validatePlan(plan) {
    const blockers = [], warnings = [];
    if (!plan || typeof plan !== "object") return result("BLOCKED", ["Piano assente o non valido."], []);
    for (const key of REQUIRED) {
      if (!Array.isArray(plan[key])) blockers.push("Dato obbligatorio mancante o non valido: " + key + ".");
    }
    if (blockers.length) return result("BLOCKED", blockers, []);
    const people = new Map();
    for (const person of plan.people) {
      if (!person || !person.id || people.has(person.id)) {
        blockers.push("Profilo persona con ID mancante o duplicato.");
        continue;
      }
      people.set(person.id, person);
    }
    const byPerson = new Map();
    const normalized = [];
    for (const a of plan.assignments) {
      if (!a || !a.personId || !people.has(a.personId)) {
        blockers.push("Assegnazione senza persona valida: " + (a && a.id || "senza ID") + ".");
        continue;
      }
      const range = timeRange(a);
      if (!a.day || !range || !a.department) {
        blockers.push("Assegnazione incompleta (giorno, reparto o orario): " + (a.id || a.personId) + ".");
        continue;
      }
      const p = people.get(a.personId);
      if (a.department === "ufficio" && a.day === "mercoledi" && !OFFICE_WEDNESDAY_POOL.has(p.name)) {
        blockers.push(p.name + " non appartiene al gruppo ammesso per l'ufficio del mercoledì.");
      }
      if (a.requiredSkill) {
        if (!Array.isArray(p.skills)) blockers.push("Competenze non censite per " + p.name + ": " + a.requiredSkill + ".");
        else if (!p.skills.includes(a.requiredSkill)) blockers.push(p.name + " non risulta abilitato a: " + a.requiredSkill + ".");
      }
      if (Array.isArray(p.unavailable)) {
        for (const u of p.unavailable) {
          if (u.day === a.day) {
            const ur = timeRange(u);
            if (!ur) blockers.push("Indisponibilità con orario non valido per " + p.name + ".");
            else if (overlaps(range.start, range.end, ur.start, ur.end)) blockers.push(p.name + " assegnato durante un'indisponibilità (" + (u.reason || "motivo non specificato") + ").");
          }
        }
      } else {
        warnings.push("Indisponibilità non censite per " + p.name + ".");
      }
      const key = a.day + "|" + a.personId;
      const entries = byPerson.get(key) || [];
      for (const old of entries) {
        const oldRange = timeRange(old);
        if (oldRange && overlaps(range.start, range.end, oldRange.start, oldRange.end)) {
          blockers.push(p.name + " ha assegnazioni sovrapposte il " + a.day + ".");
        }
      }
      entries.push(a); byPerson.set(key, entries);
      normalized.push({ assignment: a, person: p, range });
    }

    // Pair integrity: only enforced where a pair is explicitly declared as required.
    const requiredPairs = Array.isArray(plan.requiredPairs) ? plan.requiredPairs : [];
    for (const pair of requiredPairs) {
      if (!pair || !pair.day || !pair.start || !pair.end || !Array.isArray(pair.personIds) || pair.personIds.length !== 2) {
        blockers.push("Regola coppia magazzino incompleta.");
        continue;
      }
      const pr = timeRange(pair);
      if (!pr) { blockers.push("Orario della coppia non valido."); continue; }
      const active = normalized.filter(x => x.assignment.day === pair.day &&
        x.assignment.department === "magazzino" &&
        overlaps(x.range.start, x.range.end, pr.start, pr.end) &&
        pair.personIds.includes(x.person.id));
      const present = new Set(active.map(x => x.person.id));
      if (present.size !== 2) blockers.push("Coppia richiesta non completa per " + pair.day + " " + pair.start + "–" + pair.end + ".");
    }

    // Every declared coverage window must be covered for its entire duration.
    for (const w of plan.coverageWindows) {
      const wr = w && timeRange(w);
      if (!w || !wr || !w.day || !w.department || !Number.isInteger(w.minPeople) || w.minPeople < 1) {
        blockers.push("Finestra di copertura incompleta o non valida.");
        continue;
      }
      const boundaries = new Set([wr.start, wr.end]);
      normalized.forEach(x => {
        if (x.assignment.day === w.day && x.assignment.department === w.department && overlaps(x.range.start, x.range.end, wr.start, wr.end)) {
          boundaries.add(Math.max(wr.start, x.range.start));
          boundaries.add(Math.min(wr.end, x.range.end));
        }
      });
      const points = [...boundaries].sort((a,b)=>a-b);
      for (let i=0; i<points.length-1; i++) {
        const left=points[i], right=points[i+1];
        if (right<=left) continue;
        const count = normalized.filter(x => x.assignment.day===w.day && x.assignment.department===w.department &&
          x.range.start<=left && x.range.end>=right).length;
        if (count < w.minPeople) {
          blockers.push("Copertura insufficiente: " + w.department + " " + w.day + " " +
            String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
            String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
            " ("+count+"/"+w.minPeople+" persone).");
          break;
        }
      }
    }
    // Skill-aware coverage windows: headcount alone is not proof of task coverage.
    for (const w of (Array.isArray(plan.skillCoverageWindows) ? plan.skillCoverageWindows : [])) {
      const wr = w && timeRange(w);
      if (!w || !wr || !w.day || !w.department || !w.requiredSkill ||
          !Number.isInteger(w.minPeople) || w.minPeople < 1) {
        blockers.push("Finestra di copertura per competenza incompleta o non valida.");
        continue;
      }
      const boundaries = new Set([wr.start, wr.end]);
      normalized.forEach(x => {
        if (x.assignment.day === w.day && x.assignment.department === w.department &&
            overlaps(x.range.start, x.range.end, wr.start, wr.end)) {
          boundaries.add(Math.max(wr.start, x.range.start));
          boundaries.add(Math.min(wr.end, x.range.end));
        }
      });
      const points = [...boundaries].sort((a,b)=>a-b);
      for (let i=0; i<points.length-1; i++) {
        const left=points[i], right=points[i+1];
        if (right<=left) continue;
        const qualified = normalized.filter(x =>
          x.assignment.day===w.day && x.assignment.department===w.department &&
          x.range.start<=left && x.range.end>=right &&
          Array.isArray(x.person.skills) && x.person.skills.includes(w.requiredSkill)).length;
        if (qualified < w.minPeople) {
          blockers.push("Competenza non coperta: " + w.requiredSkill + " in " + w.department + " " + w.day + " " +
            String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
            String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
            " ("+qualified+"/"+w.minPeople+" persone abilitate).");
          break;
        }
      }
    }

    const uniqueBlockers = [...new Set(blockers)];
    const uniqueWarnings = [...new Set(warnings)];
    return result(uniqueBlockers.length ? "BLOCKED" : uniqueWarnings.length ? "NEEDS_REVIEW" : "VALID",
      uniqueBlockers, uniqueWarnings, { checkedAssignments: normalized.length });
  }

  // Ranks possible replacements; never edits the plan. Unknown skills/availability fail closed.
  function rankReplacements({ people, day, start, end, department, requiredSkill, excludedIds = [], currentAssignments = [] }) {
    const startMin = minutes(start), endMin = minutes(end);
    if (!Array.isArray(people) || !day || !department || !Number.isFinite(startMin) ||
        !Number.isFinite(endMin) || endMin <= startMin) {
      return { status: "BLOCKED", candidates: [], reason: "Dati dello scenario incompleti." };
    }
    const excluded = new Set(excludedIds);
    const candidates = [];
    for (const p of people) {
      if (!p || !p.id || !p.name || excluded.has(p.id)) continue;
      if (requiredSkill && (!Array.isArray(p.skills) || !p.skills.includes(requiredSkill))) continue;
      if (!Array.isArray(p.unavailable)) continue; // unknown availability: do not recommend
      const blocked = p.unavailable.some(u => {
        if (u.day !== day) return false;
        const r = timeRange(u);
        return !r || overlaps(startMin, endMin, r.start, r.end);
      });
      if (blocked) continue;
      const collision = currentAssignments.some(a => a.personId === p.id && a.day === day && timeRange(a) &&
        overlaps(startMin, endMin, timeRange(a).start, timeRange(a).end));
      if (collision) continue;
      if (department === "ufficio" && day === "mercoledi" && !OFFICE_WEDNESDAY_POOL.has(p.name)) continue;
      candidates.push({ id: p.id, name: p.name, skills: p.skills, reason: "Disponibilità e requisiti noti compatibili; verificare impatto sul resto del piano." });
    }
    return { status: candidates.length ? "CANDIDATES_FOR_REVIEW" : "NO_VERIFIED_CANDIDATE",
      candidates, reason: candidates.length ? "Nessuna assegnazione automatica: confrontare copertura e vincoli globali." :
      "Nessun candidato verificato. Non inventare una sostituzione: dichiarare copertura impossibile o chiedere dati." };
  }
  root.CorvettoEngine = Object.freeze({ validatePlan, rankReplacements, minutes });
})(typeof window !== "undefined" ? window : globalThis);
