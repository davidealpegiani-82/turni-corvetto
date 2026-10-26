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

    // Typed events make non-availability explicit. They are not automatically counted as work hours.
    const EVENT_TYPES = new Set(["ferie","rol","permesso-retribuito","permesso-non-retribuito","donazione-sangue","corso","visita-medica","pausa","recupero","altro"]);
    for (const ev of (Array.isArray(plan.events) ? plan.events : [])) {
      if (!ev || !ev.personId || !people.has(ev.personId) || !ev.day || !EVENT_TYPES.has(ev.type) || !timeRange(ev)) {
        blockers.push("Evento personale incompleto: servono persona, giorno, tipo riconosciuto e orari validi.");
        continue;
      }
      if (ev.type === "altro" && !(typeof ev.description === "string" && ev.description.trim())) {
        blockers.push("Evento di tipo altro: specificare una descrizione.");
      }
      const er = timeRange(ev), person = people.get(ev.personId);
      const conflicts = normalized.filter(x => x.person.id === ev.personId && x.assignment.day === ev.day &&
        overlaps(x.range.start, x.range.end, er.start, er.end));
      if (conflicts.length) blockers.push(person.name + " ha un turno assegnato durante l'evento " + ev.type +
        " (" + ev.start + "–" + ev.end + "); dividere il turno o correggere l'evento.");
      if (ev.type === "pausa" && ev.countsAsCoverage === true) {
        blockers.push("Una pausa non può essere conteggiata come copertura.");
      }
      if (ev.countsAsWorkHours === undefined) {
        warnings.push("Conteggio ore non configurato per l'evento " + ev.type + " di " + person.name +
          " (" + ev.day + " " + ev.start + "–" + ev.end + ").");
      }
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

    // Warehouse opening rule: if three or more workers are explicitly available,
    // require the configured minimum at every point of the opening window.
    for (const rule of (Array.isArray(plan.warehouseOpeningRules) ? plan.warehouseOpeningRules : [])) {
      const rr = rule && timeRange(rule);
      if (!rule || !rr || !rule.day || !Array.isArray(rule.availablePersonIds) ||
          !Number.isInteger(rule.minimumWhenThreeOrMore) || rule.minimumWhenThreeOrMore < 1) {
        blockers.push("Regola apertura magazzino incompleta o non valida.");
        continue;
      }
      const available = new Set(rule.availablePersonIds.filter(id => people.has(id)));
      if (available.size !== rule.availablePersonIds.length) {
        blockers.push("Regola apertura magazzino: uno o più ID disponibili non corrispondono a persone censite.");
        continue;
      }
      if (available.size < 3) continue;
      const boundaries = new Set([rr.start, rr.end]);
      normalized.forEach(x => {
        if (x.assignment.day === rule.day && x.assignment.department === "magazzino" &&
            available.has(x.person.id) && overlaps(x.range.start, x.range.end, rr.start, rr.end)) {
          boundaries.add(Math.max(rr.start, x.range.start));
          boundaries.add(Math.min(rr.end, x.range.end));
        }
      });
      const points = [...boundaries].sort((a,b)=>a-b);
      for (let i=0; i<points.length-1; i++) {
        const left=points[i], right=points[i+1];
        if (right<=left) continue;
        const count = normalized.filter(x => x.assignment.day===rule.day &&
          x.assignment.department==="magazzino" && available.has(x.person.id) &&
          x.range.start<=left && x.range.end>=right).length;
        if (count < rule.minimumWhenThreeOrMore) {
          blockers.push("Apertura magazzino sotto soglia: " + rule.day + " " +
            String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
            String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
            " ("+count+"/"+rule.minimumWhenThreeOrMore+" addetti disponibili assegnati).");
          break;
        }
      }
    }

    // Preferred pairs are a soft constraint: splitting one raises a review warning,
    // while explicitly required pairs above remain a hard blocker.
    for (const pair of (Array.isArray(plan.preferredPairs) ? plan.preferredPairs : [])) {
      if (!pair || !pair.day || !pair.start || !pair.end || !Array.isArray(pair.personIds) || pair.personIds.length !== 2) {
        blockers.push("Preferenza coppia magazzino incompleta o non valida.");
        continue;
      }
      const pr = timeRange(pair);
      if (!pr) { blockers.push("Orario della coppia preferenziale non valido."); continue; }
      const active = normalized.filter(x => x.assignment.day === pair.day &&
        x.assignment.department === "magazzino" &&
        overlaps(x.range.start, x.range.end, pr.start, pr.end) &&
        pair.personIds.includes(x.person.id));
      const present = new Set(active.map(x => x.person.id));
      if (present.size === 1) {
        const person = people.get([...present][0]);
        warnings.push("Coppia preferenziale separata: " + (person ? person.name : [...present][0]) +
          " lavora senza il compagno previsto il " + pair.day + " " + pair.start + "–" + pair.end + ". Verificare se Mario jolly può coprire prima di confermare.");
      }
    }

    // Explicit office coverage roles: opening and closing are separate windows, not just total headcount.
    for (const w of (Array.isArray(plan.officeCoverageWindows) ? plan.officeCoverageWindows : [])) {
      const wr = w && timeRange(w);
      if (!w || !wr || w.day !== "mercoledi" || !["apertura","chiusura"].includes(w.role) ||
          !Number.isInteger(w.minPeople) || w.minPeople < 1) {
        blockers.push("Finestra di copertura ufficio incompleta o non valida.");
        continue;
      }
      const covered = normalized.filter(x => x.assignment.day === w.day &&
        x.assignment.department === "ufficio" && x.range.start <= wr.start && x.range.end >= wr.end &&
        (!Array.isArray(x.assignment.roles) || x.assignment.roles.includes(w.role)));
      const eligible = covered.filter(x => OFFICE_WEDNESDAY_POOL.has(x.person.name));
      if (eligible.length < w.minPeople) {
        blockers.push("Copertura ufficio del mercoledì insufficiente (" + w.role + "): " +
          w.start + "–" + w.end + " (" + eligible.length + "/" + w.minPeople + ").");
      }
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
  // Conservative hour ledger: only explicit countsAsWorkHours flags are counted.
  // Missing payroll semantics stay unknown; overlaps invalidate totals to avoid double counting.
  function summarizeHours(plan, weeklyLimitMinutes = 2400) {
    if (!plan || !Array.isArray(plan.people) || !Array.isArray(plan.assignments) ||
        !Array.isArray(plan.events) || !Number.isFinite(weeklyLimitMinutes) || weeklyLimitMinutes < 0) {
      return { status: "BLOCKED", people: [], errors: ["Dati insufficienti per il riepilogo ore."] };
    }
    const people = new Map(plan.people.filter(p => p && p.id).map(p => [p.id, p]));
    const records = [];
    const errors = [];
    for (const a of plan.assignments) {
      const r = a && timeRange(a);
      if (!a || !people.has(a.personId) || !a.day || !r) {
        errors.push("Segmento turno non valido nel riepilogo ore.");
        continue;
      }
      records.push({ personId:a.personId, day:a.day, start:r.start, end:r.end,
        kind:"turno", flag:a.countsAsWorkHours });
    }
    for (const ev of plan.events) {
      const r = ev && timeRange(ev);
      if (!ev || !people.has(ev.personId) || !ev.day || !r) {
        errors.push("Evento non valido nel riepilogo ore.");
        continue;
      }
      records.push({ personId:ev.personId, day:ev.day, start:r.start, end:r.end,
        kind:"evento:" + (ev.type || "sconosciuto"), flag:ev.countsAsWorkHours });
    }
    const peopleRows = [];
    for (const [id, person] of people) {
      const mine = records.filter(r => r.personId === id);
      const unknown = mine.filter(r => typeof r.flag !== "boolean");
      const counted = mine.filter(r => r.flag === true);
      const overlapsFound = [];
      for (let i=0; i<mine.length; i++) for (let j=i+1; j<mine.length; j++) {
        if (mine[i].day === mine[j].day && overlaps(mine[i].start,mine[i].end,mine[j].start,mine[j].end)) {
          overlapsFound.push(mine[i].day + " " + mine[i].kind + " / " + mine[j].kind);
        }
      }
      const knownMinutes = counted.reduce((sum,r)=>sum+(r.end-r.start),0);
      const safeTotal = overlapsFound.length ? null : knownMinutes;
      peopleRows.push({ personId:id, name:person.name || id,
        knownWorkMinutes:safeTotal, knownWorkHours:safeTotal === null ? null : Math.round(safeTotal/60*100)/100,
        unknownRecordCount:unknown.length, unknownRecords:unknown.map(r=>({day:r.day,kind:r.kind,start:r.start,end:r.end})),
        overlaps:overlapsFound,
        overWeeklyLimit:safeTotal === null ? null : safeTotal > weeklyLimitMinutes,
        status:overlapsFound.length ? "BLOCKED_OVERLAP" : unknown.length ? "INCOMPLETE" :
          safeTotal > weeklyLimitMinutes ? "NEEDS_HR_REVIEW" : "COMPLETE"
      });
    }
    if (errors.length) return { status:"BLOCKED", people:peopleRows, errors };
    return { status: peopleRows.some(p=>p.status==="BLOCKED_OVERLAP") ? "BLOCKED" :
      peopleRows.some(p=>p.status==="INCOMPLETE" || p.status==="NEEDS_HR_REVIEW") ? "NEEDS_REVIEW" : "COMPLETE",
      weeklyLimitMinutes, people:peopleRows, errors:[] };
  }
  root.CorvettoEngine = Object.freeze({ validatePlan, rankReplacements, summarizeHours, minutes });
})(typeof window !== "undefined" ? window : globalThis);
